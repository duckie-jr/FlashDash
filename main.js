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
}
updateClock();
setInterval(updateClock, 10_000);

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

function buildQuickTile(app) {
  const tile = document.createElement('div');
  tile.className = 'gtile';
  tile.innerHTML = `
    <div class="gtile__icon">${app.icon}</div>
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
    <div class="app-card__icon">${app.icon}</div>
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
const appViewerEl    = document.getElementById('appViewer');
const appViewerFrame = document.getElementById('appViewerFrame');
const appViewerIcon  = document.getElementById('appViewerIcon');
const appViewerTitle = document.getElementById('appViewerTitle');

function buildAppSrcdoc(appName, jsCode) {
  const safeJsCode = jsCode.replace(/<\/script/gi, '<\\/script');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${appName}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, Arial, sans-serif; background: #fff; color: #111; }
  </style>
</head>
<body>
<script>
${safeJsCode}
<\/script>
</body>
</html>`;
}

function buildLoadingHtml(appName) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;
         justify-content:center;background:#111;color:#888;font-family:system-ui,sans-serif;gap:14px}
    .spinner{width:32px;height:32px;border:3px solid #2a2a2a;border-top-color:#52B043;
             border-radius:50%;animation:spin .7s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    .label{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}
  </style></head>
  <body>
    <div class="spinner"></div>
    <div class="label">Loading ${appName}</div>
  </body></html>`;
}

function buildErrorHtml(message) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;
         justify-content:center;background:#111;color:#c44;font-family:system-ui,sans-serif;gap:10px}
    .title{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px}
    .detail{font-size:11px;color:#555;max-width:340px;text-align:center;line-height:1.6}
  </style></head>
  <body>
    <div class="title">Failed to load</div>
    <div class="detail">${message}</div>
  </body></html>`;
}

function openAppViewer(app) {
  appViewerIcon.innerHTML    = app.icon;
  appViewerTitle.textContent = app.name;
  appViewerEl.classList.add('app-viewer--open');
  appViewerFrame.setAttribute('sandbox', 'allow-scripts');

  if (app.url) {
    appViewerFrame.srcdoc = buildLoadingHtml(app.name);

    fetch(app.url)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then(fetchedJsCode => {
        appViewerFrame.srcdoc = buildAppSrcdoc(app.name, fetchedJsCode);
      })
      .catch(fetchError => {
        appViewerFrame.srcdoc = buildErrorHtml(fetchError.message);
      });
  } else {
    appViewerFrame.srcdoc = buildAppSrcdoc(app.name, app.jsCode);
  }
}

function closeAppViewer() {
  appViewerFrame.removeAttribute('src');
  appViewerFrame.srcdoc = '';
  appViewerEl.classList.remove('app-viewer--open');
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
  inputUrl.focus();
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
  inputUrl.focus();
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
      editApp(editingAppId, {
        name:        deriveNameFromUrl(appUrl),
        icon:        ICON_BOLT,
        description: '',
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
