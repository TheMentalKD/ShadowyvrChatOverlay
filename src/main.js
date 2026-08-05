const { app, ipcMain, globalShortcut, screen, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');

app.setPath('userData', path.join(app.getPath('appData'), 'Shadowyvr Chat Overlay'));
fs.mkdirSync(app.getPath('userData'), { recursive: true });

const configModule  = require('./modules/config.js');
const windowModule  = require('./modules/windows.js');
const trayModule    = require('./modules/tray.js');
const updaterModule = require('./modules/updater.js');
const twitchModule  = require('./modules/twitch.js');

let config = configModule.loadConfig();

function getConfig()    { return config; }
function saveConfig(c)  { config = c; configModule.saveConfig(c); }

function getPublicConfig() {
  return {
    ...config,
    twitchConnected: twitchModule.isConnected(),
    twitchAuthToken: undefined,
    twitchAuthed: !!config.twitchAuthToken,
    twitchAuthUser: config.twitchAuthUser || null
  };
}

function broadcastConfig() {
  const pub = getPublicConfig();
  windowModule.broadcastToAll('config-update', pub);
}

function broadcastAuth() {
  const payload = { authed: !!config.twitchAuthToken, username: config.twitchAuthUser || null };
  windowModule.broadcastToAll('auth-update', payload);
}

windowModule.init({ getConfig, getPublicConfig });

trayModule.init({
  getConfig,
  toggleOverlay:      () => windowModule.toggleOverlay(trayModule.getTray(), () => trayModule.buildTrayMenu(updaterModule.isUpdateReady(), require('electron-updater').autoUpdater)),
  toggleClickThrough: () => toggleClickThrough(),
  createSettingsWindow: () => windowModule.createSettingsWindow(),
});

updaterModule.init({
  sendToOverlay:    windowModule.sendToOverlay,
  refreshTrayMenu:  (ready, au) => trayModule.refreshTrayMenu(ready, au),
  getTray:          trayModule.getTray,
});

twitchModule.init({
  getConfig,
  saveConfig,
  broadcastConfig,
  broadcastAuth,
  sendToOverlay: windowModule.sendToOverlay,
});

function toggleClickThrough() {
  config.clickThrough = !config.clickThrough;
  saveConfig(config);
  windowModule.applyClickThrough(config.clickThrough, trayModule.getTray(), () =>
    trayModule.buildTrayMenu(updaterModule.isUpdateReady(), require('electron-updater').autoUpdater)
  );
  broadcastConfig();
}

app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=128');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'local-fonts');
  });

  windowModule.createMainWindow(twitchModule.connectTwitch);
  trayModule.createTray(updaterModule.isUpdateReady(), require('electron-updater').autoUpdater);
  windowModule.startLayeringInterval();
  if (app.isPackaged) updaterModule.setupAutoUpdater();

  try {
    globalShortcut.register(config.toggleKey, toggleClickThrough);
  } catch {
    globalShortcut.register('F9', toggleClickThrough);
  }
});

app.on('second-instance', () => {
  const win = windowModule.getMainWindow();
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

app.on('will-quit', () => {
  windowModule.stopLayeringInterval();
  globalShortcut.unregisterAll();
  trayModule.destroyTray();
});

app.on('window-all-closed', () => app.quit());

ipcMain.on('_internal-save-position', (_e, pos) => {
  config.position = pos;
  configModule.saveConfig(config);
});
ipcMain.on('_internal-save-size', (_e, size) => {
  config.size = size;
  configModule.saveConfig(config);
});

ipcMain.handle('get-config', () => getPublicConfig());

ipcMain.handle('save-config', async (_event, newConfig) => {
  if (newConfig.toggleKey && newConfig.toggleKey !== config.toggleKey) {
    globalShortcut.unregisterAll();
    try { globalShortcut.register(newConfig.toggleKey, toggleClickThrough); }
    catch { globalShortcut.register('F9', toggleClickThrough); }
  }

  const previousChannel = config.channel;
  const { twitchConnected: _tc, ...safeConfig } = newConfig;
  config = { ...config, ...safeConfig };
  delete config.twitchClientId;
  delete config.twitchAuth;
  saveConfig(config);

  windowModule.applyClickThrough(config.clickThrough, trayModule.getTray(), () =>
    trayModule.buildTrayMenu(updaterModule.isUpdateReady(), require('electron-updater').autoUpdater)
  );
  windowModule.applyHideFromCapture(config.hideFromCapture);
  broadcastConfig();

  if (config.twitchAuthToken && config.channel && config.channel !== previousChannel) {
    twitchModule.connectTwitch(config.channel).catch(() => {});
  } else if (twitchModule.isConnected() && config.channel) {
    if (config.eventFollows) twitchModule.connectEventSub(config.channel);
    else twitchModule.disconnectEventSub();
  }

  return getPublicConfig();
});

ipcMain.handle('twitch-connect',      async (_e, channel) => twitchModule.connectTwitch(channel || config.channel));
ipcMain.handle('twitch-disconnect',   async () => twitchModule.disconnectTwitch());
ipcMain.handle('twitch-login',        async () => twitchModule.twitchLoginFlow());
ipcMain.handle('twitch-logout',       async () => twitchModule.twitchLogoutFlow());
ipcMain.handle('send-chat-message',   async (_e, _ch, text) => twitchModule.sendChatMessage(text));

ipcMain.handle('open-settings',       () => windowModule.createSettingsWindow());
ipcMain.handle('open-about',          () => windowModule.createAboutWindow());
ipcMain.handle('toggle-clickthrough', () => toggleClickThrough());

ipcMain.handle('get-displays', () =>
  screen.getAllDisplays().map(d => ({ id: d.id, bounds: d.bounds, label: `Display ${d.id} (${d.bounds.width}x${d.bounds.height})` }))
);

ipcMain.handle('get-window-bounds', () => {
  const win = windowModule.getMainWindow();
  return win ? win.getBounds() : {};
});

ipcMain.handle('set-window-bounds', (_e, bounds) => {
  const win = windowModule.getMainWindow();
  if (win) win.setBounds(bounds);
});

ipcMain.on('start-resizing', (_event, edge) => {
  const mainWindow = windowModule.getMainWindow();
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const pos    = mainWindow.getPosition();
  const size   = mainWindow.getSize();
  const cursor = screen.getCursorScreenPoint();
  let [x, y, w, h] = [pos[0], pos[1], size[0], size[1]];

  const interval = setInterval(() => {
    const p  = screen.getCursorScreenPoint();
    const dx = p.x - cursor.x;
    const dy = p.y - cursor.y;
    if (edge.includes('right'))  w = Math.max(200, size[0] + dx);
    if (edge.includes('bottom')) h = Math.max(100, size[1] + dy);
    if (edge.includes('left'))   { w = Math.max(200, size[0] - dx); x = pos[0] + dx; }
    if (edge.includes('top'))    { h = Math.max(100, size[1] - dy); y = pos[1] + dy; }
    mainWindow.setBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) });
  }, 16);

  ipcMain.once('stop-resizing', () => clearInterval(interval));
  setTimeout(() => clearInterval(interval), 5000);
});

ipcMain.on('stop-resizing', () => {});

ipcMain.handle('get-version', () => app.getVersion());

ipcMain.handle('open-external', (_e, url) => {
  const allowed = ['https://ko-fi.com', 'https://github.com'];
  if (allowed.some(prefix => url.startsWith(prefix))) shell.openExternal(url);
});

ipcMain.handle('check-for-update', () => updaterModule.checkForUpdate(windowModule.sendToOverlay));
ipcMain.handle('download-update',  () => updaterModule.downloadUpdate(windowModule.sendToOverlay));
ipcMain.handle('install-update',   () => updaterModule.installUpdate());

ipcMain.on('close-overlay', () => app.quit());
