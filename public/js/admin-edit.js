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
        position: relative; width: 28px; height: 28px;
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
      .gal-search { flex:1; min-width:100px; max-width:200px; background:#0e0906; border:1px solid #604e14; border-radius:4px; color:#e8dfc8; padding:5px 10px; font-size:12px; outline:none; transition:border-color 0.15s; }
      .gal-search:focus { border-color:#b38c0f; }
      .gal-search::placeholder { color:#4a3a1a; }
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
      .gal-item-delete { flex-shrink:0; width:22px; height:22px; display:flex; align-items:center; justify-content:center; background:transparent; border:1px solid transparent; border-radius:3px; color:#a06060; font-size:12px; cursor:pointer; transition:all 0.15s; font-family:Arial,sans-serif; padding:0; line-height:1; }
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
      /* ── Passwort-Modal ── */
      #pw-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; }
      #pw-modal { background:#1e1208; border:1px solid #604e14; border-radius:10px; padding:28px 32px; width:320px; max-width:90vw; box-shadow:0 20px 60px rgba(0,0,0,0.8); font-family:Arial,sans-serif; }
      #pw-modal h3 { color:#c4b47a; font-size:15px; margin-bottom:20px; letter-spacing:1px; text-align:center; }
      #pw-modal label { display:block; font-size:11px; color:#a19d91; letter-spacing:1px; text-transform:uppercase; margin-bottom:5px; margin-top:14px; }
      #pw-modal input { width:100%; background:#0e0906; border:1px solid #604e14; border-radius:4px; color:#e8dfc8; padding:8px 10px; font-size:14px; outline:none; transition:border-color 0.15s; box-sizing:border-box; }
      #pw-modal input:focus { border-color:#b38c0f; }
      #pw-modal-error { color:#c97070; font-size:12px; margin-top:10px; min-height:18px; text-align:center; }
      #pw-modal-btns { display:flex; gap:10px; margin-top:22px; }
      #pw-modal-btns button { flex:1; padding:9px; border-radius:5px; font-size:13px; cursor:pointer; border:1px solid #604e14; letter-spacing:1px; transition:all 0.15s; }
      .pw-modal-cancel { background:transparent; color:#a19d91; }
      .pw-modal-cancel:hover { border-color:#a19d91 !important; color:#ebebeb !important; }
      .pw-modal-save { background:#604e14; color:#e8dfc8; }
      .pw-modal-save:hover { background:#b38c0f !important; border-color:#b38c0f !important; color:#fff !important; }

      .termin-delete {
        display:none; position:absolute; top:4px; right:4px;
        background:rgba(180,60,60,0.85); color:#fff; border:none;
        border-radius:3px; padding:2px 7px; font-size:12px; cursor:pointer;
        font-family:Arial,sans-serif; z-index:10;
      }
      body.edit-mode .row.termin { position:relative; }
      body.edit-mode .row.termin:hover .termin-delete { display:block; }

      /* ── CMS Block-System ── */
      body.edit-mode .cms-block { position: relative; }

      /* Schwebende Leiste – erscheint ÜBER dem Block oben rechts */
      .cms-block-ui {
        position: absolute;
        top: -10px; right: 0;
        height: 26px;
        display: none;
        flex-direction: row;
        align-items: center;
        gap: 0;
        z-index: 800;
        background: rgba(15,9,3,0.95);
        border: 1px solid #604e14;
        border-radius: 4px;
        overflow: hidden;
        box-shadow: 0 2px 10px rgba(0,0,0,0.6);
        white-space: nowrap;
      }
      /* Pseudo-Brücke zwischen Block und UI damit Hover nicht bricht */
      .cms-block-ui::after {
        content: '';
        position: absolute;
        top: 100%; left: 0; right: 0;
        height: 8px;
      }
      /* UI anzeigen bei Hover auf cms-block ODER auf Kind-Elemente (Textfelder, Bilder etc.) */
      body.edit-mode .cms-block:hover > .cms-block-ui,
      body.edit-mode .cms-block:hover .cms-block-ui,
      body.edit-mode .cms-block-ui:hover { display: flex; }

      .cms-ui-btn {
        height: 26px;
        padding: 0 9px;
        display: flex; align-items: center; gap: 4px;
        background: transparent;
        border: none;
        border-right: 1px solid #2a1a08;
        color: #a08840;
        cursor: pointer;
        font-size: 11px;
        font-family: Arial, sans-serif;
        letter-spacing: 0.5px;
        transition: all 0.13s;
        white-space: nowrap;
      }
      .cms-ui-btn:last-child { border-right: none; }
      .cms-ui-btn:hover { background: #2a1a08; color: #c4b47a; }
      .cms-ui-btn.drag-handle { cursor: grab; color: #6a5030; }
      .cms-ui-btn.drag-handle:hover { color: #a08840; }
      .cms-ui-btn.drag-handle:active { cursor: grabbing; }
      .cms-ui-btn.del-btn:hover { background: #5a1010; color: #f0a0a0; }

      .cms-block.sortable-ghost { opacity: 0.3; }
      .cms-block.sortable-chosen { outline: 2px dashed #604e14; outline-offset: 2px; }

      /* Bilder in cms-blocks immer zentrieren */
      body.edit-mode .cms-block > img,
      .cms-block > img { display: block; margin: 0 auto; }

      /* Link Button im cms-block-ui - disabled State */
      .cms-ui-btn.link-btn:disabled,
      .cms-ui-btn.link-btn.disabled {
        color: #3a2a0a !important;
        cursor: not-allowed !important;
        opacity: 0.5;
      }
      .cms-ui-btn.link-btn:disabled:hover,
      .cms-ui-btn.link-btn.disabled:hover {
        background: transparent !important;
        color: #3a2a0a !important;
      }

      /* Admin-Bar Buttons (nur im Edit-Mode) */
      #btn-add-block-text, #btn-add-block-img,
      #btn-add-block-line, #btn-add-block-spacer { display: none; }
      body.edit-mode #btn-add-block-text,
      body.edit-mode #btn-add-block-img,
      body.edit-mode #btn-add-block-line,
      body.edit-mode #btn-add-block-spacer {
        display: inline-flex; align-items: center; gap: 5px;
      }

      /* ── Spalten-System ── */
      .col-placeholder {
        min-height: 80px; display:flex; flex-direction:column;
        align-items:center; justify-content:center; gap:8px;
        border:1px dashed #3a2208; border-radius:4px; padding:16px;
      }
      .col-placeholder-label { font-family:Arial,sans-serif; font-size:11px; color:#4a3218; letter-spacing:1px; text-transform:uppercase; }
      .col-placeholder-btns { display:flex; gap:8px; }
      .col-add-btn {
        display:flex; align-items:center; gap:5px; padding:6px 12px;
        background:rgba(20,12,4,0.9); border:1px solid #604e14; border-radius:4px;
        color:#c4b47a; font-size:12px; font-family:Arial,sans-serif; cursor:pointer; transition:all 0.15s;
      }
      .col-add-btn:hover { background:#604e14; color:#fff; }
      .col-controls {
        display:none; position:absolute; bottom:0; right:0;
        background:rgba(15,9,3,0.92); border:1px solid #2a1a08;
        border-radius:3px 0 0 0; overflow:hidden;
      }
      body.edit-mode [class*="col-md-"]:hover > .col-controls,
      body.edit-mode [class*="col-sm-"]:hover > .col-controls,
      body.edit-mode .col-controls:hover { display:flex; }
      .col-ctrl-btn {
        padding:4px 8px; background:transparent; border:none; border-right:1px solid #2a1a08;
        color:#6a5030; cursor:pointer; font-size:10px; font-family:Arial,sans-serif;
        display:flex; align-items:center; gap:3px; transition:all 0.13s; white-space:nowrap;
      }
      .col-ctrl-btn:last-child { border-right:none; }
      .col-ctrl-btn:hover { background:#2a1a08; color:#c4b47a; }
      .col-ctrl-btn.del-col:hover { background:#5a1010; color:#f0a0a0; }
      body.edit-mode [class*="col-md-"],
      body.edit-mode [class*="col-sm-"] { position:relative; min-height:40px; }

      /* ── Bild-Skala ── */
      #img-scale-bar {
        position:fixed; z-index:9001; display:none; align-items:center; gap:8px;
        background:rgba(15,9,3,0.95); border:1px solid #604e14; border-radius:4px;
        padding:5px 10px; font-family:Arial,sans-serif; font-size:11px; color:#a08840;
        box-shadow:0 2px 10px rgba(0,0,0,0.6);
      }
      #img-scale-bar.visible { display:flex; }
      #img-scale-bar input[type=range] {
        -webkit-appearance:none; width:100px; height:4px;
        background:#3a2208; border-radius:2px; outline:none;
      }
      #img-scale-bar input[type=range]::-webkit-slider-thumb {
        -webkit-appearance:none; width:14px; height:14px; background:#b38c0f; border-radius:50%; cursor:pointer;
      }
      #img-scale-bar span { min-width:34px; text-align:right; color:#c4b47a; }

      /* ── Custom Confirm/Alert Modal ── */
      #cms-dialog-overlay {
        position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:199999;
        display:none; align-items:center; justify-content:center;
      }
      #cms-dialog-overlay.open { display:flex; }
      #cms-dialog-box {
        background:#1e1208; border:1px solid #604e14; border-radius:10px;
        padding:26px 30px; width:340px; max-width:92vw;
        box-shadow:0 20px 60px rgba(0,0,0,.85); font-family:Arial,sans-serif;
        display:flex; flex-direction:column; gap:16px;
      }
      #cms-dialog-msg { color:#e8dfc8; font-size:13px; line-height:1.6; text-align:center; }
      #cms-dialog-btns { display:flex; gap:10px; }
      .cms-dialog-btn {
        flex:1; padding:9px; border-radius:5px; font-size:13px; cursor:pointer;
        font-family:Arial,sans-serif; letter-spacing:0.5px; transition:all 0.15s;
      }
      .cms-dialog-btn.cancel { background:transparent; border:1px solid #3a2a0a; color:#a19d91; }
      .cms-dialog-btn.cancel:hover { border-color:#604e14; color:#c4b47a; }
      .cms-dialog-btn.confirm { background:#604e14; border:1px solid #604e14; color:#e8dfc8; }
      .cms-dialog-btn.confirm:hover { background:#b38c0f; border-color:#b38c0f; color:#fff; }
      .cms-dialog-btn.danger { background:#7a1a1a; border:1px solid #7a1a1a; color:#f0c0c0; }
      .cms-dialog-btn.danger:hover { background:#a02020; border-color:#c04040; }

      /* ── Backup-Modal ── */
      #backup-modal-overlay {
        position:fixed; inset:0; background:rgba(0,0,0,0.78); z-index:99999;
        display:none; align-items:center; justify-content:center;
      }
      #backup-modal-overlay.open { display:flex; }
      #backup-modal {
        background:#1e1208; border:1px solid #604e14; border-radius:10px;
        padding:26px 30px; width:420px; max-width:94vw; max-height:80vh;
        box-shadow:0 20px 60px rgba(0,0,0,.85); font-family:Arial,sans-serif;
        display:flex; flex-direction:column;
      }
      #backup-modal h3 { color:#c4b47a; font-size:14px; margin:0 0 16px; letter-spacing:1px; text-align:center; }
      #backup-list { overflow-y:auto; flex:1; margin-bottom:14px; }
      .backup-item {
        display:flex; align-items:center; justify-content:space-between;
        padding:8px 0; border-bottom:1px solid #1a0e06; gap:10px;
      }
      .backup-item:last-child { border-bottom:none; }
      .backup-item-date { color:#e8dfc8; font-size:12px; }
      .backup-restore-btn {
        padding:4px 12px; background:transparent; flex-shrink:0;
        border:1px solid #604e14; border-radius:4px; color:#c4b47a;
        cursor:pointer; font-size:11px; transition:all 0.15s; white-space:nowrap;
      }
      .backup-restore-btn:hover { background:#604e14; color:#fff; }
      .backup-empty { color:#4a3a1a; text-align:center; padding:30px; font-size:13px; }
      #backup-close-btn {
        padding:8px; background:transparent; width:100%;
        border:1px solid #3a2a0a; border-radius:5px; color:#6a5030;
        cursor:pointer; font-size:12px; font-family:Arial,sans-serif; transition:all 0.15s;
      }
      #backup-close-btn:hover { border-color:#604e14; color:#c4b47a; }

      /* spacer_break */
      .spacer_break { height: 40px; width: 100%; }
      body.edit-mode .spacer_break {
        border: 1px dashed #3a2208;
        border-radius: 3px;
        position: relative;
        display: flex; align-items: center; justify-content: center;
      }
      body.edit-mode .spacer_break::before {
        content: 'Abstand';
        font-family: Arial, sans-serif;
        font-size: 11px;
        color: #3a2208;
        letter-spacing: 1px;
        text-transform: uppercase;
      }

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
          <button class="abar-btn" id="btn-upload-pdf" title="Speisekarte als PDF hochladen"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> PDF ändern</button>` : ''}
        <div class="abar-sep"></div>
        <button class="abar-btn" id="btn-add-block-text" title="Textfeld hinzufügen"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Text</button>
        <button class="abar-btn" id="btn-add-block-img"  title="Bild-Block hinzufügen"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Bild</button>
        <button class="abar-btn" id="btn-add-block-line" title="Trennlinie einfügen"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="2" y1="12" x2="22" y2="12"/></svg> Trennlinie</button>
        <button class="abar-btn" id="btn-add-block-spacer" title="Abstand einfügen"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="4" y1="4" x2="20" y2="4"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="4" y1="20" x2="20" y2="20"/></svg> Abstand</button>
        <div class="abar-sep"></div>
      <button class="abar-btn" id="btn-changepw" title="Passwort ändern">~ Passwort ändern</button>
        <div class="abar-sep"></div>
        <button class="abar-btn" id="btn-backups" title="Sicherungsverlauf"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5.34L1 10"/></svg> Verlauf</button>
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
            showNotify('~ PDF zu groß (max. 20 MB) ~', 'error');
            return;
          }
          showNotify('~ PDF wird hochgeladen… ~', 'info');
          const fd = new FormData();
          fd.append('pdf', file);
          try {
            const res = await fetch('/api/upload-pdf', {
              method: 'POST',
              body: fd,
              credentials: 'include'
            });
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

    document.getElementById('btn-backups')?.addEventListener('click', openBackupModal);
    document.getElementById('btn-changepw').addEventListener('click', () => {
      const overlay = document.createElement('div');
      overlay.id = 'pw-modal-overlay';
      overlay.innerHTML = `
        <div id="pw-modal">
          <h3>~ Passwort ändern ~</h3>
          <label>Aktuelles Passwort</label>
          <input type="password" id="pw-current" autocomplete="current-password">
          <label>Neues Passwort</label>
          <input type="password" id="pw-new" autocomplete="new-password" placeholder="min. 8 Zeichen">
          <label>Bestätigen</label>
          <input type="password" id="pw-confirm" autocomplete="new-password">
          <div id="pw-modal-error"></div>
          <div id="pw-modal-btns">
            <button class="pw-modal-cancel" id="pw-modal-cancel">Abbrechen</button>
            <button class="pw-modal-save" id="pw-modal-save">Speichern</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      document.getElementById('pw-current').focus();
      const errEl = document.getElementById('pw-modal-error');

      function closeModal() {
        overlay.remove();
      }
      document.getElementById('pw-modal-cancel').addEventListener('click', closeModal);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
      });
      document.getElementById('pw-modal-save').addEventListener('click', async () => {
        const current = document.getElementById('pw-current').value;
        const neu = document.getElementById('pw-new').value;
        const confirm = document.getElementById('pw-confirm').value;
        if (!current) {
          errEl.textContent = 'Aktuelles Passwort eingeben.';
          return;
        }
        if (neu.length < 8) {
          errEl.textContent = 'Neues Passwort min. 8 Zeichen.';
          return;
        }
        if (neu !== confirm) {
          errEl.textContent = 'Passwörter stimmen nicht überein.';
          return;
        }
        errEl.textContent = '';
        try {
          const res = await fetch('/api/change-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
              currentPassword: current,
              newPassword: neu
            })
          });
          const data = await res.json();
          if (data.success) {
            closeModal();
            showNotify('~ Passwort geändert ~', 'success');
          } else errEl.textContent = data.error || 'Fehler';
        } catch {
          errEl.textContent = 'Verbindungsfehler';
        }
      });
      ['pw-current', 'pw-new', 'pw-confirm'].forEach(id => {
        document.getElementById(id).addEventListener('keydown', (e) => {
          if (e.key === 'Enter') document.getElementById('pw-modal-save').click();
        });
      });
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
    initBlockSystem();
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
    destroyBlockSystem();
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

      <button class="tb-btn" id="tb-link"    title="Link einfügen"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button>
      <button class="tb-btn" id="tb-img-insert" title="Bild einfügen"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></button>

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

      // Neuen Link einfügen – Custom Modal
      const selectedText = sel && !sel.isCollapsed ? sel.toString() : '';
      const savedRangeForLink = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;

      const linkOverlay = document.createElement('div');
      linkOverlay.id = 'link-modal-overlay';
      linkOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99999;display:flex;align-items:center;justify-content:center;';
      linkOverlay.innerHTML = `
        <div style="background:#1e1208;border:1px solid #604e14;border-radius:10px;padding:26px 30px;width:340px;max-width:92vw;box-shadow:0 20px 60px rgba(0,0,0,0.8);font-family:Arial,sans-serif;">
          <h3 style="color:#c4b47a;font-size:14px;margin-bottom:18px;letter-spacing:1px;text-align:center;">~ Link einfügen ~</h3>
          <label style="display:block;font-size:11px;color:#a19d91;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">URL</label>
          <input id="link-url-input" type="url" value="https://" style="width:100%;background:#0e0906;border:1px solid #604e14;border-radius:4px;color:#e8dfc8;padding:8px 10px;font-size:13px;outline:none;box-sizing:border-box;">
          ${!selectedText ? `
          <label style="display:block;font-size:11px;color:#a19d91;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;margin-top:14px;">Linktext</label>
          <input id="link-text-input" type="text" placeholder="Anzeigetext" style="width:100%;background:#0e0906;border:1px solid #604e14;border-radius:4px;color:#e8dfc8;padding:8px 10px;font-size:13px;outline:none;box-sizing:border-box;">` : ''}
          <div id="link-modal-error" style="color:#c97070;font-size:12px;margin-top:8px;min-height:16px;"></div>
          <div style="display:flex;gap:10px;margin-top:20px;">
            <button id="link-modal-cancel" class="pw-modal-cancel" style="flex:1;padding:9px;border-radius:5px;font-size:13px;cursor:pointer;border:1px solid #604e14;background:transparent;color:#a19d91;letter-spacing:1px;">Abbrechen</button>
            <button id="link-modal-save" class="pw-modal-save" style="flex:1;padding:9px;border-radius:5px;font-size:13px;cursor:pointer;border:1px solid #604e14;background:#604e14;color:#e8dfc8;letter-spacing:1px;">Einfügen</button>
          </div>
        </div>`;
      document.body.appendChild(linkOverlay);
      document.getElementById('link-url-input').focus();
      document.getElementById('link-url-input').select();

      function closeLinkModal() {
        linkOverlay.remove();
      }
      document.getElementById('link-modal-cancel').addEventListener('click', closeLinkModal);
      linkOverlay.addEventListener('click', (e) => {
        if (e.target === linkOverlay) closeLinkModal();
      });

      document.getElementById('link-modal-save').addEventListener('click', () => {
        const url = document.getElementById('link-url-input').value.trim();
        const errEl = document.getElementById('link-modal-error');
        if (!url || url === 'https://') {
          errEl.textContent = 'Bitte eine URL eingeben.';
          return;
        }

        closeLinkModal();

        // Selektion wiederherstellen
        if (savedRangeForLink) {
          const s = window.getSelection();
          s.removeAllRanges();
          s.addRange(savedRangeForLink);
        }

        if (selectedText) {
          document.execCommand('createLink', false, url);
          document.querySelectorAll('a[href="' + url + '"]').forEach(a => {
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
          });
        } else {
          const linkTextEl = document.getElementById('link-text-input');
          const linkText = linkTextEl ? linkTextEl.value.trim() : '';
          if (!linkText) return;
          document.execCommand('insertHTML', false,
            `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`);
        }
        markUnsaved();
        updateToolbarState();
      });

      // Enter-Taste im URL-Feld
      document.getElementById('link-url-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('link-modal-save').click();
      });
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
          <input class="gal-search" id="gal-search" type="text" placeholder="Suche…">
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
        document.getElementById('gal-search').value = '';
        renderGallery(btn.dataset.folder);
      });
    });
    document.getElementById('gal-search').addEventListener('input', (e) => {
      const activeFolder = overlay.querySelector('.gal-filter-btn.active') ?.dataset.folder || 'all';
      renderGallery(activeFolder, e.target.value.trim());
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

  function renderGallery(folder, search = '') {
    const grid = document.getElementById('gal-grid');
    let list = folder === 'all' ? allImages : allImages.filter(i => i.folder === folder);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i => i.name.toLowerCase().includes(q));
    }
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
          ${isUpload ? '<button class="gal-item-delete" title="Bild löschen"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>' : ''}
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
          cmsConfirm('Bild "' + item.dataset.name + '" wirklich löschen?', async () => {
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
            } catch { showNotify('~ Fehler beim Löschen ~', 'error'); }
          }, 'danger');
        });
      }
    });
  }

  // function selectImage(url) {
  //   if (insertImgMode) {
  //     // Bild an gespeicherter Cursorposition einfügen
  //     insertImgMode = false;
  //     const sel = window.getSelection();
  //     if (savedRange) {
  //       sel.removeAllRanges();
  //       sel.addRange(savedRange);
  //       savedRange = null;
  //     }
  //     const html = `<img src="${url}" alt="" style="max-width:100%;height:auto;display:block;margin:8px 0;" loading="lazy">`;
  //     document.execCommand('insertHTML', false, html);
  //     markUnsaved();
  //     showNotify('~ Bild eingefügt ~', 'info');
  //     closeGallery();
  //     return;
  //   }
  //   if (currentImgTarget) {
  //     currentImgTarget.src = url;
  //     const link = currentImgTarget.closest('a[data-toggle="lightbox"], a[href]');
  //     if (link) link.href = url;
  //     markUnsaved();
  //     showNotify('~ Bild ausgetauscht ~', 'info');
  //   }
  //   closeGallery();
  // }
  function selectImage(url) {
    if (currentImgTarget === '__col__') {
      closeGallery();
      const col = window.__colTarget; window.__colTarget = null; currentImgTarget = null;
      if (!col) return;
      const img = document.createElement('img');
      img.src = url; img.alt = ''; img.classList.add('img-responsive');
      img.style.cssText = 'max-width:100%;display:block;margin:0 auto;';
      const ctrl = col.querySelector('.col-controls');
      ctrl ? col.insertBefore(img, ctrl) : col.appendChild(img);
      markUnsaved(); showNotify('~ Bild in Spalte eingefügt ~', 'success'); return;
    }
    // Wenn Galerie für neuen Bild-Block geöffnet wurde
    if (currentImgTarget === '__cms-block__') {
      closeGallery();
      const box = getContentBox();
      if (!box) return;
      const div = document.createElement('div');
      div.className = 'cms-block';
      div.setAttribute('data-cms-block', '');
      div.style.textAlign = 'center';
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.style.cssText = 'max-width:100%;display:block;margin:0 auto;';
      div.prepend(makeCmsUi(div));
      div.appendChild(img);
      box.appendChild(div);
      markUnsaved();
      showNotify('~ Bild-Block hinzugefügt ~', 'success');
      return;
    }
    if (insertImgMode) {
      // Neues Bild einfügen (Standard mit Lightbox)
      insertImgMode = false;
      const html = `<a href="${url}" data-toggle="lightbox"><img src="${url}" alt="" style="max-width:100%;height:auto;display:block;margin:8px 0;" loading="lazy"></a>`;
      document.execCommand('insertHTML', false, html);
      markUnsaved();
      closeGallery();
      return;
    }

    if (currentImgTarget) {
      // 1. Das Bild auf der Seite wird immer getauscht
      currentImgTarget.src = url;

      // 2. Den umschließenden Link prüfen
      let link = currentImgTarget.closest('a');

      if (link) {
        const href = link.getAttribute('href') || '';

        // Filter-Logik: Was ist ein "Spezial-Link", den wir NICHT anfassen?
        const isPdf = href.toLowerCase().endsWith('.pdf');
        const isAnchor = href.includes('#');
        const isExternal = link.getAttribute('rel') === 'external' || href.startsWith('http');
        const isImage = /\.(jpg|jpeg|png|gif|webp|svg)($|\?)/i.test(href);

        // Entscheidung:
        if (isPdf || isAnchor || isExternal) {
          // Diese Links lassen wir exakt so wie sie sind!
          showNotify('~ Bild getauscht (Link-Ziel erhalten) ~', 'info');
        } else if (isImage || href === '' || href === '#') {
          // Nur wenn es ein Bild-Link ist, wird auch das Großbild-Ziel (href) angepasst
          link.href = url;
          link.setAttribute('data-toggle', 'lightbox');
          showNotify('~ Bild & Lightbox aktualisiert ~', 'success');
        }
      } else {
        // Gar kein Link da? Dann erstellen wir einen neuen Lightbox-Link
        const newLink = document.createElement('a');
        newLink.href = url;
        newLink.setAttribute('data-toggle', 'lightbox');
        currentImgTarget.parentNode.insertBefore(newLink, currentImgTarget);
        newLink.appendChild(currentImgTarget);
        showNotify('~ Lightbox-Link erstellt ~', 'success');
      }

      markUnsaved();
    }
    closeGallery();
  }



  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  async function handleUpload(files) {
    if (!files ?.length) return;
    const zone = document.getElementById('gal-upload-zone');
    for (const file of files) {
      const sizeStr = formatFileSize(file.size);
      zone.innerHTML = `<span style="color:#c4b47a">${file.name}</span> <span style="color:#604e14">(${sizeStr})</span> wird hochgeladen…`;
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
          showNotify(`~ ${file.name} (${sizeStr}) hochgeladen ~`, 'success');
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
    clone.querySelectorAll('.cms-block-ui').forEach(el => el.remove());
    clone.querySelectorAll('.col-controls').forEach(el => el.remove());
    clone.querySelectorAll('.col-placeholder').forEach(el => el.remove());
    clone.querySelectorAll('[data-cms-block]').forEach(el => el.removeAttribute('data-cms-block'));
    // cms-block Klasse nur entfernen wenn kein Originalinhalt (nicht row, termin etc.)
    clone.querySelectorAll('.cms-block').forEach(el => {
      if (!el.classList.contains('row') && !el.classList.contains('termin') && !el.classList.contains('nachruf')) {
        el.classList.remove('cms-block');
      }
    });
    clone.querySelector('#playground-banner') ?.remove();
    clone.querySelectorAll('.playground-section-label').forEach(el => el.remove());
    clone.querySelectorAll('[data-cms-block]').forEach(el => el.removeAttribute('data-cms-block'));
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
    if (hasUnsavedChanges) {
      cmsConfirm('Alle Änderungen verwerfen und Seite neu laden?', () => { hasUnsavedChanges = false; location.reload(); }, 'danger');
      return;
    }
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
      btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> Termin löschen';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        cmsConfirm('Diesen Termin wirklich löschen?', () => {
          row.remove(); markUnsaved(); showNotify('~ Termin gelöscht ~', 'info');
        }, 'danger');
      });
      row.appendChild(btn);
    });
  }

  function addNewTermin() {
    const contentBox = document.getElementById('wrapper-content-box');
    if (!contentBox) {
      cmsAlert('Inhalt-Container nicht gefunden.');
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
    <button class="termin-delete"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> Termin löschen</button>`;

    // Direkt in contentBox anhängen – kein .after(), kein Suchen
    const allTermine = [...contentBox.querySelectorAll('.row.termin')];
    if (allTermine.length) {
      allTermine[allTermine.length - 1].insertAdjacentElement('afterend', newBlock);
    } else {
      contentBox.insertAdjacentElement('beforeend', newBlock);
    }

    newBlock.querySelector('.termin-delete').addEventListener('click', () => {
      cmsConfirm('Diesen Termin wirklich löschen?', () => {
        newBlock.remove(); markUnsaved(); showNotify('~ Termin gelöscht ~', 'info');
      }, 'danger');
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

  // ── Block-System (Drag & Drop, Hinzufügen, Löschen, Split) ─────────────────
  let sortableInstance = null;

  function getContentBox() {
    return document.getElementById('wrapper-content-box') || document.getElementById('wrapper-box');
  }

  function makeCmsUi(block) {
    const ui = document.createElement('div');
    ui.className = 'cms-block-ui';
    const hasImg = !!block.querySelector('img');

    ui.innerHTML = `
      ${hasImg ? '<button class="cms-ui-btn scale-btn" title="Bildgröße"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg> Größe</button>' : ''}
      <button class="cms-ui-btn drag-handle" title="Verschieben"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="9" cy="5" r="1.5" fill="currentColor"/><circle cx="15" cy="5" r="1.5" fill="currentColor"/><circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/><circle cx="9" cy="19" r="1.5" fill="currentColor"/><circle cx="15" cy="19" r="1.5" fill="currentColor"/></svg> Verschieben</button>
      <button class="cms-ui-btn link-btn" ${!hasImg ? 'disabled' : ''} title="${hasImg ? 'Link hinzufügen' : 'Kein Bild vorhanden'}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Link</button>
      <button class="cms-ui-btn split-btn"   title="Zweispaltig"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="2" y="3" width="9" height="18" rx="1"/><rect x="13" y="3" width="9" height="18" rx="1"/></svg> Spalten</button>
      <button class="cms-ui-btn del-btn"     title="Block löschen"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> Block löschen</button>`;

    // Skala-Button Handler
    ui.querySelector('.scale-btn')?.addEventListener('click', () => {
      const img = block.querySelector('img');
      if (img) window.openImgScale?.(img);
    });

    // Link Button Handler
    const linkBtn = ui.querySelector('.link-btn');
    linkBtn.addEventListener('click', () => {
      const img = block.querySelector('img');
      if (!img) return;

      const parentA = img.closest('a');
      const existingUrl = parentA ? parentA.getAttribute('href') : '';

      const lOl = document.createElement('div');
      lOl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99999;display:flex;align-items:center;justify-content:center;';
      lOl.innerHTML = `
        <div style="background:#1e1208;border:1px solid #604e14;border-radius:10px;padding:26px 30px;width:340px;max-width:92vw;box-shadow:0 20px 60px rgba(0,0,0,0.8);font-family:Arial,sans-serif;">
          <h3 style="color:#c4b47a;font-size:14px;margin-bottom:18px;letter-spacing:1px;text-align:center;">~ Bild-Link ${existingUrl ? 'bearbeiten' : 'hinzufügen'} ~</h3>
          <label style="display:block;font-size:11px;color:#a19d91;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">URL</label>
          <input id="img-link-url" type="url" value="${existingUrl || 'https://'}" style="width:100%;background:#0e0906;border:1px solid #604e14;border-radius:4px;color:#e8dfc8;padding:8px 10px;font-size:13px;outline:none;box-sizing:border-box;">
          ${existingUrl ? '<button id="img-link-remove" style="margin-top:10px;padding:6px 12px;background:transparent;border:1px solid #7a1a1a;color:#c97070;border-radius:4px;cursor:pointer;font-size:12px;">Link entfernen</button>' : ''}
          <div style="display:flex;gap:10px;margin-top:20px;">
            <button id="img-link-cancel" class="pw-modal-cancel" style="flex:1;padding:9px;border-radius:5px;font-size:13px;cursor:pointer;border:1px solid #604e14;background:transparent;color:#a19d91;letter-spacing:1px;">Abbrechen</button>
            <button id="img-link-save" class="pw-modal-save" style="flex:1;padding:9px;border-radius:5px;font-size:13px;cursor:pointer;border:1px solid #604e14;background:#604e14;color:#e8dfc8;letter-spacing:1px;">Speichern</button>
          </div>
        </div>`;
      document.body.appendChild(lOl);
      const inp = document.getElementById('img-link-url');
      inp.focus();
      inp.select();

      const close = () => lOl.remove();
      document.getElementById('img-link-cancel').addEventListener('click', close);
      lOl.addEventListener('click', e => {
        if (e.target === lOl) close();
      });

      // Link entfernen
      const removeBtn = document.getElementById('img-link-remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          if (parentA) parentA.replaceWith(img);
          markUnsaved();
          close();
          // UI aktualisieren
          const newUi = makeCmsUi(block);
          block.insertBefore(newUi, block.firstChild);
        });
      }

      // Link speichern
      document.getElementById('img-link-save').addEventListener('click', () => {
        const url = inp.value.trim();
        if (!url || url === 'https://') {
          if (parentA) parentA.replaceWith(img);
        } else if (parentA) {
          parentA.href = url;
          parentA.target = '_blank';
          parentA.rel = 'noopener noreferrer';
        } else {
          const a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          img.replaceWith(a);
          a.appendChild(img);
        }
        markUnsaved();
        close();
      });

      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('img-link-save').click();
      });
    });

    // Split
    ui.querySelector('.split-btn').addEventListener('click', () => splitBlock(block));
    // Löschen
    ui.querySelector('.del-btn').addEventListener('click', () => {
      cmsConfirm('Diesen Block löschen?', () => { block.remove(); markUnsaved(); }, 'danger');
    });
    return ui;
  }

  // Bootstrap 12-Grid gleichmäßig verteilen
  function rebalanceCols(row) {
    const cols = Array.from(row.querySelectorAll(':scope > [class*="col-"]'));
    if (!cols.length) return;
    const n = cols.length;
    const w = n <= 1 ? 12 : n === 2 ? 6 : n === 3 ? 4 : n === 4 ? 3 : 2;
    const sm = Math.min(w * 2, 12);
    cols.forEach(col => {
      col.className = col.className
        .replace(/\bcol-md-\d+\b/g, `col-md-${w}`)
        .replace(/\bcol-sm-\d+\b/g, `col-sm-${sm}`);
      if (!/col-md-/.test(col.className)) col.classList.add(`col-md-${w}`);
    });
  }

  // Placeholder-HTML für neue leere Spalte
  function colPlaceholderHtml() {
    return `<div class="col-placeholder">
      <div class="col-placeholder-label">Inhalt wählen</div>
      <div class="col-placeholder-btns">
        <button class="col-add-btn ph-text-btn"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Text</button>
        <button class="col-add-btn ph-img-btn"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Bild</button>
      </div>
    </div>`;
  }

  // Placeholder-Listener für eine Spalte registrieren
  function initColPlaceholder(col) {
    col.querySelector('.ph-text-btn')?.addEventListener('click', () => {
      col.querySelector('.col-placeholder')?.remove();
      const p = document.createElement('p');
      p.setAttribute('contenteditable', 'true'); p.textContent = 'Neuer Text…';
      p.addEventListener('input', markUnsaved);
      p.addEventListener('mouseup', showToolbarForSelection);
      p.addEventListener('keyup', showToolbarForSelection);
      const ctrl = col.querySelector('.col-controls');
      ctrl ? col.insertBefore(p, ctrl) : col.appendChild(p);
      p.focus(); markUnsaved();
    });
    col.querySelector('.ph-img-btn')?.addEventListener('click', () => {
      col.querySelector('.col-placeholder')?.remove();
      currentImgTarget = '__col__';
      window.__colTarget = col;
      openGallery('__col__');
    });
  }

  // Spalten-Controls für eine Spalte
  function makeColControls(col, parentRow) {
    const ctrl = document.createElement('div');
    ctrl.className = 'col-controls';
    ctrl.innerHTML = `
      <button class="col-ctrl-btn add-text-btn" title="Text hinzufügen"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Text</button>
      <button class="col-ctrl-btn add-img-btn"  title="Bild hinzufügen"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Bild</button>
      <button class="col-ctrl-btn del-col"      title="Spalte entfernen"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> Spalte</button>`;

    ctrl.querySelector('.add-text-btn').addEventListener('click', () => {
      const p = document.createElement('p');
      p.setAttribute('contenteditable', 'true'); p.textContent = 'Neuer Text…';
      p.addEventListener('input', markUnsaved);
      p.addEventListener('mouseup', showToolbarForSelection);
      p.addEventListener('keyup', showToolbarForSelection);
      col.querySelector('.col-placeholder')?.remove();
      col.insertBefore(p, ctrl); p.focus(); markUnsaved();
    });
    ctrl.querySelector('.add-img-btn').addEventListener('click', () => {
      col.querySelector('.col-placeholder')?.remove();
      currentImgTarget = '__col__'; window.__colTarget = col;
      openGallery('__col__');
    });
    ctrl.querySelector('.del-col').addEventListener('click', () => {
      const cols = Array.from(parentRow.querySelectorAll(':scope > [class*="col-"]'));
      if (cols.length <= 1) { showNotify('~ Letzte Spalte kann nicht entfernt werden ~', 'info'); return; }
      cmsConfirm('Diese Spalte und ihren Inhalt entfernen?', () => {
        col.remove();
        rebalanceCols(parentRow);
        // Wenn nur noch 1 Spalte: Row auflösen, Block-UI wiederherstellen
        const rem = Array.from(parentRow.querySelectorAll(':scope > [class*="col-"]'));
        if (rem.length === 1 && parentRow.classList.contains('cms-block')) {
          const lastCol = rem[0];
          const nodes = Array.from(lastCol.childNodes)
            .filter(n => !n.classList?.contains('col-controls') && !n.classList?.contains('col-placeholder'));
          const frag = document.createDocumentFragment();
          nodes.forEach(n => frag.appendChild(n.cloneNode(true)));
          parentRow.classList.remove('row');
          parentRow.innerHTML = '';
          parentRow.appendChild(frag);
          parentRow.prepend(makeCmsUi(parentRow));
          // Split-Btn zurücksetzen
          const sb = parentRow.querySelector(':scope > .cms-block-ui .split-btn');
          if (sb) { sb.title = 'Zweispaltig'; delete sb.dataset.patched; sb.onclick = null; }
          parentRow.querySelectorAll('p,h1,h2,h3,li,td').forEach(el => {
            if (!el.closest('[contenteditable="true"]')) {
              el.setAttribute('contenteditable', 'true');
              el.addEventListener('input', markUnsaved);
              el.addEventListener('mouseup', showToolbarForSelection);
              el.addEventListener('keyup', showToolbarForSelection);
            }
          });
        }
        markUnsaved();
      }, 'danger');
    });
    return ctrl;
  }

  // Neue Spalte zu bestehendem Row hinzufügen
  function addColToRow(row) {
    const newCol = document.createElement('div');
    newCol.className = 'col-md-6'; // wird durch rebalance überschrieben
    newCol.innerHTML = colPlaceholderHtml();
    row.appendChild(newCol);
    rebalanceCols(row); // ALLE Spalten gleichzeitig anpassen
    initColPlaceholder(newCol);
    newCol.appendChild(makeColControls(newCol, row));
    markUnsaved();
  }

  function splitBlock(block) {
    const uiEl = block.querySelector(':scope > .cms-block-ui');
    if (uiEl) uiEl.remove();
    const savedHtml = block.innerHTML;

    block.classList.add('row');
    block.innerHTML = `
      <div class="col-md-6">${savedHtml}</div>
      <div class="col-md-6">${colPlaceholderHtml()}</div>`;

    block.querySelectorAll(':scope > [class*="col-"]').forEach(col => {
      col.querySelectorAll('p,h1,h2,h3,li,td').forEach(el => {
        if (!el.closest('[contenteditable="true"]')) {
          el.setAttribute('contenteditable', 'true');
          el.addEventListener('input', markUnsaved);
          el.addEventListener('mouseup', showToolbarForSelection);
          el.addEventListener('keyup', showToolbarForSelection);
        }
      });
      initColPlaceholder(col);
      col.appendChild(makeColControls(col, block));
    });

    rebalanceCols(block); // Beide Spalten auf col-md-6 setzen

    // Block-UI wieder auf Row setzen, Split-Btn → + Spalte
    block.prepend(makeCmsUi(block));
    const splitBtn = block.querySelector(':scope > .cms-block-ui .split-btn');
    if (splitBtn && !splitBtn.dataset.patched) {
      splitBtn.dataset.patched = '1';
      splitBtn.title = 'Spalte hinzufügen';
      splitBtn.onclick = (e) => { e.stopPropagation(); addColToRow(block); };
    }
    markUnsaved();
  }

  function initBlockSystem() {
    const box = getContentBox();
    if (!box) return;

    // SortableJS laden (einmalig)
    function setupSortable() {
      if (sortableInstance) sortableInstance.destroy();
      sortableInstance = Sortable.create(box, {
        handle: '.drag-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        draggable: '.cms-block',
        onEnd: markUnsaved,
      });
    }

    if (typeof Sortable === 'undefined') {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.0/Sortable.min.js';
      s.onload = setupSortable;
      document.head.appendChild(s);
    } else {
      setupSortable();
    }

    // Alle direkten Kinder mit cms-block und UI ausstatten
    Array.from(box.children).forEach(child => {
      if (child.id && child.id.startsWith('admin-')) return;
      if (child.querySelector(':scope > .cms-block-ui')) return;
      if (!child.classList.contains('cms-block')) {
        child.classList.add('cms-block'); child.setAttribute('data-cms-block', '');
      }
      child.prepend(makeCmsUi(child));
      // Wenn bereits Row: Controls + patched Split-Btn
      if (child.classList.contains('row')) {
        child.querySelectorAll(':scope > [class*="col-"]').forEach(col => {
          if (!col.querySelector(':scope > .col-controls'))
            col.appendChild(makeColControls(col, child));
          initColPlaceholder(col);
        });
        const sb = child.querySelector(':scope > .cms-block-ui .split-btn');
        if (sb && !sb.dataset.patched) {
          sb.dataset.patched = '1'; sb.title = 'Spalte hinzufügen';
          sb.onclick = (e) => { e.stopPropagation(); addColToRow(child); };
        }
      }
    });

    // + Text Button
    const btnText = document.getElementById('btn-add-block-text');
    if (btnText) {
      btnText._handler = () => {
        const div = document.createElement('div');
        div.className = 'cms-block';
        div.setAttribute('data-cms-block', '');
        const p = document.createElement('p');
        p.setAttribute('contenteditable', 'true');
        p.textContent = 'Neuer Text…';
        p.addEventListener('input', markUnsaved);
        p.addEventListener('mouseup', showToolbarForSelection);
        p.addEventListener('keyup', showToolbarForSelection);
        div.prepend(makeCmsUi(div));
        div.appendChild(p);
        box.appendChild(div);
        p.focus();
        // Sortable kennt neues Element automatisch
        markUnsaved();
        showNotify('~ Textfeld hinzugefügt ~', 'success');
      };
      btnText.addEventListener('click', btnText._handler);
    }

    // + Bild-Block Button
    const btnImg = document.getElementById('btn-add-block-img');
    if (btnImg) {
      btnImg._handler = () => {
        openGallery('__cms-block__');
      };
      btnImg.addEventListener('click', btnImg._handler);
    }

    // + Trennlinie Button
    const btnLine = document.getElementById('btn-add-block-line');
    if (btnLine) {
      btnLine._handler = () => {
        const div = document.createElement('div');
        div.className = 'cms-block';
        div.setAttribute('data-cms-block', '');
        div.style.textAlign = 'center';
        const img = document.createElement('img');
        img.src = '/images/haarlinie.webp';
        img.onerror = () => {
          img.src = '/images/haarlinie.png';
        };
        img.alt = '';
        img.style.cssText = 'max-width:100%;display:block;margin:0 auto;';
        div.prepend(makeCmsUi(div));
        div.appendChild(img);
        box.appendChild(div);
        markUnsaved();
        showNotify('~ Trennlinie hinzugefügt ~', 'success');
      };
      btnLine.addEventListener('click', btnLine._handler);
    }

    // + Abstand Button
    const btnSpacer = document.getElementById('btn-add-block-spacer');
    if (btnSpacer) {
      btnSpacer._handler = () => {
        const div = document.createElement('div');
        div.className = 'cms-block';
        div.setAttribute('data-cms-block', '');
        const spacer = document.createElement('div');
        spacer.className = 'spacer_break';
        div.prepend(makeCmsUi(div));
        div.appendChild(spacer);
        box.appendChild(div);
        markUnsaved();
        showNotify('~ Abstand hinzugefügt ~', 'success');
      };
      btnSpacer.addEventListener('click', btnSpacer._handler);
    }
  }

  function destroyBlockSystem() {
    if (sortableInstance) {
      sortableInstance.destroy();
      sortableInstance = null;
    }
    // UI-Elemente entfernen
    document.querySelectorAll('.cms-block-ui').forEach(el => el.remove());
    document.querySelectorAll('.col-controls').forEach(el => el.remove());
    document.querySelectorAll('.col-placeholder').forEach(el => el.remove());
    document.querySelectorAll('[data-cms-block]').forEach(el => {
      el.removeAttribute('data-cms-block');
      el.classList.remove('cms-block');
    });
    // Listener entfernen
    ['btn-add-block-text', 'btn-add-block-img', 'btn-add-block-line', 'btn-add-block-spacer'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn ?._handler) btn.removeEventListener('click', btn._handler);
    });
  }

  // ── Custom Confirm / Alert ───────────────────────────────────────────────────
  (function setupCmsDialog() {
    const ov = document.createElement('div');
    ov.id = 'cms-dialog-overlay';
    ov.innerHTML = `<div id="cms-dialog-box">
      <div id="cms-dialog-msg"></div>
      <div id="cms-dialog-btns"></div>
    </div>`;
    document.body.appendChild(ov);
  })();

  // cmsConfirm(msg, onOk, style='confirm') – style: 'confirm' | 'danger'
  function cmsConfirm(msg, onOk, style = 'confirm') {
    const ov  = document.getElementById('cms-dialog-overlay');
    const msgEl = document.getElementById('cms-dialog-msg');
    const btns  = document.getElementById('cms-dialog-btns');
    msgEl.textContent = msg;
    btns.innerHTML = `
      <button class="cms-dialog-btn cancel" id="cms-dlg-cancel">Abbrechen</button>
      <button class="cms-dialog-btn ${style}" id="cms-dlg-ok">${style === 'danger' ? 'Löschen' : 'OK'}</button>`;
    ov.classList.add('open');
    const close = () => ov.classList.remove('open');
    document.getElementById('cms-dlg-cancel').onclick = close;
    ov.onclick = e => { if (e.target === ov) close(); };
    document.getElementById('cms-dlg-ok').onclick = () => { close(); onOk(); };
  }

  function cmsAlert(msg) {
    const ov  = document.getElementById('cms-dialog-overlay');
    document.getElementById('cms-dialog-msg').textContent = msg;
    const btns = document.getElementById('cms-dialog-btns');
    btns.innerHTML = `<button class="cms-dialog-btn confirm" id="cms-dlg-ok" style="max-width:120px;margin:0 auto;">OK</button>`;
    ov.classList.add('open');
    document.getElementById('cms-dlg-ok').onclick = () => ov.classList.remove('open');
    ov.onclick = e => { if (e.target === ov) ov.classList.remove('open'); };
  }

  // ── Bild-Skala ─────────────────────────────────────────────────────────────
  (function initImgScale() {
    const bar = document.createElement('div');
    bar.id = 'img-scale-bar';
    bar.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg> Größe
      <input type="range" id="img-scale-slider" min="10" max="100" value="100" step="5">
      <span id="img-scale-val">100%</span>`;
    document.body.appendChild(bar);
    let scaleImg = null;
    window.openImgScale = (img) => {
      scaleImg = img;
      const cur = parseInt(img.style.maxWidth) || 100;
      document.getElementById('img-scale-slider').value = cur;
      document.getElementById('img-scale-val').textContent = cur + '%';
      const r = img.getBoundingClientRect();
      bar.style.top = (r.bottom + 6) + 'px';
      bar.style.left = r.left + 'px';
      bar.classList.add('visible');
    };
    window.closeImgScale = () => { bar.classList.remove('visible'); scaleImg = null; };
    document.getElementById('img-scale-slider').addEventListener('input', (e) => {
      if (!scaleImg) return;
      scaleImg.style.maxWidth = e.target.value + '%';
      document.getElementById('img-scale-val').textContent = e.target.value + '%';
      markUnsaved();
    });
    document.addEventListener('mousedown', (e) => {
      if (!bar.contains(e.target) && !e.target.closest('.cms-block-ui')) window.closeImgScale?.();
    });
  })();

  // ── Backup-Modal ─────────────────────────────────────────────────────────────
  (function setupBackupModal() {
    const ov = document.createElement('div');
    ov.id = 'backup-modal-overlay';
    ov.innerHTML = `<div id="backup-modal">
      <h3><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5.34L1 10"/></svg> Verlauf: <span id="backup-modal-filename"></span></h3>
      <div id="backup-list"><div class="backup-empty">Lade…</div></div>
      <button id="backup-close-btn">Schließen</button>
    </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
    document.getElementById('backup-close-btn').addEventListener('click', () => ov.classList.remove('open'));
  })();

  async function openBackupModal() {
    const ov = document.getElementById('backup-modal-overlay');
    document.getElementById('backup-modal-filename').textContent = currentFile;
    document.getElementById('backup-list').innerHTML = '<div class="backup-empty">Lade…</div>';
    ov.classList.add('open');

    try {
      const res = await fetch('/api/backups/' + encodeURIComponent(currentFile), {
        credentials: 'include'
      });
      const data = await res.json();
      const list = document.getElementById('backup-list');
      if (!data.backups?.length) {
        list.innerHTML = '<div class="backup-empty">Keine Sicherungen vorhanden.</div>'; return;
      }
      list.innerHTML = data.backups.map(b =>
        `<div class="backup-item">
          <span class="backup-item-date">${b.date}</span>
          <button class="backup-restore-btn" data-name="${b.name}">Wiederherstellen</button>
        </div>`
      ).join('');
      list.querySelectorAll('.backup-restore-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          cmsConfirm('Diese Sicherung wiederherstellen? Aktuelle Version wird als neue Sicherung gespeichert.', async () => {
            btn.disabled = true; btn.textContent = '…';
            try {
              const r2 = await fetch('/api/restore-backup', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: currentFile, backupName: btn.dataset.name })
              });
              const d2 = await r2.json();
              if (d2.success) {
                ov.classList.remove('open');
                showNotify('~ Sicherung wiederhergestellt – Seite wird neu geladen ~', 'success');
                setTimeout(() => location.reload(), 1500);
              } else {
                showNotify('~ Fehler: ' + (d2.error || 'Unbekannt') + ' ~', 'error');
                btn.disabled = false; btn.textContent = 'Wiederherstellen';
              }
            } catch { showNotify('~ Server nicht erreichbar ~', 'error'); btn.disabled = false; btn.textContent = 'Wiederherstellen'; }
          });
        });
      });
    } catch { document.getElementById('backup-list').innerHTML = '<div class="backup-empty">Fehler beim Laden.</div>'; }
  }

  // ── Session-Timeout Warnung (nach 7h50min, Token läuft nach 8h ab) ────────
  setTimeout(() => {
    showNotify('~ Session läuft in 10 Minuten ab – bitte speichern & neu einloggen ~', 'error');
  }, (8 * 60 - 10) * 60 * 1000);

})();