// @name        YT Playlist
// @icon        📺
// @description Add YouTube videos, build a playlist, watch in-app

(function () {
  // ── Storage ────────────────────────────────────────────────
  const fdStorage = typeof FlashDash !== 'undefined' ? FlashDash.storage : null;

  function loadPlaylist() {
    try { return JSON.parse(fdStorage?.getItem('playlist') || '[]'); } catch { return []; }
  }
  function persistPlaylist() {
    fdStorage?.setItem('playlist', JSON.stringify(playlist));
  }

  // ── State ──────────────────────────────────────────────────
  let playlist     = loadPlaylist();
  let currentIndex = playlist.length > 0 ? 0 : -1;
  let shuffleActive = false;

  // ── Helpers ────────────────────────────────────────────────
  function extractVideoId(raw) {
    const s = raw.trim();
    let m;
    if ((m = s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/)))  return m[1];
    if ((m = s.match(/[?&]v=([A-Za-z0-9_-]{11})/)))       return m[1];
    if ((m = s.match(/shorts\/([A-Za-z0-9_-]{11})/)))      return m[1];
    if (/^[A-Za-z0-9_-]{11}$/.test(s))                    return s;
    return null;
  }

  async function fetchTitle(videoId) {
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=https://youtu.be/${videoId}&format=json`
      );
      if (!res.ok) return null;
      return (await res.json()).title || null;
    } catch { return null; }
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Styles ─────────────────────────────────────────────────
  document.head.insertAdjacentHTML('beforeend', `<style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      height: 100vh;
      display: flex;
      flex-direction: column;
      background: #0f0f0f;
      color: #f1f1f1;
      font-family: 'Segoe UI', Arial, sans-serif;
      overflow: hidden;
    }

    /* ── Top bar ── */
    .topbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #0a0a0a;
      border-bottom: 2px solid #ff0000;
      flex-shrink: 0;
    }
    .topbar__logo {
      font-size: 14px;
      font-weight: 900;
      color: #ff0000;
      white-space: nowrap;
      user-select: none;
      letter-spacing: -0.5px;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .topbar__logo svg { font-size: 16px; }
    .topbar__logo em { color: #f1f1f1; font-style: normal; }
    .topbar__input {
      flex: 1;
      min-width: 0;
      background: #1a1a1a;
      border: 1px solid #2e2e2e;
      border-radius: 20px;
      color: #f1f1f1;
      font-family: inherit;
      font-size: 12px;
      padding: 6px 14px;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .topbar__input:focus { border-color: #ff0000; box-shadow: 0 0 0 3px rgba(255,0,0,0.12); }
    .topbar__input::placeholder { color: #444; }
    .topbar__input--shake { animation: shake 0.35s ease; border-color: #c44 !important; }
    @keyframes shake {
      0%,100% { transform: translateX(0); }
      20%,60%  { transform: translateX(-5px); }
      40%,80%  { transform: translateX(5px); }
    }
    .topbar__btn {
      flex-shrink: 0;
      background: #ff0000;
      color: #fff;
      border: none;
      border-radius: 4px;
      padding: 6px 16px;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      font-family: inherit;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      transition: background 0.15s, transform 0.1s;
      white-space: nowrap;
    }
    .topbar__btn:hover  { background: #cc0000; }
    .topbar__btn:active { transform: scale(0.96); }

    /* ── Layout ── */
    .layout {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* ── Sidebar ── */
    .sidebar {
      width: 250px;
      flex-shrink: 0;
      background: #111;
      border-right: 1px solid #1e1e1e;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .sidebar__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 9px 12px;
      border-bottom: 1px solid #1a1a1a;
      flex-shrink: 0;
    }
    .sidebar__label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #555;
    }
    .sidebar__count {
      font-size: 10px;
      color: #3a3a3a;
      font-weight: 600;
    }
    .sidebar__list {
      flex: 1;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: #252525 transparent;
    }
    .sidebar__list::-webkit-scrollbar { width: 4px; }
    .sidebar__list::-webkit-scrollbar-thumb { background: #252525; border-radius: 2px; }
    .sidebar__list::-webkit-scrollbar-thumb:hover { background: #ff0000; }

    /* ── Empty sidebar state ── */
    .queue-empty {
      padding: 40px 16px;
      text-align: center;
      color: #333;
      line-height: 2;
    }
    .queue-empty__icon { font-size: 36px; display: block; margin-bottom: 10px; }
    .queue-empty__msg  { font-size: 11px; font-weight: 600; }

    /* ── Playlist item ── */
    .pl-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px 7px 6px;
      cursor: pointer;
      border-left: 3px solid transparent;
      transition: background 0.1s, border-color 0.1s;
      user-select: none;
    }
    .pl-item:hover { background: #191919; }
    .pl-item--active {
      background: rgba(255, 0, 0, 0.07) !important;
      border-left-color: #ff0000;
    }
    .pl-item__num {
      font-size: 10px;
      color: #3a3a3a;
      width: 16px;
      text-align: right;
      flex-shrink: 0;
      font-variant-numeric: tabular-nums;
    }
    .pl-item--active .pl-item__num {
      color: #ff4444;
      font-weight: 800;
    }
    .pl-item__thumb {
      width: 64px;
      height: 36px;
      border-radius: 3px;
      object-fit: cover;
      flex-shrink: 0;
      background: #1e1e1e;
      display: block;
    }
    .pl-item__info { flex: 1; min-width: 0; }
    .pl-item__title {
      font-size: 11px;
      font-weight: 600;
      line-height: 1.4;
      color: #bbb;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .pl-item--active .pl-item__title { color: #f1f1f1; }
    .pl-item__title--loading { color: #3a3a3a; font-style: italic; }
    .pl-item__del {
      opacity: 0;
      flex-shrink: 0;
      background: transparent;
      border: none;
      color: #555;
      font-size: 13px;
      line-height: 1;
      cursor: pointer;
      padding: 3px 5px;
      border-radius: 3px;
      transition: opacity 0.12s, color 0.12s, background 0.12s;
    }
    .pl-item:hover .pl-item__del { opacity: 1; }
    .pl-item__del:hover { color: #ff5555; background: rgba(255,0,0,0.12); }

    /* ── Player area ── */
    .player {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #000;
    }
    .player__wrap {
      flex: 1;
      position: relative;
    }
    .player__iframe {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }
    .player__empty {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      background: #0a0a0a;
    }
    .player__empty-icon {
      font-size: 60px;
      opacity: 0.15;
    }
    .player__empty-text {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #2a2a2a;
    }
    .player__empty-sub {
      font-size: 11px;
      color: #252525;
    }

    /* ── Controls bar ── */
    .controls {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 12px;
      background: #0a0a0a;
      border-top: 1px solid #181818;
      flex-shrink: 0;
    }
    .ctrl-btn {
      background: #1a1a1a;
      border: 1px solid #282828;
      border-radius: 4px;
      color: #888;
      padding: 5px 12px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      letter-spacing: 0.3px;
      white-space: nowrap;
      transition: background 0.12s, color 0.12s, border-color 0.12s;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .ctrl-btn:hover:not(:disabled) { background: #242424; color: #f1f1f1; border-color: #383838; }
    .ctrl-btn:disabled { opacity: 0.28; pointer-events: none; }
    .ctrl-btn--active  { background: rgba(255,0,0,0.14); color: #ff4444; border-color: rgba(255,0,0,0.28); }
    .now-playing {
      flex: 1;
      min-width: 0;
      text-align: center;
      font-size: 10px;
      color: #383838;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding: 0 8px;
    }
    .now-playing--active { color: #666; }
    .now-playing__pos { color: #ff4444; font-weight: 700; margin-right: 4px; }
  </style>`);

  // ── HTML ───────────────────────────────────────────────────
  document.body.innerHTML = `
    <div class="topbar">
      <div class="topbar__logo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8z"/>
          <polygon fill="#0f0f0f" points="9.75,15.5 15.5,12 9.75,8.5"/>
        </svg>
        <em>YT</em> Playlist
      </div>
      <input id="urlInput" class="topbar__input"
        placeholder="Paste YouTube URL, youtu.be link, or 11-char video ID…"
        autocomplete="off" spellcheck="false" />
      <button id="addBtn" class="topbar__btn">+ Add</button>
    </div>

    <div class="layout">
      <div class="sidebar">
        <div class="sidebar__head">
          <span class="sidebar__label">Queue</span>
          <span class="sidebar__count" id="sidebarCount">0 videos</span>
        </div>
        <div class="sidebar__list" id="sidebarList"></div>
      </div>

      <div class="player">
        <div class="player__wrap" id="playerWrap">
          <div class="player__empty" id="playerEmpty">
            <div class="player__empty-icon">▶</div>
            <div class="player__empty-text">Nothing queued</div>
            <div class="player__empty-sub">Paste a YouTube link above to get started</div>
          </div>
        </div>
        <div class="controls">
          <button class="ctrl-btn" id="prevBtn" disabled>⏮ Prev</button>
          <div class="now-playing" id="nowPlaying">No video selected</div>
          <button class="ctrl-btn" id="nextBtn" disabled>Next ⏭</button>
          <button class="ctrl-btn" id="shuffleBtn" disabled title="Shuffle queue order">⇄ Shuffle</button>
        </div>
      </div>
    </div>
  `;

  // ── Element refs ───────────────────────────────────────────
  const urlInput    = document.getElementById('urlInput');
  const addBtn      = document.getElementById('addBtn');
  const sidebarList = document.getElementById('sidebarList');
  const sidebarCount = document.getElementById('sidebarCount');
  const playerWrap  = document.getElementById('playerWrap');
  const playerEmpty = document.getElementById('playerEmpty');
  const prevBtn     = document.getElementById('prevBtn');
  const nextBtn     = document.getElementById('nextBtn');
  const shuffleBtn  = document.getElementById('shuffleBtn');
  const nowPlaying  = document.getElementById('nowPlaying');

  // ── Auto-advance: listen for YouTube ended postMessage ─────
  // YouTube iframes with enablejsapi=1 broadcast state-change events.
  // State 0 = ended → advance to next video automatically.
  window.addEventListener('message', (event) => {
    if (typeof event.data !== 'string') return;
    try {
      const msg = JSON.parse(event.data);
      if (msg.event === 'onStateChange' && msg.info === 0) {
        goNext();
      }
    } catch { /* non-JSON messages from other origins — ignore */ }
  });

  // ── Render: player iframe ──────────────────────────────────
  function renderPlayer() {
    const existingIframe = playerWrap.querySelector('.player__iframe');
    if (existingIframe) existingIframe.remove();

    const hasVideo = currentIndex >= 0 && currentIndex < playlist.length;
    playerEmpty.style.display = hasVideo ? 'none' : 'flex';

    if (!hasVideo) {
      nowPlaying.textContent = 'No video selected';
      nowPlaying.className   = 'now-playing';
      return;
    }

    const video  = playlist[currentIndex];
    const iframe = document.createElement('iframe');
    iframe.className = 'player__iframe';
    // enablejsapi=1 lets us receive state-change postMessages (auto-advance).
    // rel=0 suppresses YouTube's "more videos" end screen from other channels.
    iframe.src = `https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0&enablejsapi=1`;
    iframe.setAttribute('allow',
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen'
    );
    iframe.setAttribute('allowfullscreen', '');
    playerWrap.appendChild(iframe);

    nowPlaying.className = 'now-playing now-playing--active';
    nowPlaying.innerHTML =
      `<span class="now-playing__pos">${currentIndex + 1} / ${playlist.length}</span>`
      + escHtml(video.title || video.id);
  }

  // ── Render: sidebar queue ──────────────────────────────────
  function renderSidebar() {
    const count = playlist.length;
    sidebarCount.textContent = count === 1 ? '1 video' : `${count} videos`;

    const hasItems = count > 0;
    prevBtn.disabled    = !hasItems;
    nextBtn.disabled    = !hasItems;
    shuffleBtn.disabled = count < 2;

    if (!hasItems) {
      sidebarList.innerHTML = `
        <div class="queue-empty">
          <span class="queue-empty__icon">🎬</span>
          <span class="queue-empty__msg">
            Paste a YouTube URL above<br>to add your first video
          </span>
        </div>`;
      return;
    }

    sidebarList.innerHTML = '';
    playlist.forEach((video, index) => {
      const isActive = index === currentIndex;
      const item     = document.createElement('div');
      item.className = 'pl-item' + (isActive ? ' pl-item--active' : '');

      item.innerHTML = `
        <div class="pl-item__num">${index + 1}</div>
        <img class="pl-item__thumb"
          src="https://img.youtube.com/vi/${video.id}/mqdefault.jpg"
          loading="lazy" alt="" />
        <div class="pl-item__info">
          <div class="pl-item__title ${video.title ? '' : 'pl-item__title--loading'}">
            ${video.title ? escHtml(video.title) : 'Fetching title…'}
          </div>
        </div>
        <button class="pl-item__del" title="Remove from queue">✕</button>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.pl-item__del')) return;
        currentIndex = index;
        renderPlayer();
        renderSidebar();
      });

      item.querySelector('.pl-item__del').addEventListener('click', (e) => {
        e.stopPropagation();
        removeAt(index);
      });

      sidebarList.appendChild(item);
    });

    // Keep the active item visible when navigating via prev/next
    sidebarList.querySelector('.pl-item--active')
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function render() {
    renderPlayer();
    renderSidebar();
  }

  // ── Actions ────────────────────────────────────────────────
  function removeAt(index) {
    playlist.splice(index, 1);
    if (currentIndex >= playlist.length) {
      currentIndex = playlist.length - 1;
    }
    persistPlaylist();
    render();
  }

  function goPrev() {
    if (playlist.length === 0) return;
    currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    render();
  }

  function goNext() {
    if (playlist.length === 0) return;
    currentIndex = (currentIndex + 1) % playlist.length;
    render();
  }

  async function addVideo() {
    const raw = urlInput.value.trim();
    if (!raw) return;

    const videoId = extractVideoId(raw);
    if (!videoId) {
      urlInput.classList.add('topbar__input--shake');
      setTimeout(() => urlInput.classList.remove('topbar__input--shake'), 400);
      return;
    }

    // If already in queue, just jump to it instead of adding a duplicate
    const existingIndex = playlist.findIndex(v => v.id === videoId);
    if (existingIndex !== -1) {
      currentIndex   = existingIndex;
      urlInput.value = '';
      render();
      return;
    }

    // Optimistically add with empty title so UI responds immediately
    const entry = { id: videoId, title: '' };
    playlist.push(entry);
    if (currentIndex < 0) currentIndex = 0;
    urlInput.value = '';
    persistPlaylist();
    renderSidebar(); // show loading state right away

    // Fetch title in background; update once resolved
    const title = await fetchTitle(videoId);
    entry.title = title || videoId;
    persistPlaylist();
    renderSidebar();
  }

  function shuffleQueue() {
    if (playlist.length < 2) return;

    const currentVideo = playlist[currentIndex];

    // Fisher-Yates in-place shuffle
    for (let i = playlist.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playlist[i], playlist[j]] = [playlist[j], playlist[i]];
    }

    // Keep the currently playing video at the same logical position
    const newIndex = playlist.findIndex(v => v.id === currentVideo?.id);
    currentIndex = newIndex >= 0 ? newIndex : 0;

    shuffleActive = !shuffleActive;
    shuffleBtn.classList.toggle('ctrl-btn--active', shuffleActive);

    persistPlaylist();
    renderSidebar();
  }

  // ── Event listeners ────────────────────────────────────────
  addBtn.addEventListener('click', addVideo);
  urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addVideo(); });

  prevBtn.addEventListener('click', goPrev);
  nextBtn.addEventListener('click', goNext);
  shuffleBtn.addEventListener('click', shuffleQueue);

  // Keyboard shortcuts: ← prev, → next (when not focused on the input)
  document.addEventListener('keydown', (e) => {
    if (document.activeElement === urlInput) return;
    if (e.key === 'ArrowLeft')  goPrev();
    if (e.key === 'ArrowRight') goNext();
  });

  // ── Init ───────────────────────────────────────────────────
  render();
})();
