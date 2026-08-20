
const PLATFORMS = ['twitch', 'youtube', 'kick'];
const CANONICAL_PLATFORM = 'twitch';

const activePlatforms = new Set(['twitch']);
let selectedFontFamily = 'Inter';
let selectedFontSource = 'google';
let localFontNames = [];

function switchPlatformPage(platform) {
  activePlatforms.clear();
  activePlatforms.add(platform);
  document.querySelectorAll('.platform-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.platform === platform);
  });
  document.querySelectorAll('.platform-page').forEach(p => {
    p.classList.toggle('active', p.id === `page-${platform}`);
  });
}

document.querySelectorAll('.platform-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const platform = btn.dataset.platform;
    if (activePlatforms.has(platform)) return;
    switchPlatformPage(platform);
  });
});

function updateChannelFieldVisibility() {
  switchPlatformPage(Array.from(activePlatforms)[0] || 'twitch');
}

function fieldEl(base, platform) {
  return document.getElementById(`${base}-${platform}`);
}

function allFieldEls(base) {
  return PLATFORMS.map(p => fieldEl(base, p)).filter(Boolean);
}

function getFieldValue(el) {
  return el.type === 'checkbox' ? el.checked : el.value;
}

function setFieldValue(el, value) {
  if (!el) return;
  if (el.type === 'checkbox') el.checked = value;
  else el.value = value;
}

function linkSimpleField(base, { onAfterSync } = {}) {
  const els = allFieldEls(base);
  els.forEach(el => {
    const evt = el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(evt, () => {
      const value = getFieldValue(el);
      els.forEach(other => {
        if (other !== el) setFieldValue(other, value);
      });
      if (onAfterSync) onAfterSync();
    });
  });
  return els;
}

function updateOpacityLabels() {
  PLATFORMS.forEach(p => {
    const input = fieldEl('opacity', p);
    const label = fieldEl('opacity-val', p);
    if (input && label) label.textContent = `${input.value}%`;
  });
}

function updateShadowOpacityLabels() {
  PLATFORMS.forEach(p => {
    const input = fieldEl('shadow-opacity', p);
    const label = fieldEl('shadow-opacity-val', p);
    if (input && label) label.textContent = `${input.value}%`;
  });
}

function updateShadowOpacityVisibility() {
  PLATFORMS.forEach(p => {
    const checkbox = fieldEl('text-shadow', p);
    const field = fieldEl('shadow-opacity-field', p);
    if (checkbox && field) field.style.display = checkbox.checked ? 'flex' : 'none';
  });
}

function updateTextBackgroundOpacityLabels() {
  PLATFORMS.forEach(p => {
    const input = fieldEl('text-background-opacity', p);
    const label = fieldEl('text-background-opacity-val', p);
    if (input && label) label.textContent = `${input.value}%`;
  });
}

function updateTextBackgroundOpacityVisibility() {
  PLATFORMS.forEach(p => {
    const checkbox = fieldEl('text-background', p);
    const field = fieldEl('text-background-opacity-field', p);
    if (checkbox && field) field.style.display = checkbox.checked ? 'flex' : 'none';
  });
}

linkSimpleField('font-size');
linkSimpleField('max-messages');
linkSimpleField('message-fade');
linkSimpleField('opacity', { onAfterSync: updateOpacityLabels });
linkSimpleField('shadow-opacity', { onAfterSync: updateShadowOpacityLabels });
linkSimpleField('text-shadow', { onAfterSync: updateShadowOpacityVisibility });
linkSimpleField('text-background-opacity', { onAfterSync: updateTextBackgroundOpacityLabels });
linkSimpleField('text-background', { onAfterSync: updateTextBackgroundOpacityVisibility });

updateOpacityLabels();
updateShadowOpacityLabels();
updateTextBackgroundOpacityLabels();
setTimeout(updateShadowOpacityVisibility, 50);
setTimeout(updateTextBackgroundOpacityVisibility, 50);

function optionValue(source, family) {
  return `${source}::${family}`;
}

function parseOptionValue(value) {
  const idx = value.indexOf('::');
  if (idx === -1) return { source: isGoogleFont(value) ? 'google' : 'local', family: value };
  return { source: value.slice(0, idx), family: value.slice(idx + 2) };
}

function rebuildFontSelect(platform, filter = '') {
  const select = fieldEl('font-family', platform);
  if (!select) return;
  const q = filter.trim().toLowerCase();
  const prev = select.value;
  select.innerHTML = '';

  const openGroup = document.createElement('optgroup');
  openGroup.label = 'Open source (Google Fonts)';
  for (const family of GOOGLE_FONTS) {
    if (q && !family.toLowerCase().includes(q)) continue;
    const opt = document.createElement('option');
    opt.value = optionValue('google', family);
    opt.textContent = family;
    opt.style.fontFamily = fontFamilyCss(family);
    openGroup.appendChild(opt);
  }
  if (openGroup.children.length) select.appendChild(openGroup);

  const localGroup = document.createElement('optgroup');
  localGroup.label = 'Local fonts';
  for (const family of localFontNames) {
    if (q && !family.toLowerCase().includes(q)) continue;
    const opt = document.createElement('option');
    opt.value = optionValue('local', family);
    opt.textContent = family;
    opt.style.fontFamily = fontFamilyCss(family);
    localGroup.appendChild(opt);
  }
  if (localGroup.children.length) select.appendChild(localGroup);

  const desired = optionValue(selectedFontSource, selectedFontFamily);
  if ([...select.options].some((o) => o.value === desired)) {
    select.value = desired;
  } else if (prev && [...select.options].some((o) => o.value === prev)) {
    select.value = prev;
  } else if (select.options.length) {
    select.selectedIndex = 0;
  }
}

function rebuildAllFontSelects() {
  PLATFORMS.forEach(p => rebuildFontSelect(p, fieldEl('font-search', p)?.value || ''));
}

function applyFontSelectionToAll() {
  PLATFORMS.forEach(p => {
    const select = fieldEl('font-family', p);
    const preview = fieldEl('font-preview', p);
    if (select) {
      const desired = optionValue(selectedFontSource, selectedFontFamily);
      if ([...select.options].some(o => o.value === desired)) select.value = desired;
    }
    if (preview) preview.style.fontFamily = fontFamilyCss(selectedFontFamily);
  });
}

function syncFontSelectionFromSelect(platform) {
  const select = fieldEl('font-family', platform);
  if (!select?.value) return;
  const parsed = parseOptionValue(select.value);
  selectedFontFamily = parsed.family;
  selectedFontSource = parsed.source;
  if (selectedFontSource === 'google') ensureGoogleFontLoaded(selectedFontFamily);
  applyFontSelectionToAll();
}

PLATFORMS.forEach(p => {
  const select = fieldEl('font-family', p);
  const search = fieldEl('font-search', p);
  if (select) select.addEventListener('change', () => syncFontSelectionFromSelect(p));
  if (search) search.addEventListener('input', () => rebuildFontSelect(p, search.value));
});

async function initFontPicker(config) {
  selectedFontFamily = config.fontFamily || 'Inter';
  if (selectedFontFamily.includes(',')) {
    selectedFontFamily = selectedFontFamily.split(',')[0].replace(/['"]/g, '').trim();
  }
  selectedFontSource = config.fontSource || (isGoogleFont(selectedFontFamily) ? 'google' : 'local');
  localFontNames = await getLocalFontFamilies();
  rebuildAllFontSelects();
  applyFontSelectionToAll();
}

window.electronAPI.getConfig().then(async (config) => {
  document.getElementById('twitch-channel').value = config.channel || '';
  document.getElementById('youtube-id').value = config.youtubeId || '';
  document.getElementById('kick-channel').value = config.kickChannel || '';

  PLATFORMS.forEach(p => {
    setFieldValue(fieldEl('font-size', p), config.fontSize || 14);
    setFieldValue(fieldEl('max-messages', p), config.maxMessages || 100);
    setFieldValue(fieldEl('bg-color', p), config.theme?.background || 'rgba(0,0,0,0.45)');
    setFieldValue(fieldEl('text-color', p), config.theme?.text || '#ffffff');
    setFieldValue(fieldEl('opacity', p), Math.round((config.opacity || 0.9) * 100));
    setFieldValue(fieldEl('text-shadow', p), !!config.textShadow);
    setFieldValue(fieldEl('shadow-opacity', p), Math.round((config.shadowOpacity ?? 0.9) * 100));
    setFieldValue(fieldEl('text-background', p), !!config.textBackground);
    setFieldValue(fieldEl('text-background-opacity', p), Math.round((config.textBackgroundOpacity ?? 0.5) * 100));
    setFieldValue(fieldEl('message-fade', p), config.messageFadeSeconds ?? 0);
    syncSwatchFromInput('bg', p);
    syncSwatchFromInput('text', p);
    syncSectionSwatch('bg', p);
    syncSectionSwatch('text', p);
  });
  updateOpacityLabels();
  updateShadowOpacityLabels();
  updateTextBackgroundOpacityLabels();
  setTimeout(updateShadowOpacityVisibility, 50);
  setTimeout(updateTextBackgroundOpacityVisibility, 50);

  document.getElementById('show-timestamps').checked = config.showTimestamps !== false;
  document.getElementById('show-badges').checked = config.showBadges !== false;
  document.getElementById('show-gifs').checked = config.showGifs !== false;
  document.getElementById('show-nameplates').checked = config.showNameplates !== false;
  document.getElementById('nameplate-normal').checked = config.nameplateNormal !== false;
  document.getElementById('nameplate-mod').checked = config.nameplateMod !== false;
  document.getElementById('nameplate-vip').checked = config.nameplateVip !== false;
  updateNameplateSuboptions();
  document.getElementById('show-reply-threads').checked = config.showReplyThreads !== false;
  document.getElementById('show-shared-chat').checked = config.showSharedChat !== false;
  document.getElementById('show-shared-avatars').checked = config.showSharedChatAvatars !== false;

  document.getElementById('event-subs').checked = config.eventSubs !== false;
  document.getElementById('event-subgifts').checked = config.eventSubgifts !== false;
  document.getElementById('event-raids').checked = config.eventRaids !== false;
  document.getElementById('event-cheers').checked = config.eventCheers !== false;
  document.getElementById('event-follows').checked = !!config.eventFollows;
  updateSharedChatSubVisibility();
  document.getElementById('filter-bots').checked = config.filterBots !== false;
  document.getElementById('ignored-bots').value = config.ignoredBots ?? '';
  document.getElementById('filter-commands').checked = config.filterCommands !== false;
  document.getElementById('blocked-users').value = config.blockedUsers ?? '';
  updateFilterSubVisibility();
  document.getElementById('click-through').checked = !!config.clickThrough;
  document.getElementById('hide-from-capture').checked = !!config.hideFromCapture;
  document.getElementById('toggle-key').value = config.toggleKey || 'F9';
  const showChatInputEl = document.getElementById('show-chat-input');
  if (showChatInputEl) showChatInputEl.checked = !!config.showChatInput;

  await initFontPicker(config);
  updateShadowOpacityVisibility();

  activePlatforms.clear();
  const savedPlatform = (config.platforms || ['twitch'])[0];
  activePlatforms.add(savedPlatform);
  document.querySelectorAll('.platform-btn').forEach(btn => {
    btn.classList.toggle('active', activePlatforms.has(btn.dataset.platform));
  });
  updateChannelFieldVisibility();
});

window.electronAPI.onConfigUpdate((config) => {
  document.getElementById('click-through').checked = !!config.clickThrough;
  document.getElementById('hide-from-capture').checked = !!config.hideFromCapture;
  if (config.channel != null) {
    document.getElementById('twitch-channel').value = config.channel || '';
  }
});

document.getElementById('save-btn').addEventListener('click', async () => {
  syncFontSelectionFromSelect(CANONICAL_PLATFORM);

  const newConfig = {
    channel: document.getElementById('twitch-channel').value.trim().replace('#', ''),
    youtubeId: document.getElementById('youtube-id').value.trim(),
    kickChannel: document.getElementById('kick-channel').value.trim(),
    platforms: Array.from(activePlatforms),
    fontSize: Number.parseInt(fieldEl('font-size', CANONICAL_PLATFORM).value, 10) || 14,
    fontFamily: selectedFontFamily || 'Inter',
    fontSource: selectedFontSource || 'google',
    maxMessages: Number.parseInt(fieldEl('max-messages', CANONICAL_PLATFORM).value, 10) || 100,
    theme: {
      background: fieldEl('bg-color', CANONICAL_PLATFORM).value || 'rgba(0,0,0,0.45)',
      text: fieldEl('text-color', CANONICAL_PLATFORM).value || '#ffffff',
      timestamp: '#888888',
      selfChannel: '#9147ff',
      channelColors: {},
      textSharpness: Number.parseInt(fieldEl('text-sharpness', CANONICAL_PLATFORM)?.value || '0', 10) || 0,
    },
    opacity: Number.parseInt(fieldEl('opacity', CANONICAL_PLATFORM).value, 10) / 100,
    showTimestamps: document.getElementById('show-timestamps').checked,
    textShadow: fieldEl('text-shadow', CANONICAL_PLATFORM).checked,
    shadowOpacity: Number.parseInt(fieldEl('shadow-opacity', CANONICAL_PLATFORM).value, 10) / 100,
    textBackground: fieldEl('text-background', CANONICAL_PLATFORM).checked,
    textBackgroundOpacity: Number.parseInt(fieldEl('text-background-opacity', CANONICAL_PLATFORM).value, 10) / 100,
    showBadges: document.getElementById('show-badges').checked,
    showGifs: document.getElementById('show-gifs').checked,
    showNameplates: document.getElementById('show-nameplates').checked,
    nameplateNormal: document.getElementById('nameplate-normal').checked,
    nameplateMod: document.getElementById('nameplate-mod').checked,
    nameplateVip: document.getElementById('nameplate-vip').checked,
    showReplyThreads: document.getElementById('show-reply-threads').checked,
    showSharedChat: document.getElementById('show-shared-chat').checked,
    showSharedChatAvatars: document.getElementById('show-shared-avatars').checked,
    eventSubs: document.getElementById('event-subs').checked,
    eventSubgifts: document.getElementById('event-subgifts').checked,
    eventRaids: document.getElementById('event-raids').checked,
    eventCheers: document.getElementById('event-cheers').checked,
    eventFollows: document.getElementById('event-follows').checked,
    filterBots: document.getElementById('filter-bots').checked,
    ignoredBots: document.getElementById('ignored-bots').value.trim(),
    filterCommands: document.getElementById('filter-commands').checked,
    blockedUsers: document.getElementById('blocked-users').value.trim(),
    messageFadeSeconds: Math.max(0, Number.parseFloat(fieldEl('message-fade', CANONICAL_PLATFORM).value) || 0),
    clickThrough: document.getElementById('click-through').checked,
    hideFromCapture: document.getElementById('hide-from-capture').checked,
    toggleKey: document.getElementById('toggle-key').value.trim() || 'F9',
    showChatInput: document.getElementById('show-chat-input')?.checked ?? false
  };

  const btn = document.getElementById('save-btn');
  btn.textContent = 'Saving…';
  btn.disabled = true;

  await window.electronAPI.saveConfig(newConfig);

  btn.textContent = 'Saved ✓';
  setTimeout(() => {
    btn.textContent = 'Save & Apply';
    btn.disabled = false;
  }, 1500);
});

const showSharedChatCheckbox = document.getElementById('show-shared-chat');
const sharedChatSubEl = document.getElementById('shared-chat-sub');

function updateFilterSubVisibility() {
  const botsChecked = document.getElementById('filter-bots').checked;
  const botsSub = document.getElementById('filter-bots-sub');
  if (botsSub) botsSub.style.display = botsChecked ? 'block' : 'none';
}

document.getElementById('filter-bots').addEventListener('change', updateFilterSubVisibility);
document.getElementById('filter-commands').addEventListener('change', updateFilterSubVisibility);

function updateSharedChatSubVisibility() {
  sharedChatSubEl.style.display = showSharedChatCheckbox.checked ? '' : 'none';
}

showSharedChatCheckbox.addEventListener('change', updateSharedChatSubVisibility);

const authLoggedOut = document.getElementById('auth-logged-out');
const authLoggedIn  = document.getElementById('auth-logged-in');
const authUsername  = document.getElementById('auth-username');
const authError     = document.getElementById('auth-error');
const loginBtn      = document.getElementById('login-btn');
const logoutBtn     = document.getElementById('logout-btn');

function applyAuthState(auth) {
  const authed = !!auth?.authed;
  authLoggedOut.hidden = authed;
  authLoggedIn.hidden  = !authed;
  if (authed && auth?.username) {
    authUsername.textContent = auth.username;
  }
}

window.electronAPI.getConfig().then((config) => {
  applyAuthState({ authed: config.twitchAuthed, username: config.twitchAuthUser });
});

window.electronAPI.onAuthUpdate((auth) => {
  applyAuthState(auth);
});

loginBtn.addEventListener('click', async () => {
  loginBtn.disabled = true;
  loginBtn.textContent = 'Complete login in your browser…';
  authError.hidden = true;

  const result = await window.electronAPI.twitchLogin();

  loginBtn.disabled = false;
  loginBtn.textContent = 'Login with Twitch';

  if (!result?.ok) {
    authError.textContent = result?.error || 'Login failed';
    authError.hidden = false;
  }
});

logoutBtn.addEventListener('click', async () => {
  logoutBtn.disabled = true;
  await window.electronAPI.twitchLogout();
  logoutBtn.disabled = false;
  const showChatInputEl = document.getElementById('show-chat-input');
  if (showChatInputEl) showChatInputEl.checked = false;
});


function parseColorToRgba(str) {
  str = (str || '').trim();
  // Pull the parenthesized content out with a simple, low-complexity pattern, then split and
  // parse it in plain JS rather than one regex trying to validate every number itself.
  const rgbaMatch = str.match(/rgba?\(([^)]*)\)/);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(',').map((p) => Number.parseFloat(p.trim()));
    if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
      return {
        r: parts[0],
        g: parts[1],
        b: parts[2],
        a: Number.isFinite(parts[3]) ? parts[3] : 1
      };
    }
  }
  let hex = str.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length === 6 || hex.length === 8) {
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1
    };
  }
  return { r: 255, g: 255, b: 255, a: 1 };
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

function rgbaToHex(r, g, b, a) {
  const hex = [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  return a < 1 ? `#${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}` : `#${hex}`;
}

function formatColor(r, g, b, a, fmt) {
  if (fmt === 'rgba') return a < 1 ? `rgba(${r},${g},${b},${a.toFixed(2)})` : `rgb(${r},${g},${b})`;
  return rgbaToHex(r, g, b, a);
}

function syncSwatchFromInput(colorBase, platform) {
  const input = document.getElementById(`${colorBase}-color-${platform}`);
  const swatch = document.getElementById(`${colorBase}-picker-toggle-${platform}`);
  if (!input) return;
  if (swatch) swatch.style.background = input.value || (colorBase === 'bg' ? 'rgba(0,0,0,0.45)' : '#ffffff');
}

function syncSectionSwatch(base, platform) {
  const input = fieldEl(base === 'bg' ? 'bg-color' : 'text-color', platform);
  const swatch = fieldEl(`${base}-section-swatch`, platform);
  if (!input) return;
  if (swatch) swatch.style.background = input.value || (base === 'bg' ? 'rgba(0,0,0,0.45)' : '#ffffff');
}

const pickerBroadcast = {};
const pickerInstances = { bg: {}, text: {} };

function setupPicker(base, platform) {
  const id = `${base}-color-${platform}`;
  const canvas = document.getElementById(`${base}-canvas-${platform}`);
  const cursor = document.getElementById(`${base}-cursor-${platform}`);
  const hueSlider = document.getElementById(`${base}-hue-${platform}`);
  const alphaSlider = document.getElementById(`${base}-alpha-${platform}`);
  const textInput = document.getElementById(id);
  const swatch = document.getElementById(`${base}-picker-toggle-${platform}`);
  const panel = document.getElementById(`${base}-picker-panel-${platform}`);
  const toggleBtn = swatch;
  const fmtHex = document.getElementById(`${base}-fmt-hex-${platform}`);
  const fmtRgba = document.getElementById(`${base}-fmt-rgba-${platform}`);
  if (!canvas || !textInput) return null;
  const ctx = canvas.getContext('2d');

  let hue = 0, sat = 100, lum = 50, alpha = 1;
  let fmt = 'hex';
  let dragging = false;
  let cursorX = canvas.width, cursorY = 0;
  let suppressBroadcast = false;

  function drawCanvas() {
    const w = canvas.width, h = canvas.height;
    const grad1 = ctx.createLinearGradient(0, 0, w, 0);
    grad1.addColorStop(0, '#fff');
    grad1.addColorStop(1, `hsl(${hue},100%,50%)`);
    ctx.fillStyle = grad1;
    ctx.fillRect(0, 0, w, h);
    const grad2 = ctx.createLinearGradient(0, 0, 0, h);
    grad2.addColorStop(0, 'rgba(0,0,0,0)');
    grad2.addColorStop(1, '#000');
    ctx.fillStyle = grad2;
    ctx.fillRect(0, 0, w, h);
  }

  function notify(val) {
    syncSectionSwatch(base, platform);
    if (suppressBroadcast) return;
    if (pickerBroadcast[base]) pickerBroadcast[base](platform, val);
  }

  function updateFromPos(x, y) {
    const w = canvas.width, h = canvas.height;
    x = Math.max(0, Math.min(w, x));
    y = Math.max(0, Math.min(h, y));
    cursorX = x; cursorY = y;
    sat = (x / w) * 100;
    lum = 100 - (y / h) * 100;
    syncOutput();
    updateCursorPos();
  }

  function updateCursorPos() {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    cursor.style.left = `${(cursorX / scaleX) + 10}px`;
    cursor.style.top = `${(cursorY / scaleY) + 10}px`;
  }

  function syncOutput() {
    const rgb = hslToRgb(hue, sat, lum > 0 ? Math.min(lum, 100) : 0);
    const val = formatColor(rgb.r, rgb.g, rgb.b, alpha, fmt);
    textInput.value = val;
    swatch.style.background = val;
    notify(val);
  }

  function syncFromText() {
    const rgba = parseColorToRgba(textInput.value);
    const hsl = rgbToHsl(rgba.r, rgba.g, rgba.b);
    hue = hsl.h; sat = hsl.s; lum = hsl.l; alpha = rgba.a;
    hueSlider.value = Math.round(hue);
    alphaSlider.value = Math.round(alpha * 100);
    const w = canvas.width, h = canvas.height;
    cursorX = (sat / 100) * w;
    cursorY = (1 - lum / 100) * h;
    drawCanvas();
    updateCursorPos();
    swatch.style.background = textInput.value;
    syncSectionSwatch(base, platform);
  }

  function setColorExternal(val) {
    suppressBroadcast = true;
    textInput.value = val;
    syncFromText();
    suppressBroadcast = false;
  }

  toggleBtn.addEventListener('click', () => {
    const hidden = panel.hidden;
    panel.hidden = !hidden;
    if (!hidden) return;
    syncFromText();
  });

  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    updateFromPos((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    updateFromPos((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
  });

  window.addEventListener('mouseup', () => { dragging = false; });

  hueSlider.addEventListener('input', () => {
    hue = Number.parseInt(hueSlider.value, 10);
    drawCanvas();
    syncOutput();
  });

  alphaSlider.addEventListener('input', () => {
    alpha = Number.parseInt(alphaSlider.value, 10) / 100;
    syncOutput();
  });

  textInput.addEventListener('input', () => {
    syncSwatchFromInput(base, platform);
    syncSectionSwatch(base, platform);
  });

  textInput.addEventListener('change', () => {
    if (panel.hidden) syncSwatchFromInput(base, platform);
    else syncFromText();
    syncSectionSwatch(base, platform);
    notify(textInput.value);
  });

  fmtHex.addEventListener('click', () => {
    fmt = 'hex';
    fmtHex.classList.add('active');
    fmtRgba.classList.remove('active');
    syncOutput();
  });

  fmtRgba.addEventListener('click', () => {
    fmt = 'rgba';
    fmtRgba.classList.add('active');
    fmtHex.classList.remove('active');
    syncOutput();
  });

  drawCanvas();
  syncFromText();

  return { setColorExternal };
}

['bg', 'text'].forEach(base => {
  PLATFORMS.forEach(platform => {
    const instance = setupPicker(base, platform);
    if (instance) pickerInstances[base][platform] = instance;
  });
  pickerBroadcast[base] = (sourcePlatform, val) => {
    PLATFORMS.forEach(p => {
      if (p === sourcePlatform) return;
      pickerInstances[base][p]?.setColorExternal(val);
    });
  };
});

PLATFORMS.forEach(platform => {
  ['bg', 'text'].forEach(base => {
    const toggle = document.getElementById(`${base}-section-toggle-${platform}`);
    const body = document.getElementById(`${base}-section-body-${platform}`);
    if (!toggle || !body) return;
    toggle.addEventListener('click', () => {
      const isOpen = !body.hidden;
      body.hidden = isOpen;
      toggle.classList.toggle('open', !isOpen);
    });
  });
});

(() => {
  const toggle = document.getElementById('events-section-toggle');
  const body = document.getElementById('events-section-body');
  if (!toggle || !body) return;
  toggle.addEventListener('click', () => {
    const isOpen = !body.hidden;
    body.hidden = isOpen;
    toggle.classList.toggle('open', !isOpen);
  });
})();

function updateNameplateSuboptions() {
  const enabled = document.getElementById('show-nameplates').checked;
  const sub = document.getElementById('nameplate-suboptions');
  if (sub) sub.style.display = enabled ? 'block' : 'none';
}

document.getElementById('show-nameplates').addEventListener('change', updateNameplateSuboptions);
