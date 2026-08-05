# Shadowyvr Chat Overlay — Changelog

A lightweight, always-on-top chat overlay for Twitch, YouTube, and Kick — built to sit on your desktop, stay out of your way, and look exactly how you want it to.

## Core

- **Multi-platform chat** — Twitch, YouTube, and Kick chat in one overlay window
- **Twitch shared chat support** — see messages from every channel in a shared-chat session, with per-channel source badges and avatars
- **Third-party emotes** — 7TV and BetterTTV emotes render inline alongside native Twitch emotes
- **Click-through mode** — toggle the overlay to ignore mouse input (hotkey configurable, default `F9`) so it never blocks your game or desktop
- **Hide from screen capture** — a dedicated toggle that excludes the overlay from OBS, Discord/Zoom screen share, and screenshots, while it stays fully visible on your own monitor (Windows/macOS)
- **Draggable, resizable, frameless window** — position and size it however fits your layout, saved automatically

## Appearance

- **Fully custom look** — font family (Google Fonts or any font installed on your PC), font size, background color, text color, opacity, and text shadow, all with live color pickers
- **One shared Appearance panel across all three platform tabs** — set your look once and it applies identically to Twitch, YouTube, and Kick; no need to configure it three times
- **Adjustable message fade** — auto-fade old messages after N seconds, or keep full history
- **Timestamps toggle**

## Twitch-specific

- **Channel event alerts** — subscriptions, gifted subs, raids, cheers/bits, and follows, each individually toggleable
- **Moderation sync** — deleted messages, timeouts, and bans are reflected on the overlay automatically: the message (or all of that user's messages) disappears instead of sticking around
- **Mod/VIP name highlighting** — optional colored background behind mod (green) and VIP (royal blue) usernames for at-a-glance recognition
- **Reply threads** — replies show a compact "↳ @user: original message" line above them, so context isn't lost
- **Badge display** — Twitch badges rendered next to usernames, toggleable
- **Chat filtering** — block bot commands, ignore specific bot accounts, or block specific users from appearing at all
- **Login with Twitch** — authenticate to send messages from the overlay itself, with an optional chat input box

## Behind the scenes

- Config auto-saves on every change — position, size, and all settings persist across restarts
- Settings window reorganized into clear sections (Channel, Appearance, Twitch Events, Chat Options, Filters, Behaviour) with consistent spacing, so options aren't crammed together

---

*Have feedback or a feature request? Let me know what you'd want to see next.*
