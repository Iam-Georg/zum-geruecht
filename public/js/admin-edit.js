/**
 * admin-edit.js – Entry Point
 *
 * Einbinden am Ende von <body> (nach CSS-Link!):
 *
 *   <link  rel="stylesheet" href="/css/admin-edit.css">
 *   <script src="/js/admin-state.js"></script>
 *   <script src="/js/admin-ui.js"></script>
 *   <script src="/js/admin-blocks.js"></script>
 *   <script src="/js/admin-edit.js"></script>
 *
 * Oder als Bundle, falls du einen Build-Step einsetzt:
 *   admin-state.js → admin-ui.js → admin-blocks.js → admin-edit.js
 */
(function () {
  "use strict";

  // ─── Init ─────────────────────────────────────────────────────────────────────
  async function init() {
    // UI-Elemente ins DOM einfügen
    window.injectAdminFooterLink();
    window.injectAdminBar();
    window.injectLoginModal();
    window.injectGalleryOverlay();
    window.injectTextToolbar();
    window.injectNotify();

    // ESC schließt alle Overlays
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (document.getElementById("admin-gallery-overlay")?.classList.contains("show"))
        window.closeGallery();
      else if (document.getElementById("admin-login-modal")?.classList.contains("show"))
        window.hideLoginModal();
    });

    // Auth prüfen
    try {
      const res = await fetch(window.AdminConfig.checkAuthEndpoint);
      if (res.ok) {
        window.AdminState.isAuthenticated = true;
        window.showAdminBar();
      } else {
        window.showAdminFooterLink();
      }
    } catch {
      window.showAdminFooterLink();
    }

    // Ungespeicherte Änderungen vor dem Verlassen warnen
    window.addEventListener("beforeunload", (e) => {
      if (window.AdminState.hasUnsavedChanges && window.AdminState.isEditMode) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  }

  // ─── Session-Timeout Warnung (10 Minuten vor Ablauf) ─────────────────────────
  // Token läuft nach 8 h ab → Warnung nach 7 h 50 min
  setTimeout(
    () => {
      if (window.AdminState.isAuthenticated) {
        window.showNotify("~ Session läuft in 10 Minuten ab – bitte speichern & neu einloggen ~", "error");
      }
    },
    (8 * 60 - 10) * 60 * 1000,
  );

  // ─── Start ────────────────────────────────────────────────────────────────────
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else
    init();

})();
