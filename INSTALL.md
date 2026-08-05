# Installing Shadowyvr Chat Overlay

These instructions are for people downloading the ready-made installer — you don't need Node.js, npm, or anything from the repo.

## Windows

1. Download the installer (`Shadowyvr Chat Overlay Setup.exe`).
2. Run it. Windows SmartScreen may show a "Windows protected your PC" warning — this happens because the app isn't code-signed yet, not because anything's wrong. Click **More info → Run anyway**.
3. Follow the install prompts. The app will launch automatically when it's done.
4. If your antivirus flags it, that's a common false positive for unsigned Electron apps — you can whitelist it if needed.

## First launch — getting set up

1. The overlay window appears on your desktop (transparent, borderless). A settings icon (⚙) is available on the drag handle at the top — click it, or find the app in your system tray, to open **Settings**.
2. In **Settings → Twitch**, click **Login with Twitch** and authorize in your browser. This lets the overlay connect and (optionally) send messages as you.
3. Enter your **Twitch channel name** and/or your **YouTube live video ID** and **Kick chat room ID**, depending on which platforms you use.
4. Head to **Appearance** to set your font, colors, background, and opacity — these apply across all three platform tabs at once.
5. Add the overlay to OBS (or your capture software) as a **Window Capture** source if you want it in your stream, or leave **Hide from screen capture** off if you're relying on Display Capture to pick it up.
6. Click **Save & Apply**. Your settings are saved automatically from here on — no need to reconfigure on restart.

## Useful defaults

- **Toggle hotkey:** `F9` — shows/hides the overlay instantly (configurable in Settings).
- **Click-through:** off by default, so you can drag/resize the window; toggle it on once you've got it positioned so it stops intercepting your mouse.
- **Config file location** (if you ever need to reset or back it up):
  - Windows: `%APPDATA%\stream-chat-overlay\config.json`

## Uninstalling

- **Windows:** Settings → Apps → find "Shadowyvr Chat Overlay" → Uninstall.
- **macOS:** Drag the app from Applications to the Trash.

Your config file isn't removed automatically — delete it manually from the path above if you want a completely clean uninstall.
