const baseUrl = "http://127.0.0.1:8000";

const statusEl = document.querySelector("#status");
const sessionEl = document.querySelector("#session");
const pairingCodeEl = document.querySelector("#pairing-code");
const pairEl = document.querySelector("#pair");
const refreshEl = document.querySelector("#refresh");
const terminalEl = document.querySelector("#terminal");
const workspaceEl = document.querySelector("#workspace");
const messageEl = document.querySelector("#message");
const outputEl = document.querySelector("#output");
const sendEl = document.querySelector("#send");

async function loadSession() {
  const stored = await chrome.storage.local.get(["jarvisSessionId", "jarvisDeviceName"]);
  return {
    id: stored.jarvisSessionId || "",
    deviceName: stored.jarvisDeviceName || "Browser Companion",
  };
}

async function saveSession(session) {
  await chrome.storage.local.set({
    jarvisSessionId: session.id,
    jarvisDeviceName: session.device_name || "Browser Companion",
  });
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return body;
}

async function checkStatus() {
  try {
    const platform = await requestJson("/api/platform");
    const session = await loadSession();
    statusEl.textContent = `${platform.agents?.length || 0} agents`;
    sessionEl.textContent = session.id ? `${session.deviceName} · ${session.id}` : "No session";
    if (session.id) {
      await requestJson("/api/companion/session", {
        method: "POST",
        body: JSON.stringify({ action: "heartbeat", session_id: session.id }),
      });
    }
  } catch (error) {
    statusEl.textContent = "Offline";
    sessionEl.textContent = String(error.message || error);
  }
}

async function pairDevice() {
  outputEl.textContent = "Pairing...";
  try {
    const code = pairingCodeEl.value.trim();
    const body = await requestJson("/api/companion/session", {
      method: "POST",
      body: JSON.stringify({ action: "activate", code, device_name: "Browser Companion" }),
    });
    await saveSession(body.result?.session || body.session);
    outputEl.textContent = "Paired.";
    await checkStatus();
    await refreshWorkspace();
  } catch (error) {
    outputEl.textContent = String(error.message || error);
  }
}

async function refreshWorkspace() {
  const session = await loadSession();
  if (!session.id) {
    workspaceEl.textContent = "Pair this browser first.";
    return;
  }
  try {
    const body = await requestJson(`/api/companion/mobile-workspace?session_id=${encodeURIComponent(session.id)}`);
    const workspace = body.result || body;
    workspaceEl.textContent = JSON.stringify({
      files: (workspace.files || []).slice(0, 5).map((item) => item.path || item.name),
      agents: (workspace.agents || []).map((agent) => agent.name),
      terminal: workspace.terminal,
    }, null, 2);
  } catch (error) {
    workspaceEl.textContent = String(error.message || error);
  }
}

async function runTerminal() {
  const session = await loadSession();
  outputEl.textContent = "Running...";
  try {
    const body = await requestJson("/api/companion/terminal", {
      method: "POST",
      body: JSON.stringify({ command: "git status", session_id: session.id }),
    });
    const result = body.result || body;
    outputEl.textContent = result.stdout || result.stderr || result.status;
  } catch (error) {
    outputEl.textContent = String(error.message || error);
  }
}

async function sendToAgent() {
  outputEl.textContent = "Sending...";
  const session = await loadSession();
  const message = messageEl.value.trim();
  if (!message) {
    outputEl.textContent = "Enter a message first.";
    return;
  }
  try {
    const response = await fetch(`${baseUrl}/api/agents/research-copilot/invoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, session_id: session.id }),
    });
    const body = await response.json();
    outputEl.textContent = body.output || body.error || JSON.stringify(body, null, 2);
  } catch (error) {
    outputEl.textContent = String(error.message || error);
  }
}

pairEl.addEventListener("click", pairDevice);
refreshEl.addEventListener("click", refreshWorkspace);
terminalEl.addEventListener("click", runTerminal);
sendEl.addEventListener("click", sendToAgent);

checkStatus();
