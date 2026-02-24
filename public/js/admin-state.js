/**
 * admin-state.js – Gemeinsamer Zustand & Hilfsfunktionen
 *
 * Wird als erstes geladen. Alle anderen Module lesen/schreiben
 * nur über die hier exportierten Objekte.
 *
 * Einbinden (vor allen anderen admin-*.js):
 *   <script src="/js/admin-state.js"></script>
 */
(function () {
  "use strict";

  // ─── Konfiguration ────────────────────────────────────────────────────────────
  window.AdminConfig = {
    loginEndpoint:    "/api/login",
    logoutEndpoint:   "/api/logout",
    checkAuthEndpoint:"/api/check-auth",
    saveEndpoint:     "/api/save-html",
    uploadEndpoint:   "/api/upload-image",
    imagesEndpoint:   "/api/images",
  };

  // Aktuell bearbeitete Datei aus der URL ableiten
  window.adminCurrentFile =
    window.location.pathname === "/"
      ? "index.html"
      : (window.location.pathname.replace(/^\//, "") || "index.html") +
        (window.location.pathname.endsWith(".html") ? "" : ".html");

  // ─── Gemeinsamer State ────────────────────────────────────────────────────────
  window.AdminState = {
    isEditMode:       false,
    isAuthenticated:  false,
    allImages:        [],
    currentImgTarget: null,
    hasUnsavedChanges:false,
    undoStack:        [],
    insertImgMode:    false,
    savedRange:       null,
  };

  window.UNDO_MAX = 50;

  // ─── Scroll-Lock ─────────────────────────────────────────────────────────────
  let _scrollLockCount = 0;
  let _savedScrollY    = 0;

  window.lockScroll = function () {
    if (_scrollLockCount === 0) {
      _savedScrollY = window.scrollY;
      document.body.style.position  = "fixed";
      document.body.style.top       = `-${_savedScrollY}px`;
      document.body.style.left      = "0";
      document.body.style.right     = "0";
      document.body.style.overflowY = "scroll";
    }
    _scrollLockCount++;
  };

  window.unlockScroll = function () {
    _scrollLockCount = Math.max(0, _scrollLockCount - 1);
    if (_scrollLockCount === 0) {
      document.body.style.position  = "";
      document.body.style.top       = "";
      document.body.style.left      = "";
      document.body.style.right     = "";
      document.body.style.overflowY = "";
      window.scrollTo(0, _savedScrollY);
    }
  };

  // ─── XSS-Schutz: HTML-Zeichen escapen ────────────────────────────────────────
  // IMMER verwenden, bevor API-Daten in innerHTML / Attributen landen!
  window.escHtml = function (str) {
    if (typeof str !== "string") return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  // ─── Hilfsfunktion: Content-Box ermitteln ────────────────────────────────────
  window.getContentBox = function () {
    return (
      document.getElementById("wrapper-content-box") ||
      document.getElementById("wrapper-box")
    );
  };

})();
