/**
 * admin-loader.js – Öffentlicher Entry Point
 *
 * Diese Datei ist die EINZIGE Admin-Datei die öffentlich ausgeliefert wird.
 * Login-Button, Login-Modal, dynamisches Laden der
 * geschützten Admin-Skripte nach erfolgreichem Login.
 */
(function () {
  "use strict";

  const SVG_LOGIN  = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z"/></svg>`;
  const SVG_LOGOUT = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0z"/><path fill-rule="evenodd" d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708z"/></svg>`;

  // ─── Auth-Button erstellen ────────────────────────────────────────────────────
  function createAuthBtn() {
    if (document.getElementById("admin-auth-btn")) return;
    const btn     = document.createElement("button");
    btn.id        = "admin-auth-btn";
    btn.title     = "Admin Login";
    btn.innerHTML = SVG_LOGIN;
    document.body.appendChild(btn);
    btn.addEventListener("click", () => {
      if (window.AdminState?.isAuthenticated) {
        window.logout?.();
      } else {
        showModal();
      }
    });
  }

  // ─── Login-Modal ──────────────────────────────────────────────────────────────
  function showModal() {
    if (document.getElementById("admin-login-modal")) {
      // Bereits von admin-ui.js erstellt → window.showLoginModal nutzen
      window.showLoginModal?.();
      return;
    }
    const modal = document.createElement("div");
    modal.id    = "admin-login-modal";
    modal.innerHTML = `
      <div class="admin-modal-box">
        <h2>~ Admin ~</h2>
        <input type="password" id="admin-pw-input" placeholder="Passwort" autocomplete="current-password">
        <button class="admin-modal-submit" id="admin-login-submit">~ Einloggen ~</button>
        <div class="admin-modal-error" id="admin-login-error"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.classList.add("show");
    document.body.style.overflow = "hidden";
    setTimeout(() => document.getElementById("admin-pw-input")?.focus(), 50);

    const closeModal = () => {
      modal.classList.remove("show");
      document.body.style.overflow = "";
      document.getElementById("admin-login-error").style.display = "none";
      document.getElementById("admin-pw-input").value = "";
    };
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    document.getElementById("admin-login-submit").addEventListener("click", () => doLogin(closeModal));
    document.getElementById("admin-pw-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter")  doLogin(closeModal);
      if (e.key === "Escape") closeModal();
    });
  }

  // ─── Login-Request ────────────────────────────────────────────────────────────
  async function doLogin(onSuccess) {
    const pw    = document.getElementById("admin-pw-input")?.value || "";
    const err   = document.getElementById("admin-login-error");
    const btn   = document.getElementById("admin-login-submit");
    if (!pw || !err || !btn) return;
    btn.textContent = "…";
    btn.disabled    = true;
    err.style.display = "none";
    try {
      const res = await fetch("/api/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        onSuccess?.();
        await loadAdminScripts();
      } else {
        const data = await res.json().catch(() => ({}));
        err.textContent   = data.error || "Falsches Passwort";
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

  // ─── Admin-Skripte dynamisch laden  ──────────────────────────
  let _scriptsLoaded = false;
  async function loadAdminScripts() {
    if (_scriptsLoaded) return;
    _scriptsLoaded = true;

    const files = [
      "/js/admin-state.js",
      "/js/admin-ui.js",
      "/js/admin-blocks.js",
      "/js/admin-edit.js",
    ];
    for (const src of files) {
      await new Promise((resolve, reject) => {
        const s   = document.createElement("script");
        s.src     = src;
        s.onload  = resolve;
        s.onerror = () => {
          // 401 → Session abgelaufen
          _scriptsLoaded = false;
          reject(new Error("Laden fehlgeschlagen: " + src));
        };
        document.body.appendChild(s);
      });
    }
  }

  // ─── Logout-Icon setzen (wird von admin-ui.js nach Login aufgerufen) ──────────

  window.__loaderSetLogoutIcon = function () {
    const btn = document.getElementById("admin-auth-btn");
    if (btn) { btn.innerHTML = SVG_LOGOUT; btn.title = "Abmelden"; }
  };
  window.__loaderSetLoginIcon = function () {
    const btn = document.getElementById("admin-auth-btn");
    if (btn) { btn.innerHTML = SVG_LOGIN; btn.title = "Admin Login"; }
  };

  // ─── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    createAuthBtn();

    // Cookie vorhanden:
    fetch("/api/check-auth")
      .then((r) => { if (r.ok) loadAdminScripts(); })
      .catch(() => {/* netzwerkfehler – kein admin */});
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else
    init();

})();