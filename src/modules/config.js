const fs = require('node:fs');
const path = require('node:path');
const { app, safeStorage } = require('electron');

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

const DEFAULT_CONFIG = {
  channel: '',
  youtubeId: '',
  kickChannel: '',
  platforms: ['twitch'],
  clickThrough: false,
  hideFromCapture: false,
  opacity: 0.9,
  fontSize: 14,
  fontFamily: 'Inter',
  fontSource: 'google',
  theme: {
    background: 'rgba(0, 0, 0, 0.45)',
    text: '#ffffff',
    timestamp: '#888888',
    selfChannel: '#9147ff',
    channelColors: {}
  },
  toggleKey: 'F9',
  position: { x: 50, y: 100 },
  size: { width: 340, height: 600 },
  showTimestamps: true,
  maxMessages: 100,
  messageFadeSeconds: 0,
  textShadow: false,
  shadowOpacity: 0.9,
  textBackground: false,
  textBackgroundOpacity: 0.5,
  showBadges: true,
  showModVipHighlight: false,
  showNameplates: true,
  nameplateNormal: true,
  nameplateMod: true,
  nameplateVip: true,
  showReplyThreads: true,
  showSharedChatAvatars: true,
  showChatInput: false,
  eventSubs: true,
  eventSubgifts: true,
  eventRaids: true,
  eventCheers: true,
  eventFollows: false,
  twitchAuthToken: null,
  twitchAuthUser: null,
  filterCommands: true,
  filterBots: true,
  ignoredBots: '',
  blockedUsers: ''
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      delete parsed.twitchClientId;
      delete parsed.twitchAuth;
      delete parsed.twitchAuthTokenEnc;
      const merged = { ...DEFAULT_CONFIG, ...parsed };
      if (typeof merged.fontFamily === 'string' && merged.fontFamily.includes(',')) {
        merged.fontFamily = merged.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
      }
      if (!merged.fontSource) merged.fontSource = 'google';
      // The encrypted token can only be decrypted once safeStorage is available
      // (after app 'ready'), so auth is restored separately via restoreAuth().
      merged.twitchAuthToken = null;
      merged.twitchAuthUser = null;
      return merged;
    }
  } catch {}
  return { ...DEFAULT_CONFIG };
}

// Must be called after app.whenReady() — safeStorage.isEncryptionAvailable()
// is false (Windows/Linux) prior to that. Mutates and returns `config`.
function restoreAuth(config) {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return config;
    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    if (parsed.twitchAuthTokenEnc && safeStorage.isEncryptionAvailable()) {
      config.twitchAuthToken = safeStorage.decryptString(Buffer.from(parsed.twitchAuthTokenEnc, 'base64'));
      config.twitchAuthUser = parsed.twitchAuthUser || null;
    }
  } catch {}
  return config;
}

function saveConfig(config) {
  const out = { ...config };
  delete out.twitchAuthToken;
  if (config.twitchAuthToken && safeStorage.isEncryptionAvailable()) {
    out.twitchAuthTokenEnc = safeStorage.encryptString(config.twitchAuthToken).toString('base64');
  } else {
    delete out.twitchAuthTokenEnc;
    delete out.twitchAuthUser;
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(out, null, 2));
}

module.exports = { DEFAULT_CONFIG, loadConfig, saveConfig, restoreAuth };
