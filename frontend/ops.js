const grid = document.querySelector("#server-grid");
const template = document.querySelector("#server-card-template");
const refreshButton = document.querySelector("#refresh-button");
const lastUpdated = document.querySelector("#last-updated");

const cardById = new Map();
let busyId = "";

function serverUrl(server) {
  return `${window.location.protocol}//${window.location.hostname}:${server.port}/`;
}

function stateText(server) {
  return server.running ? "on" : "off";
}

function pidText(server) {
  return server.pid ? String(server.pid) : "-";
}

function setBusy(isBusy) {
  refreshButton.disabled = isBusy;
  document.querySelectorAll(".server-actions button").forEach((button) => {
    button.disabled = isBusy;
  });
}

function renderServer(server) {
  let card = cardById.get(server.id);
  if (!card) {
    card = template.content.firstElementChild.cloneNode(true);
    card.dataset.serverId = server.id;
    card.querySelector("h2").textContent = server.label;
    card.querySelector(".server-meta").textContent = `:${server.port} | ${server.mode}`;
    card.querySelector(".start-button").addEventListener("click", () => runAction(server.id, "start"));
    card.querySelector(".stop-button").addEventListener("click", () => runAction(server.id, "stop"));
    card.querySelector(".launch-button").addEventListener("click", () => {
      window.open(serverUrl(server), "_blank", "noopener,noreferrer");
    });
    cardById.set(server.id, card);
    grid.appendChild(card);
  }

  card.classList.toggle("is-on", server.running);
  card.querySelector(".status-dot").setAttribute("title", stateText(server));
  card.querySelector(".server-state").textContent = stateText(server);
  card.querySelector(".server-pid").textContent = pidText(server);

  const startButton = card.querySelector(".start-button");
  const stopButton = card.querySelector(".stop-button");
  const launchButton = card.querySelector(".launch-button");
  startButton.disabled = Boolean(busyId) || server.running;
  stopButton.disabled = Boolean(busyId) || !server.running;
  launchButton.disabled = Boolean(busyId) || !server.running;
}

async function fetchStatus() {
  const response = await fetch("/api/server-control/status", { cache: "no-store" });
  if (!response.ok) throw new Error(`Status failed: ${response.status}`);
  return response.json();
}

async function refreshStatus() {
  try {
    const data = await fetchStatus();
    data.servers.forEach(renderServer);
    const managerHint = Number(window.location.port) === data.managerPort ? "" : ` | manager :${data.managerPort || 3010}`;
    lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString()}${managerHint}`;
  } catch (error) {
    lastUpdated.textContent = error.message;
  }
}

async function runAction(id, action) {
  busyId = id;
  setBusy(true);
  try {
    const response = await fetch(`/api/server-control/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `${action} failed: ${response.status}`);
    }
    const payload = await response.json().catch(() => ({}));
    if (payload.server) renderServer(payload.server);
    lastUpdated.textContent = `${action} sent at ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    lastUpdated.textContent = error.message;
  } finally {
    busyId = "";
    setBusy(false);
    await refreshStatus();
  }
}

refreshButton.addEventListener("click", refreshStatus);
refreshStatus();
setInterval(refreshStatus, 5000);
