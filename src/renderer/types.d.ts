interface ElectronAPI {
  getConfig: () => Promise<any>;
  saveConfig: (config: any) => Promise<any>;
  openSettings: () => Promise<void>;
  getDisplays: () => Promise<any[]>;
  onConfigUpdate: (callback: (config: any) => void) => void;
  rendererReady: () => void;
}

interface Window {
  electronAPI: ElectronAPI;
}
