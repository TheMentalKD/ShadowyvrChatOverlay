const { autoUpdater } = require('electron-updater');

// Checked automatically on launch, then again on this interval for as long as the app stays
// open — an always-on overlay is exactly the kind of app that can sit running for a full,
// multi-hour stream without ever getting an update prompt otherwise.
const AUTO_CHECK_INITIAL_DELAY_MS = 8000;
const AUTO_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

let updateReady = false;
let checking = false;
let downloading = false;
// Whether the check currently in flight was user-initiated. Automatic background checks stay
// silent unless they find something actionable — nobody wants an unsolicited "you're up to
// date" banner every few hours — but a check the user explicitly asked for always reports back.
let lastCheckWasManual = true;

let sendToOverlay = null;
let refreshTrayMenu = null;
let getTray = null;

let initialCheckTimer = null;
let periodicCheckInterval = null;

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
    // Always shown, regardless of what triggered the check — this is the actionable
    // "update now or later?" prompt the automatic background checks exist to surface.
    sendToOverlay('update-available', { version: info.version });
    refreshTrayMenu(updateReady, autoUpdater);
  });

  autoUpdater.on('update-not-available', () => {
    if (lastCheckWasManual) sendToOverlay('update-not-available', {});
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
    if (lastCheckWasManual) sendToOverlay('update-error', {});
  });
}

async function checkForUpdate(overlaySender, { manual = true } = {}) {
  if (checking) return; // a check is already in flight (e.g. an automatic one) — don't overlap
  checking = true;
  lastCheckWasManual = manual;
  try {
    await Promise.race([
      autoUpdater.checkForUpdates(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
    ]);
  } catch {
    if (manual) overlaySender('update-error', {});
  } finally {
    checking = false;
  }
}

async function downloadUpdate(sendToOverlay) {
  downloading = true;
  try {
    await autoUpdater.downloadUpdate();
  } catch {
    sendToOverlay('update-error', {});
  } finally {
    downloading = false;
  }
}

function installUpdate() {
  autoUpdater.quitAndInstall(false, true);
}

// Call once at startup (packaged builds only). Does an initial silent check shortly after
// launch, then keeps rechecking on an interval — skipping any check while one is already in
// flight, a download is in progress, or an update is already downloaded and waiting to install.
function scheduleAutomaticChecks(overlaySender) {
  stopAutomaticChecks();
  const run = () => {
    if (checking || downloading || updateReady) return;
    checkForUpdate(overlaySender, { manual: false });
  };
  initialCheckTimer = setTimeout(() => {
    initialCheckTimer = null;
    run();
    periodicCheckInterval = setInterval(run, AUTO_CHECK_INTERVAL_MS);
  }, AUTO_CHECK_INITIAL_DELAY_MS);
}

function stopAutomaticChecks() {
  if (initialCheckTimer) { clearTimeout(initialCheckTimer); initialCheckTimer = null; }
  if (periodicCheckInterval) { clearInterval(periodicCheckInterval); periodicCheckInterval = null; }
}

module.exports = {
  init,
  isUpdateReady,
  setupAutoUpdater,
  checkForUpdate,
  downloadUpdate,
  installUpdate,
  scheduleAutomaticChecks,
  stopAutomaticChecks,
};
