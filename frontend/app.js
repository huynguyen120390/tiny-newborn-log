const state = {
  logs: [],
  recent: {},
  summary: {},
  profile: {},
  activeTab: "log",
  ticker: null,
  currentDate: todayString(),
  bathSoundEnabled: false,
  lastBathAnnouncementMinute: 0
};

const activities = [
  {
    title: "Sleep",
    key: "sleep",
    icon: "moon",
    helper: "Track asleep and awake moments.",
    actions: [
      { label: "Asleep", icon: "asleep", payload: { type: "sleep", status: "asleep" } },
      { label: "Awake", icon: "awake", payload: { type: "sleep", status: "awake" } }
    ]
  },
  {
    title: "Boobie",
    key: "boobie",
    icon: "heart",
    helper: "Start side reminder updates after each feed.",
    actions: [
      { label: "Left", icon: "left", payload: { type: "feeding", method: "breast", side: "left" }, reminder: "Try right side next time." },
      { label: "Right", icon: "right", payload: { type: "feeding", method: "breast", side: "right" }, reminder: "Try left side next time." }
    ]
  },
  {
    title: "Bottle",
    key: "bottle",
    icon: "bottle",
    helper: "Slider starts from the last bottle amount.",
    actions: [
      { label: "Bottle amount", icon: "bottle", dialog: "bottle" }
    ]
  },
  {
    title: "Wee & Poo",
    key: "diaper",
    icon: "spark",
    helper: "Tiny toilet logs.",
    actions: [
      { label: "Wee", icon: "pee", payload: { type: "diaper", kind: "pee" } },
      { label: "Poo", icon: "poop", payload: { type: "diaper", kind: "poop" } }
    ]
  },
  {
    title: "Bath",
    key: "bath",
    icon: "spark",
    helper: "Start and stop splash time.",
    actions: [
      { label: "Start", icon: "bath", payload: { type: "bath", status: "start" } },
      { label: "Stop", icon: "bath", payload: { type: "bath", status: "end" } },
      { label: "Sound", icon: "success", soundToggle: true }
    ]
  },
  {
    title: "Tummy Time",
    key: "tummy",
    icon: "sun",
    helper: "Start and end practice sessions.",
    actions: [
      { label: "Start", icon: "tummy-start", payload: { type: "tummy_time", status: "start" } },
      { label: "End", icon: "tummy-end", payload: { type: "tummy_time", status: "end" } }
    ]
  },
  {
    title: "Baby Gym",
    key: "gym",
    icon: "star",
    helper: "Log a little play and tracking time.",
    actions: [
      { label: "Log gym time", icon: "gym", payload: { type: "baby_gym" } }
    ]
  }
];

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => activateTab(button.dataset.tab));
});

document.querySelector("[data-close-dialog]").addEventListener("click", () => {
  document.getElementById("bottle-dialog").close();
});

document.getElementById("bottle-slider").addEventListener("input", (event) => {
  document.getElementById("bottle-value").textContent = Number(event.target.value).toFixed(2).replace(/0$/, "");
});

document.getElementById("bottle-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const ounces = Number(document.getElementById("bottle-slider").value);
  document.getElementById("bottle-dialog").close();
  await createLog({ type: "bottle", ounces });
});

init();

async function init() {
  renderActivities();
  setupExportPanel("export-panel");
  await refreshData();
}

async function refreshData() {
  const [appData, recent, summary] = await Promise.all([
    fetchJson("/api/app-data"),
    fetchJson("/api/recent"),
    fetchJson("/api/today-summary")
  ]);

  state.profile = appData.baby_profile || {};
  state.logs = appData.baby_log || [];
  state.recent = recent;
  state.summary = summary;

  renderAll();
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function activateTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll(".tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  document.querySelectorAll(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === tab));
}

function renderAll() {
  const name = state.profile.name || "Phương Nam Cu Tí";
  const birthday = state.profile.birthday || "";
  document.getElementById("baby-summary").textContent = `${name}${birthday ? `, born ${birthday}` : ""}. Ready for home-network logging.`;
  renderTodaySummary();
  renderRecent();
  renderHistory();
  renderActivityStats();
  updateActivityButtons();
  updateBottleDefaults();
  startTicker();
}

function renderActivities() {
  document.getElementById("activity-grid").innerHTML = activities.map((activity) => `
    <article class="activity-card" style="--card-image: url('/assets/activity/header-${activity.key}.png')">
      <div class="card-top card-header">
        <div>
          <h3>${activity.title}</h3>
          <p>${activity.helper}</p>
        </div>
      </div>
      <div class="card-info" data-card-info="${activity.key}"></div>
      <div class="button-row">
        ${activity.actions.map((action) => `
          <button class="action-button" data-card="${activity.key}" data-action-label="${action.label}" data-action='${JSON.stringify(action)}'>
            <img src="/assets/activity/icon-${action.icon}.png" alt="" loading="lazy">
            <span>${action.label}</span>
          </button>
        `).join("")}
      </div>
    </article>
  `).join("");

  document.querySelectorAll(".action-button").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = JSON.parse(button.dataset.action);
      if (action.soundToggle) {
        toggleBathSound();
        return;
      }
      if (action.dialog === "bottle") {
        openBottleDialog();
        return;
      }
      await createLog(action.payload, action.reminder);
    });
  });
}

async function createLog(payload, reminder) {
  try {
    const conflict = transitionConflict(payload);
    if (conflict) {
      showToast(conflict);
      return;
    }

    const result = await fetchJson("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    state.logs.push(result.log);
    state.recent = result.recent;
    state.summary = result.todaySummary;
    renderAll();
    showReaction("Yay, logged!", reminder || labelForLog(result.log));
  } catch (error) {
    showToast(`Could not log activity: ${error.message}`);
  }
}

function openBottleDialog() {
  updateBottleDefaults();
  document.getElementById("bottle-dialog").showModal();
}

function updateBottleDefaults() {
  const slider = document.getElementById("bottle-slider");
  const amount = Math.min(8, Math.max(0, Number(state.recent.bottleOunces || 3)));
  slider.value = amount;
  document.getElementById("bottle-value").textContent = amount.toFixed(2).replace(/0$/, "");
}

function startTicker() {
  if (state.ticker) return;
  state.ticker = setInterval(async () => {
    if (state.currentDate !== todayString()) {
      state.currentDate = todayString();
      await refreshData();
      return;
    }
    renderActivityStats();
    updateActivityButtons();
    announceBathProgress();
  }, 1000);
}

function renderActivityStats() {
  const stats = getActivityStats();
  Object.entries(stats).forEach(([key, stat]) => {
    const element = document.querySelector(`[data-card-info="${key}"]`);
    if (!element) return;
    element.innerHTML = `
      ${stat.html || `
        <span>${stat.label}</span>
        <strong>${stat.value}</strong>
        <small>${stat.helper}</small>
      `}
    `;
  });
}

function updateActivityButtons() {
  const sleep = getCurrentState("sleep");
  const tummy = getCurrentState("tummy_time");
  const bath = getCurrentState("bath");

  document.querySelectorAll(".action-button").forEach((button) => {
    const card = button.dataset.card;
    const label = button.dataset.actionLabel;
    const shouldDisable =
      (card === "sleep" && ((sleep.status === "asleep" && label === "Asleep") || (sleep.status === "awake" && label === "Awake"))) ||
      (card === "tummy" && ((tummy.status === "start" && label === "Start") || (tummy.status === "end" && label === "End"))) ||
      (card === "bath" && ((bath.status === "start" && label === "Start") || (bath.status === "end" && label === "Stop")));

    button.disabled = shouldDisable;
    button.setAttribute("aria-disabled", shouldDisable ? "true" : "false");
    button.classList.toggle("sound-on", card === "bath" && label === "Sound" && state.bathSoundEnabled);
  });
}

function getActivityStats() {
  const sleep = getCurrentState("sleep");
  const tummy = getCurrentState("tummy_time");
  const bath = getCurrentState("bath");
  const todaySummary = summarizeLogsToday();
  const sleepLabel = sleep.status === "asleep" ? "Asleep" : "Awake";
  const tummyLabel = tummy.status === "start" ? "Started" : "Ended";
  const bathLabel = bath.status === "start" ? "Bathing" : "Stopped";

  return {
    sleep: {
      label: `${sleepLabel} ${formatDuration(elapsedTodaySince(sleep.log))}${formatSince(sleep.log)}`,
      value: formatTotalDuration(totalToday("sleep", "asleep", "awake")),
      helper: "Total sleep today"
    },
    boobie: {
      label: "Breast feeds",
      value: todaySummary.breastFeeds,
      helper: `Next side: ${state.recent.nextBreastSide || "left"}`
    },
    bottle: {
      label: "Bottle total",
      value: `${todaySummary.bottleOunces} oz`,
      helper: `Last time ${formatSinceTime(lastLogOfType("bottle"))}`
    },
    diaper: {
      html: `
        <div class="hygiene-list">
          <span><img src="/assets/activity/icon-pee.png" alt="">${todaySummary.wetDiapers} wee</span>
          <span><img src="/assets/activity/icon-poop.png" alt="">${todaySummary.poops} poo</span>
        </div>
      `
    },
    bath: {
      label: `${bathLabel} ${formatDuration(elapsedTodaySince(bath.log))}${formatSince(bath.log)}`,
      value: formatTotalDuration(totalToday("bath", "start", "end")),
      helper: `Sound ${state.bathSoundEnabled ? "on" : "off"}`
    },
    tummy: {
      label: `${tummyLabel} ${formatDuration(elapsedTodaySince(tummy.log))}${formatSince(tummy.log)}`,
      value: formatTotalDuration(totalToday("tummy_time", "start", "end")),
      helper: "Total tummy time today"
    },
    gym: {
      label: "Baby gym",
      value: todaySummary.babyGymEvents,
      helper: "Play sessions today"
    }
  };
}

function summarizeLogsToday() {
  const logs = todayLogs();
  const count = (predicate) => logs.filter(predicate).length;
  const sum = (predicate, field) => logs.filter(predicate).reduce((total, log) => total + Number(log[field] || 0), 0);

  return {
    breastFeeds: count((log) => log.type === "feeding" && log.method === "breast"),
    bottleOunces: +sum((log) => log.type === "bottle", "ounces").toFixed(1),
    wetDiapers: count((log) => log.type === "diaper" && log.pee),
    poops: count((log) => log.type === "diaper" && log.poop),
    baths: count((log) => log.type === "bath" && (log.status === "start" || !log.status)),
    babyGymEvents: count((log) => log.type === "baby_gym")
  };
}

function getCurrentState(type) {
  const events = state.logs
    .filter((log) => log.type === type && log.status)
    .sort((a, b) => logTime(b) - logTime(a));
  const log = events[0] || null;
  const fallback = type === "sleep" ? "awake" : "end";
  return { status: log?.status || fallback, log };
}

function pairedConfig(type) {
  const configs = {
    sleep: { start: "asleep", end: "awake", startLabel: "asleep", endLabel: "awake" },
    tummy_time: { start: "start", end: "end", startLabel: "started", endLabel: "ended" },
    bath: { start: "start", end: "end", startLabel: "started", endLabel: "stopped" }
  };
  return configs[type] || null;
}

function transitionConflict(input, excludeId) {
  const config = pairedConfig(input.type);
  if (!config || !input.status) return "";

  const eventTime = input.date && input.time
    ? logTime({ date: input.date, time: input.time })
    : Date.now();
  const activeBefore = isActiveAt(input.type, eventTime, excludeId);
  const isStart = input.status === config.start;
  const isEnd = input.status === config.end;

  if (isStart && activeBefore) return `Already ${config.startLabel}. Stop first to avoid overlapping time.`;
  if (isEnd && !activeBefore) return `Already ${config.endLabel}. Start first before stopping.`;

  const next = nextTimedStatus(input.type, eventTime, excludeId);
  if (next && isStart && next.status === config.start) return `This would overlap with another ${config.startLabel} time.`;
  if (next && isEnd && next.status === config.end) return `This would create two stop events in a row.`;
  return "";
}

function isActiveAt(type, atTime, excludeId) {
  const config = pairedConfig(type);
  let active = false;
  state.logs
    .filter((log) => log.id !== excludeId && log.type === type && log.status && logTime(log) < atTime)
    .sort((a, b) => logTime(a) - logTime(b))
    .forEach((log) => {
      if (log.status === config.start) active = true;
      if (log.status === config.end) active = false;
    });
  return active;
}

function nextTimedStatus(type, atTime, excludeId) {
  return state.logs
    .filter((log) => log.id !== excludeId && log.type === type && log.status && logTime(log) > atTime)
    .sort((a, b) => logTime(a) - logTime(b))[0] || null;
}

function lastLogOfType(type) {
  return state.logs
    .filter((log) => log.type === type)
    .sort((a, b) => logTime(b) - logTime(a))[0] || null;
}

function toggleBathSound() {
  state.bathSoundEnabled = !state.bathSoundEnabled;
  state.lastBathAnnouncementMinute = 0;
  updateActivityButtons();
  renderActivityStats();
  showReaction(state.bathSoundEnabled ? "Bath sound on" : "Bath sound off", "Two-minute voice updates");
}

function announceBathProgress() {
  if (!state.bathSoundEnabled || !("speechSynthesis" in window)) return;

  const bath = getCurrentState("bath");
  if (bath.status !== "start" || !bath.log) {
    state.lastBathAnnouncementMinute = 0;
    return;
  }

  const minutes = Math.floor(elapsedSince(bath.log) / 60000);
  if (minutes < 2 || minutes % 2 !== 0 || minutes === state.lastBathAnnouncementMinute) return;

  state.lastBathAnnouncementMinute = minutes;
  const utterance = new SpeechSynthesisUtterance(`${numberWords(minutes)} minutes`);
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((item) => /female|girl|zira|samantha|jenny|aria/i.test(`${item.name} ${item.voiceURI}`));
  if (voice) utterance.voice = voice;
  utterance.pitch = 1.18;
  utterance.rate = 0.92;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function numberWords(value) {
  const words = {
    0: "zero", 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine",
    10: "ten", 11: "eleven", 12: "twelve", 13: "thirteen", 14: "fourteen", 15: "fifteen", 16: "sixteen",
    17: "seventeen", 18: "eighteen", 19: "nineteen", 20: "twenty", 30: "thirty", 40: "forty", 50: "fifty"
  };
  if (words[value]) return words[value];
  if (value < 60) return `${words[Math.floor(value / 10) * 10]} ${words[value % 10]}`;
  return String(value);
}

function totalToday(type, startStatus, endStatus) {
  const { start: dayStart, end: dayEnd } = todayBounds();
  const now = Date.now();
  const clipEnd = Math.min(dayEnd, now);
  let totalMs = 0;
  let activeStart = null;

  state.logs
    .filter((log) => log.type === type)
    .sort((a, b) => logTime(a) - logTime(b))
    .forEach((log) => {
      if (log.date === todayString() && Number(log.minutes)) totalMs += Number(log.minutes) * 60 * 1000;
      if (log.status === startStatus && !activeStart) activeStart = logTime(log);
      if (log.status === endStatus && activeStart) {
        totalMs += clippedDuration(activeStart, logTime(log), dayStart, clipEnd);
        activeStart = null;
      }
    });

  if (activeStart) totalMs += clippedDuration(activeStart, clipEnd, dayStart, clipEnd);
  return totalMs;
}

function elapsedSince(log) {
  if (!log) return 0;
  return Math.max(0, Date.now() - logTime(log));
}

function elapsedTodaySince(log) {
  if (!log) return 0;
  const { start: dayStart } = todayBounds();
  return Math.max(0, Date.now() - Math.max(logTime(log), dayStart));
}

function todayBounds() {
  const startDate = new Date(`${todayString()}T00:00:00`);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);
  return { start: startDate.getTime(), end: endDate.getTime() };
}

function clippedDuration(start, end, clipStart, clipEnd) {
  return Math.max(0, Math.min(end, clipEnd) - Math.max(start, clipStart));
}

function todayLogs() {
  const today = todayString();
  return state.logs.filter((log) => log.date === today);
}

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function logTime(log) {
  const [hour = "00", minute = "00"] = String(log.time || "00:00").split(":");
  const local = new Date(`${log.date || todayString()}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00`);
  if (Number.isFinite(local.getTime())) return local.getTime();

  if (log.createdAt) {
    const created = new Date(log.createdAt).getTime();
    if (Number.isFinite(created)) return created;
  }

  return 0;
}

function formatDuration(value) {
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function formatTotalDuration(value) {
  const totalMinutes = Math.max(0, Math.floor(value / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")} hrs ${String(minutes).padStart(2, "0")}min`;
}

function formatSince(log) {
  if (!log) return "";
  const date = new Date(logTime(log));
  if (Number.isNaN(date.getTime())) return "";

  const dayLabel = date.toDateString() === new Date().toDateString() ? "today" : "yesterday";
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return ` since ${time} ${dayLabel}`;
}

function formatSinceTime(log) {
  if (!log) return "not logged yet";
  const date = new Date(logTime(log));
  if (Number.isNaN(date.getTime())) return "not logged yet";
  const dayLabel = date.toDateString() === new Date().toDateString() ? "today" : "yesterday";
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${time} ${dayLabel}`;
}

function renderTodaySummary() {
  const cards = [
    ["Logs", state.summary.totalLogs || 0, "All activities"],
    ["Breast", state.summary.breastFeeds || 0, "Feeds"],
    ["Bottle", `${state.summary.bottleOunces || 0} oz`, "Today total"],
    ["Wee", state.summary.wetDiapers || 0, "Wee diapers"],
    ["Poo", state.summary.poops || 0, "Poo diapers"],
    ["Sleep", state.summary.sleepEvents || 0, "Sleep events"],
    ["Bath", state.summary.baths || 0, "Baths"],
    ["Tummy", state.summary.tummyTimeEvents || 0, "Start/end taps"]
  ];

  document.getElementById("today-metrics").innerHTML = cards.map(([label, value, helper]) => `
    <article class="metric">
      <p>${label}</p>
      <strong>${value}</strong>
      <p>${helper}</p>
    </article>
  `).join("");
}

function renderRecent() {
  const rows = [
    ["Next breast side", state.recent.nextBreastSide || "left"],
    ["Last bottle", formatSinceTime(lastLogOfType("bottle"))],
    ["Last feed", formatWhen(state.recent.lastFeedAt)],
    ["Last sleep", formatWhen(state.recent.lastSleepAt)],
    ["Last diaper", formatWhen(state.recent.lastDiaperAt)],
    ["Last activity", formatWhen(state.recent.lastActivityAt)]
  ];

  document.getElementById("recent-list").innerHTML = rows.map(([label, value]) => `
    <div class="recent-row">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");
}

function renderHistory() {
  document.getElementById("history-list").innerHTML = state.logs.slice().reverse().slice(0, 80).map((log) => `
    <form class="list-item history-editor" data-log-id="${escapeAttr(log.id)}">
      <label>
        Date
        <input name="date" type="date" value="${escapeAttr(log.date || "")}">
      </label>
      <label>
        Time
        <input name="time" type="time" value="${escapeAttr(log.time || "")}">
      </label>
      ${renderCorrectionField(log)}
      <label class="history-notes">
        Notes
        <input name="notes" type="text" value="${escapeAttr(log.notes || "")}">
      </label>
      <button class="primary history-save" type="submit">Save</button>
      <p class="history-status" aria-live="polite">${escapeHtml(labelForLog(log))}</p>
    </form>
  `).join("");

  document.querySelectorAll(".history-editor").forEach((form) => {
    form.addEventListener("submit", saveHistoryCorrection);
  });
}

function renderCorrectionField(log) {
  if (log.type === "sleep") {
    return `
      <label>
        Status
        <select name="status">
          <option value="asleep"${log.status === "asleep" ? " selected" : ""}>Asleep</option>
          <option value="awake"${log.status === "awake" ? " selected" : ""}>Awake</option>
        </select>
      </label>
    `;
  }

  if (log.type === "tummy_time") {
    return `
      <label>
        Status
        <select name="status">
          <option value="start"${log.status === "start" ? " selected" : ""}>Start</option>
          <option value="end"${log.status === "end" ? " selected" : ""}>End</option>
        </select>
      </label>
    `;
  }

  if (log.type === "bath") {
    return `
      <label>
        Status
        <select name="status">
          <option value="start"${log.status === "start" || !log.status ? " selected" : ""}>Start</option>
          <option value="end"${log.status === "end" ? " selected" : ""}>Stop</option>
        </select>
      </label>
    `;
  }

  if (log.type === "feeding") {
    return `
      <label>
        Side
        <select name="side">
          <option value="left"${log.side === "left" ? " selected" : ""}>Left</option>
          <option value="right"${log.side === "right" ? " selected" : ""}>Right</option>
        </select>
      </label>
    `;
  }

  if (log.type === "bottle") {
    return `
      <label>
        Ounces
        <input name="ounces" type="number" min="0" max="8" step="0.25" value="${escapeAttr(log.ounces || 0)}">
      </label>
    `;
  }

  if (log.type === "diaper") {
    const kind = log.poop ? "poop" : "pee";
    return `
      <label>
        Kind
        <select name="kind">
          <option value="pee"${kind === "pee" ? " selected" : ""}>Wee</option>
          <option value="poop"${kind === "poop" ? " selected" : ""}>Poo</option>
        </select>
      </label>
    `;
  }

  return `
    <label>
      Type
      <input name="typeLabel" type="text" value="${escapeAttr(labelForLog(log))}" disabled>
    </label>
  `;
}

async function saveHistoryCorrection(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector(".history-status");
  const data = Object.fromEntries(new FormData(form).entries());
  const current = state.logs.find((log) => log.id === form.dataset.logId);
  const conflict = current ? transitionConflict({ ...current, ...data }, current.id) : "";
  if (conflict) {
    status.textContent = conflict;
    return;
  }
  status.textContent = "Saving...";

  try {
    const result = await fetchJson(`/api/logs/${encodeURIComponent(form.dataset.logId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const index = state.logs.findIndex((log) => log.id === result.log.id);
    if (index !== -1) state.logs[index] = result.log;
    state.recent = result.recent;
    state.summary = result.todaySummary;
    renderAll();
    showReaction("Saved correction", labelForLog(result.log));
  } catch (error) {
    status.textContent = `Save failed: ${error.message}`;
  }
}

function labelForLog(log) {
  if (log.type === "feeding") return `Boobie, ${log.side || "unknown"} side`;
  if (log.type === "bottle") return `Bottle, ${log.ounces} oz`;
  if (log.type === "diaper") return log.poop ? "Poo diaper" : "Wee diaper";
  if (log.type === "sleep") return `Sleep: ${log.status || "logged"}`;
  if (log.type === "tummy_time") return `Tummy time: ${log.status || "logged"}`;
  if (log.type === "baby_gym") return "Baby gym time";
  if (log.type === "bath") return `Bath: ${log.status === "end" ? "stop" : "start"}`;
  return (log.type || "activity").replaceAll("_", " ");
}

function formatWhen(value) {
  if (!value) return "Not logged yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("visible"), 2400);
}

function showReaction(title, message) {
  const reaction = document.getElementById("reaction");
  document.getElementById("reaction-title").textContent = title;
  document.getElementById("reaction-message").textContent = message;
  reaction.classList.remove("visible");
  clearTimeout(showReaction.timer);
  requestAnimationFrame(() => reaction.classList.add("visible"));
  reaction.setAttribute("aria-hidden", "false");
  showReaction.timer = setTimeout(() => {
    reaction.classList.remove("visible");
    reaction.setAttribute("aria-hidden", "true");
  }, 1700);
}

function setupExportPanel(containerId) {
  const container = document.getElementById(containerId);
  const template = document.getElementById("export-controls-template");
  container.appendChild(template.content.cloneNode(true));
  const form = container.querySelector("form:last-child");
  const start = form.elements.startDate;
  const end = form.elements.endDate;
  const today = new Date().toISOString().slice(0, 10);
  start.value = addDays(today, -6);
  end.value = today;

  form.elements.rangeType.addEventListener("change", () => {
    const range = form.elements.rangeType.value;
    if (range === "daily") start.value = end.value;
    if (range === "weekly" || range === "last7") start.value = addDays(end.value, -6);
    if (range === "last30") start.value = addDays(end.value, -29);
    if (range === "monthly") start.value = `${end.value.slice(0, 7)}-01`;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = form.querySelector(".export-status");
    status.textContent = "Generating export...";

    const reportType = form.elements.reportType.value;
    const endpoint = reportType === "pediatrician-report" ? "pediatrician-report" : reportType;
    const rangeType = ["last7", "last30"].includes(form.elements.rangeType.value) ? "custom" : form.elements.rangeType.value;
    const params = new URLSearchParams({
      startDate: start.value,
      endDate: end.value,
      rangeType,
      includeCharts: form.elements.includeCharts.checked ? "true" : "false"
    });

    try {
      const response = await fetch(`/api/export/${endpoint}?${params}`);
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const fileName = match ? match[1] : `export.${endpoint}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      status.textContent = `Downloaded ${fileName}. Server copy saved in backend/exports/.`;
    } catch (error) {
      status.textContent = `Export failed: ${error.message}`;
    }
  });
}

function addDays(date, days) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
