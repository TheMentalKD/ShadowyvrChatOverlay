# Shadowyvr Chat Overlay

A transparent, always-on-top desktop chat overlay for streamers — built with Electron. Drop it on top of a game, OBS scene, or your desktop, and see your Twitch chat (YouTube and Kick coming) without tabbing away.

Any chat overlay requires the games to be 'WINDOWED FULLSCREEN' or 'BORDERLESS FULLSCREEN' for it to work sufficiently. This is a windows issue where the GPU draws anything fullscreen to the front of the screen and will conflict with the chat overlay if the graphics settings are fixed to 'FULLSCREEN'

## Why I built this

I am a streamer first and foremost. I've only recently started dabbling in javascript, Typescript, & Python. This application Shadowyvr Chat Overlay is something I set my mind in creating and building upon because of other streamer friends.
I have seen other chat overlays in the past, but those specific ones do not have the same features I originally had in mind, so I decided to make this one. The main feature I noticed with most overlays that I could find never had the shared chat option for Twitch, and that made things difficult for those who use the shared chat feature via Twitch. 

## Features

- **Twitch chat**, including Shared Chat (messages from other channels in a shared session show a source badge)
- **7TV and BetterTTV emotes** rendered inline
- **Moderation sync** — deleted messages, timeouts, and bans remove the relevant messages from the overlay automatically
- **Reply threads** — shows what a reply was responding to
- **Mod/VIP name highlighting** — optional colored background behind mod and VIP usernames
- **Channel event alerts** — subs, gifted subs, raids, cheers, follows
- **Fully custom appearance** — font, size, colors, background, opacity, shadow — shared across all platform tabs, set once
- **Click-through mode** — toggle so the overlay stops intercepting your mouse
- **Hide from screen capture** — exclude the overlay from OBS/Discord/Zoom capture while it stays visible to you
- **Chat filtering** — block bot commands, specific bots, or specific users
- **YouTube and Kick** — UI and appearance support are in, live chat connections are on the roadmap (see below)

## How it works

It's a standard two-window Electron app:

- **Main process** (`src/main.js`) owns the actual Twitch connection. It uses [`tmi.js`](https://github.com/tmijs/tmi.js) for IRC chat (messages, timeouts, bans, message deletion) and a Twitch EventSub WebSocket for channel events (subs, raids, cheers, follows) that don't come through chat. It also resolves Twitch badges, channel info, and third-party emote sets via the Twitch Helix and 7TV/BTTV APIs, and persists all settings to a local `config.json`.
- **Overlay window** (`src/renderer/chat.js`) is the transparent, click-through-capable window that actually renders messages. It receives everything from the main process over IPC — it never talks to Twitch directly.
- **Settings window** (`src/renderer/settings.js` + `settings.html`) is a separate window for configuring channels, appearance, and behavior. Appearance settings are duplicated across the Twitch/YouTube/Kick tabs in the UI but backed by one shared state, so changing your font or colors updates all three instantly rather than needing to be set per platform.

## Roadmap

Rough idea of what's next, no fixed order:

- Live YouTube and Kick chat connections
- FrankerFaceZ emote support (alongside existing 7TV/BTTV)
- Sub streak / cumulative months in resub messages
- Check for Update button for latest updates.

## Installation

Grab the latest installer from [Releases](../../releases) — see [`INSTALL.md`](./INSTALL.md) for setup steps.

To run from source instead:

```bash
npm install
npm run dev
```

## Config file location

Windows: `%APPDATA%\stream-chat-overlay\config.json`

## License

Source-available under a custom license — free for personal, non-commercial use and modification. Commercial use, resale, or redistribution as your own product requires permission. See LICENSE.md for full terms.


<img width="1240" height="716" alt="image" src="https://github.com/user-attachments/assets/5415976e-ae8b-4792-b133-b0ae6c2df3bf" />
