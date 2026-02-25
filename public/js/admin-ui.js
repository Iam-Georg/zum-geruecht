/**
 * admin-ui.js – UI-Komponenten
 *
 * Enthält: Admin-Bar, Login-Modal, Galerie, Text-Toolbar,
 *          Notify-Toast, Backup-Modal, Passwort-Modal, Custom-Dialoge,
 *          Bild-Skala-Bar, Footer-Link.
 *
 * Benötigt: admin-state.js (window.AdminState, window.AdminConfig, …)
 * Einbinden nach admin-state.js, vor admin-blocks.js:
 *   <script src="/js/admin-ui.js"></script>
 */
(function () {
  "use strict";

  // Kurzreferenzen auf globale State-Objekte
  const CFG   = window.AdminConfig;
  const STATE = window.AdminState;

  // ─── Hilfsfunktion: escHtml ───────────────────────────────────────────────────
  const esc = window.escHtml;

  // ─── Admin Auth Button (Login/Logout – über schalter_top) ────────────────────
  // SVG Bootstrap Icons
  const SVG_LOGIN  = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z"/></svg>`;
  const SVG_LOGOUT = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0z"/><path fill-rule="evenodd" d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708z"/></svg>`;

  window.injectAdminFooterLink = function () {
    // Button wurde bereits vom admin-loader.js erstellt → nichts zu tun
    // Falls Loader nicht verwendet wird (Direktaufruf ohne Loader), Button erstellen
    if (document.getElementById("admin-auth-btn")) return;
    const btn     = document.createElement("button");
    btn.id        = "admin-auth-btn";
    btn.title     = "Admin Login";
    btn.innerHTML = SVG_LOGIN;
    document.body.appendChild(btn);
    btn.addEventListener("click", _authBtnClick);
  };

  function _authBtnClick() {
    if (STATE.isAuthenticated) {
      window.logout();
    } else {
      showLoginModal();
    }
  }

  // Nach Login → Logout-Icon zeigen
  window.showAdminFooterLink = function () {
    const btn = document.getElementById("admin-auth-btn");
    if (!btn) return;
    btn.innerHTML = SVG_LOGIN;
    btn.title     = "Admin Login";
    window.__loaderSetLoginIcon?.();
  };

  // Nach Logout → Login-Icon zeigen
  window.hideAdminFooterLink = function () {
    const btn = document.getElementById("admin-auth-btn");
    if (!btn) return;
    btn.innerHTML = SVG_LOGOUT;
    btn.title     = "Abmelden";
    window.__loaderSetLogoutIcon?.();
    // Click-Handler übernehmen (Loader-Handler ersetzen)
    const newBtn = btn.cloneNode(true);
    newBtn.innerHTML = SVG_LOGOUT;
    newBtn.title     = "Abmelden";
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener("click", _authBtnClick);
  };

  // ─── Admin Bar ────────────────────────────────────────────────────────────────
  window.injectAdminBar = function () {
    const bar = document.createElement("div");
    bar.id = "admin-bar";
    document.body.appendChild(bar);
  };

  window.showAdminBar = function () {
    hideAdminFooterLink();
    const bar   = document.getElementById("admin-bar");
    const cFile = window.adminCurrentFile;
    const pdfBtn = cFile === "speisekarte.html"
      ? `<button class="abar-btn" id="btn-upload-pdf" title="Speisekarte als PDF hochladen">
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> PDF ändern
         </button>`
      : "";

    // innerHTML nur beim ersten Aufbau – kein dynamisches Rebuild
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
        ${pdfBtn}
        <div class="abar-sep"></div>
        <button class="abar-btn" id="btn-add-block-text" title="Textfeld hinzufügen"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Text</button>
        <button class="abar-btn" id="btn-add-block-img"  title="Bild-Block hinzufügen"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Bild</button>
        <button class="abar-btn" id="btn-add-block-line" title="Trennlinie einfügen"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="2" y1="12" x2="22" y2="12"/></svg> Trennlinie</button>
        <button class="abar-btn" id="btn-add-block-spacer" title="Abstand einfügen"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="4" y1="4" x2="20" y2="4"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="4" y1="20" x2="20" y2="20"/></svg> Abstand</button>
        <div class="abar-sep"></div>
        <button class="abar-btn" id="btn-changepw" title="Passwort ändern">~ Passwort ändern</button>
        <div class="abar-sep"></div>
        <button class="abar-btn" id="btn-backups" title="Sicherungsverlauf"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5.34L1 10"/></svg> Verlauf</button>
        <span class="bar-filename">${esc(cFile)}</span>
      </div>
      <div id="admin-bar-mobile">
        <button id="admin-mobile-toggle">
          <span>~ Admin – ${esc(cFile)}</span>
          <span class="mob-arrow">▲</span>
        </button>
        <div id="admin-mobile-menu">
          <button class="abar-mobile-btn" id="mob-btn-edit">~ Bearbeiten</button>
          <button class="abar-mobile-btn" id="mob-btn-undo" disabled>~ Rückgängig</button>
          <button class="abar-mobile-btn" id="mob-btn-discard" disabled>~ Verwerfen</button>
          <button class="abar-mobile-btn" id="mob-btn-save" disabled>~ Speichern</button>
        </div>
      </div>`;

    bar.style.display = "block";
    document.body.classList.add("admin-active");

    // Desktop-Listener
    document.getElementById("btn-toggle-edit").addEventListener("click", window.toggleEditMode);
    document.getElementById("btn-undo").addEventListener("click", window.undoLastChange);
    document.getElementById("btn-discard").addEventListener("click", window.discardChanges);
    document.getElementById("btn-save").addEventListener("click", window.saveChanges);
    document.getElementById("btn-backups")?.addEventListener("click", openBackupModal);
    document.getElementById("btn-changepw").addEventListener("click", openChangePwModal);

    // PDF-Upload (nur speisekarte.html)
    if (cFile === "speisekarte.html") {
      document.getElementById("btn-upload-pdf").addEventListener("click", handlePdfUpload);
    }

    // Mobile
    const mobileToggle = document.getElementById("admin-mobile-toggle");
    const mobileMenu   = document.getElementById("admin-mobile-menu");
    mobileToggle.addEventListener("click", () => {
      mobileToggle.classList.toggle("open");
      mobileMenu.classList.toggle("open");
    });
    const closeMob = () => {
      mobileToggle.classList.remove("open");
      mobileMenu.classList.remove("open");
    };
    document.getElementById("mob-btn-edit").addEventListener("click", () => { window.toggleEditMode(); closeMob(); });
    document.getElementById("mob-btn-undo").addEventListener("click", () => { window.undoLastChange(); closeMob(); });
    document.getElementById("mob-btn-discard").addEventListener("click", window.discardChanges);
    document.getElementById("mob-btn-save").addEventListener("click", () => { window.saveChanges(); closeMob(); });
  };

  window.hideAdminBar = function () {
    const bar = document.getElementById("admin-bar");
    if (bar) bar.style.display = "none";
    document.body.classList.remove("admin-active");
  };

  // ─── PDF-Upload ───────────────────────────────────────────────────────────────
  function handlePdfUpload() {
    const input   = document.createElement("input");
    input.type    = "file";
    input.accept  = "application/pdf";
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      if (file.size > 20 * 1024 * 1024) {
        window.showNotify("~ PDF zu groß (max. 20 MB) ~", "error");
        return;
      }
      window.showNotify("~ PDF wird hochgeladen… ~", "info");
      const fd = new FormData();
      fd.append("pdf", file);
      try {
        const res  = await fetch("/api/upload-pdf", { method: "POST", body: fd, credentials: "include" });
        const data = await res.json();
        if (data.success) {
          window.showNotify("~ Speisekarte aktualisiert ✓ ~", "success");
          document.querySelectorAll('a[href*="speisekarte.pdf"]').forEach((a) => {
            a.href = "/speisekarte.pdf?v=" + Date.now();
          });
        } else {
          window.showNotify("~ Fehler: " + (data.error || "Unbekannt") + " ~", "error");
        }
      } catch {
        window.showNotify("~ Upload fehlgeschlagen ~", "error");
      }
    };
    input.click();
  }

  // ─── Login Modal ──────────────────────────────────────────────────────────────
  window.injectLoginModal = function () {
    // Loader hat das Modal evtl. bereits erstellt (und danach wieder entfernt
    // nach erfolgreichem Login). Nur erstellen wenn nicht vorhanden.
    if (document.getElementById("admin-login-modal")) return;
    const modal = document.createElement("div");
    modal.id = "admin-login-modal";
    // Kein innerHTML mit user-Daten – alles statisch
    modal.innerHTML = `
      <div class="admin-modal-box">
        <h2>~ Admin ~</h2>
        <input type="password" id="admin-pw-input" placeholder="Passwort" autocomplete="current-password">
        <button class="admin-modal-submit" id="admin-login-submit">~ Einloggen ~</button>
        <div class="admin-modal-error" id="admin-login-error">Falsches Passwort</div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById("admin-login-submit").addEventListener("click", doLogin);
    document.getElementById("admin-pw-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") doLogin();
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) hideLoginModal();
    });
  };

  function showLoginModal() {
    document.getElementById("admin-login-modal").classList.add("show");
    window.lockScroll();
    setTimeout(() => document.getElementById("admin-pw-input").focus(), 50);
  }
  // Exportieren für ESC-Handler in admin-edit.js
  window.showLoginModal = showLoginModal;

  function hideLoginModal() {
    document.getElementById("admin-login-modal").classList.remove("show");
    window.unlockScroll();
    document.getElementById("admin-login-error").style.display = "none";
    document.getElementById("admin-pw-input").value = "";
  }
  window.hideLoginModal = hideLoginModal;

  async function doLogin() {
    const pw  = document.getElementById("admin-pw-input").value;
    const err = document.getElementById("admin-login-error");
    const btn = document.getElementById("admin-login-submit");
    btn.textContent = "…";
    btn.disabled    = true;
    err.style.display = "none";
    try {
      const res = await fetch(CFG.loginEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        STATE.isAuthenticated = true;
        hideLoginModal();
        window.showAdminBar();
        window.showNotify("~ Eingeloggt ~", "info");
      } else {
        const data = await res.json().catch(() => ({}));
        // textContent statt innerHTML – kein XSS
        err.textContent  = data.error || "Falsches Passwort";
        err.style.display = "block";
        document.getElementById("admin-pw-input").value = "";
        document.getElementById("admin-pw-input").focus();
      }
    } catch {
      err.textContent   = "Server nicht erreichbar";
      err.style.display = "block";
    } finally {
      btn.textContent = "~ Einloggen ~";
      btn.disabled    = false;
    }
  }

  // ─── Logout ───────────────────────────────────────────────────────────────────
  window.logout = async function () {
    if (STATE.isEditMode) window.disableEditMode();
    await fetch(CFG.logoutEndpoint, { method: "POST" });
    STATE.isAuthenticated   = false;
    STATE.hasUnsavedChanges = false;
    window.hideAdminBar();
    window.showAdminFooterLink(); // Icon → Login
    window.showNotify("~ Abgemeldet ~", "info");
  };

  // ─── Passwort-Modal ───────────────────────────────────────────────────────────
  function openChangePwModal() {
    const overlay = document.createElement("div");
    overlay.id    = "pw-modal-overlay";
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
          <button class="pw-modal-save"   id="pw-modal-save">Speichern</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById("pw-current").focus();

    const errEl = document.getElementById("pw-modal-error");
    const close = () => overlay.remove();

    document.getElementById("pw-modal-cancel").addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

    document.getElementById("pw-modal-save").addEventListener("click", async () => {
      const current = document.getElementById("pw-current").value;
      const neu     = document.getElementById("pw-new").value;
      const confirm = document.getElementById("pw-confirm").value;
      if (!current)            { errEl.textContent = "Aktuelles Passwort eingeben."; return; }
      if (neu.length < 8)      { errEl.textContent = "Neues Passwort min. 8 Zeichen."; return; }
      if (neu !== confirm)     { errEl.textContent = "Passwörter stimmen nicht überein."; return; }
      errEl.textContent = "";
      try {
        const res  = await fetch("/api/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ currentPassword: current, newPassword: neu }),
        });
        const data = await res.json();
        if (data.success) {
          close();
          window.showNotify("~ Passwort geändert ~", "success");
        } else {
          errEl.textContent = data.error || "Fehler";
        }
      } catch {
        errEl.textContent = "Verbindungsfehler";
      }
    });

    ["pw-current", "pw-new", "pw-confirm"].forEach((id) => {
      document.getElementById(id).addEventListener("keydown", (e) => {
        if (e.key === "Enter") document.getElementById("pw-modal-save").click();
      });
    });
  }

  // ─── Text Toolbar ─────────────────────────────────────────────────────────────
  window.injectTextToolbar = function () {
    const tb = document.createElement("div");
    tb.id = "admin-text-toolbar";
    tb.innerHTML = `
      <span class="tb-label">Text</span>
      <button class="tb-btn" id="tb-link"       title="Link einfügen"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button>
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
          <option value="12px">12</option><option value="14px">14</option>
          <option value="16px">16</option><option value="18px">18</option>
          <option value="20px">20</option><option value="22px" selected>22</option>
          <option value="24px">24</option><option value="28px">28</option>
          <option value="32px">32</option><option value="36px">36</option>
          <option value="42px">42</option><option value="52px">52</option>
        </select>
      </div>
      <div class="tb-sep"></div>
      <button class="tb-color-preset" id="tb-color-gold" style="background:#b38c0f;" title="Gold"></button>
      <button class="tb-color-preset" id="tb-color-gray" style="background:#a19d91;" title="Grau"></button>
      <div class="tb-color-wrap" id="tb-color-custom-wrap" title="Eigene Farbe">
        <div class="tb-color-preview" id="tb-color-preview"></div>
        <input type="color" id="tb-color" value="#c4b47a">
      </div>`;
    document.body.appendChild(tb);

    // Format-Buttons (bold/italic/…)
    tb.querySelectorAll(".tb-btn[data-cmd]").forEach((btn) => {
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        document.execCommand(btn.dataset.cmd, false, null);
        window.markUnsaved();
        updateToolbarState();
      });
    });

    // Schriftgröße
    document.getElementById("tb-fontsize").addEventListener("mousedown", (e) => e.stopPropagation());
    document.getElementById("tb-fontsize").addEventListener("change", (e) => {
      applyFontSize(e.target.value);
      window.markUnsaved();
    });

    // Preset-Farben
    const COLORS = { gold: "#b38c0f", gray: "#a19d91" };
    document.getElementById("tb-color-gold").addEventListener("mousedown", (e) => {
      e.preventDefault();
      document.execCommand("foreColor", false, COLORS.gold);
      window.markUnsaved(); updateToolbarState();
    });
    document.getElementById("tb-color-gray").addEventListener("mousedown", (e) => {
      e.preventDefault();
      document.execCommand("foreColor", false, COLORS.gray);
      window.markUnsaved(); updateToolbarState();
    });

    // Custom-Picker
    document.getElementById("tb-color").addEventListener("mousedown", (e) => e.stopPropagation());
    document.getElementById("tb-color").addEventListener("input", (e) => {
      document.execCommand("foreColor", false, e.target.value);
      window.markUnsaved(); updateToolbarState();
    });

    // Link einfügen / entfernen
    document.getElementById("tb-link").addEventListener("mousedown", (e) => {
      e.preventDefault();
      const sel = window.getSelection();
      let existingLink = null;
      if (sel && sel.rangeCount) {
        let node = sel.getRangeAt(0).startContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
        existingLink = node.closest("a");
      }
      if (existingLink) {
        sel.selectAllChildren(existingLink);
        document.execCommand("unlink", false, null);
        window.markUnsaved(); updateToolbarState();
        return;
      }
      openLinkModal(sel);
    });

    // Bild an Cursor einfügen
    document.getElementById("tb-img-insert").addEventListener("mousedown", (e) => {
      e.preventDefault();
      const sel = window.getSelection();
      if (sel && sel.rangeCount) STATE.savedRange = sel.getRangeAt(0).cloneRange();
      STATE.insertImgMode = true;
      window.openGallery(null);
    });
  };

  window.showTextToolbar = function () {
    document.getElementById("admin-text-toolbar").classList.add("show");
    updateToolbarState();
  };

  window.hideTextToolbar = function () {
    document.getElementById("admin-text-toolbar")?.classList.remove("show");
  };

  window.updateToolbarState = updateToolbarState;
  function updateToolbarState() {
    ["bold", "italic", "underline", "strikeThrough"].forEach((cmd) => {
      document.querySelector(`.tb-btn[data-cmd="${cmd}"]`)
        ?.classList.toggle("active", document.queryCommandState(cmd));
    });

    const linkBtn = document.getElementById("tb-link");
    if (linkBtn) {
      const selL = window.getSelection();
      let inLink = false;
      if (selL && selL.rangeCount) {
        let node = selL.getRangeAt(0).startContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
        inLink = !!node.closest("a");
      }
      linkBtn.classList.toggle("active", inLink);
      linkBtn.title = inLink ? "Link entfernen" : "Link einfügen";
    }

    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      let node = sel.getRangeAt(0).startContainer;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      const computedPx = parseFloat(window.getComputedStyle(node).fontSize);
      if (!isNaN(computedPx)) {
        const select  = document.getElementById("tb-fontsize");
        if (select) {
          const options = [...select.options].map((o) => parseFloat(o.value));
          const closest = options.reduce((prev, cur) =>
            Math.abs(cur - computedPx) < Math.abs(prev - computedPx) ? cur : prev
          );
          select.value = closest + "px";
        }
      }

      const computedColor = window.getComputedStyle(node).color;
      const rgb = computedColor.match(/\d+/g);
      let detectedHex = "";
      if (rgb && rgb.length >= 3) {
        detectedHex = "#" + rgb.slice(0, 3).map((v) => parseInt(v).toString(16).padStart(2, "0")).join("");
      }
      const GOLD_VARIANTS = ["#b38c0f", "#c4b47a", "#9e8124", "#b8860b", "#c4a000"];
      const GRAY_VARIANTS = ["#a19d91", "#a0a09a", "#9e9e9e", "#a09d91"];
      const isGold = GOLD_VARIANTS.some((c) => detectedHex.toLowerCase() === c);
      const isGray = GRAY_VARIANTS.some((c) => detectedHex.toLowerCase() === c);
      document.getElementById("tb-color-gold")?.classList.toggle("active", isGold);
      document.getElementById("tb-color-gray")?.classList.toggle("active", isGray);
      document.getElementById("tb-color-custom-wrap")?.classList.toggle("active", !isGold && !isGray && detectedHex !== "");
    }
  }

  window.showToolbarForSelection = function () { updateToolbarState(); };

  function applyFontSize(size) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return;
    document.execCommand("fontSize", false, "7");
    const content = window.getContentBox();
    if (content) {
      content.querySelectorAll('font[size="7"]').forEach((font) => {
        const span = document.createElement("span");
        span.style.fontSize = size;
        span.innerHTML      = font.innerHTML;
        font.replaceWith(span);
      });
    }
    window.markUnsaved();
  }

  // Link-Modal
  function openLinkModal(sel) {
    const selectedText      = sel && !sel.isCollapsed ? sel.toString() : "";
    const savedRangeForLink = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;

    const linkOverlay = document.createElement("div");
    linkOverlay.id    = "link-modal-overlay";
    linkOverlay.style.cssText = "position:fixed;inset:0;backdrop-filter:blur(8px) brightness(0.55);-webkit-backdrop-filter:blur(8px) brightness(0.55);background:rgba(10,5,0,0.45);z-index:99999;display:flex;align-items:center;justify-content:center;";

    // HTML komplett über DOM aufbauen – kein user-Daten in innerHTML
    const box = document.createElement("div");
    box.style.cssText = "background:rgba(18,10,3,0.75);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(96,78,20,0.7);border-radius:10px;padding:26px 30px;width:340px;max-width:92vw;box-shadow:0 8px 48px rgba(0,0,0,0.6);font-family:Arial,sans-serif;";
    box.innerHTML = `
      <h3 style="color:#c4b47a;font-size:14px;margin-bottom:18px;letter-spacing:1px;text-align:center;">~ Link einfügen ~</h3>
      <label style="display:block;font-size:11px;color:#a19d91;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">URL</label>
      <input id="link-url-input" type="url" value="https://" style="width:100%;background:#0e0906;border:1px solid #604e14;border-radius:4px;color:#e8dfc8;padding:8px 10px;font-size:13px;outline:none;box-sizing:border-box;">
      ${!selectedText ? `
        <label style="display:block;font-size:11px;color:#a19d91;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;margin-top:14px;">Linktext</label>
        <input id="link-text-input" type="text" placeholder="Anzeigetext" style="width:100%;background:#0e0906;border:1px solid #604e14;border-radius:4px;color:#e8dfc8;padding:8px 10px;font-size:13px;outline:none;box-sizing:border-box;">
      ` : ""}
      <div id="link-modal-error" style="color:#c97070;font-size:12px;margin-top:8px;min-height:16px;"></div>
      <div style="display:flex;gap:10px;margin-top:20px;">
        <button id="link-modal-cancel" style="flex:1;padding:9px;border-radius:5px;font-size:13px;cursor:pointer;border:1px solid rgba(96,78,20,0.5);background:transparent;color:#a19d91;letter-spacing:1px;transition:all 0.15s;">Abbrechen</button>
        <button id="link-modal-save"   style="flex:1;padding:9px;border-radius:5px;font-size:13px;cursor:pointer;border:1px solid rgba(179,140,15,0.6);background:transparent;color:#b38c0f;letter-spacing:1px;transition:all 0.15s;">Einfügen</button>
      </div>`;
    linkOverlay.appendChild(box);
    document.body.appendChild(linkOverlay);
    document.getElementById("link-url-input").focus();
    document.getElementById("link-url-input").select();

    const closeLinkModal = () => linkOverlay.remove();
    document.getElementById("link-modal-cancel").addEventListener("click", closeLinkModal);
    linkOverlay.addEventListener("click", (e) => { if (e.target === linkOverlay) closeLinkModal(); });

    document.getElementById("link-modal-save").addEventListener("click", () => {
      const url   = document.getElementById("link-url-input").value.trim();
      const errEl = document.getElementById("link-modal-error");
      if (!url || url === "https://") { errEl.textContent = "Bitte eine URL eingeben."; return; }
      closeLinkModal();
      if (savedRangeForLink) {
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(savedRangeForLink);
      }
      if (selectedText) {
        document.execCommand("createLink", false, url);
        document.querySelectorAll(`a[href="${url}"]`).forEach((a) => {
          a.target = "_blank"; a.rel = "noopener noreferrer";
        });
      } else {
        const linkTextEl = document.getElementById("link-text-input");
        const linkText   = linkTextEl ? linkTextEl.value.trim() : "";
        if (!linkText) return;
        // execCommand insertHTML: URL ist admin-kontrolliert (keine Nutzereingabe in href)
        // linkText wird über textContent gesetzt, nicht interpoliert
        const a = document.createElement("a");
        a.href   = url;
        a.target = "_blank";
        a.rel    = "noopener noreferrer";
        a.textContent = linkText;
        // Range-basiertes Einfügen (statt execCommand insertHTML mit user-String)
        const rng = savedRangeForLink ? savedRangeForLink.cloneRange() : (window.getSelection().rangeCount ? window.getSelection().getRangeAt(0) : null);
        if (rng) { rng.collapse(false); rng.insertNode(a); }
      }
      window.markUnsaved();
      updateToolbarState();
    });
    document.getElementById("link-url-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("link-modal-save").click();
    });
  }

  // ─── Galerie ──────────────────────────────────────────────────────────────────
  // Galerie-interner State
  const galState = { editMode: false, dragItem: null, folders: [] };

  window.injectGalleryOverlay = function () {
    const overlay = document.createElement("div");
    overlay.id    = "admin-gallery-overlay";
    overlay.innerHTML = `
      <div class="gal-panel">
        <div class="gal-header">
          <h3 id="gal-title">~ Bild auswählen ~</h3>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="gal-edit-toggle" id="gal-edit-toggle" title="Ordner-Verwaltung ein-/ausschalten">✎ Ordner verwalten</button>
            <button class="gal-close" id="gal-close">✕</button>
          </div>
        </div>
        <div class="gal-upload-zone" id="gal-upload-zone">
          Neues Bild hier ablegen oder klicken · JPG, PNG, GIF, WEBP · max. 15 MB
          <input type="file" id="gal-file-input" accept="image/*" multiple style="display:none">
        </div>
        <div class="gal-filter-bar" id="gal-filter-bar">
          <input class="gal-search" id="gal-search" type="text" placeholder="Suche…">
          <div id="gal-tabs" class="gal-tabs"></div>
          <button class="gal-new-folder-btn" id="gal-new-folder-btn">+ Ordner</button>
        </div>
        <div class="gal-edit-hint" id="gal-edit-hint">
          Bilder auf Ordner-Tabs ziehen zum Verschieben · Klick auf Bild zum Auswählen deaktiviert
        </div>
        <div class="gal-grid" id="gal-grid">
          <div class="gal-empty">Bilder werden geladen…</div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById("gal-close").addEventListener("click", window.closeGallery);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) window.closeGallery(); });

    const zone = document.getElementById("gal-upload-zone");
    const fi   = document.getElementById("gal-file-input");
    zone.addEventListener("click", () => fi.click());
    fi.addEventListener("change", (e) => handleUpload(e.target.files));
    zone.addEventListener("dragover",  (e) => {
      e.preventDefault();
      if (!galState.editMode) zone.classList.add("dragover");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("dragover");
      if (galState.editMode) return; // kein Upload per Drop im Edit-Mode
      handleUpload(e.dataTransfer.files);
    });

    document.getElementById("gal-search").addEventListener("input", (e) => {
      const activeFolder = document.querySelector(".gal-filter-btn.active")?.dataset.folder || "all";
      renderGallery(activeFolder, e.target.value.trim());
    });
    document.getElementById("gal-edit-toggle").addEventListener("click", toggleGalEditMode);
    document.getElementById("gal-new-folder-btn").addEventListener("click", openNewFolderDialog);
  };

  // ─── Tabs dynamisch aufbauen ──────────────────────────────────────────────────
  function buildFolderTabs(folders) {
    galState.folders = folders;
    const tabsEl     = document.getElementById("gal-tabs");
    if (!tabsEl) return;
    tabsEl.innerHTML = "";

    const makeTab = (folderKey, label) => {
      const btn = document.createElement("button");
      btn.className      = "gal-filter-btn";
      btn.dataset.folder = folderKey;
      btn.textContent    = label;

      btn.addEventListener("click", () => {
        document.querySelectorAll(".gal-filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById("gal-search").value = "";
        renderGallery(folderKey);
      });

      if (folderKey !== "all") {
        btn.addEventListener("dragover", (e) => {
          if (!galState.editMode) return;
          e.preventDefault();
          btn.classList.add("drag-over");
        });
        btn.addEventListener("dragleave", () => btn.classList.remove("drag-over"));
        btn.addEventListener("drop", (e) => {
          e.preventDefault();
          btn.classList.remove("drag-over");
          if (!galState.editMode || !galState.dragItem) return;
          if (galState.dragItem.folder === folderKey) {
            window.showNotify("~ Bild ist bereits in diesem Ordner ~", "info");
            return;
          }
          moveImageToFolder(galState.dragItem, folderKey);
        });
      }
      return btn;
    };

    const allBtn = makeTab("all", "~ Alle");
    allBtn.classList.add("active");
    tabsEl.appendChild(allBtn);
    folders.forEach(f => tabsEl.appendChild(makeTab(f, "~ " + f)));
  }

  // ─── Edit-Mode Toggle ─────────────────────────────────────────────────────────
  function toggleGalEditMode() {
    galState.editMode   = !galState.editMode;
    const panel         = document.querySelector(".gal-panel");
    const toggleBtn     = document.getElementById("gal-edit-toggle");
    const newFolderBtn  = document.getElementById("gal-new-folder-btn");
    const hint          = document.getElementById("gal-edit-hint");

    panel?.classList.toggle("gal-edit-active", galState.editMode);
    if (toggleBtn) {
      toggleBtn.classList.toggle("active", galState.editMode);
      toggleBtn.textContent = galState.editMode ? "✓ Fertig" : "✎ Ordner verwalten";
    }
    if (newFolderBtn) newFolderBtn.style.display = galState.editMode ? "inline-flex" : "none";
    if (hint)         hint.style.display         = galState.editMode ? "block"       : "none";

    const activeFolder = document.querySelector(".gal-filter-btn.active")?.dataset.folder || "all";
    renderGallery(activeFolder, document.getElementById("gal-search")?.value || "");
  }

  // ─── Bild verschieben ─────────────────────────────────────────────────────────
  async function moveImageToFolder(imgData, targetFolder) {
    try {
      const res  = await fetch("/api/images/move", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ folder: imgData.folder, filename: imgData.name, targetFolder }),
      });
      const data = await res.json();
      if (res.ok) {
        const imgObj = STATE.allImages.find(i => i.url === imgData.url);
        if (imgObj) { imgObj.folder = targetFolder; imgObj.url = data.newUrl; }
        galState.dragItem = null;
        const activeFolder = document.querySelector(".gal-filter-btn.active")?.dataset.folder || "all";
        renderGallery(activeFolder, document.getElementById("gal-search")?.value || "");
        window.showNotify(`~ Verschoben nach ${targetFolder} ~`, "success");
      } else {
        window.showNotify("~ " + (data.error || "Fehler") + " ~", "error");
      }
    } catch {
      window.showNotify("~ Fehler beim Verschieben ~", "error");
    }
  }

  // ─── Neuer Ordner Dialog ──────────────────────────────────────────────────────
  function openNewFolderDialog() {
    if (document.getElementById("gal-folder-dialog")) return;
    const wrap = document.createElement("div");
    wrap.id = "gal-folder-dialog";
    wrap.style.cssText = "position:fixed;inset:0;backdrop-filter:blur(8px) brightness(0.55);-webkit-backdrop-filter:blur(8px) brightness(0.55);background:rgba(10,5,0,0.45);z-index:9999999;display:flex;align-items:center;justify-content:center;";
    wrap.innerHTML = `
      <div style="background:rgba(18,10,3,0.78);backdrop-filter:blur(18px);border:1px solid rgba(96,78,20,0.7);border-radius:10px;padding:26px 30px;width:320px;max-width:92vw;box-shadow:0 8px 48px rgba(0,0,0,0.6);font-family:Arial,sans-serif;">
        <h3 style="color:#c4b47a;font-size:14px;margin-bottom:18px;letter-spacing:1px;text-align:center;">~ Neuer Ordner ~</h3>
        <label style="display:block;font-size:11px;color:#a19d91;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">Name (Buchstaben, Zahlen, _ -)</label>
        <input id="gal-folder-input" type="text" placeholder="z.B. galerie_2026"
          style="width:100%;background:rgba(0,0,0,0.35);border:1px solid rgba(96,78,20,0.6);border-radius:4px;color:#e8dfc8;padding:8px 10px;font-size:13px;outline:none;box-sizing:border-box;transition:border-color 0.15s;">
        <div id="gal-folder-err" style="color:#c97070;font-size:12px;margin-top:8px;min-height:16px;"></div>
        <div style="display:flex;gap:10px;margin-top:18px;">
          <button id="gal-folder-cancel" style="flex:1;padding:9px;border-radius:5px;font-size:13px;cursor:pointer;border:1px solid rgba(96,78,20,0.5);background:transparent;color:#a19d91;letter-spacing:1px;transition:all 0.15s;">Abbrechen</button>
          <button id="gal-folder-save"   style="flex:1;padding:9px;border-radius:5px;font-size:13px;cursor:pointer;border:1px solid rgba(179,140,15,0.6);background:transparent;color:#b38c0f;letter-spacing:1px;transition:all 0.15s;">Erstellen</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const input = document.getElementById("gal-folder-input");
    input.focus();
    const close = () => wrap.remove();
    document.getElementById("gal-folder-cancel").addEventListener("click", close);
    wrap.addEventListener("click", e => { if (e.target === wrap) close(); });
    const doCreate = async () => {
      const name  = input.value.trim().replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
      const errEl = document.getElementById("gal-folder-err");
      if (!name) { errEl.textContent = "Bitte einen Namen eingeben."; return; }
      if (galState.folders.includes(name)) { errEl.textContent = "Ordner existiert bereits."; return; }
      try {
        const res  = await fetch("/api/folders", {
          method: "POST", headers: { "Content-Type": "application/json" },
          credentials: "include", body: JSON.stringify({ name }),
        });
        const data = await res.json();
        if (res.ok) {
          close();
          galState.folders.push(data.name);
          buildFolderTabs(galState.folders);
          window.showNotify(`~ Ordner "${data.name}" erstellt ~`, "success");
        } else {
          errEl.textContent = data.error || "Fehler";
        }
      } catch { errEl.textContent = "Verbindungsfehler"; }
    };
    document.getElementById("gal-folder-save").addEventListener("click", doCreate);
    input.addEventListener("keydown", e => {
      if (e.key === "Enter")  doCreate();
      if (e.key === "Escape") close();
    });
  }

  // ─── Galerie öffnen / schließen ───────────────────────────────────────────────
  window.openGallery = async function (target) {
    STATE.currentImgTarget = target !== undefined ? target : null;
    // Edit-Mode zurücksetzen
    galState.editMode = false;
    document.querySelector(".gal-panel")?.classList.remove("gal-edit-active");
    const tb = document.getElementById("gal-edit-toggle");
    if (tb) { tb.classList.remove("active"); tb.textContent = "✎ Ordner verwalten"; }
    const nb = document.getElementById("gal-new-folder-btn");
    if (nb) nb.style.display = "none";
    const hint = document.getElementById("gal-edit-hint");
    if (hint) hint.style.display = "none";
    document.getElementById("admin-gallery-overlay").classList.add("show");
    window.lockScroll();
    await loadImages();
  };

  window.closeGallery = function () {
    document.getElementById("admin-gallery-overlay").classList.remove("show");
    window.unlockScroll();
    STATE.currentImgTarget = null;
  };

  async function loadImages() {
    const grid = document.getElementById("gal-grid");
    grid.innerHTML = '<div class="gal-empty">Bilder werden geladen…</div>';
    try {
      const res  = await fetch(CFG.imagesEndpoint);
      const data = await res.json();
      STATE.allImages = data.images;
      buildFolderTabs(data.folders || []);
      renderGallery("all");
    } catch {
      grid.innerHTML = '<div class="gal-empty" style="color:#c97070">Fehler beim Laden</div>';
    }
  }

  // ─── Galerie rendern ──────────────────────────────────────────────────────────
  function renderGallery(folder, search = "") {
    const grid = document.getElementById("gal-grid");
    // Nur .webp anzeigen
    let list = folder === "all" ? STATE.allImages : STATE.allImages.filter(i => i.folder === folder);
    list = list.filter(i => i.name.toLowerCase().endsWith(".webp"));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i => i.name.toLowerCase().includes(q));
    }
    if (!list.length) {
      grid.innerHTML = '<div class="gal-empty">Keine Bilder</div>';
      return;
    }

    grid.innerHTML = list.map(img => {
      const safeUrl    = esc(img.url);
      const safeName   = esc(img.name);
      const safeFolder = esc(img.folder);
      return `
        <div class="gal-item${galState.editMode ? " gal-item-draggable" : ""}"
             data-url="${safeUrl}" data-name="${safeName}" data-folder="${safeFolder}"
             ${galState.editMode ? 'draggable="true"' : ""}>
          <div class="gal-img-wrap">
            <img src="${safeUrl}" alt="" loading="lazy">
          </div>
          <div class="gal-item-footer">
            <input class="gal-item-name" value="${safeName}" title="${safeName}"
              ${img.folder === "uploads" ? "" : 'readonly tabindex="-1"'}>
            <button class="gal-item-delete" title="Bild löschen">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        </div>`;
    }).join("");

    grid.querySelectorAll(".gal-item").forEach(item => {
      const url       = item.dataset.url;
      const folder    = item.dataset.folder;
      const name      = item.dataset.name;
      const nameInput = item.querySelector(".gal-item-name");
      const deleteBtn = item.querySelector(".gal-item-delete");

      // Bild auswählen – deaktiviert im Edit-Mode
      item.querySelector(".gal-img-wrap").addEventListener("click", () => {
        if (galState.editMode) return;
        selectImage(url);
      });

      // Drag & Drop im Edit-Mode
      item.addEventListener("dragstart", (e) => {
        if (!galState.editMode) { e.preventDefault(); return; }
        galState.dragItem = { url, name, folder };
        item.classList.add("gal-dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", name);
      });
      item.addEventListener("dragend", () => item.classList.remove("gal-dragging"));

      // Umbenennen – nur uploads
      if (folder === "uploads" && nameInput) {
        nameInput.addEventListener("click",   e => e.stopPropagation());
        nameInput.addEventListener("keydown", e => {
          if (e.key === "Enter")  { e.preventDefault(); nameInput.blur(); }
          if (e.key === "Escape") { nameInput.value = item.dataset.name; nameInput.blur(); }
        });
        nameInput.addEventListener("blur", async () => {
          const newName = nameInput.value.trim();
          if (!newName || newName === item.dataset.name) { nameInput.value = item.dataset.name; return; }
          try {
            const res  = await fetch("/api/images/uploads/" + encodeURIComponent(item.dataset.name), {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ newName }),
            });
            const data = await res.json();
            if (res.ok) {
              item.dataset.name = data.newName;
              item.dataset.url  = data.url;
              nameInput.value   = data.newName;
              nameInput.title   = data.newName;
              item.querySelector("img").src = data.url;
              const imgObj = STATE.allImages.find(i => i.url === url);
              if (imgObj) { imgObj.name = data.newName; imgObj.url = data.url; }
              window.showNotify("~ Umbenannt ~", "success");
            } else {
              window.showNotify("~ " + (data.error || "Fehler") + " ~", "error");
              nameInput.value = item.dataset.name;
            }
          } catch {
            window.showNotify("~ Fehler beim Umbenennen ~", "error");
            nameInput.value = item.dataset.name;
          }
        });
      }

      // Löschen – alle Ordner
      if (deleteBtn) {
        deleteBtn.addEventListener("click", async e => {
          e.stopPropagation();
          window.cmsConfirm(
            `Bild "${name}" wirklich löschen?\n(.webp + ggf. Original werden entfernt)`,
            async () => {
              try {
                const res = await fetch(
                  `/api/images/${encodeURIComponent(folder)}/${encodeURIComponent(name)}`,
                  { method: "DELETE", credentials: "include" }
                );
                if (res.ok) {
                  STATE.allImages = STATE.allImages.filter(i => i.url !== item.dataset.url);
                  item.remove();
                  window.showNotify("~ Gelöscht ~", "success");
                } else {
                  const d = await res.json();
                  window.showNotify("~ " + (d.error || "Fehler") + " ~", "error");
                }
              } catch {
                window.showNotify("~ Fehler beim Löschen ~", "error");
              }
            },
            "danger"
          );
        });
      }
    });
  }

  function selectImage(url) {
    if (STATE.currentImgTarget === "__col__") {
      window.closeGallery();
      const col = window.__colTarget;
      window.__colTarget        = null;
      STATE.currentImgTarget    = null;
      if (!col) return;
      const img = document.createElement("img");
      img.src   = url; img.alt = "";
      img.classList.add("img-responsive");
      img.style.cssText = "max-width:100%;display:block;margin:0 auto;";
      const ctrl = col.querySelector(".col-controls");
      ctrl ? col.insertBefore(img, ctrl) : col.appendChild(img);
      window.markUnsaved();
      window.showNotify("~ Bild eingefügt ~", "success");
      return;
    }

    if (STATE.currentImgTarget === "__cms-block__") {
      window.closeGallery();
      const box = window.getContentBox();
      if (!box) return;
      const div = document.createElement("div");
      div.className = "cms-block"; div.setAttribute("data-cms-block", "");
      div.style.textAlign = "center";
      const img = document.createElement("img");
      img.src   = url; img.alt = "";
      img.style.cssText = "max-width:100%;display:block;margin:0 auto;";
      div.appendChild(img);
      div.prepend(window.makeCmsUi(div));
      box.appendChild(div);
      window.markUnsaved();
      window.showNotify("~ Bild-Block hinzugefügt ~", "success");
      return;
    }

    if (STATE.insertImgMode) {
      STATE.insertImgMode = false;
      const html = `<a href="${esc(url)}" data-toggle="lightbox"><img src="${esc(url)}" alt="" style="max-width:100%;height:auto;display:block;margin:8px 0;" loading="lazy"></a>`;
      document.execCommand("insertHTML", false, html);
      window.markUnsaved();
      window.closeGallery();
      return;
    }

    if (STATE.currentImgTarget) {
      STATE.currentImgTarget.src = url;
      const link = STATE.currentImgTarget.closest("a");
      if (link) {
        const href       = link.getAttribute("href") || "";
        const isPdf      = href.toLowerCase().endsWith(".pdf");
        const isAnchor   = href.includes("#");
        const isExternal = link.getAttribute("rel") === "external" || href.startsWith("http");
        const isImage    = /\.(jpg|jpeg|png|gif|webp|svg)($|\?)/i.test(href);
        if (isPdf || isAnchor || isExternal) {
          window.showNotify("~ Bild getauscht (Link-Ziel erhalten) ~", "info");
        } else if (isImage || href === "" || href === "#") {
          link.href = url;
          link.setAttribute("data-toggle", "lightbox");
          window.showNotify("~ Bild & Lightbox aktualisiert ~", "success");
        }
      } else {
        const newLink = document.createElement("a");
        newLink.href  = url;
        newLink.setAttribute("data-toggle", "lightbox");
        STATE.currentImgTarget.parentNode.insertBefore(newLink, STATE.currentImgTarget);
        newLink.appendChild(STATE.currentImgTarget);
        window.showNotify("~ Lightbox-Link erstellt ~", "success");
      }
      window.markUnsaved();
    }
    window.closeGallery();
  }

  function formatFileSize(bytes) {
    if (bytes < 1024)       return bytes + " B";
    if (bytes < 1024*1024)  return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024*1024)).toFixed(1) + " MB";
  }

  async function handleUpload(files) {
    if (!files?.length) return;
    const zone         = document.getElementById("gal-upload-zone");
    const activeFolder = document.querySelector(".gal-filter-btn.active")?.dataset.folder || "all";
    // "all" ist kein echter Ordner → Fallback uploads
    const targetFolder = (activeFolder === "all") ? "uploads" : activeFolder;

    for (const file of files) {
      const sizeStr = formatFileSize(file.size);
      zone.textContent = "";
      const nameSpan = document.createElement("span");
      nameSpan.style.color = "#c4b47a";
      nameSpan.textContent = file.name;
      const sizeSpan = document.createElement("span");
      sizeSpan.style.color = "#604e14";
      sizeSpan.textContent = ` (${sizeStr}) → ${targetFolder} …`;
      zone.appendChild(nameSpan);
      zone.appendChild(sizeSpan);

      const fd = new FormData();
      fd.append("image", file);
      fd.append("folder", targetFolder);   // Zielordner mitschicken
      try {
        const res = await fetch(CFG.uploadEndpoint, { method: "POST", body: fd });
        if (res.ok) {
          const data = await res.json();
          STATE.allImages.unshift({ url: data.url, folder: data.folder || targetFolder, name: data.filename });
          window.showNotify(`~ ${file.name} (${sizeStr}) → ${targetFolder} ~`, "success");
        } else {
          window.showNotify("~ Upload fehlgeschlagen ~", "error");
        }
      } catch {
        window.showNotify("~ Upload fehlgeschlagen ~", "error");
      }
    }
    // Upload-Zone zurücksetzen
    zone.textContent = "Neues Bild hier ablegen oder klicken · JPG, PNG, GIF, WEBP · max. 15 MB";
    const newFi      = document.createElement("input");
    newFi.type       = "file";
    newFi.id         = "gal-file-input";
    newFi.accept     = "image/*";
    newFi.multiple   = true;
    newFi.style.display = "none";
    newFi.addEventListener("change", (e) => handleUpload(e.target.files));
    zone.appendChild(newFi);
    renderGallery(activeFolder, document.getElementById("gal-search")?.value || "");
  }

  // ─── Notify-Toast ─────────────────────────────────────────────────────────────
  window.injectNotify = function () {
    const el = document.createElement("div");
    el.id    = "admin-notify";
    document.body.appendChild(el);
  };

  let _notifyTimer = null;
  window.showNotify = function (msg, type = "info") {
    const el = document.getElementById("admin-notify");
    el.textContent = msg; // textContent – kein XSS
    el.className   = `show ${type}`;
    if (_notifyTimer) clearTimeout(_notifyTimer);
    _notifyTimer = setTimeout(() => el.classList.remove("show"), 2500);
  };

  // ─── Custom Confirm / Alert ───────────────────────────────────────────────────
  (function setupCmsDialog() {
    if (document.getElementById("cms-dialog-overlay")) return;
    const ov  = document.createElement("div");
    ov.id     = "cms-dialog-overlay";
    ov.innerHTML = '<div id="cms-dialog-box"><div id="cms-dialog-msg"></div><div id="cms-dialog-btns"></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => { if (e.target === ov) ov.classList.remove("open"); });
  })();

  window.cmsConfirm = function (msg, onOk, style) {
    style     = style || "confirm";
    const ov  = document.getElementById("cms-dialog-overlay");
    // textContent für user-generierte Nachrichten
    document.getElementById("cms-dialog-msg").textContent = msg;
    const btns    = document.getElementById("cms-dialog-btns");
    const okLabel = style === "danger" ? "Löschen" : "OK";
    btns.innerHTML = `<button class="cms-dialog-btn cancel">Abbrechen</button><button class="cms-dialog-btn ${style}">${okLabel}</button>`;
    ov.classList.add("open");
    const close   = () => ov.classList.remove("open");
    btns.querySelector(".cancel").onclick        = close;
    btns.querySelector("." + style).onclick = () => { close(); onOk(); };
  };

  window.cmsAlert = function (msg) {
    const ov = document.getElementById("cms-dialog-overlay");
    document.getElementById("cms-dialog-msg").textContent = msg;
    document.getElementById("cms-dialog-btns").innerHTML  = '<button class="cms-dialog-btn confirm" style="max-width:120px;margin:0 auto">OK</button>';
    ov.classList.add("open");
    document.getElementById("cms-dialog-btns").querySelector(".confirm").onclick = () => ov.classList.remove("open");
    ov.addEventListener("click", (e) => { if (e.target === ov) ov.classList.remove("open"); }, { once: true });
  };

  // ─── Backup-Modal ─────────────────────────────────────────────────────────────
  (function setupBackupModal() {
    if (document.getElementById("backup-modal-overlay")) return;
    const ov  = document.createElement("div");
    ov.id     = "backup-modal-overlay";
    ov.innerHTML = `<div id="backup-modal">
      <h3><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5.34L1 10"/></svg> Verlauf: <span id="backup-modal-filename"></span></h3>
      <div id="backup-list"></div>
      <button type="button" id="backup-close-btn">Schließen</button>
    </div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => {
      if (e.target === ov || e.target.closest("#backup-close-btn")) ov.classList.remove("open");
    });
  })();

  async function openBackupModal() {
    const ov   = document.getElementById("backup-modal-overlay");
    // textContent statt innerHTML – Dateiname kommt aus URL, nicht von API
    document.getElementById("backup-modal-filename").textContent = window.adminCurrentFile;
    const list = document.getElementById("backup-list");
    list.innerHTML = '<div class="backup-empty">Lade…</div>';
    ov.classList.add("open");
    try {
      const res  = await fetch("/api/backups/" + encodeURIComponent(window.adminCurrentFile), { credentials: "include" });
      const data = await res.json();
      if (!data.backups?.length) {
        list.innerHTML = '<div class="backup-empty">Keine Sicherungen vorhanden.</div>';
        return;
      }

      // XSS-Fix: Backup-Namen aus der API werden über escHtml gesichert
      list.innerHTML = data.backups.map((b) =>
        `<div class="backup-item">
          <span class="backup-item-date">${esc(b.date)}</span>
          <button class="backup-restore-btn" data-name="${esc(b.name)}">Wiederherstellen</button>
        </div>`
      ).join("");

      list.querySelectorAll(".backup-restore-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          window.cmsConfirm(
            "Diese Sicherung wiederherstellen? Aktueller Stand wird vorher gesichert.",
            async () => {
              btn.disabled    = true;
              btn.textContent = "…";
              try {
                const r2  = await fetch("/api/restore-backup", {
                  method: "POST", credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ filename: window.adminCurrentFile, backupName: btn.dataset.name }),
                });
                const d2  = await r2.json();
                if (d2.success) {
                  ov.classList.remove("open");
                  window.showNotify("~ Sicherung wiederhergestellt – Seite wird neu geladen ~", "success");
                  setTimeout(() => location.reload(), 1500);
                } else {
                  window.showNotify("~ Fehler: " + (d2.error || "Unbekannt") + " ~", "error");
                  btn.disabled = false; btn.textContent = "Wiederherstellen";
                }
              } catch {
                window.showNotify("~ Server nicht erreichbar ~", "error");
                btn.disabled = false; btn.textContent = "Wiederherstellen";
              }
            }
          );
        });
      });
    } catch {
      list.innerHTML = '<div class="backup-empty">Fehler beim Laden.</div>';
    }
  }

  // ─── Bild-Skala ───────────────────────────────────────────────────────────────
  (function initImgScale() {
    const bar = document.createElement("div");
    bar.id    = "img-scale-bar";
    bar.innerHTML = `
      <div id="img-scale-bar-head">
        <span id="img-scale-label"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg> Größe</span>
        <button id="img-scale-close" title="Schließen">&times;</button>
      </div>
      <div id="img-scale-val">100%</div>
      <div id="img-scale-track">
        <input type="range" id="img-scale-slider" min="10" max="100" value="100" step="5">
      </div>`;
    document.body.appendChild(bar);

    const slider   = bar.querySelector("#img-scale-slider");
    const valEl    = bar.querySelector("#img-scale-val");
    const closeBtn = bar.querySelector("#img-scale-close");
    let scaleImg   = null;
    let scaleBlock = null;

    function positionBar() {
      if (!scaleBlock) return;
      const r  = scaleBlock.getBoundingClientRect();
      const bw = bar.offsetWidth  || 52;
      const bh = bar.offsetHeight || 168;
      let left = r.left - bw - 10;
      let top  = r.top  + r.height / 2 - bh / 2;
      if (left < 6) left = r.right + 10;
      top = Math.max(8, Math.min(top, window.innerHeight - bh - 8));
      bar.style.left = left + "px";
      bar.style.top  = top  + "px";
    }

    window.openImgScale = (img, block) => {
      scaleImg   = img;
      scaleBlock = block || img.closest(".cms-block") || img.parentElement;
      const wrapper  = img.parentElement?.tagName === "A" ? img.parentElement : null;
      const sourceEl = wrapper || img;
      const cur      = parseInt(sourceEl.style.maxWidth) || 100;
      slider.value   = cur;
      valEl.textContent = cur + "%";
      bar.classList.add("visible");
      requestAnimationFrame(() => requestAnimationFrame(positionBar));
    };

    window.closeImgScale = () => {
      bar.classList.remove("visible");
      scaleImg   = null;
      scaleBlock = null;
    };

    slider.addEventListener("input", (e) => {
      if (!scaleImg) return;
      const v = e.target.value;
      valEl.textContent = v + "%";
      const wrapper = scaleImg.parentElement?.tagName === "A" ? scaleImg.parentElement : null;
      if (wrapper) {
        wrapper.style.display   = "block";
        wrapper.style.maxWidth  = v + "%";
        wrapper.style.margin    = "0 auto";
        scaleImg.style.maxWidth = "100%";
        scaleImg.style.display  = "block";
      } else {
        scaleImg.style.maxWidth     = v + "%";
        scaleImg.style.display      = "block";
        scaleImg.style.marginLeft   = "auto";
        scaleImg.style.marginRight  = "auto";
      }
      window.markUnsaved();
    });

    closeBtn.addEventListener("click", window.closeImgScale);

    // Globale Event-Delegation für scale-btn
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".scale-btn");
      if (!btn) return;
      e.stopPropagation();
      const ui    = btn.closest(".cms-block-ui");
      const block = ui ? ui.parentElement : btn.closest(".cms-block");
      if (!block) return;
      const img   = block.querySelector("img");
      if (!img) { window.showNotify("~ Kein Bild in diesem Block ~", "info"); return; }
      btn.style.opacity = "1";
      window.openImgScale(img, block);
    });

    window.addEventListener("scroll", () => { if (bar.classList.contains("visible")) positionBar(); }, true);
    window.addEventListener("resize", () => { if (bar.classList.contains("visible")) positionBar(); });
    document.addEventListener("mousedown", (e) => {
      if (bar.classList.contains("visible") && !bar.contains(e.target) && !e.target.closest(".scale-btn"))
        window.closeImgScale();
    });
  })();

})();