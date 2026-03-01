/**
 * admin-blocks.js – Block-System, Undo/Save/Verwerfen, Termin-System
 *
 * Benötigt: admin-state.js, admin-ui.js
 * Einbinden nach admin-ui.js:
 *   <script src="/js/admin-blocks.js"></script>
 */
(function () {
  "use strict";

  const CFG   = window.AdminConfig;
  const STATE = window.AdminState;

  // ─── Sortable-Instanz ─────────────────────────────────────────────────────────
  let sortableInstance = null;

  // ─── Speichern ────────────────────────────────────────────────────────────────
  window.saveChanges = async function () {
    window.showNotify("~ Wird gespeichert… ~", "info");

    const editables = document.querySelectorAll("[contenteditable]");
    editables.forEach((el) => el.removeAttribute("contenteditable"));

    const clone = document.documentElement.cloneNode(true);

    // Admin-UI-Elemente aus dem gespeicherten HTML entfernen
    [
      "#admin-bar", "#admin-auth-btn", "#admin-footer-link", "#admin-login-modal",
      "#admin-gallery-overlay", "#admin-text-toolbar", "#admin-notify",
      "#admin-edit-styles", "#btn-add-termin",
      "#cms-dialog-overlay", "#backup-modal-overlay", "#img-scale-bar",
      "#pw-modal-overlay", "#link-modal-overlay", "#gal-folder-dialog",
    ].forEach((sel) => clone.querySelector(sel)?.remove());

    clone.querySelectorAll(".termin-delete").forEach((el) => el.remove());
    clone.querySelectorAll(".cms-block-ui").forEach((el) => el.remove());
    clone.querySelectorAll(".col-controls").forEach((el) => el.remove());
    clone.querySelectorAll(".col-placeholder").forEach((el) => el.remove());
    clone.querySelectorAll("[data-cms-block]").forEach((el) => el.removeAttribute("data-cms-block"));
    clone.querySelectorAll(".cms-block").forEach((el) => {
      if (!el.classList.contains("row") && !el.classList.contains("termin") && !el.classList.contains("nachruf"))
        el.classList.remove("cms-block");
    });
    clone.querySelector("#playground-banner")?.remove();
    clone.querySelectorAll(".playground-section-label").forEach((el) => el.remove());

    // Alle dynamisch geladenen Admin-Scripts entfernen (nur admin-loader.js bleibt)
    clone.querySelectorAll('script[src*="moz-extension"]').forEach((el) => el.remove());
    [
      'script[src*="admin-state"]',
      'script[src*="admin-ui"]',
      'script[src*="admin-blocks"]',
      'script[src*="admin-edit"]',
    ].forEach((sel) => clone.querySelectorAll(sel).forEach((el) => el.remove()));

    clone.querySelector("body").classList.remove("edit-mode", "admin-active");

    editables.forEach((el) => el.setAttribute("contenteditable", "true"));

    try {
      const res = await fetch(CFG.saveEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: window.adminCurrentFile, content: "<!DOCTYPE html>\n" + clone.outerHTML }),
      });
      if (res.ok) {
        STATE.hasUnsavedChanges = false;
        document.getElementById("unsaved-dot")?.classList.remove("show");
        const saveBtn = document.getElementById("btn-save");
        if (saveBtn) { saveBtn.disabled = true; saveBtn.classList.remove("save-active"); }
        window.showNotify("~ Gespeichert ~", "success");
      } else {
        window.showNotify("~ Fehler beim Speichern ~", "error");
      }
    } catch {
      window.showNotify("~ Server nicht erreichbar ~", "error");
    }
  };

  // ─── Undo ─────────────────────────────────────────────────────────────────────
  window.markUnsaved = function () {
    const el = window.getContentBox();
    if (el) {
      STATE.undoStack.push(el.innerHTML);
      if (STATE.undoStack.length > window.UNDO_MAX) STATE.undoStack.shift();
      const undoBtn = document.getElementById("btn-undo");
      if (undoBtn) undoBtn.disabled = STATE.undoStack.length <= 1;
      const mobUndo = document.getElementById("mob-btn-undo");
      if (mobUndo) mobUndo.disabled = STATE.undoStack.length <= 1;
    }
    STATE.hasUnsavedChanges = true;
    const saveBtn = document.getElementById("btn-save");
    if (saveBtn) { saveBtn.disabled = false; saveBtn.classList.add("save-active"); }
    const mobSave = document.getElementById("mob-btn-save");
    if (mobSave) { mobSave.disabled = false; mobSave.classList.add("save-active"); }
    document.getElementById("unsaved-dot")?.classList.add("show");
  };

  window.undoLastChange = function () {
    if (STATE.undoStack.length <= 1) return;
    STATE.undoStack.pop();
    const el = window.getContentBox();
    if (el) {
      el.innerHTML = STATE.undoStack[STATE.undoStack.length - 1];

      // BUG-FIX: nach innerHTML-Restore müssen ALLE Edit-Mode-Funktionen
      // neu initialisiert werden – auch das Block-System!
      window.removeEditable();
      window.makeTextEditable();
      window.makeImagesClickable();
      initBlockSystem();          // ← War vorher vergessen → Block-UI-Buttons waren tot nach Undo
    }
    const undoBtn = document.getElementById("btn-undo");
    if (undoBtn) undoBtn.disabled = STATE.undoStack.length <= 1;
    window.showNotify("~ Rückgängig ~", "info");
  };

  window.discardChanges = function () {
    if (STATE.hasUnsavedChanges) {
      window.cmsConfirm("Alle Änderungen verwerfen?", () => {
        STATE.hasUnsavedChanges = false;
        location.reload();
      }, "danger");
      return;
    }
    window.location.reload();
  };

  // ─── Text editierbar ──────────────────────────────────────────────────────────
  window.makeTextEditable = function () {
    const selectors = [
      "#wrapper-box p", "#wrapper-box h1", "#wrapper-box h2", "#wrapper-box h3",
      "#wrapper-box li", "#wrapper-box td",
      "#wrapper-box .termin p", "#wrapper-box .nachruf p", "#wrapper-box .nachruf h2",
      "#footer p", "#footer h2", "#footer h3", "#footer li",
    ];
    const el = window.getContentBox();
    if (el && STATE.undoStack.length === 0) STATE.undoStack.push(el.innerHTML);

    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((node) => {
        if (node.closest('[contenteditable="true"]')) return;
        node.setAttribute("contenteditable", "true");
        node.addEventListener("input",   window.markUnsaved);
        node.addEventListener("mouseup", window.showToolbarForSelection);
        node.addEventListener("keyup",   window.showToolbarForSelection);
      });
    });

    // ── Paste-Cleanup (einmalig registrieren) ─────────────────────────────────
    if (!document._adminPasteCleanup) {
      document._adminPasteCleanup = true;
      document.addEventListener("paste", (e) => {
        const target = e.target.closest('[contenteditable="true"]');
        if (!target) return;            // nur in editierbaren Feldern
        e.preventDefault();

        // Reinen Text aus Clipboard holen
        const plain = (e.clipboardData || window.clipboardData).getData("text/plain");
        if (!plain) return;

        // Zeilenumbrüche: doppelte Leerzeilen → <br><br>, einfache → Leerzeichen
        // (Verhält sich wie normales Browser-Verhalten ohne Fremd-CSS)
        const lines  = plain.split(/\r?\n/);
        const frag   = document.createDocumentFragment();
        lines.forEach((line, i) => {
          if (line.length) frag.appendChild(document.createTextNode(line));
          if (i < lines.length - 1) frag.appendChild(document.createElement("br"));
        });

        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(frag);
        // Cursor ans Ende der Einfügung setzen
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);

        window.markUnsaved();
      });
    }
  };

  window.removeEditable = function () {
    document.querySelectorAll('[contenteditable="true"]').forEach((el) => el.removeAttribute("contenteditable"));
  };

  // ─── Bilder klickbar ──────────────────────────────────────────────────────────
  window.makeImagesClickable = function () {
    document.querySelectorAll("#wrapper-box img, #wrapper-content-box img").forEach((img) => {
      if (img.closest("#admin-bar,#admin-gallery-overlay,#admin-login-modal,#admin-text-toolbar,#admin-notify")) return;
      // Vermeidet doppelte Listener: vorherigen entfernen und neu setzen
      img.removeEventListener("click", onImgClick);
      img.addEventListener("click", onImgClick);
    });
  };

  function onImgClick(e) {
    if (!STATE.isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    STATE.currentImgTarget = e.currentTarget;
    window.openGallery(STATE.currentImgTarget);
  }

  // ─── CMS Block UI ─────────────────────────────────────────────────────────────
  window.makeCmsUi = function (block) {
    const ui    = document.createElement("div");
    ui.className = "cms-block-ui";
    const hasImg = !!block.querySelector("img");

    ui.innerHTML = `
      <button class="cms-ui-btn scale-btn" title="Bildgröße" style="${hasImg ? "" : "opacity:0.3;"}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg> Größe
      </button>
      <button class="cms-ui-btn drag-handle" title="Verschieben">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="9" cy="5" r="1.5" fill="currentColor"/><circle cx="15" cy="5" r="1.5" fill="currentColor"/><circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/><circle cx="9" cy="19" r="1.5" fill="currentColor"/><circle cx="15" cy="19" r="1.5" fill="currentColor"/></svg> Verschieben
      </button>
      <button class="cms-ui-btn link-btn" ${!hasImg ? "disabled" : ""} title="${hasImg ? "Link hinzufügen" : "Kein Bild vorhanden"}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Link
      </button>
      <button class="cms-ui-btn split-btn" title="Zweispaltig">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="2" y="3" width="9" height="18" rx="1"/><rect x="13" y="3" width="9" height="18" rx="1"/></svg> Spalten
      </button>
      <button class="cms-ui-btn del-btn" title="Block löschen">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> Block löschen
      </button>`;

    // Link-Button
    ui.querySelector(".link-btn").addEventListener("click", () => openImgLinkModal(block));

    // Split-Button
    ui.querySelector(".split-btn").addEventListener("click", () => splitBlock(block));

    // Löschen-Button
    ui.querySelector(".del-btn").addEventListener("click", () => {
      window.cmsConfirm("Diesen Block löschen?", () => { block.remove(); window.markUnsaved(); }, "danger");
    });
    return ui;
  };

  // Bild-Link-Modal (für Block-UI)
  function openImgLinkModal(block) {
    const img = block.querySelector("img");
    if (!img) return;
    const parentA    = img.closest("a");
    const existingUrl = parentA ? parentA.getAttribute("href") : "";

    const lOl = document.createElement("div");
    lOl.style.cssText = "position:fixed;inset:0;backdrop-filter:blur(8px) brightness(0.55);-webkit-backdrop-filter:blur(8px) brightness(0.55);background:rgba(10,5,0,0.45);z-index:99999;display:flex;align-items:center;justify-content:center;";
    lOl.innerHTML = `
      <div style="background:rgba(18,10,3,0.75);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(96,78,20,0.7);border-radius:10px;padding:26px 30px;width:340px;max-width:92vw;box-shadow:0 8px 48px rgba(0,0,0,0.6);font-family:Arial,sans-serif;">
        <h3 style="color:#c4b47a;font-size:14px;margin-bottom:18px;letter-spacing:1px;text-align:center;">~ Bild-Link ${existingUrl ? "bearbeiten" : "hinzufügen"} ~</h3>
        <label style="display:block;font-size:11px;color:#a19d91;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;">URL</label>
        <input id="img-link-url" type="url" value="${window.escHtml(existingUrl || "https://")}" style="width:100%;background:rgba(0,0,0,0.35);border:1px solid rgba(96,78,20,0.6);border-radius:4px;color:#e8dfc8;padding:8px 10px;font-size:13px;outline:none;box-sizing:border-box;transition:border-color 0.15s;">
        ${existingUrl ? '<button id="img-link-remove" style="margin-top:10px;padding:6px 12px;background:transparent;border:1px solid rgba(180,60,60,0.5);color:#c97070;border-radius:4px;cursor:pointer;font-size:12px;transition:all 0.15s;">Link entfernen</button>' : ""}
        <div style="display:flex;gap:10px;margin-top:20px;">
          <button id="img-link-cancel" style="flex:1;padding:9px;border-radius:5px;font-size:13px;cursor:pointer;border:1px solid rgba(96,78,20,0.5);background:transparent;color:#a19d91;letter-spacing:1px;transition:all 0.15s;">Abbrechen</button>
          <button id="img-link-save"   style="flex:1;padding:9px;border-radius:5px;font-size:13px;cursor:pointer;border:1px solid rgba(179,140,15,0.6);background:transparent;color:#b38c0f;letter-spacing:1px;transition:all 0.15s;">Speichern</button>
        </div>
      </div>`;
    document.body.appendChild(lOl);
    const inp = document.getElementById("img-link-url");
    inp.focus(); inp.select();

    const close = () => lOl.remove();
    document.getElementById("img-link-cancel").addEventListener("click", close);
    lOl.addEventListener("click", (e) => { if (e.target === lOl) close(); });

    const removeBtn = document.getElementById("img-link-remove");
    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        if (parentA) parentA.replaceWith(img);
        window.markUnsaved();
        close();
        const newUi = window.makeCmsUi(block);
        block.insertBefore(newUi, block.firstChild);
      });
    }

    document.getElementById("img-link-save").addEventListener("click", () => {
      const url = inp.value.trim();
      if (!url || url === "https://") {
        if (parentA) parentA.replaceWith(img);
      } else if (parentA) {
        parentA.href   = url;
        parentA.target = "_blank";
        parentA.rel    = "noopener noreferrer";
      } else {
        const a   = document.createElement("a");
        a.href    = url; a.target = "_blank"; a.rel = "noopener noreferrer";
        img.replaceWith(a); a.appendChild(img);
      }
      window.markUnsaved(); close();
    });
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("img-link-save").click(); });
  }

  // ─── Spalten-System ───────────────────────────────────────────────────────────
  function rebalanceCols(row) {
    const cols = Array.from(row.querySelectorAll(':scope > [class*="col-"]'));
    const n    = cols.length;
    if (!n) return;
    const w  = n === 1 ? 12 : n === 2 ? 6 : n === 3 ? 4 : n === 4 ? 3 : 2;
    const sm = Math.min(w * 2, 12);
    cols.forEach((col) => {
      col.className = col.className
        .replace(/\bcol-md-\d+\b/g, "col-md-" + w)
        .replace(/\bcol-sm-\d+\b/g, "col-sm-" + sm);
      if (!/col-md-\d/.test(col.className)) col.classList.add("col-md-" + w);
    });
  }

  function colPlaceholderHtml() {
    return `<div class="col-placeholder">
      <div class="col-placeholder-label">Inhalt wählen</div>
      <div class="col-placeholder-btns">
        <button class="col-add-btn ph-text-btn"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Text</button>
        <button class="col-add-btn ph-img-btn"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Bild</button>
      </div>
    </div>`;
  }

  function initColPlaceholder(col) {
    col.querySelector(".ph-text-btn")?.addEventListener("click", () => {
      col.querySelector(".col-placeholder")?.remove();
      const p = document.createElement("p");
      p.setAttribute("contenteditable", "true");
      p.textContent = "Neuer Text…";
      p.addEventListener("input",   window.markUnsaved);
      p.addEventListener("mouseup", window.showToolbarForSelection);
      p.addEventListener("keyup",   window.showToolbarForSelection);
      const ctrl = col.querySelector(".col-controls");
      ctrl ? col.insertBefore(p, ctrl) : col.appendChild(p);
      p.focus(); window.markUnsaved();
    });
    col.querySelector(".ph-img-btn")?.addEventListener("click", () => {
      col.querySelector(".col-placeholder")?.remove();
      STATE.currentImgTarget = "__col__";
      window.__colTarget     = col;
      window.openGallery("__col__");
    });
  }

  function makeColControls(col, parentRow) {
    const ctrl = document.createElement("div");
    ctrl.className = "col-controls";
    ctrl.innerHTML = `
      <button class="col-ctrl-btn add-text-btn"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Text</button>
      <button class="col-ctrl-btn add-img-btn"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Bild</button>
      <button class="col-ctrl-btn del-col"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> Spalte</button>`;

    ctrl.querySelector(".add-text-btn").addEventListener("click", () => {
      const p = document.createElement("p");
      p.setAttribute("contenteditable", "true");
      p.textContent = "Neuer Text…";
      p.addEventListener("input",   window.markUnsaved);
      p.addEventListener("mouseup", window.showToolbarForSelection);
      p.addEventListener("keyup",   window.showToolbarForSelection);
      col.querySelector(".col-placeholder")?.remove();
      col.insertBefore(p, ctrl);
      p.focus(); window.markUnsaved();
    });
    ctrl.querySelector(".add-img-btn").addEventListener("click", () => {
      col.querySelector(".col-placeholder")?.remove();
      STATE.currentImgTarget = "__col__";
      window.__colTarget     = col;
      window.openGallery("__col__");
    });
    ctrl.querySelector(".del-col").addEventListener("click", () => {
      const cols = Array.from(parentRow.querySelectorAll(':scope > [class*="col-"]'));
      if (cols.length <= 1) { window.showNotify("~ Letzte Spalte kann nicht entfernt werden ~", "info"); return; }
      window.cmsConfirm("Diese Spalte und ihren Inhalt entfernen?", () => {
        col.remove(); rebalanceCols(parentRow);
        const rem = Array.from(parentRow.querySelectorAll(':scope > [class*="col-"]'));
        if (rem.length === 1 && parentRow.classList.contains("cms-block")) {
          const lastCol = rem[0];
          const nodes   = Array.from(lastCol.childNodes).filter(
            (n) => !n.classList?.contains("col-controls") && !n.classList?.contains("col-placeholder")
          );
          const frag = document.createDocumentFragment();
          nodes.forEach((n) => frag.appendChild(n.cloneNode(true)));
          parentRow.classList.remove("row");
          parentRow.innerHTML = "";
          parentRow.appendChild(frag);
          parentRow.prepend(window.makeCmsUi(parentRow));
          parentRow.querySelectorAll("p,h1,h2,h3,li,td").forEach((el) => {
            if (!el.closest('[contenteditable="true"]')) {
              el.setAttribute("contenteditable", "true");
              el.addEventListener("input",   window.markUnsaved);
              el.addEventListener("mouseup", window.showToolbarForSelection);
              el.addEventListener("keyup",   window.showToolbarForSelection);
            }
          });
        }
        window.markUnsaved();
      }, "danger");
    });
    return ctrl;
  }

  function addColToRow(row) {
    const newCol      = document.createElement("div");
    newCol.className  = "col-md-6";
    newCol.innerHTML  = colPlaceholderHtml();
    row.appendChild(newCol);
    rebalanceCols(row);
    initColPlaceholder(newCol);
    newCol.appendChild(makeColControls(newCol, row));
    window.markUnsaved();
  }

  function splitBlock(block) {
    const uiEl = block.querySelector(":scope > .cms-block-ui");
    if (uiEl) uiEl.remove();
    const savedHtml = block.innerHTML;

    block.classList.add("row");
    block.innerHTML  = `
      <div class="col-md-6">${savedHtml}</div>
      <div class="col-md-6">${colPlaceholderHtml()}</div>`;

    block.querySelectorAll(':scope > [class*="col-"]').forEach((col) => {
      col.querySelectorAll("p,h1,h2,h3,li,td").forEach((el) => {
        if (!el.closest('[contenteditable="true"]')) {
          el.setAttribute("contenteditable", "true");
          el.addEventListener("input",   window.markUnsaved);
          el.addEventListener("mouseup", window.showToolbarForSelection);
          el.addEventListener("keyup",   window.showToolbarForSelection);
        }
      });
      initColPlaceholder(col);
      col.appendChild(makeColControls(col, block));
    });

    rebalanceCols(block);
    block.prepend(window.makeCmsUi(block));
    _patchSplitBtn(block, block.querySelector(":scope > .cms-block-ui .split-btn"));
    window.markUnsaved();
  }

  function _patchSplitBtn(block, sb) {
    if (!sb || sb.dataset.patched) return;
    sb.dataset.patched = "1";
    sb.title           = "Spalte hinzufügen";
    const newSb = sb.cloneNode(true);
    newSb.onclick = (e) => { e.stopPropagation(); e.preventDefault(); addColToRow(block); };
    sb.replaceWith(newSb);
  }

  // ─── Block-System initialisieren ─────────────────────────────────────────────
  function initBlockSystem() {
    const box = window.getContentBox();
    if (!box) return;

    // SortableJS laden (einmalig)
    function setupSortable() {
      if (sortableInstance) sortableInstance.destroy();
      sortableInstance = Sortable.create(box, {
        handle:     ".drag-handle",
        animation:  150,
        ghostClass: "sortable-ghost",
        chosenClass:"sortable-chosen",
        draggable:  ".cms-block",
        onEnd:      window.markUnsaved,
      });
    }

    if (typeof Sortable === "undefined") {
      const s   = document.createElement("script");
      s.src     = "https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.0/Sortable.min.js";
      s.onload  = setupSortable;
      document.head.appendChild(s);
    } else {
      setupSortable();
    }

    Array.from(box.children).forEach((child) => {
      if (child.id && child.id.startsWith("admin-")) return;
      if (child.querySelector(":scope > .cms-block-ui")) return;
      if (!child.classList.contains("cms-block")) {
        child.classList.add("cms-block");
        child.setAttribute("data-cms-block", "");
      }
      child.prepend(window.makeCmsUi(child));

      if (child.classList.contains("row")) {
        child.querySelectorAll(':scope > [class*="col-"]').forEach((col) => {
          if (!col.querySelector(":scope > .col-controls")) col.appendChild(makeColControls(col, child));
          initColPlaceholder(col);
        });
        _patchSplitBtn(child, child.querySelector(":scope > .cms-block-ui .split-btn"));
      }
    });

    // Toolbar-Buttons für neue Blöcke
    _bindAddButtons(box);
  }
  // Exportieren für undoLastChange
  window._initBlockSystem = initBlockSystem;

  function _bindAddButtons(box) {
    const btns = {
      "btn-add-block-text":   _addTextBlock,
      "btn-add-block-img":    _addImgBlock,
      "btn-add-block-line":   _addLineBlock,
      "btn-add-block-spacer": _addSpacerBlock,
    };
    Object.entries(btns).forEach(([id, handler]) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      if (btn._handler) btn.removeEventListener("click", btn._handler);
      btn._handler = () => handler(box);
      btn.addEventListener("click", btn._handler);
    });
  }

  function _addTextBlock(box) {
    const div = document.createElement("div");
    div.className = "cms-block"; div.setAttribute("data-cms-block", "");
    const p   = document.createElement("p");
    p.setAttribute("contenteditable", "true");
    p.textContent = "Neuer Text…";
    p.addEventListener("input",   window.markUnsaved);
    p.addEventListener("mouseup", window.showToolbarForSelection);
    p.addEventListener("keyup",   window.showToolbarForSelection);
    div.prepend(window.makeCmsUi(div));
    div.appendChild(p);
    box.appendChild(div);
    p.focus();
    window.markUnsaved();
    window.showNotify("~ Textfeld hinzugefügt ~", "success");
  }

  function _addImgBlock(_box) {
    window.openGallery("__cms-block__");
  }

  function _addLineBlock(box) {
    const div = document.createElement("div");
    div.className = "cms-block"; div.setAttribute("data-cms-block", "");
    div.style.textAlign = "center";
    const img   = document.createElement("img");
    img.src     = "/images/haarlinie.webp";
    img.onerror = () => { img.src = "/images/haarlinie.png"; };
    img.alt     = ""; img.style.cssText = "max-width:100%;display:block;margin:0 auto;";
    div.appendChild(img);
    div.prepend(window.makeCmsUi(div));
    box.appendChild(div);
    window.markUnsaved();
    window.showNotify("~ Trennlinie hinzugefügt ~", "success");
  }

  function _addSpacerBlock(box) {
    const div    = document.createElement("div");
    div.className = "cms-block"; div.setAttribute("data-cms-block", "");
    const spacer = document.createElement("div");
    spacer.className = "spacer_break";
    div.prepend(window.makeCmsUi(div));
    div.appendChild(spacer);
    box.appendChild(div);
    window.markUnsaved();
    window.showNotify("~ Abstand hinzugefügt ~", "success");
  }

  // ─── Block-System zerstören ───────────────────────────────────────────────────
  window.destroyBlockSystem = function () {
    if (sortableInstance) { sortableInstance.destroy(); sortableInstance = null; }
    document.querySelectorAll(".cms-block-ui").forEach((el) => el.remove());
    document.querySelectorAll(".col-controls").forEach((el) => el.remove());
    document.querySelectorAll(".col-placeholder").forEach((el) => el.remove());
    document.querySelectorAll("[data-cms-block]").forEach((el) => {
      el.removeAttribute("data-cms-block");
      el.classList.remove("cms-block");
    });
    ["btn-add-block-text", "btn-add-block-img", "btn-add-block-line", "btn-add-block-spacer"].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn?._handler) btn.removeEventListener("click", btn._handler);
    });
  };

  // ─── Footer-Block-System ─────────────────────────────────────────────────────
  window.initFooterBlockSystem = function () {
    const footer = document.getElementById("footer");
    if (!footer) return;
    Array.from(footer.children).forEach((child) => {
      if (child.id === "schalter_oben") return;
      if (child.querySelector(":scope > .cms-block-ui")) return;
      if (!child.classList.contains("cms-block")) {
        child.classList.add("cms-block");
        child.setAttribute("data-cms-block", "");
      }
      child.prepend(window.makeCmsUi(child));
    });
  };

  // ─── Termin-System ────────────────────────────────────────────────────────────
  window.showTerminAddButton = function () {
    if (window.adminCurrentFile !== "termine.html") return;
    let btn = document.getElementById("btn-add-termin");
    if (!btn) {
      btn             = document.createElement("button");
      btn.id          = "btn-add-termin";
      btn.textContent = "+ Termin";
      btn.title       = "Neuen Termin hinzufügen";
      document.body.appendChild(btn);
    }
    btn.replaceWith(btn.cloneNode(true));
    btn = document.getElementById("btn-add-termin");
    btn.addEventListener("click", addNewTermin);
    btn.style.display = "block";
  };

  window.hideTerminAddButton = function () {
    const btn = document.getElementById("btn-add-termin");
    if (btn) btn.style.display = "none";
  };

  function addNewTermin() {
    const contentBox = document.getElementById("wrapper-content-box");
    if (!contentBox) { window.cmsAlert("Inhalt-Container nicht gefunden."); return; }

    const newBlock    = document.createElement("div");
    newBlock.className = "row termin cms-block";
    newBlock.innerHTML = `
      <div class="col-md-4 col-sm-4">
        <p class="grau" contenteditable="true" style="text-align:left!important">Datum ~ Uhrzeit</p>
      </div>
      <div class="col-md-8 col-sm-8">
        <p contenteditable="true" style="text-align:left!important">Beschreibung des Auftritts</p>
      </div>`;

    const allTermine = [...contentBox.querySelectorAll(".row.termin")];
    if (allTermine.length) {
      allTermine[allTermine.length - 1].insertAdjacentElement("afterend", newBlock);
    } else {
      contentBox.insertAdjacentElement("beforeend", newBlock);
    }

    newBlock.prepend(window.makeCmsUi(newBlock));
    const dateField = newBlock.querySelector("p.grau");
    dateField.focus();
    const range = document.createRange();
    range.selectNodeContents(dateField);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);

    window.markUnsaved();
    window.showNotify("~ Neuer Termin eingefügt ~", "info");
    newBlock.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ─── Edit-Mode-Funktionen (benötigen Block-System-Funktionen) ─────────────────
  window.enableEditMode = function () {
    STATE.isEditMode  = true;
    STATE.undoStack   = [];
    document.body.classList.add("edit-mode");

    const toggleBtn = document.getElementById("btn-toggle-edit");
    if (toggleBtn) { toggleBtn.classList.add("active"); toggleBtn.textContent = "~ Bearbeiten aktiv"; }

    _setSaveDiscardUndo(true /* editActive */);

    window.makeTextEditable();
    window.makeImagesClickable();
    window.showTextToolbar();
    window.showTerminAddButton();
    initBlockSystem();
    window.initFooterBlockSystem();
    window.showNotify("~ Bearbeitungsmodus aktiv ~", "info");
  };

  window.disableEditMode = function () {
    STATE.isEditMode = false;
    document.body.classList.remove("edit-mode");

    const toggleBtn = document.getElementById("btn-toggle-edit");
    if (toggleBtn) { toggleBtn.classList.remove("active"); toggleBtn.textContent = "~ Bearbeiten"; }

    _setSaveDiscardUndo(false /* editActive */);

    window.removeEditable();
    window.hideTextToolbar();
    window.hideTerminAddButton();
    window.destroyBlockSystem();
  };

  window.toggleEditMode = function () {
    if (STATE.isEditMode) window.disableEditMode();
    else window.enableEditMode();
  };

  function _setSaveDiscardUndo(editActive) {
    const ids = {
      "btn-save":    { disabled: true,  removeClass: "save-active" },
      "btn-discard": { disabled: !editActive },
      "btn-undo":    { disabled: true },
    };
    Object.entries(ids).forEach(([id, opts]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.disabled = opts.disabled;
      if (opts.removeClass) el.classList.remove(opts.removeClass);
    });
    // Mobile sync
    const mobMap = { "mob-btn-save": "btn-save", "mob-btn-discard": "btn-discard", "mob-btn-undo": "btn-undo" };
    Object.entries(mobMap).forEach(([mobId, deskId]) => {
      const mob = document.getElementById(mobId);
      if (mob) mob.disabled = document.getElementById(deskId)?.disabled ?? true;
    });
    const me = document.getElementById("mob-btn-edit");
    if (me) {
      if (editActive) { me.classList.add("active");    me.textContent = "~ Bearbeiten aktiv"; }
      else            { me.classList.remove("active"); me.textContent = "~ Bearbeiten"; }
    }
  }

})();