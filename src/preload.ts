import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config: unknown) => ipcRenderer.invoke('save-config', config),
  openSettings: () => ipcRenderer.invoke('open-settings'),
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),
  setWindowBounds: (bounds: unknown) => ipcRenderer.invoke('set-window-bounds', bounds),
  startResizing: (edge: string) => ipcRenderer.send('start-resizing', edge),
  twitchConnect: (channel?: string) => ipcRenderer.invoke('twitch-connect', channel),
  twitchDisconnect: () => ipcRenderer.invoke('twitch-disconnect'),

  onConfigUpdate: (callback: (config: unknown) => void) => {
    ipcRenderer.on('config-update', (_event, config) => callback(config));
  },
  onChatMessage: (callback: (msg: unknown) => void) => {
    ipcRenderer.on('chat-message', (_event, msg) => callback(msg));
  },
  onChatStatus: (callback: (status: unknown) => void) => {
    ipcRenderer.on('chat-status', (_event, status) => callback(status));
  },
});
