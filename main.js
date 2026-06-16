import {
  ICON_BOLT,
  ICON_SEARCH,
  ICON_CLOSE,
  ICON_FOLDER,
  ICON_PENCIL,
  ICON_CHECK,
  ICON_UPLOAD,
  NAMED_ICONS,
} from './icons.js';

// ── STATE ─────────────────────────────────────────────────────
const STORAGE_KEY = 'flashdash_state';

const DEFAULT_STATE = {
  version: '1.0.0',
  apps: [],
};

function loadState() {
  try {
    const savedJson = localStorage.getItem(STORAGE_KEY);
    return savedJson ? JSON.parse(savedJson) : { ...DEFAULT_STATE };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function bumpPatchVersion(versionString) {
  const parts = versionString.split('.');
  parts[2] = String(parseInt(parts[2], 10) + 1);
  return parts.join('.');
}

let state = loadState();

// ── CLOCK ─────────────────────────────────────────────────────
function updateClock() {
  const now     = new Date();
  const hours   = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('clock').textContent = `${hours}:${minutes}`;

  const dateEl = document.getElementById('statusDate');
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString(undefined, {
      weekday: 'short',
      month:   'short',
      day:     'numeric',
    });
  }
}
updateClock();
setInterval(updateClock, 60_000);

// ── TAB / BLADE SWITCHING ─────────────────────────────────────
document.getElementById('blades').addEventListener('click', (event) => {
  const clickedBlade = event.target.closest('.blade');
  if (!clickedBlade) return;

  const targetTabName = clickedBlade.dataset.tab;

  document.querySelectorAll('.blade').forEach(blade => {
    blade.classList.toggle('blade--active', blade === clickedBlade);
  });

  document.querySelectorAll('.panel').forEach(panel => {
    const isTarget = panel.id === `tab-${targetTabName}`;
    panel.classList.toggle('panel--active', isTarget);
    if (isTarget) {
      panel.style.animation = 'none';
      panel.offsetHeight;
      panel.style.animation = '';
    }
  });
});

// ── RENDER ────────────────────────────────────────────────────
function renderApps(filterQuery = '') {
  renderRecentRow();
  renderQuickRow();
  renderAppGrid(filterQuery);
  updateAppsCount();
}

function updateAppsCount() {
  const countEl = document.getElementById('appsCount');
  if (countEl) {
    const total = state.apps.length;
    countEl.textContent = `${total} ${total === 1 ? 'app' : 'apps'}`;
  }
}

function renderQuickRow() {
  const quickSection = document.getElementById('quickSection');
  const quickRow     = document.getElementById('quickRow');

  if (state.apps.length === 0) {
    quickSection.hidden = true;
    return;
  }

  quickSection.hidden = false;
  quickRow.innerHTML  = '';
  state.apps.forEach(app => quickRow.appendChild(buildQuickTile(app)));
}

function renderRecentRow() {
  const recentSection = document.getElementById('recentSection');
  const recentRow     = document.getElementById('recentRow');
  if (!recentSection || !recentRow) return;

  const recentlyOpenedApps = state.apps
    .filter(app => app.lastOpenedAt)
    .sort((firstApp, secondApp) => secondApp.lastOpenedAt - firstApp.lastOpenedAt)
    .slice(0, 6);

  if (recentlyOpenedApps.length === 0) {
    recentSection.hidden = true;
    return;
  }

  recentSection.hidden = false;
  recentRow.innerHTML  = '';
  recentlyOpenedApps.forEach(app => recentRow.appendChild(buildQuickTile(app)));
}

function buildQuickTile(app) {
  const tile = document.createElement('div');
  tile.className = 'gtile';
  tile.innerHTML = `
    <div class="gtile__icon">${renderIconForApp(app)}</div>
    <div class="gtile__name">${app.name}</div>
  `;
  tile.addEventListener('click', () => openAppViewer(app));
  return tile;
}

function renderAppGrid(filterQuery = '') {
  const gridContainer = document.getElementById('appGrid');
  const query         = filterQuery.trim().toLowerCase();
  const visibleApps   = query
    ? state.apps.filter(app => app.name.toLowerCase().includes(query))
    : state.apps;

  if (state.apps.length === 0) {
    gridContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">${ICON_FOLDER}</div>
        <div class="empty-state__msg">No apps yet</div>
        <div class="empty-state__sub">Click "+ Add App" to import a .js file or paste a URL</div>
      </div>`;
    return;
  }

  if (visibleApps.length === 0) {
    gridContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">${ICON_SEARCH}</div>
        <div class="empty-state__msg">No results</div>
        <div class="empty-state__sub">No apps match "${filterQuery}"</div>
      </div>`;
    return;
  }

  gridContainer.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'app-grid';
  visibleApps.forEach(app => grid.appendChild(buildAppCard(app)));
  gridContainer.appendChild(grid);
}

function buildAppCard(app) {
  const badgeType  = app.url ? 'url'  : 'file';
  const badgeLabel = app.url ? 'URL'  : 'File';
  const appDesc    = app.description || '';

  const card = document.createElement('div');
  card.className = 'app-card';
  card.innerHTML = `
    <div class="app-card__icon">${renderIconForApp(app)}</div>
    <div class="app-card__body">
      <div class="app-card__name">${app.name}</div>
      <div class="app-card__meta">
        ${appDesc ? `<span class="app-card__desc">${appDesc}</span>` : ''}
        <span class="app-card__badge app-card__badge--${badgeType}">${badgeLabel}</span>
      </div>
    </div>
    <div class="app-card__actions">
      <button class="app-card__btn" title="Edit">${ICON_PENCIL}</button>
      <button class="app-card__btn app-card__btn--delete" title="Remove">${ICON_CLOSE}</button>
    </div>
  `;

  card.addEventListener('click', (event) => {
    if (event.target.closest('.app-card__actions')) return;
    openAppViewer(app);
  });

  card.querySelector('.app-card__btn:not(.app-card__btn--delete)')
    .addEventListener('click', (event) => {
      event.stopPropagation();
      openEditModal(app);
    });

  card.querySelector('.app-card__btn--delete')
    .addEventListener('click', (event) => {
      event.stopPropagation();
      removeApp(app.id);
    });

  return card;
}

// ── APP VIEWER ────────────────────────────────────────────────
const appViewerEl     = document.getElementById('appViewer');
const appViewerCanvas = document.getElementById('appViewerCanvas');
const appViewerIcon   = document.getElementById('appViewerIcon');
const appViewerTitle  = document.getElementById('appViewerTitle');

/** Cleanup function returned by the currently-running app (null when no app is open). */
let activeAppCleanup = null;

/**
 * Rewrites CSS rule selectors so they are scoped under the given container ID.
 * This prevents injected app styles from bleeding into the FlashDash UI.
 *
 * Handles:
 *  - `body`, `html`, `:root` → replaced with `#containerScopeId`
 *  - all other selectors    → prefixed with `#containerScopeId `
 *  - @-rule headers         → left untouched (e.g. @keyframes, @media)
 *  - keyframe step selectors (from, to, 50%) → left untouched
 */
function scopeCssToContainer(cssText, containerScopeId) {
  return cssText.replace(/([^{}]+)\{/g, (match, selectorGroup) => {
    const trimmedSelector = selectorGroup.trim();

    if (trimmedSelector.startsWith('@')) return match;
    if (/^(from|to|[\d.]+%)/.test(trimmedSelector)) return match;

    const prefixedSelector = trimmedSelector
      .split(',')
      .map(individualSelector => {
        const selector = individualSelector.trim();
        if (selector === 'body' || selector === 'html' || selector === ':root') {
          return `#${containerScopeId}`;
        }
        return `#${containerScopeId} ${selector}`;
      })
      .join(', ');

    return `${prefixedSelector} {`;
  });
}

/**
 * Injects app JS into the given container element and runs it.
 *
 * The app receives a proxied `document` where:
 *   - `document.body` → the container div (apps render here instead of <body>)
 *   - `document.head.insertAdjacentHTML` → intercepts <style> tags, scopes their
 *     CSS to the container, and appends them to the real <head> for tracking/cleanup
 *   - all other document properties pass through to the real document
 *
 * Apps also receive tracked wrappers for `setInterval` and `setTimeout` so all
 * timers are cancelled automatically when the app closes.
 *
 * localStorage, fetch, and all other window globals are available natively.
 *
 * Returns a cleanup function that removes injected styles, clears timers, and
 * empties the container.
 */
function runAppInContainer(jsCode, containerEl, stableAppId) {
  const appScopeId    = `fd_app_${Date.now()}`;  // unique per-launch (CSS scope)
  const storagePrefix = `fd_store_${stableAppId}`; // stable across relaunches (localStorage)
  containerEl.id = appScopeId;
  containerEl.innerHTML = '';

  const injectedStyleElements = [];
  const activeIntervalIds     = [];
  const activeTimeoutIds      = [];

  const fakeHead = {
    insertAdjacentHTML(_position, htmlString) {
      const parser         = new DOMParser();
      const parsedFragment = parser.parseFromString(htmlString, 'text/html');

      Array.from(parsedFragment.querySelectorAll('style')).forEach(styleEl => {
        const scopedCss  = scopeCssToContainer(styleEl.textContent, appScopeId);
        const newStyleEl = document.createElement('style');
        newStyleEl.textContent      = scopedCss;
        newStyleEl.dataset.appScope = appScopeId;
        document.head.appendChild(newStyleEl);
        injectedStyleElements.push(newStyleEl);
      });
    }
  };

  const appDocument = new Proxy(document, {
    get(target, prop) {
      if (prop === 'body') return containerEl;
      if (prop === 'head') return fakeHead;
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });

  const trackedSetInterval = (callback, delay, ...args) => {
    const intervalId = setInterval(callback, delay, ...args);
    activeIntervalIds.push(intervalId);
    return intervalId;
  };

  const trackedSetTimeout = (callback, delay, ...args) => {
    const timeoutId = setTimeout(callback, delay, ...args);
    activeTimeoutIds.push(timeoutId);
    return timeoutId;
  };

  /**
   * Namespaced localStorage API scoped to this specific app.
   * Keys are prefixed with the stable app ID so multiple apps never clash.
   * Apps can use this OR the raw `localStorage` global — both work.
   */
  const flashDashApi = {
    storage: {
      getItem:    (key)        => localStorage.getItem(`${storagePrefix}_${key}`),
      setItem:    (key, value) => localStorage.setItem(`${storagePrefix}_${key}`, value),
      removeItem: (key)        => localStorage.removeItem(`${storagePrefix}_${key}`),
      clear() {
        const keysToRemove = Object.keys(localStorage)
          .filter(localStorageKey => localStorageKey.startsWith(`${storagePrefix}_`));
        keysToRemove.forEach(localStorageKey => localStorage.removeItem(localStorageKey));
      },
    },
  };

  try {
    // Pass overridden globals as named parameters so app code uses our tracked versions.
    // eslint-disable-next-line no-new-func
    new Function('document', 'setInterval', 'setTimeout', 'FlashDash', jsCode)(
      appDocument,
      trackedSetInterval,
      trackedSetTimeout,
      flashDashApi
    );
  } catch (runError) {
    showAppError(containerEl, runError.message);
  }

  return function cleanupApp() {
    injectedStyleElements.forEach(styleEl => styleEl.remove());
    activeIntervalIds.forEach(id => clearInterval(id));
    activeTimeoutIds.forEach(id => clearTimeout(id));
    containerEl.innerHTML = '';
    containerEl.removeAttribute('id');
    containerEl.removeAttribute('style');
  };
}

function showAppLoading(containerEl, appName) {
  // Ensure the spinner keyframe is in the document exactly once.
  if (!document.getElementById('fd-spinner-style')) {
    const spinnerStyleEl = document.createElement('style');
    spinnerStyleEl.id          = 'fd-spinner-style';
    spinnerStyleEl.textContent = '@keyframes fd-spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(spinnerStyleEl);
  }

  containerEl.removeAttribute('id');
  containerEl.style.cssText = [
    'height: 100%',
    'display: flex',
    'flex-direction: column',
    'align-items: center',
    'justify-content: center',
    'background: #111',
    'color: #888',
    'font-family: system-ui, sans-serif',
    'gap: 14px',
  ].join(';');

  containerEl.innerHTML = `
    <div style="
      width:32px; height:32px;
      border:3px solid #2a2a2a; border-top-color:#52B043;
      border-radius:50%; animation:fd-spin .7s linear infinite;
    "></div>
    <div style="font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase;">
      Loading ${appName}
    </div>
  `;
}

function showAppError(containerEl, message) {
  containerEl.removeAttribute('id');
  containerEl.style.cssText = [
    'height: 100%',
    'display: flex',
    'flex-direction: column',
    'align-items: center',
    'justify-content: center',
    'background: #111',
    'color: #c44',
    'font-family: system-ui, sans-serif',
    'gap: 10px',
  ].join(';');

  containerEl.innerHTML = `
    <div style="font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:1px;">
      Failed to load
    </div>
    <div style="font-size:11px; color:#555; max-width:340px; text-align:center; line-height:1.6;">
      ${message}
    </div>
  `;
}

function openAppViewer(app) {
  if (activeAppCleanup) {
    activeAppCleanup();
    activeAppCleanup = null;
  }

  // Record last-opened timestamp so the home Recent row stays current.
  const trackedApp = state.apps.find(stateApp => stateApp.id === app.id);
  if (trackedApp) {
    trackedApp.lastOpenedAt = Date.now();
    saveState(state);
    renderRecentRow();
  }

  appViewerIcon.innerHTML    = renderIconForApp(app);
  appViewerTitle.textContent = app.name;
  appViewerEl.classList.add('app-viewer--open');

  if (app.url) {
    showAppLoading(appViewerCanvas, app.name);

    fetch(app.url)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then(fetchedJsCode => {
        // Sync metadata from the fetched code so URL-based apps always show
        // the correct icon/name/description declared via // @annotations.
        const trackedApp = state.apps.find(stateApp => stateApp.id === app.id);
        if (trackedApp) {
          const meta = extractAppMeta(fetchedJsCode, trackedApp.name);
          trackedApp.icon        = meta.icon;
          trackedApp.description = meta.description || trackedApp.description;
          saveState(state);
          renderApps();
        }

        activeAppCleanup = runAppInContainer(fetchedJsCode, appViewerCanvas, app.id);
      })
      .catch(fetchError => {
        showAppError(appViewerCanvas, fetchError.message);
      });
  } else {
    activeAppCleanup = runAppInContainer(app.jsCode, appViewerCanvas, app.id);
  }
}

function closeAppViewer() {
  appViewerEl.classList.remove('app-viewer--open');
  if (activeAppCleanup) {
    activeAppCleanup();
    activeAppCleanup = null;
  }
}

window.closeAppViewer = closeAppViewer;

// Close the viewer with Escape
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && appViewerEl.classList.contains('app-viewer--open')) {
    closeAppViewer();
  }
});

// ── ADD / EDIT APP ────────────────────────────────────────────
function addApp({ name, icon, description, fileName, jsCode, url }) {
  state.apps.push({
    id:          `app_${Date.now()}`,
    name,
    icon:        icon        || ICON_BOLT,
    description: description || '',
    fileName:    fileName    || null,
    jsCode:      jsCode      || null,
    url:         url         || null,
  });
  state.version = bumpPatchVersion(state.version);
  saveState(state);
  renderApps(currentSearchQuery());
}

function editApp(appId, { name, icon, description, fileName, jsCode, url }) {
  const targetApp = state.apps.find(app => app.id === appId);
  if (!targetApp) return;

  targetApp.name        = name;
  targetApp.icon        = icon        || ICON_BOLT;
  targetApp.description = description || '';

  if (jsCode) {
    targetApp.fileName = fileName;
    targetApp.jsCode   = jsCode;
    targetApp.url      = null;
  } else if (url) {
    targetApp.url      = url;
    targetApp.fileName = null;
    targetApp.jsCode   = null;
  }

  state.version = bumpPatchVersion(state.version);
  saveState(state);
  renderApps(currentSearchQuery());
}

function removeApp(appId) {
  const targetApp = state.apps.find(app => app.id === appId);
  const appName   = targetApp ? targetApp.name : 'this app';

  if (!confirm(`Remove "${appName}"? This cannot be undone.`)) return;

  state.apps    = state.apps.filter(app => app.id !== appId);
  state.version = bumpPatchVersion(state.version);
  saveState(state);
  renderApps(currentSearchQuery());
}

function currentSearchQuery() {
  const searchInput = document.getElementById('searchInput');
  return searchInput ? searchInput.value : '';
}

// ── SEARCH ────────────────────────────────────────────────────
document.getElementById('searchInput').addEventListener('input', (event) => {
  renderAppGrid(event.target.value);
});

// Press "/" anywhere (outside an input) to focus the search box
document.addEventListener('keydown', (event) => {
  const activeElement = document.activeElement;
  const isTypingInInput = activeElement.tagName === 'INPUT'
    || activeElement.tagName === 'TEXTAREA'
    || activeElement.isContentEditable;

  if (event.key === '/' && !isTypingInInput && !appViewerEl.classList.contains('app-viewer--open')) {
    event.preventDefault();
    const appsTabBlade = document.querySelector('[data-tab="apps"]');
    appsTabBlade?.click();
    setTimeout(() => document.getElementById('searchInput')?.focus(), 60);
  }
});

// ── MODAL ─────────────────────────────────────────────────────
const modalBackdrop  = document.getElementById('modalBackdrop');
const addModal       = document.getElementById('addModal');
const modalTitle     = document.getElementById('modalTitle');
const modalSubmitBtn = document.getElementById('modalSubmitBtn');
const dropZone       = document.getElementById('dropZone');
const inputFile      = document.getElementById('inputFile');
const inputUrl       = document.getElementById('inputUrl');
const fileHint       = document.getElementById('fileHint');
const modalError     = document.getElementById('modalError');

let editingAppId    = null;
let pendingFileName = '';
let pendingJsCode   = null;

function processSelectedFile(file) {
  const fileReader = new FileReader();
  fileReader.onload = (readEvent) => {
    pendingJsCode      = readEvent.target.result;
    pendingFileName    = file.name;
    fileHint.innerHTML = `${ICON_CHECK} ${file.name}`;
    inputUrl.value     = '';
  };
  fileReader.readAsText(file);
}

inputFile.addEventListener('change', () => {
  const selectedFile = inputFile.files[0];
  if (!selectedFile) {
    pendingFileName      = '';
    pendingJsCode        = null;
    fileHint.textContent = '';
    return;
  }
  processSelectedFile(selectedFile);
});

dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropZone.classList.add('drop-zone--active');
});

['dragleave', 'dragend'].forEach(eventName => {
  dropZone.addEventListener(eventName, () => dropZone.classList.remove('drop-zone--active'));
});

dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropZone.classList.remove('drop-zone--active');
  const droppedFile = event.dataTransfer.files[0];
  if (droppedFile) processSelectedFile(droppedFile);
});

// Selecting a URL clears any pending file selection
inputUrl.addEventListener('input', () => {
  if (inputUrl.value.trim()) {
    inputFile.value      = '';
    pendingFileName      = '';
    pendingJsCode        = null;
    fileHint.textContent = '';
  }
});

function resetModalFileState() {
  pendingFileName      = '';
  pendingJsCode        = null;
  inputFile.value      = '';
  fileHint.textContent = '';
}

function openAddModal() {
  editingAppId = null;
  resetModalFileState();

  modalTitle.textContent     = 'Add App';
  modalSubmitBtn.textContent = 'Add App';
  inputUrl.value         = '';
  modalError.textContent = '';

  modalBackdrop.classList.add('modal-backdrop--open');
  addModal.classList.add('modal--open');
  // Delay focus until the open animation has started so browsers register it.
  setTimeout(() => inputUrl.focus(), 50);
}

function openEditModal(app) {
  editingAppId = app.id;
  resetModalFileState();

  modalTitle.textContent     = 'Edit App';
  modalSubmitBtn.textContent = 'Save Changes';
  inputUrl.value = app.url || '';

  if (app.fileName) fileHint.textContent = `current: ${app.fileName}`;

  modalError.textContent = '';

  modalBackdrop.classList.add('modal-backdrop--open');
  addModal.classList.add('modal--open');
  setTimeout(() => inputUrl.focus(), 50);
}

function closeAddModal() {
  modalBackdrop.classList.remove('modal-backdrop--open');
  addModal.classList.remove('modal--open');
  editingAppId = null;
  resetModalFileState();
}

function submitModal() {
  const appUrl = inputUrl.value.trim();

  if (editingAppId) {
    if (pendingJsCode) {
      const meta = extractAppMeta(pendingJsCode, pendingFileName.replace(/\.js$/i, ''));
      editApp(editingAppId, {
        name:        meta.name,
        icon:        meta.icon,
        description: meta.description,
        fileName:    pendingFileName,
        jsCode:      pendingJsCode,
        url:         null,
      });
    } else if (appUrl) {
      // Preserve the existing icon/description — they'll be synced from the
      // fetched code the next time the app is opened via openAppViewer.
      const existingApp = state.apps.find(stateApp => stateApp.id === editingAppId);
      editApp(editingAppId, {
        name:        deriveNameFromUrl(appUrl),
        icon:        existingApp?.icon        || ICON_BOLT,
        description: existingApp?.description || '',
        fileName:    null,
        jsCode:      null,
        url:         appUrl,
      });
    }
  } else {
    if (!pendingJsCode && !appUrl) {
      modalError.textContent = 'Pick a .js file or enter a URL.';
      return;
    }

    if (pendingJsCode) {
      const meta = extractAppMeta(pendingJsCode, pendingFileName.replace(/\.js$/i, ''));
      addApp({
        name:        meta.name,
        icon:        meta.icon,
        description: meta.description,
        fileName:    pendingFileName,
        jsCode:      pendingJsCode,
        url:         null,
      });
    } else {
      addApp({
        name:        deriveNameFromUrl(appUrl),
        icon:        ICON_BOLT,
        description: '',
        fileName:    null,
        jsCode:      null,
        url:         appUrl,
      });
    }
  }

  closeAddModal();
}

addModal.addEventListener('keydown', (event) => {
  if (event.key === 'Enter')  submitModal();
  if (event.key === 'Escape') closeAddModal();
});

window.openAddModal  = openAddModal;
window.closeAddModal = closeAddModal;
window.submitModal   = submitModal;

// ── ICON RENDERING ───────────────────────────────────────────

/**
 * Generates a deterministic hue (0–359) from an app name string.
 * This keeps each app's avatar color consistent across reloads.
 */
function deriveHueFromName(appName) {
  return Array.from(appName || '').reduce(
    (accumulated, character) => accumulated + character.charCodeAt(0),
    0
  ) % 360;
}

/**
 * Builds an inline SVG showing the first letter of the app name
 * on a colored rounded-rect background. Used as a fallback when
 * the stored icon is not an SVG (e.g. leftover emoji strings).
 */
function buildLetterAvatarSvg(appName) {
  const firstLetter = (appName || '?')[0].toUpperCase();
  const hue         = deriveHueFromName(appName);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true">`
       + `<rect width="24" height="24" rx="5" fill="hsl(${hue},45%,30%)"/>`
       + `<text x="12" y="17" text-anchor="middle" font-family="system-ui,Arial,sans-serif" `
       + `font-size="13" font-weight="800" fill="hsl(${hue},60%,85%)">${firstLetter}</text>`
       + `</svg>`;
}

/**
 * Returns the best renderable icon for an app.
 * If the stored icon is already an SVG string it is used directly;
 * otherwise a letter-avatar is generated from the app name.
 * This avoids rendering bare emoji, which look inconsistent across platforms.
 */
function renderIconForApp(app) {
  const storedIcon = app.icon || '';
  if (storedIcon.startsWith('<svg')) return storedIcon;
  return buildLetterAvatarSvg(app.name);
}

// ── APP METADATA HELPERS ──────────────────────────────────────
// JS files declare metadata via comment annotations at the top:
//
//   // @name        My Clock
//   // @icon        ⚡              ← emoji
//   // @icon        folder          ← named icon (see NAMED_ICONS in icons.js)
//   // @icon        <svg>…</svg>    ← raw inline SVG (single line)
//   // @description Shows the current time

// Resolves a raw @icon value to a renderable string.
// Priority: named icon → raw value (emoji or inline SVG) → default bolt.
function resolveIcon(rawValue) {
  if (!rawValue) return ICON_BOLT;
  const namedMatch = NAMED_ICONS[rawValue.toLowerCase()];
  return namedMatch ?? rawValue;
}

function extractAppMeta(jsCode, fallbackName) {
  const nameMatch = jsCode.match(/^\/\/ @name (.+)$/m);
  const iconMatch = jsCode.match(/^\/\/ @icon (.+)$/m);
  const descMatch = jsCode.match(/^\/\/ @description (.+)$/m);
  return {
    name:        nameMatch ? nameMatch[1].trim() : fallbackName,
    icon:        resolveIcon(iconMatch ? iconMatch[1].trim() : null),
    description: descMatch ? descMatch[1].trim() : '',
  };
}

function deriveNameFromUrl(urlString) {
  try {
    const pathname    = new URL(urlString).pathname;
    const lastSegment = pathname.split('/').filter(Boolean).pop() || 'App';
    return lastSegment.replace(/\.js$/i, '');
  } catch {
    return 'App';
  }
}

// ── INIT ──────────────────────────────────────────────────────
renderApps();
