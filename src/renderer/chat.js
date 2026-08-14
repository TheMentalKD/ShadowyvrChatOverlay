
let config = null;

// Every image src assigned below (avatars, badges, emotes) ultimately comes from a Twitch/7TV/
// BTTV/FFZ API response, not from something this process controls. Returns the parsed, re-
// serialized URL (never the original string) when it's a plain http(s) URL, or null otherwise —
// callers assign this return value to `.src`, not the input, so a malformed or unexpected
// response can never put a data:/javascript:/file: URI in an <img src>.
function safeImageUrl(url) {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

const channelColorMap = new Map();
const CHANNEL_COLORS = [
  '#e91e8c', '#1e91e9', '#e9811e', '#1ee97a',
  '#e9e01e', '#9b1ee9', '#1ee9d4', '#e94c1e'
];
let colorIndex = 0;

function getChannelColor(channelName) {
  if (!channelName) return '#9147ff';
  const key = channelName.toLowerCase();
  if (!channelColorMap.has(key)) {
    channelColorMap.set(key, CHANNEL_COLORS[colorIndex % CHANNEL_COLORS.length]);
    colorIndex++;
  }
  return channelColorMap.get(key);
}

const messagesEl   = document.getElementById('messages');
const statusDot    = document.getElementById('status-dot');
const statusText   = document.getElementById('status-text');
const emptyState   = document.getElementById('empty-state');
const chatContainer = document.getElementById('chat-container');
const settingsBtn  = document.getElementById('settings-btn');
const closeBtn     = document.getElementById('close-btn');
const closeBtnMenu = document.getElementById('close-btn-menu');
const connectBtn   = document.getElementById('connect-btn');
const reconnectPopover     = document.getElementById('reconnect-popover');
const reconnectInput       = document.getElementById('reconnect-channel-input');
const reconnectConfirmBtn  = document.getElementById('reconnect-confirm-btn');
const reconnectCancelBtn   = document.getElementById('reconnect-cancel-btn');
const updateBtn             = document.getElementById('update-btn');
const aboutBtn              = document.getElementById('about-btn');
const donateMenuBtn         = document.getElementById('donate-menu-btn');
const clickthroughToggleBtn = document.getElementById('clickthrough-toggle-btn');
const twitchLoginBtn  = document.getElementById('twitch-login-btn');
const twitchLogoutBtn = document.getElementById('twitch-logout-btn');
const loginBtnMain = document.getElementById('login-btn-main');
const openSettingsBtnMain = document.getElementById('open-settings-btn-main');


const updateBanner      = document.getElementById('update-banner');
const updateBannerText  = document.getElementById('update-banner-text');
const updateDownloadBtn = document.getElementById('update-download-btn');
const updateDismissBtn  = document.getElementById('update-dismiss-btn');

let updateBannerTimeout = null;
let updateState = 'idle';

updateBanner.style.display = 'none';

function showBanner(text, mode, autoClose) {
  if (updateBannerTimeout) {
    clearTimeout(updateBannerTimeout);
    updateBannerTimeout = null;
  }
  updateBannerText.textContent = text;
  updateState = mode;

  if (mode === 'available') {
    updateDownloadBtn.textContent = 'Update Now';
    updateDownloadBtn.style.display = 'block';
    updateDownloadBtn.disabled = false;
  } else if (mode === 'downloading') {
    updateDownloadBtn.textContent = 'Downloading...';
    updateDownloadBtn.style.display = 'block';
    updateDownloadBtn.disabled = true;
  } else if (mode === 'ready') {
    updateDownloadBtn.textContent = 'Restart & Install';
    updateDownloadBtn.style.display = 'block';
    updateDownloadBtn.disabled = false;
  } else {
    updateDownloadBtn.style.display = 'none';
  }

  updateBanner.style.display = 'flex';
  if (autoClose) {
    updateBannerTimeout = setTimeout(dismissBanner, 4000);
  }
}

function dismissBanner() {
  if (updateBannerTimeout) {
    clearTimeout(updateBannerTimeout);
    updateBannerTimeout = null;
  }
  updateBanner.style.display = 'none';
}

updateDownloadBtn.addEventListener('click', async () => {
  if (updateState === 'available') {
    showBanner('Downloading update...', 'downloading', false);
    await window.electronAPI.downloadUpdate();
  } else if (updateState === 'ready') {
    await window.electronAPI.installUpdate();
  }
});

updateDismissBtn.addEventListener('click', dismissBanner);

window.electronAPI.onUpdateAvailable((info) => {
  showBanner(`Version ${info.version} is available.`, 'available', false);
});

window.electronAPI.onUpdateNotAvailable(() => {
  showBanner('You are up to date.', 'info', true);
});

window.electronAPI.onUpdateDownloadProgress((info) => {
  showBanner(`Downloading update... ${info.percent}%`, 'downloading', false);
});

window.electronAPI.onUpdateDownloaded((info) => {
  updateState = 'ready';
  showBanner(`Version ${info.version} downloaded — restart to install.`, 'ready', false);
});

window.electronAPI.onUpdateError(() => {
  showBanner('Could not check for updates. Try again later.', 'info', true);
});
const emptyLoggedOut = document.getElementById('empty-logged-out');
const emptyNoChannel = document.getElementById('empty-no-channel');
const emptyUsernameEl = document.getElementById('empty-username');
const connectErrorEl = document.getElementById('connect-error');
const ctIndicator  = document.getElementById('clickthrough-indicator');
const chatInputBar = document.getElementById('chat-input-bar');
const chatInput    = document.getElementById('chat-input');
const chatSendBtn  = document.getElementById('chat-send-btn');

let authState = { authed: false, username: null };

function updateChatInputVisibility() {
  const shouldShow =
    authState.authed &&
    config?.twitchConnected &&
    (!config?.clickThrough || config?.showChatInput);
  chatInputBar.hidden = !shouldShow;
  if (messagesEl) {
    messagesEl.style.paddingBottom = shouldShow ? '0' : '';
  }
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';
  chatSendBtn.disabled = true;
  const result = await window.electronAPI.sendChatMessage(config?.channel, text);
  chatSendBtn.disabled = false;
  if (!result?.ok) {
    chatInput.style.borderColor = '#e74c3c';
    chatInput.placeholder = result?.error || 'Send failed';
    setTimeout(() => {
      chatInput.style.borderColor = '';
      chatInput.placeholder = 'Send a message…';
    }, 2000);
  }
  chatInput.focus();
}

chatSendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

let connecting = false;

settingsBtn.addEventListener('click', () => {
  closeAllMenus();
  window.electronAPI.openSettings();
});

closeBtn.addEventListener('click', () => {
  window.electronAPI.closeOverlay();
});

closeBtnMenu.addEventListener('click', () => {
  closeAllMenus();
  window.electronAPI.closeOverlay();
});

aboutBtn.addEventListener('click', () => {
  closeAllMenus();
  window.electronAPI.openAbout();
});

updateBtn.addEventListener('click', async () => {
  if (updateState === 'ready') {
    showBanner('Update is ready to install. Restart to apply it.', 'ready', false);
    return;
  }
  updateBtn.disabled = true;
  updateBtn.style.opacity = '0.5';
  updateBanner.style.display = 'none';
  await window.electronAPI.checkForUpdate();
});

clickthroughToggleBtn.addEventListener('click', () => {
  closeAllMenus();
  window.electronAPI.toggleClickThrough();
});

donateMenuBtn.addEventListener('click', () => {
  closeAllMenus();
  window.electronAPI.openExternal('https://ko-fi.com/V4T224ICAG');
});

twitchLoginBtn.addEventListener('click', async () => {
  closeAllMenus();
  if (authState.authed) return;
  connecting = true;
  showConnectError('');
  updateConnectButtons();
  const result = await window.electronAPI.twitchLogin();
  connecting = false;
  if (result && !result.ok) showConnectError(result.error || 'Login failed');
  updateConnectButtons();
});

twitchLogoutBtn.addEventListener('click', async () => {
  closeAllMenus();
  if (!authState.authed) return;
  await window.electronAPI.twitchLogout();
  updateConnectButtons();
});

function closeAllMenus() {
  document.querySelectorAll('.menu-dropdown.open').forEach(el => el.classList.remove('open'));
  document.querySelectorAll('.menu-item.open').forEach(el => el.classList.remove('open'));
}

document.querySelectorAll('.menu-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdownId = item.dataset.dropdown;
    const dropdown = dropdownId ? document.getElementById(dropdownId) : null;
    if (!dropdown) return;
    const wasOpen = item.classList.contains('open');
    closeAllMenus();
    if (!wasOpen) {
      const rect = item.getBoundingClientRect();
      dropdown.style.top = `${rect.bottom + 2}px`;
      dropdown.style.left = `${rect.left}px`;
      item.classList.add('open');
      dropdown.classList.add('open');
    }
  });
});

document.querySelectorAll('.menu-dropdown').forEach(dropdown => {
  dropdown.addEventListener('click', (e) => e.stopPropagation());
});

document.addEventListener('click', () => closeAllMenus());

window.electronAPI.getVersion().then((v) => {
  const el = document.getElementById('version-label');
  if (el) el.textContent = `v${v}`;
});

function showConnectError(msg) {
  if (!msg) {
    connectErrorEl.hidden = true;
    connectErrorEl.textContent = '';
    return;
  }
  connectErrorEl.hidden = false;
  connectErrorEl.textContent = msg;
}

function updateConnectButtons() {
  const authed = !!authState.authed;
  const connected = !!config?.twitchConnected;

  twitchLoginBtn.style.display = authed ? 'none' : '';
  twitchLogoutBtn.style.display = authed ? '' : 'none';

  if (!authed) {
    connectBtn.textContent = connecting ? '…' : 'Login';
    connectBtn.classList.remove('connected');
    connectBtn.disabled = connecting;
    return;
  }

  if (connected) {
    connectBtn.textContent = connecting ? '…' : 'Disconnect';
    connectBtn.classList.add('connected');
    connectBtn.disabled = connecting;
    return;
  }

  connectBtn.textContent = connecting ? 'Connecting…' : 'Reconnect';
  connectBtn.classList.remove('connected');
  connectBtn.disabled = connecting || !config?.channel;
}

function updateEmptyStateContent() {
  const authed = !!authState.authed;
  emptyLoggedOut.hidden = authed;
  emptyNoChannel.hidden = !authed || !!config?.channel;
  if (authed && emptyUsernameEl) emptyUsernameEl.textContent = authState.username || '';
}

async function handleConnectClick() {
  if (connecting) return;

  if (!authState.authed) {
    connecting = true;
    showConnectError('');
    updateConnectButtons();
    const result = await window.electronAPI.twitchLogin();
    connecting = false;
    if (result && !result.ok) {
      showConnectError(result.error || 'Login failed');
    }
    updateConnectButtons();
    return;
  }

  if (config?.twitchConnected) {
    connecting = true;
    updateConnectButtons();
    await window.electronAPI.twitchDisconnect();
    connecting = false;
    updateConnectButtons();
    return;
  }

  if (!config?.channel) {
    window.electronAPI.openSettings();
    return;
  }

  openReconnectPopover();
}

function closeReconnectPopover() {
  reconnectPopover.classList.remove('open');
  reconnectPopover.hidden = true;
}

function openReconnectPopover() {
  closeAllMenus();
  const anchor = document.getElementById('menu-file') || connectBtn;
  const rect = anchor.getBoundingClientRect();
  reconnectPopover.hidden = false;
  reconnectPopover.style.top = `${rect.bottom + 4}px`;
  reconnectPopover.style.left = `${rect.left}px`;
  reconnectPopover.classList.add('open');
  reconnectInput.value = config?.channel || '';
  reconnectInput.focus();
  reconnectInput.select();
}

async function submitReconnect() {
  const newChannel = reconnectInput.value.trim().replace('#', '');
  if (!newChannel) return;

  closeReconnectPopover();
  connecting = true;
  showConnectError('');
  updateConnectButtons();

  let result;
  if (newChannel !== config?.channel) {
    await window.electronAPI.saveConfig({ ...config, channel: newChannel });
  } else {
    result = await window.electronAPI.twitchConnect(newChannel);
  }

  connecting = false;
  if (result && !result.ok) {
    showConnectError(result.error || 'Connection failed');
  }
  updateConnectButtons();
}

reconnectConfirmBtn.addEventListener('click', submitReconnect);
reconnectCancelBtn.addEventListener('click', closeReconnectPopover);
reconnectInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitReconnect();
  if (e.key === 'Escape') closeReconnectPopover();
});
reconnectPopover.addEventListener('click', (e) => e.stopPropagation());
document.addEventListener('click', () => closeReconnectPopover());

connectBtn.addEventListener('click', handleConnectClick);
loginBtnMain.addEventListener('click', handleConnectClick);
openSettingsBtnMain.addEventListener('click', () => {
  window.electronAPI.openSettings();
});

function setStatus(state, text) {
  statusDot.className = `dot ${state}`;
  statusText.textContent = text;
}

function showEmptyState(show) {
  emptyState.style.display    = show ? 'flex' : 'none';
  chatContainer.style.display = show ? 'none' : 'flex';
  if (!show) chatContainer.style.flexDirection = 'column';
}

function scheduleFade(el) {
  const secs = Number(config?.messageFadeSeconds) || 0;
  if (secs <= 0) return;

  const fadeDurationMs = 500;
  const timer = setTimeout(() => {
    el.classList.add('fading');
    setTimeout(() => {
      el.remove();
    }, fadeDurationMs);
  }, secs * 1000);

  el._fadeTimer = timer;
}

function twitchEmoteUrl(emoteId) {
  return `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/default/dark/1.0`;
}

// tmi.js hands the `emotes` tag to us in one of two shapes depending on how the message
// arrived: an object of { emoteId: ['start-end', ...] } for regular IRC messages, or a
// "id:start-end,start-end/id:start-end" string for some event payloads.
function parseTwitchEmoteObj(obj) {
  const replacements = [];
  for (const [emoteId, positions] of Object.entries(obj)) {
    const url = twitchEmoteUrl(emoteId);
    for (const pos of positions) {
      const [start, end] = pos.split('-').map(Number);
      replacements.push({ start, end, url });
    }
  }
  return replacements;
}

function parseTwitchEmoteString(entries) {
  const replacements = [];
  for (const part of entries.split('/')) {
    const [emoteId, positions] = part.split(':');
    if (!positions) continue;
    const url = twitchEmoteUrl(emoteId);
    for (const pos of positions.split(',')) {
      const [start, end] = pos.split('-').map(Number);
      replacements.push({ start, end, url });
    }
  }
  return replacements;
}

function parseTwitchEmoteTag(emotesTag) {
  if (!emotesTag) return [];
  const replacements =
    typeof emotesTag === 'object' ? parseTwitchEmoteObj(emotesTag) : parseTwitchEmoteString(emotesTag);
  return replacements.sort((a, b) => a.start - b.start);
}

function findThirdPartyReplacements(text, thirdPartyEmotes, coveredChars) {
  const found = [];
  const wordRe = /\S+/g;
  let m;
  while ((m = wordRe.exec(text)) !== null) {
    const wordStart = m.index;
    const wordEnd = wordStart + m[0].length - 1;
    if (coveredChars.has(wordStart)) continue;
    const url = thirdPartyEmotes[m[0]];
    if (url) found.push({ start: wordStart, end: wordEnd, url });
  }
  return found;
}

function buildTextWithReplacements(text, replacements) {
  const frag = document.createDocumentFragment();
  let cursor = 0;
  for (const { start, end, url } of replacements) {
    if (start < cursor) continue;
    if (start > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, start)));

    const safeUrl = safeImageUrl(url);
    if (safeUrl) {
      const img = document.createElement('img');
      img.className = 'emote';
      img.src = safeUrl;
      img.alt = text.slice(start, end + 1);
      img.title = text.slice(start, end + 1);
      frag.appendChild(img);
    } else {
      frag.appendChild(document.createTextNode(text.slice(start, end + 1)));
    }
    cursor = end + 1;
  }
  if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)));
  return frag;
}

function renderMessageText(text, emotesTag, thirdPartyEmotes) {
  const twitchReplacements = parseTwitchEmoteTag(emotesTag);
  const hasThirdParty = thirdPartyEmotes && Object.keys(thirdPartyEmotes).length > 0;

  if (twitchReplacements.length === 0 && !hasThirdParty) {
    const frag = document.createDocumentFragment();
    frag.appendChild(document.createTextNode(text));
    return frag;
  }

  let allReplacements = twitchReplacements;
  if (hasThirdParty) {
    const twitchCoveredChars = new Set();
    for (const r of twitchReplacements) {
      for (let i = r.start; i <= r.end; i++) twitchCoveredChars.add(i);
    }
    allReplacements = [...twitchReplacements, ...findThirdPartyReplacements(text, thirdPartyEmotes, twitchCoveredChars)];
    allReplacements.sort((a, b) => a.start - b.start);
  }

  return buildTextWithReplacements(text, allReplacements);
}

const EVENT_ICONS = { sub: '⭐', subgift: '🎁', raid: '⚔️', cheer: '💜', follow: '❤️' };

function buildEventMessageBody({ eventType, username, text, timestamp }) {
  const body = document.createElement('div');
  body.className = 'message-body';
  const iconEl = document.createElement('span');
  iconEl.className = 'event-icon';
  iconEl.textContent = (EVENT_ICONS[eventType] || '📢') + ' ';
  const nameEl = document.createElement('span');
  nameEl.className = 'event-username';
  nameEl.textContent = username;
  const textEl = document.createElement('span');
  textEl.className = 'text';
  textEl.textContent = ' ' + text;
  body.appendChild(iconEl);
  body.appendChild(nameEl);
  body.appendChild(textEl);
  if (timestamp && config?.showTimestamps) {
    const ts = document.createElement('span');
    ts.className = 'timestamp';
    ts.textContent = timestamp;
    iconEl.before(ts);
  }
  return body;
}

function buildSystemMessageBody(text) {
  const body = document.createElement('div');
  body.className = 'message-body';
  const textEl = document.createElement('span');
  textEl.className = 'text';
  textEl.textContent = text;
  body.appendChild(textEl);
  return body;
}

function appendChatSourceRow(msg, { sourceChannel, isSharedSource, sourceChannelAvatar }) {
  if (!sourceChannel || config?.showSharedChat === false) return;
  const sourceRow = document.createElement('div');
  sourceRow.className = 'message-source';

  const safeAvatarUrl = isSharedSource && config?.showSharedChatAvatars !== false
    ? safeImageUrl(sourceChannelAvatar)
    : null;
  if (safeAvatarUrl) {
    const avatar = document.createElement('img');
    avatar.className = 'source-avatar';
    avatar.src = safeAvatarUrl;
    avatar.alt = '';
    avatar.referrerPolicy = 'no-referrer';
    sourceRow.appendChild(avatar);
  }

  const badge = document.createElement('span');
  badge.className = 'source-badge';
  badge.textContent = sourceChannel.replace('#', '');
  badge.style.background = getChannelColor(sourceChannel);
  sourceRow.appendChild(badge);
  msg.appendChild(sourceRow);
}

function appendChatReplyRow(msg, replyTo) {
  if (!replyTo || config?.showReplyThreads === false) return;
  const replyRow = document.createElement('div');
  replyRow.className = 'message-reply';
  const arrow = document.createElement('span');
  arrow.className = 'reply-arrow';
  arrow.textContent = '↳';
  const replyText = document.createElement('span');
  replyText.className = 'reply-text';
  const replyName = replyTo.username ? `@${replyTo.username}: ` : '';
  const replyBody = (replyTo.text || '').length > 80 ? `${replyTo.text.slice(0, 80)}…` : (replyTo.text || '');
  replyText.textContent = `${replyName}${replyBody}`;
  replyRow.appendChild(arrow);
  replyRow.appendChild(replyText);
  msg.appendChild(replyRow);
}

function appendChatBadges(body, badges) {
  if (config?.showBadges === false || !Array.isArray(badges) || !badges.length) return;
  const badgesEl = document.createElement('span');
  badgesEl.className = 'badges';
  for (const url of badges) {
    const safeUrl = safeImageUrl(url);
    if (!safeUrl) continue;
    const img = document.createElement('img');
    img.className = 'badge';
    img.src = safeUrl;
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    badgesEl.appendChild(img);
  }
  body.appendChild(badgesEl);
}

// Whether the mod/VIP/normal-viewer nameplate pill is shown for this specific message —
// pulled out of an inline nested ternary so each role's on/off setting is a plain, readable line.
function nameplateEnabledFor({ isMod, isVip }) {
  if (isMod) return config?.nameplateMod !== false;
  if (isVip) return config?.nameplateVip !== false;
  return config?.nameplateNormal !== false;
}

function appendChatUsername(body, { username, color, isMod, isVip }) {
  const user = document.createElement('span');
  user.className = 'username';
  user.textContent = username;

  const useNameplate = config?.showNameplates !== false && nameplateEnabledFor({ isMod, isVip });
  if (!useNameplate) {
    user.style.color = color || '#9147ff';
    body.appendChild(user);
    const colon = document.createElement('span');
    colon.className = 'colon';
    colon.textContent = ':';
    body.appendChild(colon);
    return;
  }

  const nameplate = document.createElement('span');
  nameplate.className = 'nameplate';
  nameplate.style.setProperty('--nameplate-color', color || '#9147ff');
  if (isMod) nameplate.classList.add('role-mod');
  else if (isVip) nameplate.classList.add('role-vip');
  nameplate.appendChild(user);
  body.appendChild(nameplate);
}

function buildChatMessageBody({ text, color, badges, isMod, isVip, timestamp, username, emotes, thirdPartyEmotes }) {
  const body = document.createElement('div');
  body.className = 'message-body';

  if (config?.showTimestamps && timestamp) {
    const ts = document.createElement('span');
    ts.className = 'timestamp';
    ts.textContent = timestamp;
    body.appendChild(ts);
  }

  appendChatBadges(body, badges);
  appendChatUsername(body, { username, color, isMod, isVip });

  const textEl = document.createElement('span');
  textEl.className = 'text';
  textEl.appendChild(renderMessageText(text, emotes, thirdPartyEmotes));
  body.appendChild(textEl);

  return body;
}

function trimToMaxMessages() {
  const max = config?.maxMessages ?? 100;
  while (messagesEl.children.length >= max) {
    const oldest = messagesEl.firstChild;
    if (oldest?._fadeTimer) clearTimeout(oldest._fadeTimer);
    oldest.remove();
  }
}

function messageClassName(isEvent, isSystem, eventType) {
  if (isEvent) return `message event event-${eventType || 'generic'}`;
  if (isSystem) return 'message system';
  return 'message';
}

function appendMessage({ messageId, userId, username, text, color, sourceChannel, sourceChannelAvatar, isSharedSource, badges, isMod, isVip, replyTo, timestamp, isSystem, isEvent, eventType, emotes, thirdPartyEmotes }) {
  if (!isSystem && !isEvent && isSharedSource && config?.showSharedChat === false) return;
  trimToMaxMessages();

  const msg = document.createElement('div');
  msg.className = messageClassName(isEvent, isSystem, eventType);
  if (!isSystem && !isEvent) {
    if (messageId) msg.dataset.messageId = messageId;
    if (userId) msg.dataset.userId = userId;
    if (username) msg.dataset.username = username.toLowerCase();
  }

  if (isEvent) {
    msg.appendChild(buildEventMessageBody({ eventType, username, text, timestamp }));
  } else if (isSystem) {
    msg.appendChild(buildSystemMessageBody(text));
  } else {
    appendChatSourceRow(msg, { sourceChannel, isSharedSource, sourceChannelAvatar });
    appendChatReplyRow(msg, replyTo);
    msg.appendChild(buildChatMessageBody({ text, color, badges, isMod, isVip, timestamp, username, emotes, thirdPartyEmotes }));
  }

  messagesEl.appendChild(msg);
  scheduleFade(msg);

  const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 80;
  if (nearBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
}

function applyConfig(cfg) {
  config = cfg;
  authState = { authed: !!cfg.twitchAuthed, username: cfg.twitchAuthUser || authState.username || null };

  document.documentElement.style.setProperty('--bg', cfg.theme.background);
  document.documentElement.style.setProperty('--text', cfg.theme.text);
  document.documentElement.style.setProperty('--timestamp', cfg.theme.timestamp);
  document.documentElement.style.setProperty('--self-channel', cfg.theme.selfChannel);
  document.documentElement.style.setProperty('--font-size', `${cfg.fontSize}px`);
  applyChatFont(cfg.fontFamily, cfg.fontSource);
  document.documentElement.style.setProperty('--bg-opacity', String(cfg.opacity ?? 0.9));
  document.body.style.opacity = '';
  const appEl = document.getElementById('app');
  if (appEl) appEl.style.opacity = '';
  document.body.classList.toggle('text-shadow', !!cfg.textShadow);
  document.documentElement.style.setProperty('--shadow-opacity', String(cfg.shadowOpacity ?? 0.9));
  document.body.classList.toggle('text-background', !!cfg.textBackground);
  document.documentElement.style.setProperty('--text-background-opacity', String(cfg.textBackgroundOpacity ?? 0.5));

  if (ctIndicator) {
    ctIndicator.classList.toggle('active', !!cfg.clickThrough);
  }
  document.body.classList.toggle('clickthrough', !!cfg.clickThrough);
  if (clickthroughToggleBtn) {
    clickthroughToggleBtn.textContent = cfg.clickThrough ? 'Click-Through: ON ✓' : 'Click-Through: OFF';
  }

  updateConnectButtons();
  updateEmptyStateContent();

  const hasLiveChat =
    (cfg.platforms.includes('twitch') && cfg.twitchConnected) ||
    (cfg.platforms.includes('youtube') && cfg.youtubeId) ||
    (cfg.platforms.includes('kick') && cfg.kickChannel);

  if (!hasLiveChat) {
    showEmptyState(true);
    if (!cfg.twitchConnected) {
      setStatus('disconnected', 'Not connected');
    }
  } else {
    showEmptyState(false);
  }

  updateChatInputVisibility();
}

window.electronAPI.onChatMessage((msg) => {
  appendMessage(msg);
});

function removeMessageEl(el) {
  if (el._fadeTimer) clearTimeout(el._fadeTimer);
  el.remove();
}

window.electronAPI.onMessageDeleted(({ messageId }) => {
  if (!messageId) return;
  const el = messagesEl.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
  if (el) removeMessageEl(el);
});

function userClearSelector(username, userId) {
  if (userId) return `[data-user-id="${CSS.escape(userId)}"]`;
  if (username) return `[data-username="${CSS.escape(username.toLowerCase())}"]`;
  return null;
}

window.electronAPI.onUserCleared(({ username, userId }) => {
  const selector = userClearSelector(username, userId);
  if (!selector) return;
  messagesEl.querySelectorAll(selector).forEach(removeMessageEl);
});

window.electronAPI.onChatCleared(() => {
  Array.from(messagesEl.children).forEach((el) => {
    if (el.classList.contains('system') || el.classList.contains('event')) return;
    removeMessageEl(el);
  });
});

window.electronAPI.onChatStatus((status) => {
  setStatus(status.state, status.text);
  if (status.state === 'connected') {
    showEmptyState(false);
    connecting = false;
    updateConnectButtons();
    updateChatInputVisibility();
  }
  if (status.state === 'connecting') {
    connecting = true;
    updateConnectButtons();
  }
  if (status.state === 'disconnected') {
    connecting = false;
    updateConnectButtons();
    updateChatInputVisibility();
    if (!config?.twitchConnected) showEmptyState(true);
  }
});

window.electronAPI.onConfigUpdate((cfg) => {
  applyConfig(cfg);
});

window.electronAPI.onAuthUpdate((auth) => {
  authState = auth;
  updateChatInputVisibility();
  updateConnectButtons();
  updateEmptyStateContent();
});

window.electronAPI.getConfig().then((cfg) => {
  applyConfig(cfg);
});

function updateDragRegion(clickThrough) {
  document.getElementById('app').style.webkitAppRegion = clickThrough ? 'no-drag' : 'drag';
  document.getElementById('messages').style.webkitAppRegion = 'no-drag';
  document.getElementById('chat-container').style.webkitAppRegion = 'no-drag';
  if (chatInputBar) chatInputBar.style.webkitAppRegion = 'no-drag';
}

window.electronAPI.onConfigUpdate((cfg) => {
  updateDragRegion(cfg.clickThrough);
});

window.electronAPI.getConfig().then((cfg) => {
  updateDragRegion(cfg.clickThrough);
});
