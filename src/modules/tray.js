const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');
const fs = require('fs');

let tray = null;

let getConfig = null;
let toggleOverlay = null;
let toggleClickThrough = null;
let createSettingsWindow = null;

function init(deps) {
  getConfig = deps.getConfig;
  toggleOverlay = deps.toggleOverlay;
  toggleClickThrough = deps.toggleClickThrough;
  createSettingsWindow = deps.createSettingsWindow;
}

function getTray() { return tray; }

function buildTrayMenu(updateReady, autoUpdater) {
  const config = getConfig();
  const items = [
    { label: 'Show / Hide Overlay', click: () => toggleOverlay(tray, () => buildTrayMenu(updateReady, autoUpdater)) },
    { label: config.clickThrough ? 'Click-Through: ON' : 'Click-Through: OFF', click: () => toggleClickThrough() },
    { label: 'Settings', click: () => createSettingsWindow() },
    { type: 'separator' },
  ];

  if (updateReady) {
    items.push({ label: '🔄 Install Update & Restart', click: () => autoUpdater.quitAndInstall(false, true) });
    items.push({ type: 'separator' });
  }

  items.push({ label: 'Quit', click: () => app.quit() });
  return Menu.buildFromTemplate(items);
}

function createTray(updateReady, autoUpdater) {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'icon.ico')
    : path.join(__dirname, '..', '..', 'assets', 'icon.ico');

  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  tray.setToolTip('Shadowyvr Chat Overlay');
  tray.setContextMenu(buildTrayMenu(updateReady, autoUpdater));
  tray.on('double-click', () => createSettingsWindow());
}

function refreshTrayMenu(updateReady, autoUpdater) {
  if (tray) tray.setContextMenu(buildTrayMenu(updateReady, autoUpdater));
}

function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

module.exports = { init, getTray, createTray, buildTrayMenu, refreshTrayMenu, destroyTray };
