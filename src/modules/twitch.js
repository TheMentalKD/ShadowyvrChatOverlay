const tmi = require('tmi.js');
const http = require('node:http');
const { BrowserWindow } = require('electron');
const WebSocketClient = require('ws');

const { fetchGlobalBadges, ensureChannelBadges, resolveBadgeUrls, resolveChannelInfo, roomIdToName, channelBadgeSets } = require('./badges.js');
const { ensureGlobalThirdPartyEmotes, ensureChannelThirdPartyEmotes, buildThirdPartyEmoteMap } = require('./emotes.js');

const TWITCH_CLIENT_ID    = 'tu4kmmhjwi5p8jzi3awoz0bqnivdj3';
const TWITCH_REDIRECT_PORT = 19813;
const TWITCH_REDIRECT_URI  = `http://localhost:${TWITCH_REDIRECT_PORT}/callback`;
const TWITCH_SCOPES        = 'chat:read chat:edit';

let twitchClient   = null;
let twitchConnected = false;
let eventSubWs      = null;
let eventSubSessionId = null;
let authServer      = null;

let getConfig    = null;
let saveConfig   = null;
let broadcastConfig = null;
let broadcastAuth   = null;
let sendToOverlay   = null;

function init(deps) {
  getConfig       = deps.getConfig;
  saveConfig      = deps.saveConfig;
  broadcastConfig = deps.broadcastConfig;
  broadcastAuth   = deps.broadcastAuth;
  sendToOverlay   = deps.sendToOverlay;
}

function isConnected() { return twitchConnected; }

function unescapeIrcTag(str) {
  if (!str) return str;
  return str
    .replaceAll(String.raw`\s`, ' ')
    .replaceAll(String.raw`\:`, ';')
    .replaceAll(String.raw`\r`, '\r')
    .replaceAll(String.raw`\n`, '\n')
    .replaceAll(String.raw`\\`, '\\');
}

const MODERATION_SLASH_COMMANDS = [
  '/shoutout', '/timeout', '/ban', '/unban', '/slow', '/subscribers', '/emoteonly', '/clear',
  '/mod', '/unmod', '/vip', '/commercial', '/host', '/unhost', '/raid', '/marker',
];

function isIgnoredBot(msgUsername, config) {
  if (!config.filterBots) return false;
  const botList = (config.ignoredBots || '').toLowerCase().split(/[,\s]+/).filter(Boolean);
  return botList.includes(msgUsername);
}

function isBlockedUser(msgUsername, config) {
  if (!config.blockedUsers) return false;
  const blocked = config.blockedUsers.toLowerCase().split(/[,\s]+/).filter(Boolean);
  return blocked.includes(msgUsername);
}

function isFilteredCommand(message, msgUsername, config) {
  if (!config.filterCommands || !message) return false;
  const isOwnMessage = config.twitchAuthUser && msgUsername === config.twitchAuthUser.toLowerCase();
  if (isOwnMessage) return false;

  const msgTrimmed = message.trim();
  if (msgTrimmed.startsWith('!')) return true;

  const msgLower = msgTrimmed.toLowerCase();
  return MODERATION_SLASH_COMMANDS.some(cmd => msgLower === cmd || msgLower.startsWith(cmd + ' '));
}

function applyMessageFilters(message, tags, config) {
  const msgUsername = (tags['display-name'] || tags.username || 'anon').toLowerCase();
  if (isIgnoredBot(msgUsername, config)) return false;
  if (isBlockedUser(msgUsername, config)) return false;
  if (isFilteredCommand(message, msgUsername, config)) return false;
  return true;
}

const SUB_PLAN_LABELS = { Prime: 'Twitch Prime', '2000': 'Tier 2', '3000': 'Tier 3' };
function subPlanLabel(planCode) {
  return SUB_PLAN_LABELS[planCode] || 'Tier 1';
}

async function connectTwitch(channel) {
  if (twitchClient) {
    try { await twitchClient.disconnect(); } catch {}
    twitchClient = null;
  }

  twitchConnected = false;
  channel = String(channel || '').trim().replace(/^#/, '').toLowerCase();
  if (!channel) return { ok: false, error: 'Enter a channel name' };
  // Twitch logins are alphanumeric + underscore only. Rejecting anything else here — before
  // it's ever used to build IRC channel names, Helix/GQL requests, or third-party emote API
  // URLs — closes off path/query injection into every one of those downstream requests at
  // the source, rather than needing each call site to sanitize it separately.
  if (!/^[a-z0-9_]{1,25}$/.test(channel)) {
    return { ok: false, error: 'Not a valid Twitch channel name' };
  }

  const config = getConfig();
  config.channel = channel;
  saveConfig(config);
  broadcastConfig();

  sendToOverlay('chat-status', { state: 'connecting', text: `Connecting to #${channel}…` });
  fetchGlobalBadges().catch(() => {});
  ensureGlobalThirdPartyEmotes().catch(() => {});
  ensureChannelThirdPartyEmotes(channel).catch(() => {});

  const clientOptions = {
    connection: { reconnect: true, secure: true },
    channels: [channel]
  };
  if (config.twitchAuthToken && config.twitchAuthUser) {
    clientOptions.identity = {
      username: config.twitchAuthUser,
      password: `oauth:${config.twitchAuthToken}`
    };
  }
  twitchClient = new tmi.Client(clientOptions);

  twitchClient.on('roomstate', (ch, state) => {
    const name = ch.replace('#', '').toLowerCase();
    if (state['room-id']) {
      roomIdToName.set(state['room-id'], name);
      ensureChannelBadges(state['room-id'], name).catch(() => {});
      resolveChannelInfo(state['room-id']).catch(() => {});
    }
  });

  twitchClient.on('connected', () => {
    twitchConnected = true;
    sendToOverlay('chat-status', { state: 'connected', text: `#${channel}` });
    sendToOverlay('chat-message', { username: 'System', text: `Connected to #${channel}`, isSystem: true });
    broadcastConfig();
  });

  let reconnectTimer = null;

  twitchClient.on('disconnected', (reason) => {
    twitchConnected = false;
    sendToOverlay('chat-status', { state: 'disconnected', text: 'Disconnected' });
    sendToOverlay('chat-message', { username: 'System', text: `Disconnected: ${reason || 'unknown'}`, isSystem: true });
    broadcastConfig();

    if (reason?.toLowerCase().includes('login authentication failed')) {
      const cfg = getConfig();
      cfg.twitchAuthToken = null;
      cfg.twitchAuthUser = null;
      saveConfig(cfg);
      sendToOverlay('chat-status', { state: 'disconnected', text: 'Auth expired — please log in again' });
      sendToOverlay('chat-message', { username: 'System', text: 'Your Twitch login has expired. Please log in again via Settings.', isSystem: true });
      broadcastConfig();
      return;
    }

    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(async () => {
      if (twitchConnected || !getConfig().channel) return;
      sendToOverlay('chat-status', { state: 'connecting', text: 'Reconnecting…' });
      try {
        if (twitchClient) {
          twitchClient.removeAllListeners();
          await twitchClient.disconnect().catch(() => {});
          twitchClient = null;
        }
        await connectTwitch(getConfig().channel);
      } catch {
        sendToOverlay('chat-status', { state: 'disconnected', text: 'Reconnect failed — click Reconnect to retry' });
      }
    }, 5000);
  });

  twitchClient.on('reconnect', () => {
    sendToOverlay('chat-status', { state: 'connecting', text: 'Reconnecting…' });
  });

  twitchClient.on('message', async (_ch, tags, message, self) => {
    if (self) return;
    const config = getConfig();
    if (!applyMessageFilters(message, tags, config)) return;

    const roomId = tags['room-id'];
    const sourceRoomId = tags['source-room-id'];
    const isSharedSource = !!(sourceRoomId && sourceRoomId !== roomId);
    const badgeRoomId = sourceRoomId || roomId;
    const badgeTag = tags['source-badges'] || tags.badges;

    let sourceChannel = null;
    let sourceChannelAvatar = null;

    if (isSharedSource) {
      const info = await resolveChannelInfo(sourceRoomId);
      sourceChannel = info?.login || roomIdToName.get(sourceRoomId) || null;
      sourceChannelAvatar = info?.profileImageURL || null;
      if (!channelBadgeSets.has(sourceRoomId)) await ensureChannelBadges(sourceRoomId, sourceChannel);
    } else if (badgeRoomId) {
      await ensureChannelBadges(badgeRoomId, roomIdToName.get(badgeRoomId));
    }

    if (!sourceChannel && roomId) {
      const info = await resolveChannelInfo(roomId);
      sourceChannel = info?.login || roomIdToName.get(roomId) || channel;
      sourceChannelAvatar = info?.profileImageURL || null;
    }

    sendToOverlay('chat-message', {
      messageId: tags.id || null,
      userId: tags['user-id'] || null,
      username: tags['display-name'] || tags.username || 'anon',
      text: message,
      color: tags.color || '#9147ff',
      sourceChannel,
      sourceChannelAvatar,
      isSharedSource,
      badges: resolveBadgeUrls(badgeTag, badgeRoomId),
      isMod: !!tags.mod || !!tags.badges?.moderator,
      isVip: !!tags.badges?.vip,
      replyTo: tags['reply-parent-msg-id'] ? {
        username: tags['reply-parent-display-name'] || tags['reply-parent-user-login'] || null,
        text: unescapeIrcTag(tags['reply-parent-msg-body']) || ''
      } : null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      emotes: tags.emotes || null,
      thirdPartyEmotes: buildThirdPartyEmoteMap(channel)
    });
  });

  twitchClient.on('messagedeleted', (_ch, _username, _msg, userstate) => {
    const messageId = userstate?.['target-msg-id'];
    if (messageId) sendToOverlay('twitch-message-deleted', { messageId });
  });

  twitchClient.on('timeout', (_ch, username, _reason, _duration, userstate) => {
    sendToOverlay('twitch-user-cleared', { username: (username || '').toLowerCase(), userId: userstate?.['target-user-id'] || null });
  });

  twitchClient.on('ban', (_ch, username, _reason, userstate) => {
    sendToOverlay('twitch-user-cleared', { username: (username || '').toLowerCase(), userId: userstate?.['target-user-id'] || null });
  });

  twitchClient.on('clearchat', () => sendToOverlay('twitch-chat-cleared', {}));

  twitchClient.on('notice', (_ch, _msgid, message) => {
    sendToOverlay('chat-message', { username: 'Notice', text: message, isSystem: true });
  });

  twitchClient.on('subscription', (_ch, username, method, message, tags) => {
    if (!getConfig().eventSubs) return;
    const plan = subPlanLabel(method?.plan);
    const msg = message ? ` — "${message}"` : '';
    sendToOverlay('chat-message', { username: tags?.['display-name'] || username, text: `just subscribed with ${plan}!${msg}`, isEvent: true, eventType: 'sub', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  });

  twitchClient.on('resub', (_ch, username, _months, message, tags, methods) => {
    if (!getConfig().eventSubs) return;
    const months = tags?.['msg-param-cumulative-months'] || _months || 0;
    const plan = subPlanLabel(methods?.plan);
    const msg = message ? ` — "${message}"` : '';
    sendToOverlay('chat-message', { username: tags?.['display-name'] || username, text: `resubscribed for ${months} months with ${plan}!${msg}`, isEvent: true, eventType: 'sub', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  });

  twitchClient.on('subgift', (_ch, username, _streakMonths, recipient, methods, tags) => {
    if (!getConfig().eventSubgifts) return;
    const plan = subPlanLabel(methods?.plan);
    sendToOverlay('chat-message', { username: tags?.['display-name'] || username, text: `gifted a ${plan} sub to ${recipient}!`, isEvent: true, eventType: 'subgift', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  });

  twitchClient.on('submysterygift', (_ch, username, giftCount, methods, tags) => {
    if (!getConfig().eventSubgifts) return;
    const plan = subPlanLabel(methods?.plan);
    sendToOverlay('chat-message', { username: tags?.['display-name'] || username, text: `gifted ${giftCount} ${plan} subs to the community!`, isEvent: true, eventType: 'subgift', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  });

  twitchClient.on('raided', (_ch, username, viewers, tags) => {
    if (!getConfig().eventRaids) return;
    sendToOverlay('chat-message', { username: tags?.['display-name'] || username, text: `is raiding with ${viewers} viewer${viewers !== 1 ? 's' : ''}!`, isEvent: true, eventType: 'raid', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  });

  twitchClient.on('cheer', (_ch, tags, message) => {
    if (!getConfig().eventCheers) return;
    const bits = tags?.bits || 0;
    sendToOverlay('chat-message', { username: tags?.['display-name'] || tags?.username || 'anonymous', text: `cheered ${bits} bit${bits !== 1 ? 's' : ''}! ${message || ''}`.trim(), isEvent: true, eventType: 'cheer', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  });

  try {
    await twitchClient.connect();
    connectEventSub(channel);
    return { ok: true, channel };
  } catch (err) {
    twitchConnected = false;
    sendToOverlay('chat-status', { state: 'disconnected', text: 'Connection failed' });
    sendToOverlay('chat-message', { username: 'System', text: `Failed to connect: ${err.message || err}`, isSystem: true });
    broadcastConfig();
    return { ok: false, error: err.message || String(err) };
  }
}

async function disconnectTwitch() {
  if (twitchClient) {
    try { await twitchClient.disconnect(); } catch {}
    twitchClient = null;
  }
  twitchConnected = false;
  disconnectEventSub();
  sendToOverlay('chat-status', { state: 'disconnected', text: 'Disconnected' });
  broadcastConfig();
  return { ok: true };
}

async function sendChatMessage(text) {
  if (!twitchClient || !twitchConnected) return { ok: false, error: 'Not connected' };
  const config = getConfig();
  if (!config.twitchAuthToken) return { ok: false, error: 'Not logged in' };
  if (!config.channel) return { ok: false, error: 'No channel' };
  try {
    await twitchClient.say(config.channel, text);
    sendToOverlay('chat-message', {
      username: config.twitchAuthUser || 'You',
      text,
      color: '#9147ff',
      badges: [],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSelf: true
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

function disconnectEventSub() {
  if (eventSubWs) {
    try { eventSubWs.close(); } catch {}
    eventSubWs = null;
  }
  eventSubSessionId = null;
}

async function fetchTwitchUserId(login, token) {
  try {
    const res = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': TWITCH_CLIENT_ID }
    });
    const json = await res.json();
    return json?.data?.[0]?.id || null;
  } catch { return null; }
}

async function subscribeEventSubFollow(broadcasterId, moderatorId, token) {
  try {
    await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': TWITCH_CLIENT_ID, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'channel.follow',
        version: '2',
        condition: { broadcaster_user_id: broadcasterId, moderator_user_id: moderatorId },
        transport: { method: 'websocket', session_id: eventSubSessionId }
      })
    });
  } catch {}
}

function connectEventSub(channel) {
  const config = getConfig();
  if (!config.eventFollows) return;
  if (!config.twitchAuthToken || !config.twitchAuthUser) return;
  disconnectEventSub();

  const ws = new WebSocketClient('wss://eventsub.wss.twitch.tv/ws');
  eventSubWs = ws;

  ws.on('message', async (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    const type = msg?.metadata?.message_type;

    if (type === 'session_welcome') {
      eventSubSessionId = msg.payload?.session?.id;
      const cfg = getConfig();
      const moderatorId = await fetchTwitchUserId(cfg.twitchAuthUser, cfg.twitchAuthToken);
      const broadcasterId = await fetchTwitchUserId(channel, cfg.twitchAuthToken);
      if (moderatorId && broadcasterId) {
        await subscribeEventSubFollow(broadcasterId, moderatorId, cfg.twitchAuthToken);
      }
    }

    if (type === 'notification' && msg?.metadata?.subscription_type === 'channel.follow' && getConfig().eventFollows) {
      const user = msg.payload?.event?.user_name || msg.payload?.event?.user_login || 'Someone';
      sendToOverlay('chat-message', { username: user, text: 'just followed the channel!', isEvent: true, eventType: 'follow', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    }
  });

  ws.on('error', () => {});
  ws.on('close', () => { eventSubWs = null; eventSubSessionId = null; });
}

function closeAuthServer() {
  if (authServer) { authServer.close(); authServer = null; }
}

function startAuthServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url, `http://localhost:${TWITCH_REDIRECT_PORT}`);

      if (reqUrl.pathname !== '/callback') {
        res.writeHead(404); res.end(); return;
      }

      if (reqUrl.searchParams.has('access_token') || reqUrl.searchParams.has('error')) {
        const token = reqUrl.searchParams.get('access_token');
        const error = reqUrl.searchParams.get('error_description') || reqUrl.searchParams.get('error');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html><html><head><script>
          window.close();
          setTimeout(function(){ document.getElementById('fallback').style.display = 'block'; }, 1200);
        </script></head><body style="font-family:sans-serif;text-align:center;margin-top:15%">
          <div id="fallback" style="display:none"><h2>${token ? 'Logged in — you can close this window.' : 'Login failed — you can close this window.'}</h2></div>
        </body></html>`);
        closeAuthServer();
        if (token) resolve({ ok: true, token });
        else resolve({ ok: false, error: error || 'No token received' });
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<html><body><script>var params = new URLSearchParams(window.location.hash.slice(1)); window.location.replace('/callback?' + params.toString());</script></body></html>`);
    });

    server.on('error', reject);
    server.listen(TWITCH_REDIRECT_PORT, '127.0.0.1', () => { authServer = server; });
  });
}

async function doTwitchLogin() {
  closeAuthServer();
  const authUrl =
    `https://id.twitch.tv/oauth2/authorize` +
    `?client_id=${TWITCH_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(TWITCH_REDIRECT_URI)}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent(TWITCH_SCOPES)}` +
    `&force_verify=true`;

  const authPromise = startAuthServer();

  const authWindow = new BrowserWindow({
    width: 500,
    height: 750,
    title: 'Shadowyvr Chat Overlay — Twitch Login',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const windowClosedPromise = new Promise(resolve => {
    authWindow.on('closed', () => resolve({ ok: false, error: 'Login window closed' }));
  });

  const timeout = new Promise(resolve => {
    setTimeout(() => resolve({ ok: false, error: 'Login timed out — please try again' }), 5 * 60 * 1000);
  });

  authWindow.loadURL(authUrl).catch(() => { authWindow.close(); });

  const result = await Promise.race([authPromise, windowClosedPromise, timeout]);

  closeAuthServer();
  if (!authWindow.isDestroyed()) authWindow.close();
  return result;
}

async function fetchTwitchUsername(token) {
  try {
    const res = await fetch('https://api.twitch.tv/helix/users', {
      headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': TWITCH_CLIENT_ID }
    });
    const json = await res.json();
    return json?.data?.[0]?.login || null;
  } catch { return null; }
}

async function twitchLoginFlow() {
  const result = await doTwitchLogin();
  if (!result.ok) return { ok: false, error: result.error };

  const username = await fetchTwitchUsername(result.token);
  if (!username) return { ok: false, error: 'Could not verify token' };

  const config = getConfig();
  config.twitchAuthToken = result.token;
  config.twitchAuthUser = username;
  saveConfig(config);
  broadcastConfig();
  broadcastAuth();

  if (config.channel) await connectTwitch(config.channel);
  return { ok: true, username };
}

async function twitchLogoutFlow() {
  const config = getConfig();
  config.twitchAuthToken = null;
  config.twitchAuthUser = null;
  saveConfig(config);
  broadcastConfig();
  broadcastAuth();
  if (twitchConnected) await disconnectTwitch();
  return { ok: true };
}

module.exports = {
  init,
  isConnected,
  connectTwitch,
  disconnectTwitch,
  sendChatMessage,
  connectEventSub,
  disconnectEventSub,
  twitchLoginFlow,
  twitchLogoutFlow,
};
