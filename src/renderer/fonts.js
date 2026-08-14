/* exported getLocalFontFamilies, applyChatFont */
// Loaded as a classic <script> before chat.js and settings.js, which call
// these directly as globals — see index.html / settings.html load order.

const GOOGLE_FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
  'Source Sans 3', 'Nunito', 'Raleway', 'Work Sans', 'Rubik',
  'Noto Sans', 'Oswald', 'Playfair Display', 'Merriweather',
  'Fira Sans', 'Ubuntu', 'PT Sans', 'Cabin', 'Josefin Sans',
  'Barlow', 'DM Sans', 'Manrope', 'Space Grotesk', 'Outfit',
  'Figtree', 'Sora', 'Plus Jakarta Sans', 'Lexend', 'Quicksand',
  'Mulish', 'Karla', 'Inconsolata', 'IBM Plex Sans', 'IBM Plex Mono',
  'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'Roboto Mono',
  'Bebas Neue', 'Anton', 'Archivo', 'Exo 2', 'Titillium Web',
  'Comfortaa', 'Pacifico', 'Lobster', 'Dancing Script', 'Caveat'
];

const GOOGLE_FONT_SET = new Set(GOOGLE_FONTS);

const FALLBACK_LOCAL_FONTS = [
  'Arial', 'Arial Black', 'Bahnschrift', 'Calibri', 'Cambria',
  'Candara', 'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel',
  'Courier New', 'Georgia', 'Impact', 'Lucida Console', 'Lucida Sans Unicode',
  'Microsoft Sans Serif', 'Palatino Linotype', 'Segoe UI', 'Segoe UI Variable',
  'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana',
  'Helvetica', 'Helvetica Neue', 'Menlo', 'Monaco', 'Geneva',
  'system-ui', 'sans-serif', 'serif', 'monospace'
];

function isGoogleFont(name) {
  return GOOGLE_FONT_SET.has(name);
}

function quoteFontName(name) {
  if (!name) return 'system-ui';
  if (/^[a-zA-Z0-9-]+$/.test(name)) return name;
  return `'${String(name).replace(/'/g, "\\'")}'`;
}

function fontFamilyCss(name) {
  return `${quoteFontName(name)}, system-ui, sans-serif`;
}

function googleFontsStylesheetUrl(family) {
  const q = encodeURIComponent(family).replace(/%20/g, '+');
  return `https://fonts.googleapis.com/css2?family=${q}:wght@400;500;600;700&display=swap`;
}

function ensureGoogleFontLoaded(family) {
  if (!family || !isGoogleFont(family)) return;
  const id = 'gfont-' + family.replace(/\s+/g, '-').toLowerCase();
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = googleFontsStylesheetUrl(family);
  document.head.appendChild(link);
}

async function getLocalFontFamilies() {
  if (typeof window.queryLocalFonts === 'function') {
    try {
      const fonts = await window.queryLocalFonts();
      const names = [...new Set(fonts.map((f) => f.family).filter(Boolean))];
      names.sort((a, b) => a.localeCompare(b));
      if (names.length) return names;
    } catch {
    }
  }
  return FALLBACK_LOCAL_FONTS.slice().sort((a, b) => a.localeCompare(b));
}

function applyChatFont(family, source) {
  const name = family || 'Inter';
  const useGoogle = source === 'google' || (source !== 'local' && isGoogleFont(name));
  if (useGoogle) ensureGoogleFontLoaded(name);
  document.documentElement.style.setProperty('--font-family', fontFamilyCss(name));
}
