const { autoUpdater } = require('electron-updater');

let updateReady = false;

let sendToOverlay = null;
let refreshTrayMenu = null;
let getTray = null;

function init(deps) {
  sendToOverlay = deps.sendToOverlay;
  refreshTrayMenu = deps.refreshTrayMenu;
  getTray = deps.getTray;
}

function isUpdateReady() { return updateReady; }

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('update-available', (info) => {
    updateReady = false;
    sendToOverlay('update-available', { version: info.version });
    refreshTrayMenu(updateReady, autoUpdater);
  });

  autoUpdater.on('update-not-available', () => {
    sendToOverlay('update-not-available', {});
  });

  autoUpdater.on('download-progress', (progress) => {
    sendToOverlay('update-download-progress', { percent: Math.round(progress.percent) });
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateReady = true;
    sendToOverlay('update-downloaded', { version: info.version });
    refreshTrayMenu(updateReady, autoUpdater);
    const tray = getTray();
    if (tray) tray.setToolTip(`Shadowyvr Chat Overlay — Update ready: v${info.version}`);
  });

  autoUpdater.on('error', () => {
    sendToOverlay('update-error', {});
  });
}

async function checkForUpdate(sendToOverlay) {
  try {
    await Promise.race([
      autoUpdater.checkForUpdates(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
    ]);
  } catch {
    sendToOverlay('update-error', {});
  }
}

async function downloadUpdate(sendToOverlay) {
  try {
    await autoUpdater.downloadUpdate();
  } catch {
    sendToOverlay('update-error', {});
  }
}

function installUpdate() {
  autoUpdater.quitAndInstall(false, true);
}

module.exports = { init, isUpdateReady, setupAutoUpdater, checkForUpdate, downloadUpdate, installUpdate };
