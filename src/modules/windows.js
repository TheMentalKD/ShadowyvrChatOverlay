const { BrowserWindow, app } = require('electron');
const path = require('path');

let mainWindow = null;
let settingsWindow = null;
let aboutWindow = null;

let getConfig = null;
let getPublicConfig = null;

function init(deps) {
  getConfig = deps.getConfig;
  getPublicConfig = deps.getPublicConfig;
}

function getMainWindow()     { return mainWindow; }
function getSettingsWindow() { return settingsWindow; }
function getAboutWindow()    { return aboutWindow; }

function sendToOverlay(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function broadcastToAll(channel, data) {
  sendToOverlay(channel, data);
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send(channel, data);
  }
}

function createMainWindow(connectTwitch) {
  const config = getConfig();

  mainWindow = new BrowserWindow({
    x: config.position.x,
    y: config.position.y,
    width: config.size.width,
    height: config.size.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    hasShadow: false,
    fullscreenable: false,
    focusable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: true,
      spellcheck: false,
      v8CacheOptions: 'bypassHeatCheck',
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.on('blur', () => applyOverlayLayering());

  mainWindow.on('moved', () => {
    if (!mainWindow) return;
    const [x, y] = mainWindow.getPosition();
    const cfg = getConfig();
    cfg.position = { x, y };
    mainWindow.webContents.send('_internal-save-position', { x, y });
  });

  mainWindow.on('resize', () => {
    if (!mainWindow) return;
    const [width, height] = mainWindow.getSize();
    mainWindow.webContents.send('_internal-save-size', { width, height });
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('config-update', getPublicConfig());
    const cfg = getConfig();
    mainWindow.webContents.send('auth-update', {
      authed: !!cfg.twitchAuthToken,
      username: cfg.twitchAuthUser || null
    });
    if (cfg.twitchAuthToken && cfg.channel) {
      connectTwitch(cfg.channel).catch(() => {});
    }
  });

  mainWindow.once('ready-to-show', () => {
    applyOverlayLayering();
    if (typeof mainWindow.showInactive === 'function') {
      mainWindow.showInactive();
    } else {
      mainWindow.show();
    }
    const cfg = getConfig();
    mainWindow.setContentProtection(!!cfg.hideFromCapture);
  });
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    if (typeof settingsWindow.moveTop === 'function') settingsWindow.moveTop();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 480,
    height: 720,
    title: 'Shadowyvr Chat Overlay — Settings',
    resizable: true,
    parent: mainWindow,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'settings.html'));
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.setAlwaysOnTop(true, 'screen-saver', 2);
  if (typeof settingsWindow.moveTop === 'function') settingsWindow.moveTop();
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

function createAboutWindow() {
  if (aboutWindow) { aboutWindow.focus(); return; }

  aboutWindow = new BrowserWindow({
    width: 340,
    height: 270,
    title: 'About Shadowyvr Chat Overlay',
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: mainWindow,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const version = app.getVersion();
  // Entirely author-controlled markup (no external or user input reaches this string), but it
  // still ships an inline <script> and <style>, so give it the same defense-in-depth CSP as the
  // other windows rather than leaving it as the one unprotected surface.
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<style>
  body { font-family: system-ui, sans-serif; background: #141414; color: #ccc; margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; gap: 8px; user-select: none; }
  h2 { color: #fff; margin: 0; font-size: 18px; }
  p { margin: 0; font-size: 12px; color: #888; }
  .version { font-size: 13px; color: #9147ff; }
  .donate-btn { margin-top: 14px; padding: 6px 16px; background: #9673f5; color: #fff; border: none; border-radius: 6px; font-size: 13px; font-family: inherit; cursor: pointer; }
  .donate-btn:hover { background: #7d55d4; }
</style></head><body>
  <h2>Shadowyvr Chat Overlay</h2>
  <span class="version">v${version}</span>
  <p>Stream chat overlay for Twitch, YouTube &amp; Kick.</p>
  <p style="margin-top:12px">by The Mental KD</p>
  <button class="donate-btn" id="donate-btn">❤ Support me on Ko-fi</button>
  <script>
    document.getElementById('donate-btn').addEventListener('click', () => {
      window.electronAPI.openExternal('https://ko-fi.com/V4T224ICAG');
    });
  </script>
</body></html>`;

  aboutWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  aboutWindow.setMenuBarVisibility(false);
  aboutWindow.on('closed', () => { aboutWindow = null; });
}

let layeringInterval = null;
let overlayVisible = true;

function applyOverlayLayering() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setFullScreenable(false);

  const childOpen =
    (settingsWindow && !settingsWindow.isDestroyed() && settingsWindow.isVisible()) ||
    (aboutWindow && !aboutWindow.isDestroyed() && aboutWindow.isVisible());

  if (!childOpen && typeof mainWindow.moveTop === 'function') {
    mainWindow.moveTop();
  }
}

function startLayeringInterval() {
  if (layeringInterval) return;
  layeringInterval = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed() && overlayVisible) {
      applyOverlayLayering();
    }
  }, 5000);
}

function stopLayeringInterval() {
  if (layeringInterval) {
    clearInterval(layeringInterval);
    layeringInterval = null;
  }
}

function toggleOverlay(tray, buildTrayMenu) {
  if (!mainWindow) return;
  overlayVisible = !overlayVisible;
  mainWindow.webContents.setBackgroundThrottling(!overlayVisible);
  if (overlayVisible) {
    applyClickThrough(getConfig().clickThrough, tray, buildTrayMenu);
    if (typeof mainWindow.showInactive === 'function') {
      mainWindow.showInactive();
    } else {
      mainWindow.show();
    }
  } else {
    mainWindow.hide();
  }
}

function applyClickThrough(enabled, tray, buildTrayMenu) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const on = !!enabled;
  mainWindow.setIgnoreMouseEvents(on, { forward: true });
  if (tray) {
    tray.setToolTip(`Shadowyvr Chat Overlay${on ? ' [Click-Through ON]' : ''}`);
    if (buildTrayMenu) tray.setContextMenu(buildTrayMenu());
  }
  applyOverlayLayering();
}

function applyHideFromCapture(enabled) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setContentProtection(!!enabled);
}

module.exports = {
  init,
  getMainWindow,
  getSettingsWindow,
  getAboutWindow,
  sendToOverlay,
  broadcastToAll,
  createMainWindow,
  createSettingsWindow,
  createAboutWindow,
  applyOverlayLayering,
  applyClickThrough,
  applyHideFromCapture,
  startLayeringInterval,
  stopLayeringInterval,
  toggleOverlay,
};
