/**
 * Shared "Uptime Kuma connection" section of the property inspectors.
 *
 * The plugin owns the connection: this page only sends the login data once
 * ({ event: "login" }) and shows the status the plugin reports back
 * ({ event: "status" }). Username and password are never stored.
 */
(function () {
  const client = SDPIComponents.streamDeckClient;
  const $ = (id) => document.getElementById(id);

  const STATE_TEXT = {
    connected: "Connected",
    connecting: "Connecting…",
    error: "Connection problem",
    unconfigured: "Not logged in",
  };

  function send(payload) {
    client.send("sendToPlugin", payload);
  }

  function showMessage(text, kind) {
    const box = $("kuma-message");
    box.textContent = text || "";
    box.className = `message ${kind || ""}`;
    box.hidden = !text;
  }

  function renderStatus(status) {
    const badge = $("kuma-status");
    badge.className = `status ${status.state}`;
    $("kuma-status-text").textContent = STATE_TEXT[status.state] || status.state;
    $("kuma-status-detail").textContent = status.error
      ? status.error
      : status.state === "connected"
        ? `${status.url} · ${status.monitorCount} monitors`
        : status.url;

    $("kuma-login").hidden = status.loggedIn;
    $("kuma-logout").hidden = !status.loggedIn;
    for (const el of document.querySelectorAll(".requires-login")) {
      el.hidden = !status.loggedIn;
    }
    if (!status.loggedIn && status.url && !$("kuma-url").value) {
      $("kuma-url").value = status.url;
    }
  }

  client.sendToPropertyInspector.subscribe((message) => {
    const payload = message.payload || {};
    if (payload.event === "status") {
      renderStatus(payload);
    } else if (payload.event === "login") {
      $("kuma-connect").disabled = false;
      if (payload.ok) {
        showMessage("Logged in", "success");
        $("kuma-password").value = "";
        $("kuma-2fa").value = "";
        $("kuma-2fa-item").hidden = true;
      } else {
        if (payload.needs2fa) {
          $("kuma-2fa-item").hidden = false;
        }
        showMessage(payload.error, "error");
      }
    }
  });

  const TEMPLATE = `
    <sdpi-item label="Uptime Kuma">
      <div id="kuma-status" class="status unconfigured">
        <div><strong id="kuma-status-text">…</strong><span id="kuma-status-detail"></span></div>
      </div>
    </sdpi-item>
    <div id="kuma-message" class="message" hidden></div>
    <div id="kuma-login" hidden>
      <sdpi-item label="URL"><sdpi-textfield id="kuma-url" placeholder="https://uptime.example.com"></sdpi-textfield></sdpi-item>
      <sdpi-item label="Username"><sdpi-textfield id="kuma-username"></sdpi-textfield></sdpi-item>
      <sdpi-item label="Password"><sdpi-password id="kuma-password"></sdpi-password></sdpi-item>
      <sdpi-item label="2FA code" id="kuma-2fa-item" hidden><sdpi-textfield id="kuma-2fa" placeholder="From your authenticator app"></sdpi-textfield></sdpi-item>
      <sdpi-item><sdpi-button id="kuma-connect">Log in</sdpi-button></sdpi-item>
      <p class="hint">The password is only used once to get a login token and is not stored.</p>
    </div>
    <div id="kuma-logout" hidden>
      <sdpi-item><sdpi-button id="kuma-logout-button">Log out</sdpi-button></sdpi-item>
    </div>`;

  window.addEventListener("DOMContentLoaded", () => {
    $("kuma-connection").innerHTML = TEMPLATE;

    $("kuma-connect").addEventListener("click", () => {
      const url = ($("kuma-url").value || "").trim();
      const username = ($("kuma-username").value || "").trim();
      const password = $("kuma-password").value || "";
      if (!url || !username || !password) {
        showMessage("Please enter URL, username and password", "error");
        return;
      }
      showMessage("Logging in…", "");
      $("kuma-connect").disabled = true;
      send({ event: "login", url, username, password, token2fa: ($("kuma-2fa").value || "").trim() });
    });

    $("kuma-logout-button").addEventListener("click", () => {
      showMessage("", "");
      send({ event: "logout" });
    });

    send({ event: "getStatus" });
  });
})();
