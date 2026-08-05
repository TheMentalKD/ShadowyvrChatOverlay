const TWITCH_GQL_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

const twitchUserIdCache = new Map();
const roomIdToName = new Map();
const channelInfoCache = new Map();
const channelInfoPending = new Map();
let globalBadgeSets = null;
const channelBadgeSets = new Map();
const channelBadgePending = new Map();

async function gqlRequest(query, variables = {}) {
  const res = await fetch('https://gql.twitch.tv/gql', {
    method: 'POST',
    headers: {
      'Client-ID': TWITCH_GQL_CLIENT_ID,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) throw new Error(`GQL HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message || 'GQL error');
  return json.data;
}

async function getTwitchUserId(login) {
  if (twitchUserIdCache.has(login)) return twitchUserIdCache.get(login);
  const data = await gqlRequest('query($login:String!){user(login:$login){id}}', { login });
  const id = data?.user?.id;
  if (id) twitchUserIdCache.set(login, id);
  return id;
}

function parseBadgesTag(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  const out = {};
  for (const part of String(raw).split(',')) {
    if (!part) continue;
    const [name, version] = part.split('/');
    if (name) out[name] = version || '1';
  }
  return out;
}

function indexBadgeList(list) {
  const sets = new Map();
  for (const badge of list || []) {
    const setId = badge.setID || badge.set_id;
    const version = String(badge.version ?? badge.id ?? '');
    const url = badge.imageURL || badge.image2x || badge.image_url_2x || badge.image_url_1x;
    if (!setId || !version || !url) continue;
    if (!sets.has(setId)) sets.set(setId, new Map());
    sets.get(setId).set(version, url);
  }
  return sets;
}

async function fetchGlobalBadges() {
  if (globalBadgeSets) return globalBadgeSets;
  try {
    const data = await gqlRequest('query { badges { setID version imageURL(size: DOUBLE) } }');
    globalBadgeSets = indexBadgeList(data?.badges);
    return globalBadgeSets;
  } catch {
    globalBadgeSets = new Map();
    return globalBadgeSets;
  }
}

async function ensureChannelBadges(roomId, loginHint) {
  if (!roomId || channelBadgeSets.has(roomId)) return channelBadgeSets.get(roomId);
  if (channelBadgePending.has(roomId)) return channelBadgePending.get(roomId);

  const pending = (async () => {
    try {
      const login = loginHint || roomIdToName.get(roomId);
      let badges = [];
      if (login) {
        const data = await gqlRequest(
          'query($login: String!) { user(login: $login) { broadcastBadges { setID version imageURL(size: DOUBLE) } } }',
          { login }
        );
        badges = data?.user?.broadcastBadges || [];
      } else {
        const data = await gqlRequest(
          'query($id: ID!) { user(id: $id) { broadcastBadges { setID version imageURL(size: DOUBLE) } } }',
          { id: String(roomId) }
        );
        badges = data?.user?.broadcastBadges || [];
      }
      const sets = indexBadgeList(badges);
      channelBadgeSets.set(roomId, sets);
      return sets;
    } catch {
      channelBadgeSets.set(roomId, new Map());
      return channelBadgeSets.get(roomId);
    } finally {
      channelBadgePending.delete(roomId);
    }
  })();

  channelBadgePending.set(roomId, pending);
  return pending;
}

function resolveBadgeUrls(badgesRaw, roomId) {
  const badges = parseBadgesTag(badgesRaw);
  const channelSets = (roomId && channelBadgeSets.get(roomId)) || new Map();
  const globalSets = globalBadgeSets || new Map();
  const urls = [];
  for (const [name, version] of Object.entries(badges)) {
    const ver = String(version);
    const url = channelSets.get(name)?.get(ver) || globalSets.get(name)?.get(ver);
    if (url) urls.push(url);
  }
  return urls;
}

async function resolveChannelInfo(roomId) {
  if (!roomId) return null;
  if (channelInfoCache.has(roomId)) return channelInfoCache.get(roomId);
  if (channelInfoPending.has(roomId)) return channelInfoPending.get(roomId);

  const pending = (async () => {
    try {
      const data = await gqlRequest(
        'query($id: ID!) { user(id: $id) { login displayName profileImageURL(width: 70) broadcastBadges { setID version imageURL(size: DOUBLE) } } }',
        { id: String(roomId) }
      );
      const user = data?.user;
      const info = user ? { login: user.login, displayName: user.displayName, profileImageURL: user.profileImageURL } : null;
      channelInfoCache.set(roomId, info);
      if (info?.login) roomIdToName.set(roomId, info.login.toLowerCase());
      if (user?.broadcastBadges && !channelBadgeSets.has(roomId)) {
        channelBadgeSets.set(roomId, indexBadgeList(user.broadcastBadges));
      }
      return info;
    } catch {
      channelInfoCache.set(roomId, null);
      return null;
    } finally {
      channelInfoPending.delete(roomId);
    }
  })();

  channelInfoPending.set(roomId, pending);
  return pending;
}

module.exports = {
  gqlRequest,
  getTwitchUserId,
  fetchGlobalBadges,
  ensureChannelBadges,
  resolveBadgeUrls,
  resolveChannelInfo,
  roomIdToName,
  channelBadgeSets,
};
