const { getTwitchUserId } = require('./badges.js');

let globalThirdPartyEmotes = null;
const channelThirdPartyEmotes = new Map();
const emoteMapCache = new Map();

async function safeFetch(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

async function fetch7TVGlobal() {
  const data = await safeFetch('https://7tv.io/v3/emote-sets/global');
  const map = new Map();
  for (const e of data?.emotes ?? []) {
    const file = e.data?.host?.files?.find(f => f.format === 'WEBP' && f.name === '1x.webp') || e.data?.host?.files?.[0];
    if (file) map.set(e.name, `https:${e.data.host.url}/${file.name}`);
  }
  return map;
}

async function fetch7TVChannel(login) {
  const user = await safeFetch(`https://7tv.io/v3/users/twitch/${encodeURIComponent(login)}`);
  const map = new Map();
  for (const e of user?.emote_set?.emotes ?? []) {
    const file = e.data?.host?.files?.find(f => f.format === 'WEBP' && f.name === '1x.webp') || e.data?.host?.files?.[0];
    if (file) map.set(e.name, `https:${e.data.host.url}/${file.name}`);
  }
  return map;
}

async function fetchBTTVGlobal() {
  const data = await safeFetch('https://api.betterttv.net/3/cached/emotes/global');
  const map = new Map();
  for (const e of data ?? []) {
    map.set(e.code, `https://cdn.betterttv.net/emote/${e.id}/1x`);
  }
  return map;
}

async function fetchBTTVChannel(login) {
  const userId = await getTwitchUserId(login);
  const data = await safeFetch(`https://api.betterttv.net/3/cached/users/twitch/${encodeURIComponent(userId)}`);
  const map = new Map();
  for (const e of [...(data?.channelEmotes ?? []), ...(data?.sharedEmotes ?? [])]) {
    map.set(e.code, `https://cdn.betterttv.net/emote/${e.id}/1x`);
  }
  return map;
}

async function fetchFFZGlobal() {
  const data = await safeFetch('https://api.frankerfacez.com/v1/set/global');
  const map = new Map();
  for (const set of Object.values(data?.sets ?? {})) {
    for (const e of set?.emoticons ?? []) {
      const url = e.urls?.['1'] || Object.values(e.urls ?? {})[0];
      if (url) map.set(e.name, url.startsWith('http') ? url : `https:${url}`);
    }
  }
  return map;
}

async function fetchFFZChannel(login) {
  const data = await safeFetch(`https://api.frankerfacez.com/v1/room/${encodeURIComponent(login)}`);
  const map = new Map();
  for (const set of Object.values(data?.sets ?? {})) {
    for (const e of set?.emoticons ?? []) {
      const url = e.urls?.['1'] || Object.values(e.urls ?? {})[0];
      if (url) map.set(e.name, url.startsWith('http') ? url : `https:${url}`);
    }
  }
  return map;
}

async function ensureGlobalThirdPartyEmotes() {
  if (globalThirdPartyEmotes) return globalThirdPartyEmotes;
  const map = new Map();
  await Promise.allSettled([
    fetch7TVGlobal().then(m => m.forEach((v, k) => map.set(k, v))),
    fetchBTTVGlobal().then(m => m.forEach((v, k) => map.set(k, v))),
    fetchFFZGlobal().then(m => m.forEach((v, k) => map.set(k, v))),
  ]);
  globalThirdPartyEmotes = map;
  invalidateEmoteCache();
  return map;
}

async function ensureChannelThirdPartyEmotes(login) {
  if (!login) return new Map();
  if (channelThirdPartyEmotes.has(login)) return channelThirdPartyEmotes.get(login);
  const map = new Map();
  await Promise.allSettled([
    fetch7TVChannel(login).then(m => m.forEach((v, k) => map.set(k, v))),
    fetchBTTVChannel(login).then(m => m.forEach((v, k) => map.set(k, v))),
    fetchFFZChannel(login).then(m => m.forEach((v, k) => map.set(k, v))),
  ]);
  channelThirdPartyEmotes.set(login, map);
  return map;
}

function buildThirdPartyEmoteMap(channelLogin) {
  const key = channelLogin || '__global__';
  if (emoteMapCache.has(key)) return emoteMapCache.get(key);
  const out = {};
  const global = globalThirdPartyEmotes || new Map();
  const chan = (channelLogin && channelThirdPartyEmotes.get(channelLogin)) || new Map();
  global.forEach((url, code) => { out[code] = url; });
  chan.forEach((url, code) => { out[code] = url; });
  emoteMapCache.set(key, out);
  return out;
}

function invalidateEmoteCache() {
  emoteMapCache.clear();
}

module.exports = {
  ensureGlobalThirdPartyEmotes,
  ensureChannelThirdPartyEmotes,
  buildThirdPartyEmoteMap,
  invalidateEmoteCache,
};
