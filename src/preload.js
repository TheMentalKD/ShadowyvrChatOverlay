const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  openSettings: () => ipcRenderer.invoke('open-settings'),
  toggleClickThrough: () => ipcRenderer.invoke('toggle-clickthrough'),
  openAbout: () => ipcRenderer.invoke('open-about'),
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),
  setWindowBounds: (bounds) => ipcRenderer.invoke('set-window-bounds', bounds),
  startResizing: (edge) => ipcRenderer.send('start-resizing', edge),
  stopResizing: () => ipcRenderer.send('stop-resizing'),
  twitchConnect: (channel) => ipcRenderer.invoke('twitch-connect', channel),
  twitchDisconnect: () => ipcRenderer.invoke('twitch-disconnect'),
  twitchLogin: () => ipcRenderer.invoke('twitch-login'),
  twitchLogout: () => ipcRenderer.invoke('twitch-logout'),
  sendChatMessage: (channel, text) => ipcRenderer.invoke('send-chat-message', channel, text),

  getVersion: () => ipcRenderer.invoke('get-version'),
  closeOverlay: () => ipcRenderer.send('close-overlay'),
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),

  onConfigUpdate: (callback) => {
    ipcRenderer.on('config-update', (_event, config) => callback(config));
  },
  onChatMessage: (callback) => {
    ipcRenderer.on('chat-message', (_event, msg) => callback(msg));
  },
  onMessageDeleted: (callback) => {
    ipcRenderer.on('twitch-message-deleted', (_event, data) => callback(data));
  },
  onUserCleared: (callback) => {
    ipcRenderer.on('twitch-user-cleared', (_event, data) => callback(data));
  },
  onChatCleared: (callback) => {
    ipcRenderer.on('twitch-chat-cleared', (_event, data) => callback(data));
  },
  onChatStatus: (callback) => {
    ipcRenderer.on('chat-status', (_event, status) => callback(status));
  },
  onAuthUpdate: (callback) => {
    ipcRenderer.on('auth-update', (_event, auth) => callback(auth));
  },
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (_event, info) => callback(info));
  },
  onUpdateNotAvailable: (callback) => {
    ipcRenderer.on('update-not-available', (_event) => callback());
  },
  onUpdateDownloadProgress: (callback) => {
    ipcRenderer.on('update-download-progress', (_event, info) => callback(info));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (_event, info) => callback(info));
  },
  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', (_event) => callback());
  },
});
