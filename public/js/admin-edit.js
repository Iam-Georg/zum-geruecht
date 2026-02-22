/**
 * Zum Gerücht – Admin Edit Mode
 * Am Ende von <body> einbinden: <script src="/js/admin-edit.js"></script>
 */
(function () {
  'use strict';

  const CONFIG = {
    loginEndpoint: '/api/login',
    logoutEndpoint: '/api/logout',
    checkAuthEndpoint: '/api/check-auth',
    saveEndpoint: '/api/save-html',
    uploadEndpoint: '/api/upload-image',
    imagesEndpoint: '/api/images',
  };

  const currentFile = window.location.pathname === '/' ?
    'index.html' :
    (window.location.pathname.replace(/^\//, '') || 'index.html') + (window.location.pathname.endsWith('.html') ? '' : '.html');


  // ─── State ───────────────────────────────────────────────────────────────────
  let isEditMode = false;
  let isAuthenticated = false;
  let allImages = [];
  let currentImgTarget = null;
  let hasUnsavedChanges = false;
  let undoStack = [];
  const UNDO_MAX = 50;
  let insertImgMode = false; // Bild an Cursorposition einfügen
  let savedRange = null; // Cursorposition vor Galerie-Öffnung

  // ─── Scroll-Lock ─────────────────────────────────────────────────────────────
  let scrollLockCount = 0;
  let savedScrollY = 0;

  function lockScroll() {
    if (scrollLockCount === 0) {
      savedScrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflowY = 'scroll';
    }
    scrollLockCount++;
  }

  function unlockScroll() {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflowY = '';
      window.scrollTo(0, savedScrollY);
    }
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────
  async function init() {
    injectStyles();
    injectAdminFooterLink();
    injectAdminBar();
    injectLoginModal();
    injectGalleryOverlay();
    injectTextToolbar();
    injectNotify();

    // ESC schliesst alle Overlays
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (document.getElementById('admin-gallery-overlay').classList.contains('show')) closeGallery();
      else if (document.getElementById('admin-login-modal').classList.contains('show')) hideLoginModal();
    });

    // Auth prüfen
    try {
      const res = await fetch(CONFIG.checkAuthEndpoint);
      if (res.ok) {
        isAuthenticated = true;
        showAdminBar();
      } else showAdminFooterLink();
    } catch {
      showAdminFooterLink();
    }

    window.addEventListener('beforeunload', (e) => {
      if (hasUnsavedChanges && isEditMode) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  // ─── Styles ───────────────────────────────────────────────────────────────────
  function injectStyles() {
    const s = document.createElement('style');
    s.id = 'admin-edit-styles';
    s.textContent = `
      /* ── Footer Admin Link ── */
      #admin-footer-link { display:none; text-align:center; padding:6px 0 10px; }
      #admin-footer-link a {
        color:#4a3a1a !important; font-size:11px !important;
        font-family:'Alegreya',georgia,verdana,arial !important;
        text-decoration:none !important; letter-spacing:1px;
        opacity:0.5; transition:opacity 0.3s;
      }
      #admin-footer-link a:hover { opacity:1 !important; color:#b38c0f !important; }

      /* ── Admin Bar ── */
      #admin-bar {
        display:none; position:fixed; bottom:0; left:0; right:0;
        background:linear-gradient(180deg,#2b1d0e 0%,#1a1008 100%);
        border-top:1px solid #604e14;
        box-shadow:0 -3px 18px rgba(0,0,0,0.7);
        z-index:99999; font-family:'Alegreya',georgia,verdana,arial;
      }
      #admin-bar-inner {
        display:flex; align-items:center; justify-content:center;
        height:46px; gap:2px; padding:0 16px;
      }
      .bar-label {
        color:#604e14; font-size:11px; letter-spacing:2px;
        text-transform:uppercase; padding:0 14px 0 4px;
        border-right:1px solid #3a2a0a; margin-right:6px; user-select:none;
      }
      .abar-btn {
        display:inline-block; padding:0 16px; height:46px; line-height:46px;
        font-family:'Alegreya',georgia,verdana,arial; font-size:15px;
        color:#a19d91; background:transparent; border:none;
        border-left:1px solid transparent; border-right:1px solid transparent;
        cursor:pointer; transition:color 0.2s,background 0.2s,border-color 0.2s;
        white-space:nowrap;
      }
      .abar-btn:hover { color:#ebebeb; background:rgba(179,140,15,0.08); border-left-color:#3a2a0a; border-right-color:#3a2a0a; }
      .abar-btn.active { color:#b38c0f; background:rgba(179,140,15,0.12); border-left-color:#604e14; border-right-color:#604e14; }
      .abar-btn.save-active { color:#8ab88a; }
      .abar-btn.save-active:hover { color:#afd4af; background:rgba(100,180,100,0.08); }
      .abar-btn:disabled { color:#3a2a0a; cursor:not-allowed; }
      .abar-btn:disabled:hover { background:transparent; border-color:transparent; color:#3a2a0a; }
      .abar-sep { width:1px; height:22px; background:#3a2a0a; margin:0 4px; flex-shrink:0; }
      .bar-filename { color:#2a1a08; font-size:12px; padding-left:14px; border-left:1px solid #2a1a08; margin-left:6px; font-family:monospace; user-select:none; }
      #unsaved-dot { display:inline-block; width:6px; height:6px; background:#c97070; border-radius:50%; margin-left:5px; vertical-align:middle; opacity:0; transition:opacity 0.3s; }
      #unsaved-dot.show { opacity:1; }
      body.admin-active { padding-bottom:48px !important; }

      /* ── Login Modal ── */
      #admin-login-modal {
        display:none; position:fixed; inset:0;
        background:rgba(0,0,0,0.88); z-index:999999;
        align-items:center; justify-content:center;
      }
      #admin-login-modal.show { display:block; }
      .admin-modal-box {
        position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
        background:url('/images/bg_box.png') repeat,#1e1208;
        border:1px solid #604e14; border-radius:10px; padding:36px 40px 32px;
        width:320px; box-shadow:0 0 40px rgba(0,0,0,0.8);
        text-align:center; font-family:'Alegreya',georgia,verdana,arial;
      }
      .admin-modal-box h2 {
        color:#b38c0f !important; font-size:26px !important; font-weight:400 !important;
        margin-bottom:20px !important; font-family:'Alegreya',georgia,verdana,arial !important;
        text-shadow:1px 1px 2px #000 !important; letter-spacing:1px;
      }
      .admin-modal-box input[type="password"] {
        width:100%; padding:10px 12px; background:#140d04; border:1px solid #604e14;
        border-radius:4px; color:#c4b47a; font-size:16px; margin-bottom:14px;
        box-sizing:border-box; font-family:'Alegreya',georgia,verdana,arial;
        outline:none; transition:border-color 0.2s;
      }
      .admin-modal-box input[type="password"]:focus { border-color:#b38c0f; }
      .admin-modal-submit {
        width:100%; padding:10px; background:transparent; border:1px solid #b38c0f;
        border-radius:4px; color:#b38c0f; font-size:17px;
        font-family:'Alegreya',georgia,verdana,arial; cursor:pointer;
        letter-spacing:1px; transition:all 0.2s;
      }
      .admin-modal-submit:hover { background:rgba(179,140,15,0.15); color:#d4c99a; }
      .admin-modal-error { color:#c97070; font-size:14px; margin-top:12px; display:none; font-family:'Alegreya',georgia,verdana,arial; }

      /* ── Edit-Mode Indikatoren ── */
      body.edit-mode [contenteditable="true"] {
        outline:2px dashed rgba(179,140,15,0.4) !important;
        border-radius:10px; min-height:1em; cursor:text;
      }
      body.edit-mode [contenteditable="true"]:hover { outline:2px solid rgba(179,140,15,0.7) !important; background:rgba(179,140,15,0.04) !important; }
      body.edit-mode [contenteditable="true"]:focus { outline:2px solid #b38c0f !important; background:rgba(179,140,15,0.06) !important; }
      body.edit-mode img { cursor:pointer !important; }
      body.edit-mode img:hover { outline:2px solid #b38c0f !important; outline-offset:2px; }

      /* ── Text Toolbar – vertikale Leiste links ── */
      #admin-text-toolbar {
        display: none;
        position: fixed;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 8px 5px;
        background: linear-gradient(180deg, #2b1d0e 0%, #1a1008 100%);
        border: 1px solid #604e14;
        border-radius: 8px;
        box-shadow: 0 6px 28px rgba(0,0,0,0.75);
        z-index: 99998;
        min-width: 38px;
      }
      #admin-text-toolbar.show { display: flex !important; }

      /* Label oben */
      .tb-label {
        color: #604e14; font-size: 9px; letter-spacing: 1.5px;
        text-transform: uppercase; font-family: Arial, sans-serif;
        margin-bottom: 4px; user-select: none; writing-mode: horizontal-tb;
      }

      /* Trennlinie horizontal */
      .tb-sep {
        width: 26px; height: 1px; background: #3a2a0a; margin: 3px 0; flex-shrink: 0;
      }

      /* Format-Buttons */
      .tb-btn {
        width: 32px; height: 32px;
        display: flex; align-items: center; justify-content: center;
        background: transparent; border: 1px solid transparent; border-radius: 5px;
        color: #a19d91; font-size: 14px; cursor: pointer;
        transition: all 0.15s; font-family: Arial, sans-serif;
        flex-shrink: 0;
      }
      .tb-btn:hover  { color: #ebebeb; border-color: #604e14; background: rgba(179,140,15,0.08); }
      .tb-btn.active { color: #b38c0f; border-color: #604e14; background: rgba(179,140,15,0.15); }

      /* Schriftgrößen-Dropdown – kompakt */
      .tb-select {
        width: 32px; padding: 3px 2px;
        background: #140d04; border: 1px solid #3a2a0a; border-radius: 4px;
        color: #a19d91; font-size: 11px; cursor: pointer;
        font-family: Arial, sans-serif; outline: none; text-align: center;
        -webkit-appearance: none; appearance: none;
      }
      .tb-select:focus { border-color: #604e14; }
      .tb-select-wrap {
        position: relative; width: 32px;
        display: flex; flex-direction: column; align-items: center;
      }
      .tb-select-label {
        font-size: 8px; color: #604e14; font-family: Arial, sans-serif;
        letter-spacing: 0.5px; margin-bottom: 2px; user-select: none;
      }

      /* Farb-Buttons (Grundfarben) */
      .tb-color-preset {
        width: 22px; height: 22px; border-radius: 4px;
        border: 2px solid transparent; cursor: pointer;
        transition: border-color 0.15s, transform 0.1s;
        flex-shrink: 0; padding: 0;
      }
      .tb-color-preset:hover  { border-color: #ebebeb; transform: scale(1.1); }
      .tb-color-preset.active { border-color: #ffffff; box-shadow: 0 0 0 1px #604e14; }

      /* Farb-Picker (Custom) */
      .tb-color-wrap {
        position: relative; width: 26px; height: 26px;
        border: 2px solid #3a2a0a; border-radius: 5px;
        overflow: hidden; cursor: pointer; flex-shrink: 0;
        transition: border-color 0.15s;
      }
      .tb-color-wrap:hover  { border-color: #604e14; }
      .tb-color-wrap.active { border-color: #ffffff; box-shadow: 0 0 0 1px #604e14; }
      .tb-color-preview {
        width: 100%; height: 100%; pointer-events: none;
        background: conic-gradient(red,yellow,lime,cyan,blue,magenta,red);
      }
      .tb-color-wrap input[type="color"] {
        position: absolute; inset: -4px;
        width: calc(100% + 8px); height: calc(100% + 8px);
        opacity: 0; cursor: pointer;
      }

      /* ── Galerie Overlay ── */
      #admin-gallery-overlay {
        display:none; position:fixed; inset:0;
        background:rgba(0,0,0,0.75); z-index:9999999;
        font-family:'Alegreya',georgia,verdana,arial;
      }
      #admin-gallery-overlay.show { display:block; }
      .gal-panel {
        position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
        width:70%; max-width:1100px; min-width:480px; height:82vh;
        background:linear-gradient(180deg,#221508 0%,#160f06 100%);
        border:1px solid #604e14; border-radius:10px;
        box-shadow:0 20px 60px rgba(0,0,0,0.9); display:flex; flex-direction:column; overflow:hidden;
      }
      .gal-header { display:flex; align-items:center; justify-content:space-between; padding:14px 22px; border-bottom:1px solid #3a2a0a; background:linear-gradient(180deg,#2b1d0e 0%,#1e1208 100%); flex-shrink:0; }
      .gal-header h3 { color:#b38c0f; margin:0; font-size:19px; font-weight:400; letter-spacing:1px; }
      .gal-close { background:transparent; border:1px solid #604e14; color:#a19d91; width:30px; height:30px; border-radius:4px; font-size:15px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s; font-family:Arial,sans-serif; }
      .gal-close:hover { border-color:#b38c0f; color:#ebebeb; }
      .gal-upload-zone { margin:12px 20px 4px; border:1px dashed #3a2a0a; border-radius:6px; padding:12px 16px; text-align:center; cursor:pointer; transition:all 0.2s; flex-shrink:0; color:#6a5a3a; font-size:14px; }
      .gal-upload-zone:hover,.gal-upload-zone.dragover { border-color:#604e14; background:rgba(179,140,15,0.04); color:#a19d91; }
      .gal-filter-bar { display:flex; gap:5px; padding:8px 20px 9px; flex-shrink:0; flex-wrap:wrap; align-items:center; border-bottom:1px solid #1f1408; }
      .gal-filter-btn { padding:2px 10px; border-radius:3px; border:1px solid #2a1a08; background:transparent; color:#6a5a3a; font-size:13px; font-family:'Alegreya',georgia,verdana,arial; cursor:pointer; transition:all 0.2s; }
      .gal-filter-btn.active { border-color:#604e14; color:#b38c0f; background:rgba(179,140,15,0.08); }
      .gal-filter-btn:hover { border-color:#604e14; color:#a19d91; }
      .gal-grid { flex:1; overflow-y:auto; padding:14px 20px 20px; display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); grid-auto-rows:140px; gap:9px; align-content:start; min-width:0; min-height:0; scrollbar-width:thin; scrollbar-color:#604e14 #1a1008; }
      .gal-grid::-webkit-scrollbar { width:6px; }
      .gal-grid::-webkit-scrollbar-track { background:#1a1008; border-radius:3px; }
      .gal-grid::-webkit-scrollbar-thumb { background:#604e14; border-radius:3px; }
      .gal-grid::-webkit-scrollbar-thumb:hover { background:#b38c0f; }
      .gal-item { position:relative; border-radius:5px; overflow:hidden; cursor:pointer; border:1px solid #2a1a0a; transition:border-color 0.2s; background:#0e0906; display:flex; flex-direction:column; }
      .gal-item:hover { border-color:#b38c0f; }
      .gal-item .gal-img-wrap { flex:1; overflow:hidden; min-height:0; }
      .gal-item img { width:100%; height:100%; object-fit:cover; display:block; }
      .gal-item-footer { flex-shrink:0; background:rgba(0,0,0,0.88); display:flex; align-items:center; height:28px; padding:0 3px 0 5px; gap:2px; }
      .gal-item-name { flex:1; color:#a19d91; font-size:10px; font-family:Arial,sans-serif; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; border:1px solid transparent; border-radius:2px; background:transparent; outline:none; padding:2px 3px; transition:border-color 0.15s,background 0.15s; min-width:0; }
      .gal-item-name:focus { border-color:#b38c0f; background:rgba(0,0,0,0.6); color:#c4b47a; }
      .gal-item-delete { flex-shrink:0; width:22px; height:22px; display:flex; align-items:center; justify-content:center; background:transparent; border:1px solid transparent; border-radius:3px; color:#6a4a4a; font-size:12px; cursor:pointer; transition:all 0.15s; font-family:Arial,sans-serif; padding:0; line-height:1; }
      .gal-item-delete:hover { color:#c97070; border-color:#6a2a2a; background:rgba(180,60,60,0.15); }
      .gal-empty { grid-column:1/-1; text-align:center; color:#4a3a1a; padding:50px; font-size:16px; }

      /* ── Neuer-Termin-Button ── */
      #btn-add-termin {
        position:fixed; right:18px; bottom:60px;
        background:linear-gradient(180deg,#2b1d0e,#1a1008);
        border:1px solid #604e14; color:#b38c0f;
        font-family:'Alegreya',georgia,serif; font-size:15px;
        padding:10px 18px; border-radius:6px; cursor:pointer;
        z-index:99990; display:none; box-shadow:0 4px 16px rgba(0,0,0,0.6);
        transition:all 0.2s;
      }
      #btn-add-termin:hover { border-color:#b38c0f; color:#ebebeb; }

      /* Termin-Block im Edit-Mode: Löschen-Button sichtbar */
      .termin-delete {
        display:none; position:absolute; top:4px; right:4px;
        background:rgba(180,60,60,0.85); color:#fff; border:none;
        border-radius:3px; padding:2px 7px; font-size:12px; cursor:pointer;
        font-family:Arial,sans-serif; z-index:10;
      }
      body.edit-mode .row.termin { position:relative; }
      body.edit-mode .row.termin:hover .termin-delete { display:block; }

      /* Galerie-Modus: Bild an Cursor einfügen */
      #gal-insert-img-mode .gal-header h3::after {
        content:' – Bild auswählen zum Einfügen';
        font-size:13px; color:#604e14; font-style:italic;
      }

      /* ── Mobile Admin-Bar ── */
      @media (max-width: 768px) {
        #admin-bar-inner { 
          display: none !important; 
        }
        #admin-bar-mobile { 
          display: flex !important; 
        }
        #admin-text-toolbar {
          display: none !important;
          position: fixed !important;
          right: auto !important;
          left: 0 !important;
          top: auto !important;
          bottom: 46px !important;
          width: 10% !important;
          max-width: 10% !important;
          min-width: 50px !important;
          transform: none !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          border-left: none !important;
          border-bottom: none !important;
          border-radius: 0 !important;
          padding: 6px 4px !important;
          box-sizing: border-box !important;
          gap: 4px !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
        }
        #admin-text-toolbar.show {display:flex !important}
        .tb-sep {
          width: 22px !important;
          height: 1px !important;
          margin: 4px 0 !important;
          flex-shrink: 0 !important;
        }
        .tb-label {
          display: none !important;
        }
        .tb-select-wrap {
          flex-direction: column !important;
          align-items: center !important;
          gap: 2px !important;
        }
        .tb-select {
          width: 100% !important;
        }
      }
      @media (min-width: 769px) { #admin-bar-mobile { display:none !important; } }
      #admin-bar-mobile { display:none; flex-direction:column; width:100%; }
      #admin-mobile-toggle { display:flex; align-items:center; justify-content:space-between; height:46px; padding:0 18px; font-family:'Alegreya',georgia,verdana,arial; font-size:15px; color:#b38c0f; background:transparent; border:none; width:100%; cursor:pointer; }
      #admin-mobile-toggle .mob-arrow { font-size:18px; transition:transform 0.25s; display:inline-block; }
      #admin-mobile-toggle.open .mob-arrow { transform:rotate(180deg); }
      #admin-mobile-menu { display:none; flex-direction:column; border-top:1px solid #3a2a0a; }
      #admin-mobile-menu.open { display:flex; }
      .abar-mobile-btn { padding:13px 22px; font-family:'Alegreya',georgia,verdana,arial; font-size:15px; color:#a19d91; background:transparent; border:none; border-bottom:1px solid #1f1408; text-align:left; cursor:pointer; transition:color 0.2s,background 0.2s; width:100%; }
      .abar-mobile-btn:last-child { border-bottom:none; }
      .abar-mobile-btn:hover { color:#ebebeb; background:rgba(179,140,15,0.08); }
      .abar-mobile-btn.active { color:#b38c0f; }
      .abar-mobile-btn.save-active { color:#8ab88a; }
      .abar-mobile-btn:disabled { color:#3a2a0a; cursor:not-allowed; }

      /* ── Galerie Mobile ── */
      @media (max-width: 600px) {
        .gal-panel { width:100% !important; min-width:0 !important; height:92vh !important; top:auto !important; bottom:0 !important; left:0 !important; transform:none !important; border-radius:12px 12px 0 0 !important; }
        .gal-grid { grid-template-columns:repeat(auto-fill,minmax(100px,1fr)) !important; grid-auto-rows:110px !important; }
        .gal-filter-bar { gap:4px; padding:6px 12px; }
        .gal-filter-btn { font-size:11px; padding:2px 7px; }
      }


      /* ── Notify ── */
      #admin-notify {
        position:fixed; top:0; left:50%;
        transform:translateX(-50%) translateY(-100%);
        background:linear-gradient(180deg,#2b1d0e 0%,#1a1008 100%);
        border:1px solid #604e14; border-top:none; border-radius:0 0 6px 6px;
        padding:8px 28px; font-family:'Alegreya',georgia,verdana,arial;
        font-size:16px; color:#a19d91; z-index:9999999;
        transition:transform 0.3s ease; pointer-events:none;
        letter-spacing:0.5px; white-space:nowrap; box-shadow:0 4px 20px rgba(0,0,0,0.5);
      }
      #admin-notify.show { transform:translateX(-50%) translateY(0); }
      #admin-notify.success { color:#8ab88a; border-color:#2a4a2a; }
      #admin-notify.error   { color:#c97070; border-color:#4a2a2a; }
      #admin-notify.info    { color:#b38c0f; border-color:#604e14; }
    `;
    document.head.appendChild(s);
  }

  // ─── Admin Footer Link ────────────────────────────────────────────────────────
  function injectAdminFooterLink() {
    const wrap = document.createElement('div');
    wrap.id = 'admin-footer-link';
    wrap.innerHTML = `<a href="#" id="admin-footer-trigger">~ Admin ~</a>`;
    document.body.appendChild(wrap);
    document.getElementById('admin-footer-trigger').addEventListener('click', (e) => {
      e.preventDefault();
      showLoginModal();
    });
  }

  function showAdminFooterLink() {
    const el = document.getElementById('admin-footer-link');
    if (el) el.style.display = 'block';
  }

  function hideAdminFooterLink() {
    const el = document.getElementById('admin-footer-link');
    if (el) el.style.display = 'none';
  }

  // ─── Admin Bar ────────────────────────────────────────────────────────────────
  function injectAdminBar() {
    const bar = document.createElement('div');
    bar.id = 'admin-bar';
    document.body.appendChild(bar);
  }

  function showAdminBar() {
    hideAdminFooterLink();
    const bar = document.getElementById('admin-bar');
    bar.innerHTML = `
      <div id="admin-bar-inner">
        <span class="bar-label">Admin</span>
        <button class="abar-btn" id="btn-toggle-edit">~ Bearbeiten</button>
        <div class="abar-sep"></div>
        <button class="abar-btn" id="btn-undo" disabled>~ Rückgängig</button>
        <div class="abar-sep"></div>
        <button class="abar-btn" id="btn-discard" disabled>~ Verwerfen</button>
        <div class="abar-sep"></div>
        <button class="abar-btn" id="btn-save" disabled>~ Speichern <span id="unsaved-dot"></span></button>
        <div class="abar-sep"></div>
        <button class="abar-btn" id="btn-logout">~ Abmelden</button>
        ${currentFile === 'speisekarte.html' ? `
          <button class="abar-btn" id="btn-upload-pdf" title="Speisekarte als PDF hochladen">~ Speisekarte ändern</button>` : ''}
      <button class="abar-btn" id="btn-changepw" title="Passwort ändern">~ Passwort ändern</button>
        <span class="bar-filename">${currentFile}</span>
      </div>
      <div id="admin-bar-mobile">
        <button id="admin-mobile-toggle">
          <span>~ Admin – ${currentFile}</span>
          <span class="mob-arrow">▲</span>
        </button>
        <div id="admin-mobile-menu">
          <button class="abar-mobile-btn" id="mob-btn-edit">~ Bearbeiten</button>
          <button class="abar-mobile-btn" id="mob-btn-undo" disabled>~ Rückgängig</button>
          <button class="abar-mobile-btn" id="mob-btn-discard" disabled>~ Verwerfen</button>
          <button class="abar-mobile-btn" id="mob-btn-save" disabled>~ Speichern</button>
          <button class="abar-mobile-btn" id="mob-btn-logout">~ Abmelden</button>
        </div>
      </div>`;
    bar.style.display = 'block';
    document.body.classList.add('admin-active');

    // Desktop
    document.getElementById('btn-toggle-edit').addEventListener('click', toggleEditMode);
    document.getElementById('btn-undo').addEventListener('click', undoLastChange);
    document.getElementById('btn-discard').addEventListener('click', discardChanges);
    document.getElementById('btn-save').addEventListener('click', saveChanges);
    document.getElementById('btn-logout').addEventListener('click', logout);

    // ── PDF Upload (nur Speisekarte) ──────────────────────────────────────
    if (currentFile === 'speisekarte.html') {
      document.getElementById('btn-upload-pdf').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/pdf';
        input.onchange = async () => {
          const file = input.files[0];
          if (!file) return;
          if (file.size > 20 * 1024 * 1024) {
            showNotify('~ PDF zu groß (max. 20 MB) ~', 'error'); return;
          }
          showNotify('~ PDF wird hochgeladen… ~', 'info');
          const fd = new FormData();
          fd.append('pdf', file);
          try {
            const res = await fetch('/api/upload-pdf', { method: 'POST', body: fd, credentials: 'include' });
            const data = await res.json();
            if (data.success) {
              showNotify('~ Speisekarte aktualisiert ✓ ~', 'success');
              document.querySelectorAll('a[href*="speisekarte.pdf"]').forEach(a => {
                a.href = '/speisekarte.pdf?v=' + Date.now();
              });
            } else {
              showNotify('~ Fehler: ' + (data.error || 'Unbekannt') + ' ~', 'error');
            }
          } catch (e) {
            showNotify('~ Upload fehlgeschlagen ~', 'error');
          }
        };
        input.click();
      });
    }

    document.getElementById('btn-changepw').addEventListener('click', () => {
      const current = prompt('Aktuelles Passwort:');
      if (!current) return;
      const neu = prompt('Neues Passwort (min. 8 Zeichen):');
      if (!neu || neu.length < 8) {
        alert('Zu kurz!');
        return;
      }
      const confirm = prompt('Neues Passwort bestätigen:');
      if (neu !== confirm) {
        alert('Passwörter stimmen nicht überein!');
        return;
      }

      fetch('/api/change-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            currentPassword: current,
            newPassword: neu
          })
        })
        .then(r => r.json())
        .then(data => {
          if (data.success) showNotify('~ Passwort geändert ~', 'success');
          else showNotify('~ ' + (data.error || 'Fehler') + ' ~', 'error');
        })
        .catch(() => showNotify('~ Fehler ~', 'error'));
    });

    // Mobile Toggle
    const mobileToggle = document.getElementById('admin-mobile-toggle');
    const mobileMenu = document.getElementById('admin-mobile-menu');
    mobileToggle.addEventListener('click', () => {
      mobileToggle.classList.toggle('open');
      mobileMenu.classList.toggle('open');
    });
    const closeMob = () => {
      mobileToggle.classList.remove('open');
      mobileMenu.classList.remove('open');
    };
    document.getElementById('mob-btn-edit').addEventListener('click', () => {
      toggleEditMode();
      closeMob();
    });
    document.getElementById('mob-btn-undo').addEventListener('click', () => {
      undoLastChange();
      closeMob();
    });
    document.getElementById('mob-btn-discard').addEventListener('click', discardChanges);
    document.getElementById('mob-btn-save').addEventListener('click', () => {
      saveChanges();
      closeMob();
    });
    document.getElementById('mob-btn-logout').addEventListener('click', logout);
  }

  function hideAdminBar() {
    const bar = document.getElementById('admin-bar');
    if (bar) bar.style.display = 'none';
    document.body.classList.remove('admin-active');
  }

  // ─── Login Modal ──────────────────────────────────────────────────────────────
  function injectLoginModal() {
    const modal = document.createElement('div');
    modal.id = 'admin-login-modal';
    modal.innerHTML = `
      <div class="admin-modal-box">
        <h2>~ Admin ~</h2>
        <input type="password" id="admin-pw-input" placeholder="Passwort" autocomplete="current-password">
        <button class="admin-modal-submit" id="admin-login-submit">~ Einloggen ~</button>
        <div class="admin-modal-error" id="admin-login-error">Falsches Passwort</div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('admin-login-submit').addEventListener('click', doLogin);
    document.getElementById('admin-pw-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doLogin();
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) hideLoginModal();
    });
  }

  function showLoginModal() {
    document.getElementById('admin-login-modal').classList.add('show');
    lockScroll();
    setTimeout(() => document.getElementById('admin-pw-input').focus(), 50);
  }

  function hideLoginModal() {
    document.getElementById('admin-login-modal').classList.remove('show');
    unlockScroll();
    document.getElementById('admin-login-error').style.display = 'none';
    document.getElementById('admin-pw-input').value = '';
  }

  async function doLogin() {
    const pw = document.getElementById('admin-pw-input').value;
    const err = document.getElementById('admin-login-error');
    const btn = document.getElementById('admin-login-submit');
    btn.textContent = '…';
    btn.disabled = true;
    err.style.display = 'none';
    try {
      const res = await fetch(CONFIG.loginEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: pw
        })
      });
      if (res.ok) {
        isAuthenticated = true;
        hideLoginModal();
        showAdminBar();
        showNotify('~ Eingeloggt ~', 'info');
      } else {
        const data = await res.json().catch(() => ({}));
        err.textContent = data.error || 'Falsches Passwort';
        err.style.display = 'block';
        document.getElementById('admin-pw-input').value = '';
        document.getElementById('admin-pw-input').focus();
      }
    } catch {
      err.textContent = 'Server nicht erreichbar';
      err.style.display = 'block';
    } finally {
      btn.textContent = '~ Einloggen ~';
      btn.disabled = false;
    }
  }

  async function logout() {
    if (isEditMode) disableEditMode();
    await fetch(CONFIG.logoutEndpoint, {
      method: 'POST'
    });
    isAuthenticated = false;
    hasUnsavedChanges = false;
    hideAdminBar();
    showAdminFooterLink();
    showNotify('~ Abgemeldet ~', 'info');
  }

  // ─── Edit Mode ────────────────────────────────────────────────────────────────
  function toggleEditMode() {
    if (isEditMode) disableEditMode();
    else enableEditMode();
  }

  function enableEditMode() {
    isEditMode = true;
    undoStack = [];
    document.body.classList.add('edit-mode');
    document.getElementById('btn-toggle-edit').classList.add('active');
    document.getElementById('btn-toggle-edit').textContent = '~ Bearbeiten aktiv';
    document.getElementById('btn-save').disabled = true;
    document.getElementById('btn-discard').disabled = false;
    document.getElementById('btn-undo').disabled = true;
    // Mobile sync
    const ms = document.getElementById('mob-btn-save');
    if (ms) ms.disabled = true;
    const md = document.getElementById('mob-btn-discard');
    if (md) md.disabled = false;
    const mu = document.getElementById('mob-btn-undo');
    if (mu) mu.disabled = true;
    const me = document.getElementById('mob-btn-edit');
    if (me) {
      me.classList.add('active');
      me.textContent = '~ Bearbeiten aktiv';
    }
    makeTextEditable();
    makeImagesClickable();
    showTextToolbar();
    addTerminDeleteButtons();
    showTerminAddButton();
    showNotify('~ Bearbeitungsmodus aktiv ~', 'info');
  }

  function disableEditMode() {
    isEditMode = false;
    document.body.classList.remove('edit-mode');
    document.getElementById('btn-toggle-edit').classList.remove('active');
    document.getElementById('btn-toggle-edit').textContent = '~ Bearbeiten';
    document.getElementById('btn-save').disabled = true;
    document.getElementById('btn-save').classList.remove('save-active');
    document.getElementById('btn-discard').disabled = true;
    document.getElementById('btn-undo').disabled = true;
    // Mobile sync
    const ms2 = document.getElementById('mob-btn-save');
    if (ms2) {
      ms2.disabled = true;
      ms2.classList.remove('save-active');
    }
    const md2 = document.getElementById('mob-btn-discard');
    if (md2) md2.disabled = true;
    const mu2 = document.getElementById('mob-btn-undo');
    if (mu2) mu2.disabled = true;
    const me2 = document.getElementById('mob-btn-edit');
    if (me2) {
      me2.classList.remove('active');
      me2.textContent = '~ Bearbeiten';
    }
    removeEditable();
    hideTextToolbar();
    hideTerminAddButton();
  }

  // ─── Text editierbar ──────────────────────────────────────────────────────────
  function makeTextEditable() {
    const selectors = [
      '#wrapper-box p', '#wrapper-box h1', '#wrapper-box h2', '#wrapper-box h3',
      '#wrapper-box li', '#wrapper-box td',
      '#wrapper-box .termin p', '#wrapper-box .nachruf p', '#wrapper-box .nachruf h2',
    ];
    const el = document.getElementById('wrapper-content-box') || document.getElementById('wrapper-box');
    if (el && undoStack.length === 0) undoStack.push(el.innerHTML);

    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(node => {
        if (node.closest('[contenteditable="true"]')) return;
        node.setAttribute('contenteditable', 'true');
        node.addEventListener('input', markUnsaved);
        node.addEventListener('mouseup', showToolbarForSelection);
        node.addEventListener('keyup', showToolbarForSelection);
      });
    });
  }

  function removeEditable() {
    document.querySelectorAll('[contenteditable="true"]').forEach(el => el.removeAttribute('contenteditable'));
  }

  // ─── Text Toolbar ─────────────────────────────────────────────────────────────
  function injectTextToolbar() {
    const tb = document.createElement('div');
    tb.id = 'admin-text-toolbar';
    tb.innerHTML = `
      <span class="tb-label">Text</span>

      <button class="tb-btn" id="tb-link"    title="Link einfügen">🌐</button>
      <button class="tb-btn" id="tb-img-insert" title="Bild einfügen">🌄</button>

      <div class="tb-sep"></div>

      <button class="tb-btn" data-cmd="bold"          title="Fett (Strg+B)"><b>B</b></button>
      <button class="tb-btn" data-cmd="italic"        title="Kursiv (Strg+I)"><i>I</i></button>
      <button class="tb-btn" data-cmd="underline"     title="Unterstrichen (Strg+U)"><u>U</u></button>
      <button class="tb-btn" data-cmd="strikeThrough" title="Durchgestrichen"><s>S</s></button>

      <div class="tb-sep"></div>

      <div class="tb-select-wrap" title="Schriftgröße">
        <span class="tb-select-label">Größe</span>
        <select class="tb-select" id="tb-fontsize">
          <option value="12px">12</option>
          <option value="14px">14</option>
          <option value="16px">16</option>
          <option value="18px">18</option>
          <option value="20px">20</option>
          <option value="22px" selected>22</option>
          <option value="24px">24</option>
          <option value="28px">28</option>
          <option value="32px">32</option>
          <option value="36px">36</option>
          <option value="42px">42</option>
          <option value="52px">52</option>
        </select>
      </div>

      <div class="tb-sep"></div>

      <button class="tb-color-preset" id="tb-color-gold"
        style="background:#b38c0f;" title="Gold (Grundfarbe)"></button>
      <button class="tb-color-preset" id="tb-color-gray"
        style="background:#a19d91;" title="Grau (Grundfarbe)"></button>

      <div class="tb-color-wrap" id="tb-color-custom-wrap" title="Eigene Farbe wählen">
        <div class="tb-color-preview" id="tb-color-preview"></div>
        <input type="color" id="tb-color" value="#c4b47a">
      </div>

    `;
    document.body.appendChild(tb);

    // Format-Buttons
    tb.querySelectorAll('.tb-btn[data-cmd]').forEach(btn => {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        document.execCommand(btn.dataset.cmd, false, null);
        markUnsaved();
        updateToolbarState();
      });
    });

    // Schriftgröße
    document.getElementById('tb-fontsize').addEventListener('mousedown', (e) => e.stopPropagation());
    document.getElementById('tb-fontsize').addEventListener('change', (e) => {
      applyFontSize(e.target.value);
      markUnsaved();
    });

    // Grundfarben-Buttons
    const COLORS = {
      gold: '#b38c0f',
      gray: '#a19d91',
    };

    function applyPresetColor(colorHex, btnId) {
      // Farbe anwenden
      document.execCommand('foreColor', false, colorHex);
      markUnsaved();
      updateToolbarState();
    }

    document.getElementById('tb-color-gold').addEventListener('mousedown', (e) => {
      e.preventDefault();
      applyPresetColor(COLORS.gold, 'tb-color-gold');
    });
    document.getElementById('tb-color-gray').addEventListener('mousedown', (e) => {
      e.preventDefault();
      applyPresetColor(COLORS.gray, 'tb-color-gray');
    });

    // Custom Farbpicker
    document.getElementById('tb-color').addEventListener('mousedown', (e) => e.stopPropagation());
    document.getElementById('tb-color').addEventListener('input', (e) => {
      document.execCommand('foreColor', false, e.target.value);
      markUnsaved();
      updateToolbarState();
    });

    // ── Link einfügen ──────────────────────────────────────────────────────
    document.getElementById('tb-link').addEventListener('mousedown', (e) => {
      e.preventDefault();
      const sel = window.getSelection();

      // Prüfen ob Cursor bereits in einem Link ist → dann entfernen
      let existingLink = null;
      if (sel && sel.rangeCount) {
        let node = sel.getRangeAt(0).startContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
        existingLink = node.closest('a');
      }

      if (existingLink) {
        sel.selectAllChildren(existingLink);
        document.execCommand('unlink', false, null);
        markUnsaved();
        updateToolbarState();
        return;
      }

      // Neuen Link einfügen
      const url = prompt('URL eingeben:', 'https://');
      if (!url || url === 'https://') return;
      if (sel && !sel.isCollapsed) {
        document.execCommand('createLink', false, url);
        document.querySelectorAll('a[href="' + url + '"]').forEach(a => {
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
        });
      } else {
        const linkText = prompt('Linktext (kein Text markiert):', '');
        if (!linkText) return;
        document.execCommand('insertHTML', false,
          `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`);
      }
      markUnsaved();
      updateToolbarState();
    });

    // ── Bild an Cursorposition einfügen ───────────────────────────────────
    // insertImgMode und savedRange sind auf Modul-Ebene (siehe State-Block oben)

    document.getElementById('tb-img-insert').addEventListener('mousedown', (e) => {
      e.preventDefault();
      // Cursorposition speichern
      const sel = window.getSelection();
      if (sel && sel.rangeCount) savedRange = sel.getRangeAt(0).cloneRange();
      insertImgMode = true;
      openGallery(null); // Galerie ohne Bild-Swap öffnen
    });
  }

  function showTextToolbar() {
    document.getElementById('admin-text-toolbar').classList.add('show');
    updateToolbarState();
  }

  function hideTextToolbar() {
    document.getElementById('admin-text-toolbar') ?.classList.remove('show');
  }

  // Toolbar-State beim Klick/Selektion aktualisieren – inkl. Schriftgrößenerkennung
  function updateToolbarState() {
    // Fett / Kursiv / Unterstrichen / Durchgestrichen
    ['bold', 'italic', 'underline', 'strikeThrough'].forEach(cmd => {
      document.querySelector(`.tb-btn[data-cmd="${cmd}"]`) ?.classList.toggle('active', document.queryCommandState(cmd));
    });

    // Link-Erkennung
    const linkBtn = document.getElementById('tb-link');
    if (linkBtn) {
      const selL = window.getSelection();
      let inLink = false;
      if (selL && selL.rangeCount) {
        let node = selL.getRangeAt(0).startContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
        inLink = !!node.closest('a');
      }
      linkBtn.classList.toggle('active', inLink);
      linkBtn.title = inLink ? 'Link entfernen' : 'Link einfügen';
    }

    // Schriftgröße des Cursors / der Selektion erkennen
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      let node = sel.getRangeAt(0).startContainer;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      const computedPx = parseFloat(window.getComputedStyle(node).fontSize);
      if (!isNaN(computedPx)) {
        const select = document.getElementById('tb-fontsize');
        if (select) {
          const options = [...select.options].map(o => parseFloat(o.value));
          const closest = options.reduce((prev, cur) =>
            Math.abs(cur - computedPx) < Math.abs(prev - computedPx) ? cur : prev
          );
          select.value = closest + 'px';
        }
      }

      // Textfarbe erkennen und Buttons highlighten
      const computedColor = window.getComputedStyle(node).color;
      // RGB → HEX umrechnen
      const rgb = computedColor.match(/\d+/g);
      let detectedHex = '';
      if (rgb && rgb.length >= 3) {
        detectedHex = '#' + rgb.slice(0, 3).map(v =>
          parseInt(v).toString(16).padStart(2, '0')
        ).join('');
      }

      const GOLD_VARIANTS = ['#b38c0f', '#c4b47a', '#9e8124', '#b8860b', '#c4a000'];
      const GRAY_VARIANTS = ['#a19d91', '#a0a09a', '#9e9e9e', '#a09d91'];

      const isGold = GOLD_VARIANTS.some(c => detectedHex.toLowerCase() === c);
      const isGray = GRAY_VARIANTS.some(c => detectedHex.toLowerCase() === c);

      document.getElementById('tb-color-gold') ?.classList.toggle('active', isGold);
      document.getElementById('tb-color-gray') ?.classList.toggle('active', isGray);
      // Custom-Picker leuchtet wenn weder Gold noch Grau
      document.getElementById('tb-color-custom-wrap') ?.classList.toggle('active', !isGold && !isGray && detectedHex !== '');
    }
  }

  // Wird bei mouseup/keyup in editierbaren Elementen aufgerufen
  function showToolbarForSelection() {
    updateToolbarState();
  }

  function applyFontSize(size) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return;

    // execCommand setzt <font size="7"> als Hook – wir ersetzen sie dann sauber
    document.execCommand('fontSize', false, '7');

    const content = document.getElementById('wrapper-content-box') || document.getElementById('wrapper-box');
    if (content) {
      content.querySelectorAll('font[size="7"]').forEach(font => {
        const span = document.createElement('span');
        span.style.fontSize = size;
        span.innerHTML = font.innerHTML;
        font.replaceWith(span);
      });
    }
    markUnsaved();
  }

  // ─── Bilder – Klick im Edit-Mode öffnet Galerie ───────────────────────────────
  function makeImagesClickable() {
    document.querySelectorAll('#wrapper-box img, #wrapper-content-box img').forEach(img => {
      if (img.closest('#admin-bar,#admin-gallery-overlay,#admin-login-modal,#admin-text-toolbar,#admin-notify')) return;
      img.addEventListener('click', onImgClick);
    });
  }

  function onImgClick(e) {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    currentImgTarget = e.currentTarget;
    openGallery(currentImgTarget);
  }

  // ─── Galerie ──────────────────────────────────────────────────────────────────
  function injectGalleryOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'admin-gallery-overlay';
    overlay.innerHTML = `
      <div class="gal-panel">
        <div class="gal-header">
          <h3>~ Bild auswählen ~</h3>
          <button class="gal-close" id="gal-close">✕</button>
        </div>
        <div class="gal-upload-zone" id="gal-upload-zone">
          Neues Bild hier ablegen oder klicken zum Auswählen &nbsp;·&nbsp; JPG, PNG, GIF, WEBP &nbsp;·&nbsp; max. 15 MB
          <input type="file" id="gal-file-input" accept="image/*" multiple style="display:none">
        </div>
        <div class="gal-filter-bar">
          <button class="gal-filter-btn active" data-folder="all">~ Alle</button>
          <button class="gal-filter-btn" data-folder="uploads">~ Uploads</button>
          <button class="gal-filter-btn" data-folder="images">~ images</button>
          <button class="gal-filter-btn" data-folder="bilder-kneipe">~ bilder-kneipe</button>
          <button class="gal-filter-btn" data-folder="galerie_25_1">~ galerie_25_1</button>
          <button class="gal-filter-btn" data-folder="galerie_25_2">~ galerie_25_2</button>
          <button class="gal-filter-btn" data-folder="galerie_30_1">~ galerie_30_1</button>
        </div>
        <div class="gal-grid" id="gal-grid">
          <div class="gal-empty">Bilder werden geladen…</div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('gal-close').addEventListener('click', closeGallery);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeGallery();
    });

    const zone = document.getElementById('gal-upload-zone');
    const fi = document.getElementById('gal-file-input');
    zone.addEventListener('click', () => fi.click());
    fi.addEventListener('change', (e) => handleUpload(e.target.files));
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      handleUpload(e.dataTransfer.files);
    });

    overlay.querySelectorAll('.gal-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.gal-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderGallery(btn.dataset.folder);
      });
    });
  }

  async function openGallery(target) {
    currentImgTarget = target !== undefined ? target : null;
    document.getElementById('admin-gallery-overlay').classList.add('show');
    lockScroll();
    await loadImages();
  }

  function closeGallery() {
    document.getElementById('admin-gallery-overlay').classList.remove('show');
    unlockScroll();
    currentImgTarget = null;
  }

  async function loadImages() {
    const grid = document.getElementById('gal-grid');
    grid.innerHTML = '<div class="gal-empty">Bilder werden geladen…</div>';
    try {
      const res = await fetch(CONFIG.imagesEndpoint);
      const data = await res.json();
      allImages = data.images;
      renderGallery('all');
    } catch {
      grid.innerHTML = '<div class="gal-empty" style="color:#c97070">Fehler beim Laden</div>';
    }
  }

  function renderGallery(folder) {
    const grid = document.getElementById('gal-grid');
    const list = folder === 'all' ? allImages : allImages.filter(i => i.folder === folder);
    if (!list.length) {
      grid.innerHTML = '<div class="gal-empty">Keine Bilder</div>';
      return;
    }

    grid.innerHTML = list.map(img => {
      const isUpload = img.folder === 'uploads';
      return `
      <div class="gal-item" data-url="${img.url}" data-name="${img.name}" data-folder="${img.folder}">
        <div class="gal-img-wrap">
          <img src="${img.url}" alt="${img.name}" loading="lazy">
        </div>
        <div class="gal-item-footer">
          <input class="gal-item-name" value="${img.name}" title="${img.name}"
            ${isUpload ? '' : 'readonly tabindex="-1"'}>
          ${isUpload ? '<button class="gal-item-delete" title="Bild löschen">🗑</button>' : ''}
        </div>
      </div>`;
    }).join('');

    grid.querySelectorAll('.gal-item').forEach(item => {
      const url = item.dataset.url;
      const folder = item.dataset.folder;
      const nameInput = item.querySelector('.gal-item-name');
      const deleteBtn = item.querySelector('.gal-item-delete');

      // Klick auf Bild-Bereich → auswählen
      item.querySelector('.gal-img-wrap').addEventListener('click', () => selectImage(url));

      // Upload-Bilder: Umbenennen
      if (folder === 'uploads' && nameInput) {
        nameInput.addEventListener('click', (e) => e.stopPropagation());
        nameInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            nameInput.blur();
          }
          if (e.key === 'Escape') {
            nameInput.value = item.dataset.name;
            nameInput.blur();
          }
        });
        nameInput.addEventListener('blur', async () => {
          const newName = nameInput.value.trim();
          if (!newName || newName === item.dataset.name) {
            nameInput.value = item.dataset.name;
            return;
          }
          try {
            const res = await fetch('/api/images/uploads/' + encodeURIComponent(item.dataset.name), {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                newName
              })
            });
            const data = await res.json();
            if (res.ok) {
              item.dataset.name = data.newName;
              item.dataset.url = data.url;
              nameInput.value = data.newName;
              nameInput.title = data.newName;
              item.querySelector('img').src = data.url;
              // allImages aktualisieren
              const imgObj = allImages.find(i => i.url === url);
              if (imgObj) {
                imgObj.name = data.newName;
                imgObj.url = data.url;
              }
              showNotify('~ Umbenannt ~', 'success');
            } else {
              showNotify('~ ' + (data.error || 'Fehler') + ' ~', 'error');
              nameInput.value = item.dataset.name;
            }
          } catch {
            showNotify('~ Fehler beim Umbenennen ~', 'error');
            nameInput.value = item.dataset.name;
          }
        });
      }

      // Upload-Bilder: Löschen
      if (folder === 'uploads' && deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('Bild "' + item.dataset.name + '" wirklich löschen?')) return;
          try {
            const res = await fetch('/api/images/uploads/' + encodeURIComponent(item.dataset.name), {
              method: 'DELETE'
            });
            if (res.ok) {
              allImages = allImages.filter(i => i.url !== item.dataset.url);
              item.remove();
              showNotify('~ Gelöscht ~', 'success');
            } else {
              const data = await res.json();
              showNotify('~ ' + (data.error || 'Fehler') + ' ~', 'error');
            }
          } catch {
            showNotify('~ Fehler beim Löschen ~', 'error');
          }
        });
      }
    });
  }

  function selectImage(url) {
    if (insertImgMode) {
      // Bild an gespeicherter Cursorposition einfügen
      insertImgMode = false;
      const sel = window.getSelection();
      if (savedRange) {
        sel.removeAllRanges();
        sel.addRange(savedRange);
        savedRange = null;
      }
      const html = `<img src="${url}" alt="" style="max-width:100%;height:auto;display:block;margin:8px 0;" loading="lazy">`;
      document.execCommand('insertHTML', false, html);
      markUnsaved();
      showNotify('~ Bild eingefügt ~', 'info');
      closeGallery();
      return;
    }
    if (currentImgTarget) {
      currentImgTarget.src = url;
      const link = currentImgTarget.closest('a[data-toggle="lightbox"], a[href]');
      if (link) link.href = url;
      markUnsaved();
      showNotify('~ Bild ausgetauscht ~', 'info');
    }
    closeGallery();
  }

  async function handleUpload(files) {
    if (!files ?.length) return;
    const zone = document.getElementById('gal-upload-zone');
    for (const file of files) {
      zone.textContent = `${file.name} wird hochgeladen…`;
      const fd = new FormData();
      fd.append('image', file);
      try {
        const res = await fetch(CONFIG.uploadEndpoint, {
          method: 'POST',
          body: fd
        });
        if (res.ok) {
          const data = await res.json();
          allImages.unshift({
            url: data.url,
            folder: 'uploads',
            name: data.filename
          });
          showNotify(`~ ${file.name} hochgeladen ~`, 'success');
        } else showNotify('~ Upload fehlgeschlagen ~', 'error');
      } catch {
        showNotify('~ Upload fehlgeschlagen ~', 'error');
      }
    }
    zone.innerHTML = `Neues Bild hier ablegen oder klicken zum Auswählen &nbsp;·&nbsp; JPG, PNG, GIF, WEBP &nbsp;·&nbsp; max. 15 MB
      <input type="file" id="gal-file-input" accept="image/*" multiple style="display:none">`;
    document.getElementById('gal-file-input').addEventListener('change', (e) => handleUpload(e.target.files));
    renderGallery(document.querySelector('.gal-filter-btn.active') ?.dataset.folder || 'all');
  }

  // ─── Speichern ────────────────────────────────────────────────────────────────
  async function saveChanges() {
    showNotify('~ Wird gespeichert… ~', 'info');

    const editables = document.querySelectorAll('[contenteditable]');
    editables.forEach(el => el.removeAttribute('contenteditable'));

    const clone = document.documentElement.cloneNode(true);
    ['#admin-bar', '#admin-footer-link', '#admin-login-modal',
      '#admin-gallery-overlay', '#admin-text-toolbar', '#admin-notify', '#admin-edit-styles',
      '#btn-add-termin'
    ]
    .forEach(sel => clone.querySelector(sel) ?.remove());
    // Termin-Löschen-Buttons aus dem gespeicherten HTML entfernen
    clone.querySelectorAll('.termin-delete').forEach(el => el.remove());
    // Firefox moz-extension Scripts entfernen
    clone.querySelectorAll('script[src*="moz-extension"]').forEach(el => el.remove());
    clone.querySelectorAll('script[src*="admin-edit"]').forEach(el => el.remove());
    clone.querySelector('body').classList.remove('edit-mode', 'admin-active');
    const sc = document.createElement('script');
    sc.src = '/js/admin-edit.js';
    clone.querySelector('body').appendChild(sc);

    editables.forEach(el => el.setAttribute('contenteditable', 'true'));

    try {
      const res = await fetch(CONFIG.saveEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filename: currentFile,
          content: '<!DOCTYPE html>\n' + clone.outerHTML
        })
      });
      if (res.ok) {
        hasUnsavedChanges = false;
        document.getElementById('unsaved-dot') ?.classList.remove('show');
        document.getElementById('btn-save').disabled = true;
        document.getElementById('btn-save').classList.remove('save-active');
        showNotify('~ Gespeichert ~', 'success');
      } else showNotify('~ Fehler beim Speichern ~', 'error');
    } catch {
      showNotify('~ Server nicht erreichbar ~', 'error');
    }
  }

  // ─── Undo / Discard / Unsaved ─────────────────────────────────────────────────
  function markUnsaved() {
    const el = document.getElementById('wrapper-content-box') || document.getElementById('wrapper-box');
    if (el) {
      undoStack.push(el.innerHTML);
      if (undoStack.length > UNDO_MAX) undoStack.shift();
      const undoBtn = document.getElementById('btn-undo');
      if (undoBtn) undoBtn.disabled = undoStack.length <= 1;
    }
    hasUnsavedChanges = true;
    const saveBtn = document.getElementById('btn-save');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.classList.add('save-active');
    }
    const mobSave = document.getElementById('mob-btn-save');
    if (mobSave) {
      mobSave.disabled = false;
      mobSave.classList.add('save-active');
    }
    document.getElementById('unsaved-dot') ?.classList.add('show');
  }

  function undoLastChange() {
    if (undoStack.length <= 1) return;
    undoStack.pop();
    const el = document.getElementById('wrapper-content-box') || document.getElementById('wrapper-box');
    if (el) {
      el.innerHTML = undoStack[undoStack.length - 1];
      removeEditable();
      makeTextEditable();
      makeImagesClickable();
    }
    document.getElementById('btn-undo').disabled = undoStack.length <= 1;
    showNotify('~ Rückgängig ~', 'info');
  }

  function discardChanges() {
    if (hasUnsavedChanges && !confirm('Alle Änderungen verwerfen und Seite neu laden?')) return;
    window.location.reload();
  }

  // ─── Notify ───────────────────────────────────────────────────────────────────
  function injectNotify() {
    const el = document.createElement('div');
    el.id = 'admin-notify';
    document.body.appendChild(el);
  }

  let notifyTimer = null;

  function showNotify(msg, type = 'info') {
    const el = document.getElementById('admin-notify');
    el.textContent = msg;
    el.className = `show ${type}`;
    if (notifyTimer) clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => el.classList.remove('show'), 2500);
  }

  // ─── Neuer Termin ────────────────────────────────────────────────────────────
  function showTerminAddButton() {
    if (currentFile !== 'termine.html') return;
    let btn = document.getElementById('btn-add-termin');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'btn-add-termin';
      btn.textContent = '+ Termin';
      btn.title = 'Neuen Termin hinzufügen';
      document.body.appendChild(btn);
    }
    // Listener immer neu setzen (Button könnte aus HTML kommen ohne Listener)
    btn.replaceWith(btn.cloneNode(true)); // Alle alten Listener entfernen
    btn = document.getElementById('btn-add-termin');
    btn.addEventListener('click', addNewTermin);
    btn.style.display = 'block';
  }

  function hideTerminAddButton() {
    const btn = document.getElementById('btn-add-termin');
    if (btn) btn.style.display = 'none';
  }

  function addTerminDeleteButtons() {
    if (currentFile !== 'termine.html') return;
    document.querySelectorAll('.row.termin').forEach(row => {
      // Alten Button entfernen und neu erstellen damit Listener sicher drauf ist
      const existing = row.querySelector('.termin-delete');
      if (existing) existing.remove();
      const btn = document.createElement('button');
      btn.className = 'termin-delete';
      btn.textContent = '✕ Termin löschen';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Diesen Termin wirklich löschen?')) {
          row.remove();
          markUnsaved();
          showNotify('~ Termin gelöscht ~', 'info');
        }
      });
      row.appendChild(btn);
    });
  }

  function addNewTermin() {
    const contentBox = document.getElementById('wrapper-content-box');
    if (!contentBox) {
      alert('content-box nicht gefunden');
      return;
    }

    const newBlock = document.createElement('div');
    newBlock.className = 'row termin';
    newBlock.innerHTML = `
    <div class="col-md-4 col-sm-4">
      <p class="grau" contenteditable="true" style="text-align:left!important">Datum ~ Uhrzeit</p>
    </div>
    <div class="col-md-8 col-sm-8">
      <p contenteditable="true" style="text-align:left!important">Beschreibung des Auftritts</p>
    </div>
    <button class="termin-delete">✕ Termin löschen</button>`;

    // Direkt in contentBox anhängen – kein .after(), kein Suchen
    const allTermine = [...contentBox.querySelectorAll('.row.termin')];
    if (allTermine.length) {
      allTermine[allTermine.length - 1].insertAdjacentElement('afterend', newBlock);
    } else {
      contentBox.insertAdjacentElement('beforeend', newBlock);
    }

    newBlock.querySelector('.termin-delete').addEventListener('click', () => {
      if (confirm('Diesen Termin wirklich löschen?')) {
        newBlock.remove();
        markUnsaved();
        showNotify('~ Termin gelöscht ~', 'info');
      }
    });

    const dateField = newBlock.querySelector('p.grau');
    dateField.focus();
    const range = document.createRange();
    range.selectNodeContents(dateField);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);

    markUnsaved();
    showNotify('~ Neuer Termin eingefügt ~', 'info');
    newBlock.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }

  // ─── Start ────────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();