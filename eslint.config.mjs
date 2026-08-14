import globals from 'globals';

/**
 * Flat ESLint config.
 *
 * The project has three distinct JS environments:
 *  - main process + modules (CommonJS, Node globals, Electron)
 *  - preload (CommonJS, Node + browser globals)
 *  - renderer (classic <script> tags, browser globals, cross-file globals)
 */
export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'release/**'],
  },

  // Main process and modules
  {
    files: ['src/main.js', 'src/modules/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        fetch: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: ['warn', 'smart'],
      'no-var': 'error',
      'prefer-const': 'warn',
    },
  },

  // Preload bridge
  {
    files: ['src/preload.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
    },
  },

  // Renderer scripts: loaded as classic scripts, so they share one global scope.
  {
    files: ['src/renderer/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        // Declared in fonts.js, consumed by chat.js / settings.js
        GOOGLE_FONTS: 'readonly',
        isGoogleFont: 'readonly',
        fontFamilyCss: 'readonly',
        ensureGoogleFontLoaded: 'readonly',
        getLocalFontFamilies: 'readonly',
        applyChatFont: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: ['warn', 'smart'],
      'no-var': 'error',
      'prefer-const': 'warn',
    },
  },
];
