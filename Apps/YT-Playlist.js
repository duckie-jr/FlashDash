// @name        YT Playlist
// @icon        <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#ff0000"/><path d="M9.5 7.5v9l7-4.5z" fill="#fff"/></svg>
// @description YouTube playlist manager — queue videos and open to watch

(function () {
  const store = typeof FlashDash !== 'undefined' ? FlashDash.storage : null;
  function loadPlaylist() { try { return JSON.parse(store?.getItem('yt_pl') || '[]'); } catch { return []; } }
  function persist() { store?.setItem('yt_pl', JSON.stringify(playlist)); }

  let playlist     = loadPlaylist();
  let currentIndex = playlist.length > 0 ? 0 : -1;
  let shuffleOn    = false;

  function extractId(raw) {
    const s = raw.trim();
    let m;
    if ((m = s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/)))  return m[1];
    if ((m = s.match(/[?&]v=([A-Za-z0-9_-]{11})/)))       return m[1];
    if ((m = s.match(/shorts\/([A-Za-z0-9_-]{11})/)))      return m[1];
    if ((m = s.match(/embed\/([A-Za-z0-9_-]{11})/)))       return m[1];
    if (/^[A-Za-z0-9_-]{11}$/.test(s))                    return s;
    return null;
  }

  async function fetchInfo(id) {
    try {
      const r = await fetch(`https://www.youtube.com/oembed?url=https://youtu.be/${id}&format=json`);
      if (!r.ok) return {};
      const d = await r.json();
      return { title: d.title || '', channel: d.author_name || '' };
    } catch { return {}; }
  }

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function thumb(id, q='hqdefault') { return `https://img.youtube.com/vi/${id}/${q}.jpg`; }

  // ── Styles ─────────────────────────────────────────────────
  document.head.insertAdjacentHTML('beforeend', `<style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      height: 100vh; display: flex; flex-direction: column;
      background: #080808; color: #f1f1f1;
      font-family: 'Segoe UI', system-ui, Arial, sans-serif;
      overflow: hidden; user-select: none;
    }

    /* Top bar */
    .bar {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 14px; background: #080808;
      border-bottom: 1px solid #1c1c1c; flex-shrink: 0; z-index: 20;
    }
    .brand { display: flex; align-items: center; gap: 7px; flex-shrink: 0; }
    .brand-pill {
      background: #ff0000; border-radius: 5px;
      width: 28px; height: 20px;
      display: flex; align-items: center; justify-content: center;
    }
    .brand-name { font-size: 13px; font-weight: 800; color: #f1f1f1; white-space: nowrap; }
    .brand-name b { color: #ff3333; }

    .url-in {
      flex: 1; min-width: 0;
      background: #141414; border: 1px solid #252525; border-radius: 22px;
      color: #f1f1f1; font-family: inherit; font-size: 12px;
      padding: 6px 16px; outline: none; user-select: text;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .url-in:focus { border-color: #ff0000; box-shadow: 0 0 0 2px rgba(255,0,0,0.15); }
    .url-in::placeholder { color: #333; }
    .url-in.shake { animation: shake 0.3s; border-color: #922 !important; }
    @keyframes shake {
      0%,100% { transform: translateX(0); }
      25%,75%  { transform: translateX(-4px); }
      50%      { transform: translateX(4px); }
    }

    .add-btn {
      flex-shrink: 0; background: #ff0000; color: #fff; border: none;
      border-radius: 5px; padding: 7px 18px; font-size: 12px; font-weight: 800;
      cursor: pointer; font-family: inherit; text-transform: uppercase;
      letter-spacing: 0.5px; transition: background 0.12s, transform 0.1s;
    }
    .add-btn:hover  { background: #d50000; }
    .add-btn:active { transform: scale(0.96); }

    /* Layout */
    .layout { display: flex; flex: 1; overflow: hidden; }

    /* Sidebar */
    .sb {
      width: 258px; flex-shrink: 0; background: #0c0c0c;
      border-right: 1px solid #191919;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .sb-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px 9px; border-bottom: 1px solid #171717; flex-shrink: 0;
    }
    .sb-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #3a3a3a; }
    .sb-count  { font-size: 10px; color: #272727; font-weight: 700; }
    .sb-list {
      flex: 1; overflow-y: auto;
      scrollbar-width: thin; scrollbar-color: #1e1e1e transparent;
    }
    .sb-list::-webkit-scrollbar       { width: 3px; }
    .sb-list::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }
    .sb-list::-webkit-scrollbar-thumb:hover { background: #ff0000; }

    /* Empty state */
    .qe { padding: 52px 20px; text-align: center; }
    .qe-icon  { font-size: 28px; opacity: 0.12; display: block; margin-bottom: 12px; }
    .qe-title { font-size: 10px; color: #252525; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 6px; }
    .qe-sub   { font-size: 10px; color: #1e1e1e; line-height: 1.8; }

    /* Queue item */
    .qi {
      display: flex; align-items: center; gap: 9px;
      padding: 7px 10px 7px 4px;
      border-left: 3px solid transparent; cursor: pointer;
      transition: background 0.1s;
    }
    .qi:hover { background: #121212; }
    .qi.act   { background: rgba(255,0,0,0.05) !important; border-left-color: #ff0000; }
    .qi-num   { font-size: 9px; color: #262626; width: 18px; text-align: right; flex-shrink: 0; font-variant-numeric: tabular-nums; font-weight: 700; }
    .qi.act .qi-num { color: #ff3333; }
    .qi-thumb { width: 80px; height: 45px; object-fit: cover; border-radius: 3px; background: #1a1a1a; flex-shrink: 0; display: block; }
    .qi-info  { flex: 1; min-width: 0; }
    .qi-title {
      font-size: 11px; font-weight: 600; color: #777; line-height: 1.35;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .qi.act .qi-title { color: #eee; }
    .qi-title.load    { color: #252525; font-style: italic; }
    .qi-ch  { font-size: 10px; color: #2a2a2a; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .qi.act .qi-ch { color: #555; }
    .qi-del {
      opacity: 0; background: none; border: none; color: #333; font-size: 11px;
      cursor: pointer; padding: 4px 5px; border-radius: 3px; line-height: 1; flex-shrink: 0;
      transition: opacity 0.1s, color 0.1s, background 0.1s;
    }
    .qi:hover .qi-del { opacity: 1; }
    .qi-del:hover { color: #ff4444; background: rgba(255,0,0,0.1); }

    /* Stage — fills all remaining space */
    .stage {
      flex: 1; position: relative; overflow: hidden; background: #000;
      display: flex; flex-direction: column;
    }

    /* Full-bleed background image */
    .stage-bg {
      position: absolute; inset: 0;
      width: 100%; height: 100%; object-fit: cover; display: block;
      filter: brightness(0.45) saturate(1.2);
      transition: opacity 0.3s ease;
    }
    .stage-bg.fading { opacity: 0; }

    /* Bottom gradient */
    .stage-grad {
      position: absolute; inset: 0; z-index: 1;
      background: linear-gradient(to top,
        rgba(0,0,0,0.97) 0%,
        rgba(0,0,0,0.7)  28%,
        rgba(0,0,0,0.15) 60%,
        transparent      100%
      );
    }

    /* Overlay content pinned to bottom */
    .stage-over {
      position: absolute; bottom: 0; left: 0; right: 0;
      z-index: 2; padding: 0 28px 22px;
      display: none; flex-direction: column; gap: 5px;
    }
    .stage-over.visible { display: flex; }

    .stage-title {
      font-size: 24px; font-weight: 800; color: #fff; line-height: 1.25;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
      text-shadow: 0 2px 12px rgba(0,0,0,0.6);
    }
    .stage-title.load { font-size: 14px; color: #2e2e2e; font-style: italic; font-weight: 500; }
    .stage-ch { font-size: 13px; color: rgba(255,255,255,0.45); margin-bottom: 4px; }

    .stage-actions { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }

    .btn-watch {
      display: flex; align-items: center; gap: 7px;
      background: #ff0000; color: #fff; border: none; border-radius: 5px;
      padding: 9px 22px; font-size: 13px; font-weight: 800;
      cursor: pointer; font-family: inherit;
      transition: background 0.12s, transform 0.1s;
    }
    .btn-watch:hover  { background: #cc0000; }
    .btn-watch:active { transform: scale(0.97); }

    .btn-copy {
      display: flex; align-items: center; gap: 6px;
      background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.6);
      border: 1px solid rgba(255,255,255,0.1); border-radius: 5px;
      padding: 8px 16px; font-size: 13px; font-weight: 700;
      cursor: pointer; font-family: inherit;
      transition: background 0.12s, color 0.12s;
    }
    .btn-copy:hover  { background: rgba(255,255,255,0.13); color: #fff; }
    .btn-copy.ok     { color: #4caf50; border-color: rgba(76,175,80,0.35); }

    /* Controls row */
    .stage-ctrl {
      display: flex; align-items: center; gap: 8px;
      padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.07);
    }
    .c-btn {
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.09);
      border-radius: 4px; color: rgba(255,255,255,0.5);
      padding: 5px 14px; font-size: 11px; font-weight: 700;
      cursor: pointer; font-family: inherit; white-space: nowrap;
      transition: background 0.1s, color 0.1s;
    }
    .c-btn:hover:not(:disabled) { background: rgba(255,255,255,0.12); color: #fff; }
    .c-btn:disabled { opacity: 0.18; pointer-events: none; }
    .c-btn.on { background: rgba(255,0,0,0.18); color: #ff5555; border-color: rgba(255,0,0,0.28); }
    .c-pos {
      flex: 1; text-align: center; font-size: 11px;
      color: rgba(255,255,255,0.2); font-weight: 700; font-variant-numeric: tabular-nums;
    }
    .c-pos.on { color: rgba(255,255,255,0.4); }

    /* Empty stage */
    .stage-empty {
      position: absolute; inset: 0; z-index: 3;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 14px; background: #050505;
    }
    .stage-empty-ring {
      width: 72px; height: 72px; border-radius: 50%;
      background: #111; border: 1px solid #1e1e1e;
      display: flex; align-items: center; justify-content: center;
    }
    .stage-empty-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #222; }
    .stage-empty-sub   { font-size: 11px; color: #1a1a1a; }
  </style>`);

  // ── HTML ──────────────────────────────────────────────────
  document.body.innerHTML = `
    <div class="bar">
      <div class="brand">
        <div class="brand-pill">
          <svg width="10" height="10" viewBox="0 0 12 12">
            <path d="M3 2v8l7-4z" fill="white"/>
          </svg>
        </div>
        <span class="brand-name"><b>YT</b> Playlist</span>
      </div>
      <input id="urlIn" class="url-in" placeholder="Paste YouTube URL or video ID…" autocomplete="off" spellcheck="false" />
      <button id="addBtn" class="add-btn">+ Add</button>
    </div>

    <div class="layout">
      <div class="sb">
        <div class="sb-head">
          <span class="sb-label">Queue</span>
          <span class="sb-count" id="sbCount">0 videos</span>
        </div>
        <div class="sb-list" id="sbList"></div>
      </div>

      <div class="stage" id="stage">
        <img class="stage-bg" id="stageBg" src="" alt="" />
        <div class="stage-grad"></div>

        <div class="stage-over" id="stageOver">
          <div class="stage-title" id="stageTitle"></div>
          <div class="stage-ch"    id="stageCh"></div>
          <div class="stage-actions">
            <button class="btn-watch" id="watchBtn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              Watch on YouTube
            </button>
            <button class="btn-copy" id="copyBtn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy Link
            </button>
          </div>
          <div class="stage-ctrl">
            <button class="c-btn" id="prevBtn" disabled>⏮ Prev</button>
            <div    class="c-pos" id="cPos">— / —</div>
            <button class="c-btn" id="nextBtn" disabled>Next ⏭</button>
            <button class="c-btn" id="shuffleBtn" disabled>⇄ Shuffle</button>
          </div>
        </div>

        <div class="stage-empty" id="stageEmpty">
          <div class="stage-empty-ring">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2a2a2a" stroke-width="1.5" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
          <div class="stage-empty-title">Queue is empty</div>
          <div class="stage-empty-sub">Paste a YouTube URL above to get started</div>
        </div>
      </div>
    </div>
  `;

  // ── Refs ──────────────────────────────────────────────────
  const urlIn      = document.getElementById('urlIn');
  const addBtn     = document.getElementById('addBtn');
  const sbList     = document.getElementById('sbList');
  const sbCount    = document.getElementById('sbCount');
  const stageBg    = document.getElementById('stageBg');
  const stageOver  = document.getElementById('stageOver');
  const stageEmpty = document.getElementById('stageEmpty');
  const stageTitle = document.getElementById('stageTitle');
  const stageCh    = document.getElementById('stageCh');
  const watchBtn   = document.getElementById('watchBtn');
  const copyBtn    = document.getElementById('copyBtn');
  const prevBtn    = document.getElementById('prevBtn');
  const nextBtn    = document.getElementById('nextBtn');
  const shuffleBtn = document.getElementById('shuffleBtn');
  const cPos       = document.getElementById('cPos');

  // ── Render stage ─────────────────────────────────────────
  function renderStage() {
    const hasVideo = currentIndex >= 0 && currentIndex < playlist.length;
    stageEmpty.style.display = hasVideo ? 'none' : 'flex';
    stageOver.classList.toggle('visible', hasVideo);

    if (!hasVideo) {
      stageBg.src         = '';
      cPos.textContent    = '— / —';
      cPos.className      = 'c-pos';
      return;
    }

    const v = playlist[currentIndex];

    // Crossfade background
    stageBg.classList.add('fading');
    setTimeout(() => {
      stageBg.src     = thumb(v.id, 'maxresdefault');
      stageBg.onerror = () => { stageBg.src = thumb(v.id, 'hqdefault'); };
      stageBg.classList.remove('fading');
    }, 160);

    stageTitle.textContent = v.title   || '';
    stageTitle.className   = 'stage-title' + (v.title ? '' : ' load');
    stageCh.textContent    = v.channel ? `by ${v.channel}` : '';
    cPos.textContent       = `${currentIndex + 1} / ${playlist.length}`;
    cPos.className         = 'c-pos on';

    watchBtn.onclick = () => window.open(`https://www.youtube.com/watch?v=${v.id}`, '_blank');
    copyBtn.onclick  = () => {
      navigator.clipboard?.writeText(`https://youtu.be/${v.id}`).then(() => {
        copyBtn.classList.add('ok');
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => {
          copyBtn.classList.remove('ok');
          copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Link`;
        }, 1800);
      });
    };
  }

  // ── Render sidebar ────────────────────────────────────────
  function renderSidebar() {
    const count = playlist.length;
    sbCount.textContent = count === 1 ? '1 video' : `${count} videos`;
    prevBtn.disabled    = count === 0;
    nextBtn.disabled    = count === 0;
    shuffleBtn.disabled = count < 2;

    if (count === 0) {
      sbList.innerHTML = `
        <div class="qe">
          <span class="qe-icon">▶</span>
          <div class="qe-title">Nothing here yet</div>
          <div class="qe-sub">Paste a YouTube URL<br>in the bar above</div>
        </div>`;
      return;
    }

    sbList.innerHTML = '';
    playlist.forEach((v, i) => {
      const el = document.createElement('div');
      el.className = 'qi' + (i === currentIndex ? ' act' : '');
      el.innerHTML = `
        <div class="qi-num">${i + 1}</div>
        <img class="qi-thumb" src="${thumb(v.id, 'mqdefault')}" loading="lazy" alt="" />
        <div class="qi-info">
          <div class="qi-title ${v.title ? '' : 'load'}">${v.title ? esc(v.title) : 'Loading…'}</div>
          ${v.channel ? `<div class="qi-ch">${esc(v.channel)}</div>` : ''}
        </div>
        <button class="qi-del" title="Remove">✕</button>`;

      el.addEventListener('click', (e) => {
        if (e.target.closest('.qi-del')) return;
        currentIndex = i;
        render();
      });
      el.querySelector('.qi-del').addEventListener('click', (e) => {
        e.stopPropagation();
        playlist.splice(i, 1);
        if (currentIndex >= playlist.length) currentIndex = playlist.length - 1;
        persist();
        render();
      });
      sbList.appendChild(el);
    });

    sbList.querySelector('.qi.act')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function render() { renderStage(); renderSidebar(); }

  // ── Add video ─────────────────────────────────────────────
  async function addVideo() {
    const raw = urlIn.value.trim();
    if (!raw) return;
    const id = extractId(raw);
    if (!id) {
      urlIn.classList.add('shake');
      setTimeout(() => urlIn.classList.remove('shake'), 400);
      return;
    }
    const existing = playlist.findIndex(v => v.id === id);
    if (existing !== -1) { currentIndex = existing; urlIn.value = ''; render(); return; }

    const entry = { id, title: '', channel: '' };
    playlist.push(entry);
    if (currentIndex < 0) currentIndex = 0;
    urlIn.value = '';
    persist();
    render();

    const info  = await fetchInfo(id);
    entry.title   = info.title   || id;
    entry.channel = info.channel || '';
    persist();
    render();
  }

  // ── Controls ──────────────────────────────────────────────
  function goPrev() {
    if (!playlist.length) return;
    currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    render();
  }
  function goNext() {
    if (!playlist.length) return;
    currentIndex = (currentIndex + 1) % playlist.length;
    render();
  }

  addBtn.addEventListener('click', addVideo);
  urlIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') addVideo(); });
  prevBtn.addEventListener('click', goPrev);
  nextBtn.addEventListener('click', goNext);
  shuffleBtn.addEventListener('click', () => {
    if (playlist.length < 2) return;
    const cur = playlist[currentIndex];
    for (let i = playlist.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playlist[i], playlist[j]] = [playlist[j], playlist[i]];
    }
    currentIndex = playlist.findIndex(v => v.id === cur?.id);
    if (currentIndex < 0) currentIndex = 0;
    shuffleOn = !shuffleOn;
    shuffleBtn.classList.toggle('on', shuffleOn);
    persist();
    render();
  });

  document.addEventListener('keydown', (e) => {
    if (document.activeElement === urlIn) return;
    if (e.key === 'ArrowLeft')  goPrev();
    if (e.key === 'ArrowRight') goNext();
  });

  render();
})();
