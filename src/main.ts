import { app, BrowserWindow, ipcMain, globalShortcut, screen, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

interface Config {
  channel: string;
  youtubeId: string;
  kickChannel: string;
  platforms: ('twitch' | 'youtube' | 'kick')[];
  clickThrough: boolean;
  hideFromCapture: boolean;
  opacity: number;
  fontSize: number;
  fontFamily: string;
  fontSource: 'google' | 'local';
  theme: {
    background: string;
    text: string;
    timestamp: string;
    selfChannel: string;
    channelColors: Record<string, string>;
  };
  toggleKey: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  showTimestamps: boolean;
  maxMessages: number;
  messageFadeSeconds: number;
  textShadow: boolean;
  showBadges: boolean;
  showSharedChatAvatars: boolean;
}

const DEFAULT_CONFIG: Config = {
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
  showBadges: true,
  showSharedChatAvatars: true
};

function loadConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch {
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(config: Config): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let config = loadConfig();
let overlayVisible = true;

function getPreloadPath(): string {
  const distPreload = path.join(__dirname, 'preload.js');
  const srcPreload = path.join(__dirname, '..', 'src', 'preload.js');
  return fs.existsSync(distPreload) ? distPreload : srcPreload;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    x: config.position.x,
    y: config.position.y,
    width: config.size.width,
    height: config.size.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    hasShadow: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../src/renderer/index.html'));
  mainWindow.setIgnoreMouseEvents(config.clickThrough, { forward: true });
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true);
  mainWindow.setContentProtection(config.hideFromCapture);

  mainWindow.on('moved', () => {
    if (!mainWindow) return;
    const [x, y] = mainWindow.getPosition();
    config.position = { x, y };
    saveConfig(config);
  });

  mainWindow.on('resize', () => {
    if (!mainWindow) return;
    const [width, height] = mainWindow.getSize();
    config.size = { width, height };
    saveConfig(config);
  });
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 480,
    height: 720,
    title: 'Stream Chat Overlay — Settings',
    resizable: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWindow.loadFile(path.join(__dirname, '../src/renderer/settings.html'));
  settingsWindow.setMenuBarVisibility(false);

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show / Hide Overlay',
      click: () => toggleOverlay()
    },
    {
      label: 'Settings',
      click: () => createSettingsWindow()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ]);

  tray.setToolTip('Stream Chat Overlay');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => createSettingsWindow());
}

function toggleOverlay() {
  if (!mainWindow) return;
  overlayVisible = !overlayVisible;
  if (overlayVisible) {
    mainWindow.show();
  } else {
    mainWindow.hide();
  }
}

app.whenReady().then(() => {
  createMainWindow();
  createTray();

  try {
    globalShortcut.register(config.toggleKey, toggleOverlay);
  } catch {
    globalShortcut.register('F9', toggleOverlay);
  }

  ipcMain.on('renderer-ready', (event) => {
    event.reply('config-update', config);
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});


ipcMain.handle('get-config', () => config);

ipcMain.handle('save-config', (_event, newConfig: Partial<Config>) => {
  if (newConfig.toggleKey && newConfig.toggleKey !== config.toggleKey) {
    globalShortcut.unregisterAll();
    try {
      globalShortcut.register(newConfig.toggleKey, toggleOverlay);
    } catch {
      globalShortcut.register('F9', toggleOverlay);
    }
  }

  config = { ...config, ...newConfig };
  saveConfig(config);

  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(config.clickThrough, { forward: true });
    mainWindow.setContentProtection(config.hideFromCapture);
  }

  mainWindow?.webContents.send('config-update', config);
  settingsWindow?.webContents.send('config-update', config);

  return config;
});

ipcMain.handle('open-settings', () => {
  createSettingsWindow();
});

ipcMain.handle('get-displays', () => {
  return screen.getAllDisplays().map(d => ({
    id: d.id,
    bounds: d.bounds,
    label: `Display ${d.id} (${d.bounds.width}x${d.bounds.height})`
  }));
});

ipcMain.on('start-resize', (_event, direction: string) => {
  if (!mainWindow) return;
  mainWindow.webContents.executeJavaScript('').catch(() => {});
});

ipcMain.on('window-move-start', () => {
});
