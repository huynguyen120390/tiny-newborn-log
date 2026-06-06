const state = {
  logs: [],
  recent: {},
  summary: {},
  profile: {},
  activeTab: "home",
  activeHomeTab: "log",
  activeSettingsView: "settings",
  visibleCards: [],
  poopColors: [],
  historyFilters: {
    startDate: "",
    endDate: "",
    types: ["all"]
  },
  dashboardFilters: {
    rangeMode: "day",
    startDate: todayString(),
    endDate: todayString(),
    types: ["all"],
    viewStartMs: null,
    viewEndMs: null
  },
  dashboardSelection: null,
  activeLogsCard: null,
  selectedCareIssue: null,
  selectedCareSubtab: {},
  careInfo: {},
  doctorGuideline: null,
  babyCriesAssistant: {
    open: false,
    inFlight: false,
    lastSignature: "",
    lastRunAt: 0,
    result: null,
    source: "",
    updatedAt: "",
    error: "",
    prompt: ""
  },
  dashboardOverview: {
    status: "idle",
    lastInputHash: "",
    serverInputHash: "",
    publishedReview: null,
    pendingReview: null,
    source: "",
    updatedAt: "",
    error: "",
    reviewTrace: null,
    overviewOpen: localStorage.getItem("tinyNewborn.dashboardOverview.overviewOpen") !== "0",
    reviewTraceOpen: localStorage.getItem("tinyNewborn.dashboardOverview.reviewTraceOpen") === "1",
    openCardDetails: new Set(JSON.parse(localStorage.getItem("tinyNewborn.dashboardOverview.openCardDetails") || "[]")),
    timerId: null
  },
  overviewSettings: {
    reviewMode: "rules_only",
    llamaModel: "llama3.2",
    gptModel: "gpt-4.1-mini",
    refreshIntervalMinutes: 5,
    maxOutputTokens: 700,
    reviewWindowDays: 3
  },
  milestoneProgress: {},
  selectedMilestoneId: null,
  ticker: null,
  pendingActionConfirm: null,
  pendingLogSyncCount: 0,
  pendingLogSyncing: false,
  currentDate: todayString(),
  weather: null,
  weatherLastUpdated: 0,
  bathSoundEnabled: false,
  bathReminderSeconds: loadBathReminderSeconds(),
  lastBathAnnouncementStep: 0,
  tummySoundEnabled: false,
  tummyReminderSeconds: loadTummyReminderSeconds(),
  lastTummyAnnouncementStep: 0,
  weightUnit: loadWeightUnit(),
  heightUnit: loadHeightUnit(),
  reminderVoiceURI: loadReminderVoiceURI(),
  audioContext: null,
  quiz: {
    selectedSetId: "everyday_parenting_daily_scenarios",
    questionCount: 10,
    timerDuration: 0,
    soundEnabled: false,
    status: "idle",
    error: "",
    set: null,
    questions: [],
    currentIndex: 0,
    selectedChoiceId: null,
    result: null,
    score: 0,
    answered: 0,
    correct: 0,
    timerRemaining: 0,
    timerStartedAt: 0,
    timerId: null,
    tickTimerId: null,
    tickOscillator: null,
    tickGain: null
  }
};

// Add future quiz JSON files under frontend/data/quizzes/ and register them here.
const quizSets = [
  {
    id: "everyday_parenting_daily_scenarios",
    displayName: "Everyday Parenting — Daily Scenarios",
    jsonPath: "./data/quizzes/everyday_parenting_daily_scenarios_quiz_bank_200.json",
    description: "Practical daily parenting scenario quiz for everyday family situations."
  }
];

const quizQuestionCounts = [10, 20, 30];
const quizTimerDurations = [
  { label: "Off", value: 0 },
  { label: "10s", value: 10 },
  { label: "15s", value: 15 },
  { label: "20s", value: 20 }
];

const pendingLogQueueKey = "pendingLogQueue.v1";

const weightUnits = {
  oz: { label: "oz", grams: 28.349523125 },
  lb: { label: "lb", grams: 453.59237 },
  g: { label: "g", grams: 1 },
  kg: { label: "kg", grams: 1000 }
};

const heightUnits = {
  in: { label: "in", mm: 25.4 },
  ft: { label: "ft", mm: 304.8 },
  cm: { label: "cm", mm: 10 },
  mm: { label: "mm", mm: 1 }
};

const feedingBurpReminder = "Burp baby after feeding.";

const activities = [
  {
    title: "Sleep and Awake",
    key: "sleep",
    icon: "moon",
    helper: "Baby is awaking.",
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
      { label: "Left", icon: "left", payload: { type: "feeding", method: "breast", side: "left" }, reminder: `${feedingBurpReminder} Try right side next time.` },
      { label: "Right", icon: "right", payload: { type: "feeding", method: "breast", side: "right" }, reminder: `${feedingBurpReminder} Try left side next time.` }
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
    title: "Routines",
    key: "routine",
    icon: "star",
    helper: "Mark routine steps as done.",
    actions: [
      { label: "Morning routine", icon: "routine-morning", payload: { type: "routine", routine: "morning" } },
      { label: "Naptime routine", icon: "routine-naptime", payload: { type: "routine", routine: "naptime" } },
      { label: "Bedtime routine", icon: "routine-bedtime", payload: { type: "routine", routine: "bedtime" } }
    ]
  },
  {
    title: "Wee & Poo",
    key: "diaper",
    icon: "spark",
    helper: "Tiny toilet logs.",
    actions: [
      { label: "Wee", icon: "pee", payload: { type: "diaper", kind: "pee" } },
      { label: "Poo", icon: "poop", dialog: "poopColor" }
    ]
  },
  {
    title: "Baby Stats",
    key: "growth",
    icon: "stats",
    helper: "Log weight or height for checkups.",
    actions: [
      { label: "Weight", icon: "weight", dialog: "growth", stat: "weight" },
      { label: "Height", icon: "height", dialog: "growth", stat: "height" }
    ]
  },
  {
    title: "Bath",
    key: "bath",
    icon: "spark",
    helper: "Start and stop splash time.",
    actions: [
      { label: "Start", icon: "bath", payload: { type: "bath", status: "start" } },
      { label: "Stop", icon: "bath", payload: { type: "bath", status: "end" } }
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
    title: "Outdoor Time",
    key: "outdoor",
    icon: "sun",
    helper: "Start and end fresh air time.",
    actions: [
      { label: "Start", icon: "outdoor-start", payload: { type: "outdoor_time", status: "start" } },
      { label: "End", icon: "outdoor-end", payload: { type: "outdoor_time", status: "end" } }
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

const careIssues = [
  { key: "troubleshoot", title: "Troubleshoot", helper: "Fix it with care.", header: "troubleshoot" },
  { key: "eat", title: "Eat", helper: "Feeding and appetite concerns.", header: "eat" },
  { key: "sleep", title: "Sleep", helper: "Rest, naps, and bedtime concerns.", header: "sleep" },
  { key: "hygiene", title: "Hygiene", helper: "Diaper, bath, and clean-up concerns.", header: "hygiene" },
  { key: "exercise", title: "Exercise", helper: "Movement and body practice concerns.", header: "exercise" },
  { key: "play", title: "Play", helper: "Engagement and stimulation concerns.", header: "play" },
  { key: "safety", title: "Safety", helper: "Home, travel, and setup concerns.", header: "safety" },
  { key: "health", title: "Health", helper: "Symptoms and checkup concerns.", header: "health" }
];

const historyEventTypes = [
  { value: "all", label: "All" },
  { value: "sleep", label: "Sleep" },
  { value: "feeding", label: "Boobie" },
  { value: "bottle", label: "Bottle" },
  { value: "routine", label: "Routines" },
  { value: "diaper", label: "Diaper" },
  { value: "growth_stats", label: "Stats" },
  { value: "bath", label: "Bath" },
  { value: "tummy_time", label: "Tummy" },
  { value: "outdoor_time", label: "Outdoor" },
  { value: "baby_gym", label: "Gym" }
];

const eventCategoryConfig = {
  sleep: {
    label: "Sleep",
    kind: "period",
    start: "asleep",
    end: "awake",
    startLabel: "asleep",
    endLabel: "awake",
    color: "#4078b9",
    icon: "/assets/activity/icon-asleep.png"
  },
  bath: {
    label: "Bath",
    kind: "period",
    start: "start",
    end: "end",
    startLabel: "started",
    endLabel: "stopped",
    color: "#2d8b9e",
    icon: "/assets/activity/icon-bath.png"
  },
  tummy_time: {
    label: "Tummy",
    kind: "period",
    start: "start",
    end: "end",
    startLabel: "started",
    endLabel: "ended",
    color: "#6f8f45",
    icon: "/assets/activity/icon-tummy-start.png"
  },
  outdoor_time: {
    label: "Outdoor",
    kind: "period",
    start: "start",
    end: "end",
    startLabel: "started",
    endLabel: "ended",
    color: "#3f8f68",
    icon: "/assets/activity/icon-outdoor-start.png"
  },
  feeding: { label: "Boobie", kind: "quick", color: "#d95f72", icon: "/assets/activity/icon-left.png" },
  bottle: { label: "Bottle", kind: "quick", color: "#24756f", icon: "/assets/activity/icon-bottle.png" },
  routine: { label: "Routine", kind: "quick", color: "#6b6fd1", icon: "/assets/activity/icon-routine-morning.png" },
  diaper: { label: "Diaper", kind: "quick", color: "#d99a2b", icon: "/assets/activity/icon-pee.png" },
  growth_stats: { label: "Stats", kind: "quick", color: "#7d6d2f", icon: "/assets/activity/icon-weight.png" },
  baby_gym: { label: "Gym", kind: "quick", color: "#9b5bc0", icon: "/assets/activity/icon-gym.png" }
};

function milestoneGuide() {
  return state.doctorGuideline?.milestoneGuide || {};
}

function arrayGuideValue(value) {
  return Array.isArray(value) ? value : [];
}

function objectGuideValue(value) {
  return value && !Array.isArray(value) && typeof value === "object" ? value : {};
}

function milestoneDefinitions() {
  return arrayGuideValue(milestoneGuide().definitions);
}

function exerciseLibrary() {
  return arrayGuideValue(milestoneGuide().exerciseLibrary);
}

function milestoneStateMessages() {
  return objectGuideValue(milestoneGuide().statusMessages);
}

function milestoneBehaviorDescriptions() {
  return objectGuideValue(milestoneGuide().behaviorDescriptions);
}

function supportingMilestoneExercises() {
  return objectGuideValue(milestoneGuide().supportingExercises);
}

const milestoneStates = ["Not Yet", "Maybe", "Practicing", "Confirmed"];
const dashboardOverviewCacheKey = "tinyNewborn.dashboardOverview.publishedReview.v2";
const overviewReviewModes = [
  { value: "rules_only", label: "Fast local rules" },
  { value: "ollama_strict", label: "Strict Ollama" },
  { value: "gpt_strict", label: "Strict GPT" }
];
const overviewLlamaModels = ["llama3.2", "llama3.2:latest", "qwen2.5:0.5b", "qwen2.5:1.5b", "gemma2:2b"];
const overviewGptModels = ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-5.1", "gpt-5.4"];
const overviewCareVoices = ["parent_friendly", "pediatrician_genz_professional"];
const dashboardPlotBaseWidth = 884;
const dashboardPlotLeft = 128;
const dashboardMaxZoom = 8;
const dashboardMinWindowMs = 15 * 60 * 1000;



const legacyMilestoneStatus = {
  Upcoming: "Not Yet",
  Achieved: "Confirmed",
  practicing: "Practicing",
  achieved: "Confirmed",
  "not-yet": "Not Yet",
  maybe: "Maybe",
  confirmed: "Confirmed"
};



state.visibleCards = loadVisibleCards();

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => activateTab(button.dataset.tab));
});

document.querySelectorAll("[data-home-tab]").forEach((button) => {
  button.addEventListener("click", () => activateTab(button.dataset.homeTab));
});

document.querySelectorAll("[data-settings-view]").forEach((button) => {
  button.addEventListener("click", () => activateTab(button.dataset.settingsView));
});

document.getElementById("chatgpt-shortcut")?.addEventListener("click", openChatGptShortcut);
document.getElementById("weather-shortcut")?.addEventListener("click", openWeatherShortcut);

document.querySelector("[data-close-dialog]").addEventListener("click", () => {
  document.getElementById("bottle-dialog").close();
});

document.querySelector("[data-close-weight-dialog]").addEventListener("click", () => {
  document.getElementById("weight-dialog").close();
});

document.querySelector("[data-close-height-dialog]").addEventListener("click", () => {
  document.getElementById("height-dialog").close();
});

document.querySelector("[data-close-poop-color]").addEventListener("click", () => {
  document.getElementById("poop-color-dialog").close();
});

document.getElementById("poop-color-dialog").addEventListener("click", (event) => {
  if (event.target.id === "poop-color-dialog") event.target.close();
});

document.querySelector("[data-close-activity-logs]").addEventListener("click", () => {
  document.getElementById("activity-logs-dialog").close();
});

document.querySelector("[data-close-milestone]").addEventListener("click", () => {
  document.getElementById("milestone-dialog").close();
});

document.getElementById("milestone-dialog").addEventListener("click", (event) => {
  if (event.target.id === "milestone-dialog") event.target.close();
});

document.getElementById("bottle-slider").addEventListener("input", (event) => {
  document.getElementById("bottle-value").textContent = Number(event.target.value).toFixed(2).replace(/0$/, "");
});

document.getElementById("bottle-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const ounces = Number(document.getElementById("bottle-slider").value);
  document.getElementById("bottle-dialog").close();
  await createLog({ type: "bottle", ounces }, feedingBurpReminder);
});

document.getElementById("weight-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const weightUnit = state.weightUnit;
  state.weightUnit = weightUnit;
  saveWeightUnit();
  document.getElementById("weight-dialog").close();
  await createLog({ type: "growth_stats", stat: "weight", weight: Number(document.getElementById("growth-weight").value), weightUnit });
});

document.getElementById("height-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const heightUnit = state.heightUnit;
  state.heightUnit = heightUnit;
  saveHeightUnit();
  document.getElementById("height-dialog").close();
  await createLog({ type: "growth_stats", stat: "height", height: Number(document.getElementById("growth-height").value), heightUnit });
});

init().catch((error) => {
  const summary = document.getElementById("baby-summary");
  if (summary) summary.textContent = `Could not load profile: ${error.message}`;
  showToast(`Could not load app data: ${error.message}`);
});

async function init() {
  updatePendingLogSyncStatus();
  window.addEventListener("online", () => retryPendingLogSyncs());
  window.addEventListener("focus", () => retryPendingLogSyncs());
  renderActivities();
  await loadCareInfo();
  setupHistoryFilters();
  setupDashboardFilters();
  setupSettingsPanel();
  setupQuizPanel();
  setupExportPanel("export-panel");
  setupSpeechVoices();
  updateClock();
  updateWeatherDisplay();
  refreshWeather();
  await refreshData();
  await retryPendingLogSyncs({ quiet: true });
  startDashboardOverviewReviews();
}

async function refreshData() {
  const [appData, recent, summary, poopColors] = await Promise.all([
    fetchJson("/api/app-data"),
    fetchJson("/api/recent"),
    fetchJson("/api/today-summary"),
    fetchJson("/api/poop-colors")
  ]);

  state.profile = appData.baby_profile || {};
  state.logs = appData.baby_log || [];
  mergePendingLogsIntoState();
  state.recent = recent;
  state.summary = summary;
  state.poopColors = Array.isArray(poopColors) ? poopColors : [];
  state.bathSoundEnabled = Boolean(appData.sound_settings?.bathSoundEnabled);
  state.tummySoundEnabled = Boolean(appData.sound_settings?.tummySoundEnabled);
  state.overviewSettings = cleanOverviewSettings(appData.overview_settings);
  state.milestoneProgress = appData.milestone_progress || (Array.isArray(appData.milestones) ? {} : appData.milestones || {});

  renderAll();
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    try {
      const payload = JSON.parse(text);
      const error = new Error(payload.error || text);
      error.payload = payload;
      throw error;
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error(text);
      throw error;
    }
  }
  return response.json();
}

function readPendingLogQueue() {
  try {
    const parsed = JSON.parse(storageGet(pendingLogQueueKey) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item?.payload?.type) : [];
  } catch {
    return [];
  }
}

function writePendingLogQueue(queue) {
  storageSet(pendingLogQueueKey, JSON.stringify(queue));
  updatePendingLogSyncStatus(queue.length);
}

function updatePendingLogSyncStatus(count = readPendingLogQueue().length) {
  state.pendingLogSyncCount = count;
  const element = document.getElementById("pending-log-sync-status");
  if (!element) return;
  element.hidden = count <= 0;
  element.textContent = state.pendingLogSyncing
    ? `Syncing ${count}`
    : `${count} pending`;
}

function makeClientLogId() {
  const random = Math.random().toString(16).slice(2, 8);
  return `web-${Date.now()}-${random}`;
}

function logTimestampParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date();
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  const day = String(safeDate.getDate()).padStart(2, "0");
  const hour = String(safeDate.getHours()).padStart(2, "0");
  const minute = String(safeDate.getMinutes()).padStart(2, "0");
  return {
    iso: safeDate.toISOString(),
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`
  };
}

function prepareLogPayload(payload) {
  const stamp = logTimestampParts(payload.createdAt);
  return {
    ...payload,
    id: payload.id || makeClientLogId(),
    date: payload.date || stamp.date,
    time: payload.time || stamp.time,
    createdAt: payload.createdAt || stamp.iso
  };
}

function queuePendingLog(payload) {
  const prepared = prepareLogPayload(payload);
  const queue = readPendingLogQueue();
  const item = {
    id: prepared.id,
    queuedAt: new Date().toISOString(),
    payload: prepared
  };
  queue.push(item);
  writePendingLogQueue(queue);
  mergePendingLogsIntoState();
  renderAll();
  return item;
}

function localLogFromPendingItem(item) {
  return {
    ...item.payload,
    id: item.id,
    timestamp: item.payload.createdAt,
    createdAt: item.payload.createdAt,
    pendingSync: true
  };
}

function mergePendingLogsIntoState() {
  const pendingLogs = readPendingLogQueue().map(localLogFromPendingItem);
  if (!pendingLogs.length) return;
  const ids = new Set(state.logs.map((log) => log.id));
  pendingLogs.forEach((log) => {
    if (!ids.has(log.id)) state.logs.push(log);
  });
  state.logs.sort((a, b) => logTime(a) - logTime(b));
}

async function postLogPayload(payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetchJson("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function shouldQueueLogError(error) {
  if (!navigator.onLine) return true;
  return !error.payload;
}

async function retryPendingLogSyncs({ quiet = false } = {}) {
  let queue = readPendingLogQueue();
  if (!queue.length || state.pendingLogSyncing) return;
  if (navigator.onLine === false) {
    updatePendingLogSyncStatus(queue.length);
    return;
  }

  state.pendingLogSyncing = true;
  updatePendingLogSyncStatus(queue.length);
  let synced = 0;

  try {
    while (queue.length) {
      const item = queue[0];
      await postLogPayload(item.payload);
      synced += 1;
      queue = queue.slice(1);
      writePendingLogQueue(queue);
    }
  } catch {
    // Keep unsent logs queued. The next online/focus/log action will retry.
  } finally {
    state.pendingLogSyncing = false;
    updatePendingLogSyncStatus(queue.length);
  }

  if (synced > 0) {
    try {
      await refreshData();
    } catch {
      renderAll();
    }
    if (!quiet) showToast(`Synced ${synced} saved log${synced === 1 ? "" : "s"}.`);
  }
}

async function loadCareInfo() {
  try {
    const guideline = await fetchJson("/api/doctor-guideline");
    state.doctorGuideline = guideline;
    state.careInfo.sleep = guideline.careGuides?.sleep || null;
    state.careInfo.eat = guideline.careGuides?.eat || null;
  } catch (error) {
    state.careInfo.sleep = null;
    state.careInfo.eat = null;
  }
}

function activateTab(tab) {
  const homeViews = ["log", "care", "milestones", "dashboard"];
  const settingsViews = ["settings", "history", "exports"];

  if (homeViews.includes(tab)) {
    state.activeTab = "home";
    state.activeHomeTab = tab;
  } else if (settingsViews.includes(tab)) {
    state.activeTab = "settings";
    state.activeSettingsView = tab;
  } else {
    state.activeTab = tab;
  }

  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === state.activeTab);
  });

  document.getElementById("home-tabs")?.classList.toggle("active", state.activeTab === "home");
  document.querySelectorAll("[data-home-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.homeTab === state.activeHomeTab);
  });
  document.querySelectorAll("[data-settings-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.settingsView === state.activeSettingsView);
  });

  document.querySelectorAll(".panel").forEach((panel) => {
    const isHomePanel = state.activeTab === "home" && homeViews.includes(panel.id) && panel.id === state.activeHomeTab;
    const isSettingsPanel = state.activeTab === "settings" && settingsViews.includes(panel.id) && panel.id === state.activeSettingsView;
    const isTopPanel = !homeViews.includes(panel.id) && !settingsViews.includes(panel.id) && panel.id === state.activeTab;
    panel.classList.toggle("active", isHomePanel || isSettingsPanel || isTopPanel);
  });

  if (state.activeTab === "home" && state.activeHomeTab === "dashboard") renderDashboard();
}

function renderAll() {
  
  const birthday = state.profile.birthday || "";
  const age = formatBabyAge(birthday);
  document.getElementById("baby-summary").textContent = `${age}.`;
  updateTopbarBabyAge();
  renderTodaySummary();
  renderRecent();
  renderCare();
  renderHistory();
  renderDashboard();
  renderMilestones();
  renderQuiz();
  renderSettings();
  renderActivityStats();
  updateActivityButtons();
  updateBottleDefaults();
  startTicker();
}

function renderActivities() {
  resetPendingCardAction();
  const visibleActivities = activities.filter((activity) => state.visibleCards.includes(activity.key));
  document.getElementById("activity-grid").innerHTML = visibleActivities.map((activity) => `
    <article class="activity-card" data-activity-card="${activity.key}" style="--card-image: url('${cardHeaderImage(activity.key)}')">
      <div class="card-top card-header">
        <div>
          <h3 data-card-title="${activity.key}">${activity.title}</h3>
          <p data-card-subtitle="${activity.key}">${activity.helper}</p>
        </div>
        ${["sleep", "bath", "tummy", "outdoor"].includes(activity.key) ? `
          <div class="activity-motion" aria-hidden="true">
            <span class="star-field"></span>
            <span class="star-field"></span>
            <span class="star-field"></span>
            <span class="cloud-field"></span>
            <span class="cloud-field"></span>
            <span class="cloud-field"></span>
            <span class="bubble-field"></span>
            <span class="bubble-field"></span>
            <span class="sweat-field"></span>
            <span class="sweat-field"></span>
          </div>
        ` : ""}
        <button class="card-more" type="button" data-more-card="${activity.key}" aria-label="Show today's ${activity.title} logs">
          <span></span><span></span><span></span>
        </button>
        ${activity.key === "boobie" ? `
          <button class="card-care-link" type="button" data-care-shortcut="eat" data-care-subtab-shortcut="boobie-positions" aria-label="Open Boobie Positions">
            <img src="/assets/activity/icon-bottle.png" alt="" loading="lazy">
          </button>
        ` : ""}
        ${["bath", "tummy"].includes(activity.key) ? `
          <button class="sound-toggle" type="button" data-${activity.key}-sound-toggle aria-label="${activity.title} sound is off">
            <span class="speaker-icon" aria-hidden="true"></span>
          </button>
        ` : ""}
      </div>
      <div>
          <div class="card-info" data-card-info="${activity.key}"></div>
          <div class="button-row">
            ${activity.actions.map((action) => `
              <button class="action-button" data-card="${activity.key}" data-action-label="${action.label}" data-action='${JSON.stringify(action)}'>
                <img src="/assets/activity/icon-${action.icon}.png" alt="" loading="lazy">
                <span>${action.label}</span>
              </button>
            `).join("")}
          </div>
      </div>
      
    </article>
  `).join("");

  document.querySelectorAll(".action-button").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = JSON.parse(button.dataset.action);
      if (action.dialog === "bottle") {
        openBottleDialog();
        return;
      }
      if (action.dialog === "growth") {
        openGrowthDialog(action.stat || "weight");
        return;
      }
      if (action.dialog === "poopColor") {
        openPoopColorDialog();
        return;
      }
      if (!confirmCardAction(button)) return;
      await createLog(action.payload, action.reminder);
    });
  });

  document.querySelectorAll(".card-more").forEach((button) => {
    button.addEventListener("click", () => openActivityLogs(button.dataset.moreCard));
  });

  document.querySelectorAll("[data-care-shortcut]").forEach((button) => {
    button.addEventListener("click", () => openCareShortcut(button.dataset.careShortcut, button.dataset.careSubtabShortcut));
  });

  document.querySelectorAll("[data-bath-sound-toggle]").forEach((button) => {
    button.addEventListener("click", toggleBathSound);
  });

  document.querySelectorAll("[data-tummy-sound-toggle]").forEach((button) => {
    button.addEventListener("click", toggleTummySound);
  });
}

function openCareShortcut(issueKey, subtabKey = "") {
  if (!careIssues.some((issue) => issue.key === issueKey)) return;
  state.selectedCareIssue = issueKey;
  if (subtabKey) state.selectedCareSubtab[issueKey] = subtabKey;
  activateTab("care");
  renderCare();
  document.getElementById("care")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderCare() {
  const panel = document.getElementById("care-panel");
  if (!panel) return;

  const selected = careIssues.find((issue) => issue.key === state.selectedCareIssue);
  if (selected) {
    panel.innerHTML = renderCareIssueView(selected);
    panel.querySelector("[data-care-back]")?.addEventListener("click", () => {
      state.selectedCareIssue = null;
      renderCare();
    });
    panel.querySelectorAll("[data-care-subtab]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedCareSubtab[selected.key] = button.dataset.careSubtab;
        renderCare();
      });
    });
    panel.querySelector("[data-baby-cries-llama]")?.addEventListener("click", () => {
      state.babyCriesAssistant.open = true;
      updateBabyCriesAssistantPanel();
      maybeRefreshBabyCriesAssistant(true);
    });
    panel.querySelector("[data-baby-cries-close]")?.addEventListener("click", () => {
      state.babyCriesAssistant.open = false;
      updateBabyCriesAssistantPanel();
    });
    return;
  }

  const columns = careIssueColumns();
  panel.innerHTML = `
    <div class="care-grid">
      ${columns.map((column) => `
        <div class="care-column">
          ${column.map(renderCareIssueCard).join("")}
        </div>
      `).join("")}
    </div>
  `;

  panel.querySelectorAll("[data-care-issue]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCareIssue = button.dataset.careIssue;
      renderCare();
    });
  });
}

function careIssueColumns() {
  const columnCount = 3;
  return careIssues.reduce((columns, issue, index) => {
    columns[index % columnCount].push(issue);
    return columns;
  }, Array.from({ length: columnCount }, () => []));
}

function renderCareIssueCard(issue) {
  const info = renderCareIssueCardInfo(issue);
  return `
    <button class="activity-card care-card" type="button" data-care-issue="${escapeAttr(issue.key)}" style="--card-image: url('${careHeaderImage(issue.header)}')">
      <div class="card-top card-header">
        <div>
          <h3>${escapeHtml(issue.title)}</h3>
          <p>${escapeHtml(issue.helper)}</p>
        </div>
      </div>
      ${info ? `<div class="card-info care-card-info">${info}</div>` : ""}
    </button>
  `;
}

function renderCareIssueCardInfo(issue) {
  const bullets = issue.key === "sleep" ? sleepCardBullets() : issue.key === "eat" ? eatCardBullets() : [];
  if (!bullets.length) return "";
  return `<ul class="care-card-bullets">${bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function sleepCardBullets() {
  const data = state.careInfo.sleep;
  if (!data) {
    return [
      "Sleep milestones: Loading...",
      "Nap: Loading...",
      "Outdoor clothing: Waiting for weather",
      "Indoor clothing: Coming soon"
    ];
  }

  const row = relevantSleepRow(data);
  return [
    `Sleep milestones: ${row ? `${row.age}: ${row.sleepMilestone}; wake ${row.wakeWindow}` : "Set birthday for age-based guidance"}`,
    `Nap: ${row ? `${row.nap}; ${row.recommendedNapTime || "30 min-2 hrs each"}. Dark, quiet room. Limit long naps to 2-3x/day.` : "Set birthday for age-based guidance"}`,
    `Outdoor clothing: ${outdoorClothingRecommendation(data)}`,
    `Indoor clothing: ${data.indoorClothing || "Coming soon"}`,
    "Start bedtime routine 30-60m before bed; watch sleepy cues to start routine."
  ];
}

function eatCardBullets() {
  const data = state.careInfo.eat;
  if (!data) {
    return [
      "Eat milestones: Loading...",
      "Breastfeed: Loading...",
      "Milk Pump: Loading...",
      "Bottle: Loading...",
      "Wet diapers: Loading..."
    ];
  }

  const row = relevantFeedingRow(data);
  return [
    `Eat milestones: ${row ? formatFeedingMilestoneRow(row) : "Set birthday for age-based guidance"}`,
    "Breastfeed: Warm compress before feed; alternate sides; cold compress after feed.",
    `Milk Pump: ${milkPumpReminder(data)}`,
    `Bottle: ${bottleReminder(data, row)}`,
    `Wet diapers: ${wetDiaperReminder(data)}`
  ];
}

function relevantFeedingRow(data) {
  const ageMonths = babyAgeMonths();
  if (!Number.isFinite(ageMonths)) return null;
  const rows = findCareSectionById(data.sections, "feeding-milestones")?.rows || [];
  return rows.find((row) => ageRangeMatches(row.age, ageMonths)) || rows[rows.length - 1] || null;
}

function formatFeedingMilestoneRow(row) {
  const notes = Array.isArray(row.notes) && row.notes.length ? `; Notes: ${row.notes.join(", ")}` : "";
  return `${row.age}: ${row.whatToFeed}; ${row.howOften}; ${row.amountPerFeed}; nipple ${row.bottleNipple}${notes}`;
}

function milkPumpReminder(data) {
  const whenToPump = findCareSectionById(data.sections, "when-to-pump")?.items || [];
  const exclusive = whenToPump.find((item) => /times\/day/i.test(item)) || "8-10 times/day for exclusive pumping";
  const powerSteps = findCareSectionById(data.sections, "power-pumping")?.steps || [];
  const trend = latestWeightTrend();
  if (trend === "not-increasing") {
    return `${exclusive}. Weight is not increasing in latest logs; consider power pumping${powerSteps.length ? ` (${powerSteps.join(" -> ")})` : ""}.`;
  }
  if (trend === "increasing") return `${exclusive}. Latest weight is increasing; keep tracking.`;
  return `${exclusive}. Log at least 2 weights to watch supply trend.`;
}

function bottleReminder(data, milestoneRow) {
  const nipple = relevantNippleSize(data) || milestoneRow?.bottleNipple || "age-appropriate nipple";
  const milkTemp = findCareSectionById(data.sections, "milk-temperature")?.items || [];
  return `Nipple ${nipple}; milk ${milkTemp.join(", ") || "warm to body temperature and test on wrist"}.`;
}

function relevantNippleSize(data) {
  const ageMonths = babyAgeMonths();
  if (!Number.isFinite(ageMonths)) return "";
  const rows = findCareSectionById(data.sections, "nipple-size-guide")?.rows || [];
  const row = rows.find((item) => ageRangeMatches(item[0], ageMonths)) || rows[rows.length - 1];
  return row?.[1] || "";
}

function wetDiaperReminder(data) {
  const rows = findCareSectionById(data.sections, "wet-diapers")?.rows || [];
  const ageDays = babyAgeDays();
  const label = Number.isFinite(ageDays) ? (ageDays >= 4 ? "Day 4+" : `Day ${Math.max(1, ageDays)}`) : "";
  const row = rows.find((item) => item[0] === label) || rows[rows.length - 1];
  const logged = summarizeLogsToday().wetDiapers;
  if (!row) return `${logged} logged today; database guidance unavailable.`;
  return `${row[0]} expected ${row[1]}; ${logged} logged today.`;
}

function findCareSectionById(sections, id) {
  for (const section of sections || []) {
    if (section.id === id) return section;
    const found = findCareSectionById(section.subsections, id);
    if (found) return found;
  }
  return null;
}

function ageRangeMatches(label, ageMonths) {
  const text = String(label || "").toLowerCase();
  const match = text.match(/(\d+)\s*-\s*(\d+)\+?\s*months?/);
  if (match) return ageMonths >= Number(match[1]) && ageMonths <= Number(match[2]);
  const plus = text.match(/(\d+)\+\s*months?/);
  if (plus) return ageMonths >= Number(plus[1]);
  const single = text.match(/(\d+)\s*months?/);
  if (single) return Math.round(ageMonths) === Number(single[1]);
  return false;
}

function latestWeightTrend() {
  const weights = state.logs
    .filter((log) => log.type === "growth_stats" && (log.stat === "weight" || (!log.stat && (log.weight || log.weightGrams))))
    .map((log) => ({ log, grams: readWeightGrams(log) }))
    .filter((item) => item.grams > 0)
    .sort((a, b) => logTime(a.log) - logTime(b.log));
  if (weights.length < 2) return "unknown";
  const previous = weights[weights.length - 2].grams;
  const latest = weights[weights.length - 1].grams;
  return latest > previous ? "increasing" : "not-increasing";
}

function relevantSleepRow(data) {
  const weeks = babyAgeWeeks();
  if (!Number.isFinite(weeks)) return null;
  return (data.milestones || []).find((row) => weeks >= row.minWeeks && weeks <= row.maxWeeks)
    || (data.milestones || [])[data.milestones.length - 1]
    || null;
}

function outdoorClothingRecommendation(data) {
  const temperature = state.weather?.temperature;
  if (!Number.isFinite(temperature)) return "Waiting for local weather";
  const rule = (data.outdoorClothingRules || []).find((item) => temperature <= item.maxF);
  return `${temperature}°F: ${rule?.text || "Dress in light layers and check baby often."}`;
}

function renderCareIssueView(issue) {
  if (issue.key === "troubleshoot") return renderTroubleshootCareView(issue);
  if (issue.key === "eat") return renderEatCareView(issue);
  if (issue.key === "sleep") return renderSleepCheatsheetImage(issue);

  return `
    <section class="care-detail">
      <button class="ghost care-back-button" type="button" data-care-back>Back to Care</button>
      <div class="care-detail-hero" style="--card-image: url('${careHeaderImage(issue.header)}')">
        <h3>${escapeHtml(issue.title)}</h3>
        <p>${escapeHtml(issue.helper)}</p>
      </div>
      <div class="care-detail-body"></div>
    </section>
  `;
}

function renderTroubleshootCareView(issue) {
  return `
    <section class="care-detail">
      <button class="ghost care-back-button" type="button" data-care-back>Back to Care</button>
      <div class="care-detail-hero" style="--card-image: url('${careHeaderImage(issue.header)}')">
        <h3>${escapeHtml(issue.title)}</h3>
        <p>${escapeHtml(issue.helper)}</p>
      </div>
      <div class="care-image-viewer">
        ${renderBabyCriesCardClean()}
        <div class="baby-cries-llama-row">
          <button class="baby-cries-llama-button" type="button" data-baby-cries-llama aria-expanded="${state.babyCriesAssistant.open ? "true" : "false"}">
            <img src="/assets/care/llama.png" alt="">
            <span>Ask Llama</span>
          </button>
        </div>
        <div id="baby-cries-assistant-slot">
          ${state.babyCriesAssistant.open ? renderBabyCriesAssistantPanel() : ""}
        </div>
      </div>
    </section>
  `;
}

function renderBabyCriesAssistantPanel() {
  const assistant = state.babyCriesAssistant;
  const result = assistant.result;
  const status = assistant.inFlight ? "Checking logs..." : assistant.error ? "Fallback guidance" : result ? "Llama's Thoughts" : "Waiting to review logs";
  const updated = assistant.updatedAt ? formatAssistantUpdatedAt(assistant.updatedAt) : "--";
  const source = assistant.source === "llama" ? "Llama" : assistant.source === "fallback" ? "Fallback" : "Local review";
  const inspections = result?.inspections || [];

  return `
    <section class="baby-cries-assistant" id="baby-cries-assistant" aria-live="polite">
      <div class="baby-cries-assistant-top">
        <div>
          <span>${escapeHtml(status)}</span>
          <h4>${escapeHtml(result?.likelyReason || "Baby cries review")}</h4>
        </div>
        <div class="baby-cries-assistant-actions">
          <span class="baby-cries-confidence confidence-${escapeAttr((result?.confidence || "low").toLowerCase())}">${escapeHtml(result?.confidence || "Low")}</span>
          <button type="button" data-baby-cries-close aria-label="Close Llama recommendation">x</button>
        </div>
      </div>
      <div class="baby-cries-assistant-grid">
        <div>
          <strong>Reasoning</strong>
          <p>${escapeHtml(result?.reasoning || "I will review recent feeding, diaper, sleep, weather, and care guidance while this view is open.")}</p>
        </div>
        <div>
          <strong>Next action</strong>
          <p>${escapeHtml(result?.suggestedAction || "Start with the Baby cries checklist above.")}</p>
        </div>
      </div>
      ${inspections.length ? `
        <div class="baby-cries-inspections">
          <strong>Step inspection</strong>
          <ol>
            ${inspections.map((item) => `
              <li>
                <span>${escapeHtml(item.label || `Step ${item.step || ""}`)}</span>
                <small>${escapeHtml(item.status || "unknown")}</small>
                <p>${escapeHtml(item.reasoning || "No information found.")}</p>
              </li>
            `).join("")}
          </ol>
        </div>
      ` : ""}
      ${assistant.prompt ? `
        <details class="baby-cries-prompt" open>
          <summary>User default prompt to Llama</summary>
          <pre>${escapeHtml(assistant.prompt)}</pre>
        </details>
      ` : ""}
      <div class="baby-cries-assistant-meta">
        <span>${escapeHtml(source)}</span>
        <span>Updated: ${escapeHtml(updated)}</span>
        ${assistant.error ? `<span>${escapeHtml(assistant.error)}</span>` : ""}
      </div>
    </section>
  `;
}

function isBabyCriesAssistantVisible() {
  return state.activeTab === "home" && state.activeHomeTab === "care" && state.selectedCareIssue === "troubleshoot";
}

function babyCriesAssistantSignature() {
  const reviewCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentLogs = state.logs
    .slice()
    .filter((log) => logTime(log) >= reviewCutoff)
    .sort((a, b) => logTime(b) - logTime(a))
    .slice(0, 80)
    .map((log) => ({
      id: log.id,
      type: log.type,
      date: log.date,
      time: log.time,
      status: log.status || "",
      method: log.method || "",
      side: log.side || "",
      ounces: log.ounces || "",
      pee: Boolean(log.pee),
      poop: Boolean(log.poop),
      notes: log.notes || ""
    }));
  return JSON.stringify({
    birthday: state.profile.birthday || "",
    summary: state.summary || {},
    weather: state.weather ? {
      temperature: state.weather.temperature,
      description: state.weather.description
    } : null,
    recentLogs
  });
}

async function maybeRefreshBabyCriesAssistant(force = false) {
  if (!isBabyCriesAssistantVisible()) return;
  const assistant = state.babyCriesAssistant;
  if (!assistant.open) return;
  const now = Date.now();
  if (assistant.inFlight) return;
  if (!force && now - assistant.lastRunAt < 60_000) return;

  const signature = babyCriesAssistantSignature();
  if (!force && assistant.result && signature === assistant.lastSignature) return;

  assistant.inFlight = true;
  assistant.lastRunAt = now;
  assistant.error = "";
  updateBabyCriesAssistantPanel();

  try {
    const payload = await fetchJson("/api/troubleshoot/baby-cries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weather: state.weather ? {
          temperature: state.weather.temperature,
          description: state.weather.description,
          icon: state.weather.icon
        } : null
      })
    });
    assistant.result = payload.recommendation || null;
    assistant.source = payload.source || "fallback";
    assistant.updatedAt = payload.updatedAt || new Date().toISOString();
    assistant.prompt = payload.prompt || payload.llamaPrompt || "";
    assistant.lastSignature = signature;
    assistant.error = payload.llama?.available === false && payload.llama?.error ? "Llama unavailable; using fallback." : "";
  } catch (error) {
    assistant.error = `Could not review logs: ${error.message}`;
    assistant.source = "fallback";
    assistant.updatedAt = new Date().toISOString();
    assistant.prompt = "";
  } finally {
    assistant.inFlight = false;
    updateBabyCriesAssistantPanel();
  }
}

function updateBabyCriesAssistantPanel() {
  const slot = document.getElementById("baby-cries-assistant-slot");
  if (!slot) return;
  slot.innerHTML = state.babyCriesAssistant.open ? renderBabyCriesAssistantPanel() : "";
  slot.querySelector("[data-baby-cries-close]")?.addEventListener("click", () => {
    state.babyCriesAssistant.open = false;
    updateBabyCriesAssistantPanel();
  });
  const button = document.querySelector("[data-baby-cries-llama]");
  if (button) button.setAttribute("aria-expanded", state.babyCriesAssistant.open ? "true" : "false");
}

function formatAssistantUpdatedAt(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "--";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function renderEatCareView(issue) {
  const tabs = [
    { key: "cheatsheet", label: "Cheatsheet", image: "/assets/care/feeding-cheatsheet.png", alt: "Baby feeding cheatsheet" },
    { key: "hunger-cues", label: "Hunger Cues", image: "/assets/care/feeding-hunger-cues.png", alt: "Baby feeding hunger cues" },
    { key: "boobie-positions", label: "Boobie Positions", image: "/assets/care/boobie-positions.png", alt: "Boobie breastfeeding positions" }
  ];
  const activeKey = state.selectedCareSubtab.eat || "cheatsheet";
  const activeTab = tabs.find((tab) => tab.key === activeKey) || tabs[0];

  return `
    <section class="care-detail">
      <button class="ghost care-back-button" type="button" data-care-back>Back to Care</button>
      <div class="care-detail-hero" style="--card-image: url('${careHeaderImage(issue.header)}')">
        <h3>${escapeHtml(issue.title)}</h3>
        <p>${escapeHtml(issue.helper)}</p>
      </div>
      <div class="care-issue-tabs" role="tablist" aria-label="Eat care views">
        ${tabs.map((tab) => `
          <button class="${tab.key === activeTab.key ? "active" : ""}" type="button" role="tab" aria-selected="${tab.key === activeTab.key ? "true" : "false"}" data-care-subtab="${escapeAttr(tab.key)}">
            ${escapeHtml(tab.label)}
          </button>
        `).join("")}
      </div>
      <div class="care-image-viewer">
        ${activeTab.key === "hunger-cues" ? renderHungerCuesQuickCardClean() : ""}
        <img src="${escapeAttr(activeTab.image)}" alt="${escapeAttr(activeTab.alt)}">
      </div>
    </section>
  `;
}

function renderHungerCuesQuickCard() {
  const cues = ["Lip smacking", "Hands to mouth", "Rooting (turning head)", "Fussiness", "Crying (late sign)"];
  return `
    <section class="hunger-cues-quick" aria-label="Hunger cues quick guide">
      <div class="hunger-cues-copy">
        <h4>Hunger Cues</h4>
        <p>(Watch for early signs)</p>
        <ul>
          ${cues.map((cue) => `<li><span aria-hidden="true">✓</span>${escapeHtml(cue)}</li>`).join("")}
        </ul>
      </div>
      <div class="hunger-cues-bottle" aria-hidden="true">
        <div class="bottle-cap"></div>
        <div class="bottle-body">
          <span></span><span></span><span></span>
        </div>
      </div>
    </section>
  `;
}

function renderBabyCriesCard() {
  const steps = [
    { icon: "🍼", label: "Hungry?", note: "Time to feed" },
    { icon: "🧷", label: "Wet diaper?", note: "Check and change" },
    { icon: "👶", label: "Need burp?", note: "Burp gently" },
    { icon: "🌡", label: "Too hot/cold?", note: "Adjust clothes or temperature" },
    { icon: "💤", label: "Overtired?", note: "Too much stimulation" },
    { icon: "➕", label: "Sick?", note: "Pain, illness, or discomfort" }
  ];
  const soothing = ["Hold close (skin-to-skin)", "White noise", "Walk or gentle movement", "Shush (loud \"shhh\")", "Swaddle (if not rolling)", "Dim lights"];

  return `
    <section class="baby-cries-card" aria-label="Baby cries algorithm">
      <div class="baby-cries-title">
        <span>4</span>
        <strong>Baby cries?</strong>
      </div>
      <div class="baby-cries-body">
        <div class="baby-cries-flow">
          ${steps.map((step, index) => `
            <div class="baby-cries-step">
              <span class="baby-cries-number">${index + 1}</span>
              <div class="baby-cries-icon" aria-hidden="true">${step.icon}</div>
              <strong>${escapeHtml(step.label)}</strong>
              <p>${escapeHtml(step.note)}</p>
            </div>
          `).join("")}
        </div>
        <aside class="baby-cries-soothe">
          <h4>Still crying?</h4>
          <p>Try soothing techniques:</p>
          <ul>
            ${soothing.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
          <small>Crying is communication, not manipulation.</small>
        </aside>
      </div>
      <p class="baby-cries-note"><strong>Remember:</strong> Witching hour (evening fussiness) is normal. Peaks around 6-8 weeks and improves.</p>
    </section>
  `;
}

function renderSleepCheatsheetImage(issue) {
  return renderCareCheatsheetImage(issue, "/assets/care/sleep-cheatsheet.png", "Baby sleep cheatsheet");
}

function renderHungerCuesQuickCardClean() {
  const cues = ["Lip smacking", "Hands to mouth", "Rooting (turning head)", "Fussiness", "Crying (late sign)"];
  return `
    <section class="hunger-cues-quick" aria-label="Hunger cues quick guide">
      <div class="hunger-cues-copy">
        <h4>Hunger Cues</h4>
        <p>(Watch for early signs)</p>
        <ul>
          ${cues.map((cue) => `<li><span aria-hidden="true">&#10003;</span>${escapeHtml(cue)}</li>`).join("")}
        </ul>
      </div>
      <div class="hunger-cues-bottle" aria-hidden="true">
        <div class="bottle-cap"></div>
        <div class="bottle-body">
          <span></span><span></span><span></span>
        </div>
      </div>
    </section>
  `;
}

function renderBabyCriesCardClean() {
  const steps = [
    { icon: "&#127868;", label: "Hungry?", note: "Time to feed" },
    { icon: "&#129527;", label: "Wet diaper?", note: "Check and change" },
    { icon: "&#128118;", label: "Need burp?", note: "Burp gently" },
    { icon: "&#127777;", label: "Too hot/cold?", note: "Adjust clothes or temperature" },
    { icon: "Zz", label: "Overtired?", note: "Too much stimulation" },
    { icon: "&#9877;", label: "Sick?", note: "Pain, illness, or discomfort" }
  ];
  const soothing = ["Hold close (skin-to-skin)", "White noise", "Walk or gentle movement", "Shush (loud \"shhh\")", "Swaddle (if not rolling)", "Dim lights"];

  return `
    <section class="baby-cries-card" aria-label="Baby cries algorithm">
      <div class="baby-cries-title">
        <strong>Baby cries?</strong>
      </div>
      <div class="baby-cries-body">
        <div class="baby-cries-flow">
          ${steps.map((step, index) => `
            <div class="baby-cries-step" style="--step-index: ${index}">
              <span class="baby-cries-number">${index + 1}</span>
              <div class="baby-cries-icon" aria-hidden="true">${step.icon}</div>
              <strong>${escapeHtml(step.label)}</strong>
              <p>${escapeHtml(step.note)}</p>
            </div>
          `).join("")}
        </div>
        <aside class="baby-cries-soothe">
          <h4>Still crying?</h4>
          <p>Try soothing techniques:</p>
          <ul>
            ${soothing.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
          <small>Crying is communication, not manipulation.</small>
        </aside>
      </div>
      <p class="baby-cries-note"><strong>Remember:</strong> Witching hour (evening fussiness) is normal. Peaks around 6-8 weeks and improves.</p>
    </section>
  `;
}

function renderCareCheatsheetImage(issue, imagePath, altText) {
  return `
    <section class="care-detail">
      <button class="ghost care-back-button" type="button" data-care-back>Back to Care</button>
      <div class="care-detail-hero" style="--card-image: url('${careHeaderImage(issue.header)}')">
        <h3>${escapeHtml(issue.title)}</h3>
        <p>${escapeHtml(issue.helper)}</p>
      </div>
      <div class="care-image-viewer">
        <img src="${escapeAttr(imagePath)}" alt="${escapeAttr(altText)}">
      </div>
    </section>
  `;
}

function careHeaderImage(header) {
  return `/assets/care/${header}.png`;
}

function cardActionConfirmKey(button) {
  return `${button.dataset.card || ""}:${button.dataset.actionLabel || ""}`;
}

function resetPendingCardAction() {
  const pending = state.pendingActionConfirm;
  if (!pending) return;
  clearTimeout(pending.timer);
  pending.button?.classList.remove("awaiting-confirmation");
  pending.button?.removeAttribute("data-confirming");
  state.pendingActionConfirm = null;
}

function confirmCardAction(button) {
  const key = cardActionConfirmKey(button);
  const pending = state.pendingActionConfirm;
  if (pending?.key === key && pending.button === button) {
    resetPendingCardAction();
    return true;
  }

  resetPendingCardAction();
  button.classList.add("awaiting-confirmation");
  button.dataset.confirming = "true";
  showToast(`${button.dataset.actionLabel || "Action"}: tap again to confirm.`);
  state.pendingActionConfirm = {
    key,
    button,
    timer: setTimeout(resetPendingCardAction, 1800)
  };
  return false;
}

function renderMilestones() {
  const next = nextExpectedMilestone();
  const nextCard = document.getElementById("next-milestone-card");
  if (nextCard) nextCard.innerHTML = renderNextMilestone(next);

  const major = document.getElementById("major-milestones");
  if (major) major.innerHTML = milestoneRecords(1).map((milestone, index, list) => renderMilestoneCard(milestone, next?.id, index, list.length)).join("");

  const supporting = document.getElementById("supporting-milestones");
  if (supporting) supporting.innerHTML = milestoneRecords(2).map((milestone, index, list) => renderMilestoneCard(milestone, next?.id, index, list.length)).join("");

  const exerciseContainer = document.getElementById("exercise-library");
  if (exerciseContainer) exerciseContainer.innerHTML = exerciseLibrary().map(renderExerciseCard).join("");

  document.querySelectorAll("[data-milestone-id]").forEach((button) => {
    button.addEventListener("click", () => openMilestoneDialog(button.dataset.milestoneId));
  });
  document.querySelectorAll("[data-exercise-card]").forEach((card) => {
    card.addEventListener("click", () => card.classList.remove("spotlight"));
  });
}

function milestoneRecords(level) {
  return milestoneDefinitions()
    .filter((milestone) => milestone.level === level)
    .sort((a, b) => a.ageStartWeeks - b.ageStartWeeks)
    .map(mergeMilestoneProgress);
}

function mergeMilestoneProgress(milestone) {
  const progress = state.milestoneProgress[milestone.id] || {};
  const status = normalizeMilestoneStatus(progress.state || progress.status || defaultMilestoneStatus(milestone));
  return {
    ...milestone,
    state: status,
    status,
    achievedDate: progress.achievedDate || null,
    confirmedAt: progress.confirmedAt || null,
    changedDate: progress.changedDate || progress.confirmedAt || progress.achievedDate || null,
    notes: progress.notes || ""
  };
}

function defaultMilestoneStatus(milestone) {
  return "Not Yet";
}

function renderMilestoneCard(milestone, nextId, index = 0, count = 1) {
  const isNext = milestone.id === nextId;
  const isFirst = index === 0;
  const isLast = index === count - 1;
  return `
    <button class="milestone-card ${statusClass(milestone.status)} ${isNext ? "next" : ""} ${isFirst ? "first" : ""} ${isLast ? "last" : ""}" type="button" data-milestone-id="${escapeAttr(milestone.id)}" aria-label="${escapeAttr(`${milestone.name}, ${displayAgeLabel(milestone)}, ${milestone.status}`)}">
      <span class="milestone-icon-wrap">
        <img src="${milestoneIconPath(milestone)}" alt="">
        ${milestone.status === "Confirmed" ? `<span class="milestone-check" aria-hidden="true">&#10003;</span>` : ""}
      </span>
      <span class="milestone-card-copy">
        <strong>${escapeHtml(milestone.name)}</strong>
        <small>${escapeHtml(displayAgeLabel(milestone))}</small>
        <span class="status-pill ${statusClass(milestone.status)}">${escapeHtml(milestone.status)}</span>
      </span>
    </button>
  `;
  container.querySelectorAll("[data-help-text]").forEach((button) => {
    button.addEventListener("click", () => showToast(button.dataset.helpText || ""));
  });
}

function renderNextMilestone(milestone) {
  if (!milestone) {
    return `<div><h3>Next Expected Milestone</h3><p>All listed milestones are achieved.</p></div>`;
  }

  const recommendations = recommendedExercisesForMilestone(milestone);
  return `
    <button class="next-milestone-button" type="button" data-milestone-id="${escapeAttr(milestone.id)}">
      <img src="${milestoneIconPath(milestone)}" alt="">
      <span>
        <small>Next Expected Milestone</small>
        <strong>${escapeHtml(milestone.name)}</strong>
        <em>${escapeHtml(displayAgeLabel(milestone))}</em>
        <span>${recommendations.length ? escapeHtml(recommendations.map((exercise) => exercise.name).join(", ")) : "Practice through everyday play."}</span>
      </span>
    </button>
  `;
}

function renderExerciseCard(exercise) {
  return `
    <article class="exercise-card" id="exercise-${escapeAttr(exercise.id)}" data-exercise-card="${escapeAttr(exercise.id)}" tabindex="-1">
      <h4>${escapeHtml(exercise.name)}</h4>
      ${renderExerciseGroup("Purpose", exercise.purpose)}
      ${renderExerciseGroup("Timing", exercise.timing)}
      ${renderExerciseGroup("Recommended amount", exercise.recommendedAmount)}
      ${renderExerciseGroup("Safety", exercise.safety)}
      ${renderExerciseGroup("Methods", exercise.methods)}
      ${renderExerciseGroup("Supports milestones", exercise.supportsMilestones)}
    </article>
  `;
}

function renderExerciseGroup(label, items) {
  if (!items.length) return "";
  return `
    <div>
      <strong>${escapeHtml(label)}</strong>
      <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
  `;
  detail.innerHTML = `
    <img src="${escapeAttr(category.icon)}" alt="">
    <div>
      <strong>${escapeHtml(category.label)} - ${escapeHtml(duration)}${active ? " so far" : ""}</strong>
      <span>${escapeHtml(formatDisplayDate(startLog.date))} - ${escapeHtml(formatLogClock(startLog))} to ${escapeHtml(endLabel)}</span>
    </div>
  `;
}

function nextExpectedMilestone() {
  return milestoneDefinitions().map(mergeMilestoneProgress).find((milestone) => milestone.status !== "Confirmed") || null;
}

function openMilestoneDialog(id) {
  const definition = milestoneDefinitions().find((item) => item.id === id);
  if (!definition) return;
  const milestone = mergeMilestoneProgress(definition);

  state.selectedMilestoneId = id;
  const dialog = document.getElementById("milestone-dialog");
  document.getElementById("milestone-dialog-content").innerHTML = renderMilestoneDialog(milestone);
  dialog.querySelectorAll("[data-milestone-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      updateMilestoneStatus(milestone.id, button.dataset.milestoneAction, dialog.querySelector("[data-milestone-notes]")?.value || "");
    });
  });
  dialog.querySelectorAll("[data-exercise-open]").forEach((button) => {
    button.addEventListener("click", () => openExerciseEntry(button.dataset.exerciseOpen));
  });
  if (!dialog.open) dialog.showModal();
}

function renderMilestoneDialog(milestone) {
  const recommendations = recommendedExercisesForMilestone(milestone);
  const behavior = milestoneBehaviorDescriptions()[milestone.id] || [];
  const exercises = milestoneExercises(milestone);
  return `
    <div class="milestone-dialog-hero">
      <img src="${milestoneIconPath(milestone)}" alt="">
      <div>
        <span class="status-pill ${statusClass(milestone.status)}">${escapeHtml(milestone.status)}</span>
        <h3>${escapeHtml(milestone.name)}</h3>
        <p>Level ${milestone.level} &bull; ${escapeHtml(displayAgeLabel(milestone))}</p>
      </div>
    </div>
    <div class="milestone-dialog-body">
      <div>
        <strong>Milestone Information</strong>
        <p>${escapeHtml(milestoneStateMessages()[milestone.status] || "")}</p>
      </div>
      ${behavior.length ? renderExerciseGroup("Baby Behavior Description", behavior) : ""}
      ${exercises.length ? renderExerciseGroup("Exercises", exercises) : ""}
      ${recommendations.length ? renderExerciseLinks("Exercise Library", recommendations) : ""}
      ${milestone.changedDate ? `<p class="achieved-note">Last changed on ${escapeHtml(formatDisplayDate(milestone.changedDate))}</p>` : ""}
      <label class="milestone-notes">
        <strong>Notes</strong>
        <textarea data-milestone-notes rows="3" placeholder="Optional parent notes">${escapeHtml(milestone.notes)}</textarea>
      </label>
    </div>
    <div class="modal-actions milestone-actions">
      ${milestoneStates.map((stateName) => `<button class="${stateName === milestone.status ? "primary" : "ghost"}" type="button" data-milestone-action="${escapeAttr(stateName)}">${escapeHtml(stateName)}</button>`).join("")}
    </div>
  `;
}

async function updateMilestoneStatus(id, action, notes = "") {
  const now = new Date().toISOString();
  const stateName = normalizeMilestoneStatus(action);
  const payload = {
    milestoneId: id,
    state: stateName,
    status: stateName,
    changedDate: now,
    achievedDate: stateName === "Confirmed" ? todayString() : null,
    confirmedAt: stateName === "Confirmed" ? now : null,
    notes
  };

  try {
    const result = await fetchJson(`/api/milestones/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    state.milestoneProgress = result.milestone_progress || result.milestones || {};
    document.getElementById("milestone-dialog").close();
    renderMilestones();
    showReaction(payload.status === "Confirmed" ? "Milestone confirmed" : "Milestone saved", milestoneName(id));
  } catch (error) {
    showToast(`Could not save milestone: ${error.message}`);
  }
}

function recommendedExercisesForMilestone(milestone) {
  return exerciseLibrary()
    .filter((exercise) => exercise.supportsMilestones.includes(milestone.name))
    .slice(0, 4);
}

function milestoneExercises(milestone) {
  return (milestone.exercises.length ? milestone.exercises : supportingMilestoneExercises()[milestone.id] || []).slice(0, 5);
}

function renderExerciseLinks(label, exercises) {
  return `
    <div>
      <strong>${escapeHtml(label)}</strong>
      <div class="exercise-link-list">
        ${exercises.map((exercise) => `<button type="button" data-exercise-open="${escapeAttr(exercise.id)}">${escapeHtml(exercise.name)}</button>`).join("")}
      </div>
    </div>
  `;
}

function openExerciseEntry(id) {
  const dialog = document.getElementById("milestone-dialog");
  if (dialog.open) dialog.close();
  const card = document.getElementById(`exercise-${id}`);
  if (!card) return;
  card.classList.add("spotlight");
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.focus({ preventScroll: true });
}

function normalizeMilestoneStatus(status) {
  if (milestoneStates.includes(status)) return status;
  return legacyMilestoneStatus[status] || "Not Yet";
}

function babyAgeWeeks() {
  const birthday = state.profile.birthday;
  if (!birthday) return NaN;
  const birth = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return NaN;
  return Math.floor((Date.now() - birth.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function babyAgeMonths() {
  const days = babyAgeDays();
  if (!Number.isFinite(days)) return NaN;
  return days / 30.4375;
}

function displayAgeLabel(milestone) {
  return String(milestone.ageLabel || "").replaceAll("â€“", "-").replaceAll("–", "-");
}

function formatDisplayDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function milestoneIconPath(milestone) {
  return `/icons/milestones/${milestone.iconFile}?v=20260530-astronaut`;
}

function milestoneName(id) {
  return milestoneDefinitions().find((milestone) => milestone.id === id)?.name || "Milestone";
}

function statusClass(status) {
  return normalizeMilestoneStatus(status).toLowerCase().replace(/\s+/g, "-");
}

function openActivityLogs(cardKey) {
  state.activeLogsCard = cardKey;
  const activity = activities.find((item) => item.key === cardKey);
  const dialog = document.getElementById("activity-logs-dialog");
  const list = document.getElementById("activity-logs-list");
  document.getElementById("activity-logs-title").textContent = `${activity?.title || "Activity"} today`;

  const logs = logsForActivityCard(cardKey)
    .filter((log) => log.date === todayString())
    .sort((a, b) => logTime(b) - logTime(a));

  list.innerHTML = logs.length ? logs.map((log) => `
    ${renderActivityLogRow(log, cardKey)}
  `).join("") : `<p class="empty-state">No logs today.</p>`;

  list.querySelectorAll("[data-edit-log]").forEach((button) => {
    button.addEventListener("click", () => startActivityLogEdit(button.dataset.editLog, cardKey));
  });
  list.querySelectorAll("[data-delete-log]").forEach((button) => {
    button.addEventListener("click", () => deleteLog(button.dataset.deleteLog, cardKey));
  });

  if (!dialog.open) dialog.showModal();
}

function cardHeaderImage(key) {
  const versions = {
    boobie: "20260530-boobie-baby"
  };
  const files = {
    growth: "gym"
  };
  const fileKey = files[key] || key;
  return `/assets/activity/header-${fileKey}.png${versions[key] ? `?v=${versions[key]}` : ""}`;
}

function renderActivityLogRow(log, cardKey) {
  return `
    <div class="activity-log-row" data-log-row="${escapeAttr(log.id)}">
      <img class="activity-log-icon" src="${activityIconForLog(log, cardKey)}" alt="">
      <div class="activity-log-body">
        <span>${formatLogClock(log)}</span>
        <strong>${escapeHtml(labelForLog(log))}</strong>
        ${log.notes ? `<small>${escapeHtml(log.notes)}</small>` : ""}
      </div>
      ${renderLogMenu(log, cardKey)}
    </div>
  `;
}

function renderLogMenu(log, cardKey = "") {
  const editAttr = cardKey
    ? `data-edit-log="${escapeAttr(log.id)}" data-card-key="${escapeAttr(cardKey)}"`
    : `data-history-edit="${escapeAttr(log.id)}"`;
  const cardAttr = cardKey ? ` data-card-key="${escapeAttr(cardKey)}"` : "";
  return `
    <details class="log-row-menu">
      <summary aria-label="Log actions">...</summary>
      <div class="log-row-menu-panel">
        <button type="button" ${editAttr}>Edit</button>
        <button class="danger-menu-button" type="button" data-delete-log="${escapeAttr(log.id)}"${cardAttr}>
          <span aria-hidden="true">&#128465;</span>
          Delete
        </button>
      </div>
    </details>
  `;
}

function startActivityLogEdit(logId, cardKey) {
  const log = state.logs.find((item) => item.id === logId);
  const row = Array.from(document.querySelectorAll("[data-log-row]")).find((item) => item.dataset.logRow === logId);
  if (!log || !row) return;

  row.innerHTML = `
    <img class="activity-log-icon" src="${activityIconForLog(log, cardKey)}" alt="">
    <form class="activity-log-edit-form" data-log-edit-form="${escapeAttr(log.id)}">
      <label>
        Time
        <input name="time" type="time" value="${escapeAttr(log.time || "")}">
      </label>
      <label class="activity-log-notes-field">
        Notes
        <input name="notes" type="text" value="${escapeAttr(log.notes || "")}">
      </label>
      <div class="activity-log-edit-actions">
        <button class="primary" type="submit">Done</button>
      </div>
      <p class="activity-log-edit-status" aria-live="polite"></p>
    </form>
  `;

  row.querySelector("form").addEventListener("submit", (event) => saveActivityLogEdit(event, log, cardKey));
  row.querySelector("[type='submit']").addEventListener("click", (event) => {
    event.preventDefault();
    saveActivityLogEdit(event, log, cardKey);
  });
}

async function saveActivityLogEdit(event, log, cardKey) {
  event.preventDefault();
  event.stopPropagation();
  const form = event.currentTarget.closest("form") || event.currentTarget.form;
  const status = form.querySelector(".activity-log-edit-status");
  const data = Object.fromEntries(new FormData(form).entries());
  const conflict = transitionConflict({ ...log, ...data }, log.id);
  if (conflict) {
    status.textContent = conflict;
    return;
  }
  status.textContent = "Saving...";

  try {
    const result = await fetchJson(`/api/logs/${encodeURIComponent(log.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ time: data.time, notes: data.notes })
    });

    const index = state.logs.findIndex((item) => item.id === result.log.id);
    if (index !== -1) state.logs[index] = result.log;
    state.recent = result.recent;
    state.summary = result.todaySummary;
    renderAll();
    openActivityLogs(cardKey);
    showReaction("Log updated", labelForLog(result.log));
  } catch (error) {
    status.textContent = `Save failed: ${error.message}`;
  }
}

function activityIconForLog(log, cardKey) {
  const icons = {
    sleep: log.status === "awake" ? "awake" : "asleep",
    feeding: log.side === "right" ? "right" : "left",
    bottle: "bottle",
    routine: `routine-${log.routine || "morning"}`,
    diaper: log.poop ? "poop" : "pee",
    growth_stats: readHeightMm(log) > 0 && readWeightGrams(log) <= 0 ? "height" : "weight",
    bath: "bath",
    tummy_time: log.status === "end" ? "tummy-end" : "tummy-start",
    outdoor_time: log.status === "end" ? "outdoor-end" : "outdoor-start",
    baby_gym: "gym"
  };
  const fallbackByCard = {
    boobie: "left",
    gym: "gym",
    tummy: "tummy-start",
    outdoor: "outdoor-start",
    growth: "weight"
  };
  return `/assets/activity/icon-${icons[log.type] || fallbackByCard[cardKey] || "success"}.png`;
}

function logsForActivityCard(cardKey) {
  const filters = {
    sleep: (log) => log.type === "sleep",
    boobie: (log) => log.type === "feeding" && log.method === "breast",
    bottle: (log) => log.type === "bottle",
    routine: (log) => log.type === "routine",
    diaper: (log) => log.type === "diaper",
    growth: (log) => log.type === "growth_stats",
    bath: (log) => log.type === "bath",
    tummy: (log) => log.type === "tummy_time",
    outdoor: (log) => log.type === "outdoor_time",
    gym: (log) => log.type === "baby_gym"
  };
  const matches = filters[cardKey] || (() => false);
  return state.logs.filter(matches);
}

function eventTypeFilterDropdownMarkup(selectedTypes = ["all"]) {
  return `
    <details class="event-type-dropdown">
      <summary>
        <span data-event-type-summary>${escapeHtml(eventTypeSummaryLabel(selectedTypes))}</span>
      </summary>
      <div class="event-type-menu">
        ${historyEventTypes.map((type) => `
          <label>
            <input type="checkbox" value="${escapeAttr(type.value)}" ${selectedTypes.includes(type.value) ? "checked" : ""}>
            ${escapeHtml(type.label)}
          </label>
        `).join("")}
      </div>
    </details>
  `;
}

function eventTypeSummaryLabel(selectedTypes = ["all"]) {
  if (selectedTypes.includes("all")) return "All event types";
  if (selectedTypes.length === 1) {
    return historyEventTypes.find((type) => type.value === selectedTypes[0])?.label || "1 event type";
  }
  return `${selectedTypes.length} event types`;
}

function updateEventTypeDropdownSummary(container, selectedTypes) {
  const summary = container?.querySelector("[data-event-type-summary]");
  if (summary) summary.textContent = eventTypeSummaryLabel(selectedTypes);
}

function setupHistoryFilters() {
  const form = document.getElementById("history-filters");
  const typeContainer = document.getElementById("history-type-filters");
  if (!form || !typeContainer) return;

  typeContainer.innerHTML = eventTypeFilterDropdownMarkup(state.historyFilters.types || ["all"]);

  document.getElementById("history-start-date").addEventListener("change", updateHistoryFilters);
  document.getElementById("history-end-date").addEventListener("change", updateHistoryFilters);
  typeContainer.addEventListener("change", updateHistoryFilters);
}

function updateHistoryFilters(event) {
  const typeContainer = document.getElementById("history-type-filters");
  const boxes = Array.from(typeContainer.querySelectorAll("input[type='checkbox']"));
  const allBox = boxes.find((box) => box.value === "all");
  let selected = boxes.filter((box) => box.checked).map((box) => box.value);

  if (event?.target?.value === "all" && event.target.checked) {
    boxes.forEach((box) => {
      box.checked = box.value === "all";
    });
    selected = ["all"];
  } else if (event?.target?.value !== "all") {
    if (allBox) allBox.checked = false;
    selected = boxes.filter((box) => box.checked && box.value !== "all").map((box) => box.value);
    if (!selected.length && allBox) {
      allBox.checked = true;
      selected = ["all"];
    }
  }
  if (!selected.length && allBox) {
    allBox.checked = true;
    selected = ["all"];
  }

  state.historyFilters = {
    startDate: document.getElementById("history-start-date")?.value || "",
    endDate: document.getElementById("history-end-date")?.value || "",
    types: selected.includes("all") ? ["all"] : selected
  };
  updateEventTypeDropdownSummary(typeContainer, state.historyFilters.types);
  renderHistory();
}

function setupDashboardFilters() {
  const form = document.getElementById("dashboard-filters");
  const typeContainer = document.getElementById("dashboard-type-filters");
  if (!form || !typeContainer) return;

  typeContainer.innerHTML = eventTypeFilterDropdownMarkup(state.dashboardFilters.types || ["all"]);

  const mode = document.getElementById("dashboard-range-mode");
  const start = document.getElementById("dashboard-start-date");
  const end = document.getElementById("dashboard-end-date");
  syncDashboardDateInputs();

  mode.addEventListener("change", () => {
    state.dashboardFilters.rangeMode = mode.value;
    applyDashboardPreset(mode.value);
    resetDashboardViewWindow();
    syncDashboardDateInputs();
    renderDashboard();
  });

  [start, end].forEach((input) => {
    input.addEventListener("change", () => {
      state.dashboardFilters.rangeMode = "custom";
      state.dashboardFilters.startDate = start.value || todayString();
      state.dashboardFilters.endDate = end.value || state.dashboardFilters.startDate;
      resetDashboardViewWindow();
      syncDashboardDateInputs();
      renderDashboard();
    });
  });

  typeContainer.addEventListener("change", updateDashboardTypeFilters);
  document.getElementById("dashboard-zoom-in")?.addEventListener("click", () => updateDashboardZoom(2));
  document.getElementById("dashboard-zoom-out")?.addEventListener("click", () => updateDashboardZoom(0.5));
  document.getElementById("dashboard-zoom-reset")?.addEventListener("click", () => {
    resetDashboardViewWindow();
    renderDashboard();
  });
  setupDashboardTouchZoom();
}

function updateDashboardZoom(multiplier) {
  const visible = dashboardVisibleRangeMs();
  const center = visible.startTime + visible.span / 2;
  setDashboardVisibleWindow(center - (visible.span / multiplier) / 2, center + (visible.span / multiplier) / 2);
  renderDashboard();
}

function setupDashboardTouchZoom() {
  const chart = document.getElementById("dashboard-chart");
  if (!chart) return;
  let pinch = null;
  let drag = null;

  chart.addEventListener("touchstart", (event) => {
    if (event.touches.length === 2) {
      const midpoint = touchMidpoint(event.touches);
      const visible = dashboardVisibleRangeMs();
      pinch = {
        distance: touchDistance(event.touches),
        span: visible.span,
        anchorRatio: chartXToRatio(midpoint.x),
        anchorTime: visible.startTime + chartXToRatio(midpoint.x) * visible.span
      };
      drag = null;
      chart.classList.add("pinching");
    } else if (event.touches.length === 1) {
      const visible = dashboardVisibleRangeMs();
      drag = { x: event.touches[0].clientX, startTime: visible.startTime, endTime: visible.endTime, span: visible.span };
    }
  }, { passive: true });

  chart.addEventListener("touchmove", (event) => {
    if (pinch && event.touches.length === 2) {
      event.preventDefault();
      const distance = touchDistance(event.touches);
      const scale = distance / Math.max(1, pinch.distance);
      const nextSpan = pinch.span / Math.max(0.1, scale);
      const nextStart = pinch.anchorTime - pinch.anchorRatio * nextSpan;
      setDashboardVisibleWindow(nextStart, nextStart + nextSpan);
      renderDashboard();
    } else if (drag && event.touches.length === 1) {
      const visible = dashboardVisibleRangeMs();
      if (visible.zoom <= 1.01) return;
      event.preventDefault();
      const deltaX = event.touches[0].clientX - drag.x;
      const deltaTime = -(deltaX / dashboardRenderedPlotWidth()) * drag.span;
      setDashboardVisibleWindow(drag.startTime + deltaTime, drag.endTime + deltaTime);
      renderDashboard();
    }
  }, { passive: false });

  chart.addEventListener("touchend", (event) => {
    if (event.touches.length < 2) {
      pinch = null;
      chart.classList.remove("pinching");
    }
    if (event.touches.length === 0) drag = null;
  }, { passive: true });
}

function touchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function touchMidpoint(touches) {
  const chart = document.getElementById("dashboard-chart");
  const rect = chart.getBoundingClientRect();
  return {
    x: ((touches[0].clientX + touches[1].clientX) / 2) - rect.left,
    y: ((touches[0].clientY + touches[1].clientY) / 2) - rect.top
  };
}

function chartXToRatio(x) {
  return Math.min(1, Math.max(0, (x - dashboardPlotLeft) / dashboardRenderedPlotWidth()));
}

function dashboardRenderedPlotWidth() {
  return dashboardPlotBaseWidth * Math.max(1, Math.min(3, dashboardVisibleRangeMs().zoom || 1));
}

function dashboardSelectedRangeMs() {
  const filters = state.dashboardFilters || {};
  const startDate = filters.startDate || todayString();
  const endDate = filters.endDate || startDate;
  const [start, end] = startDate <= endDate ? [startDate, endDate] : [endDate, startDate];
  const startTime = new Date(`${start}T00:00:00`).getTime();
  const endTime = new Date(`${end}T23:59:59`).getTime();
  return { start, end, startTime, endTime, span: Math.max(1, endTime - startTime) };
}

function dashboardVisibleRangeMs() {
  const selected = dashboardSelectedRangeMs();
  const filters = state.dashboardFilters || {};
  const maxZoomWindow = selected.span / dashboardMaxZoom;
  const minSpan = Math.min(selected.span, Math.max(dashboardMinWindowMs, maxZoomWindow));
  const hasWindow = Number.isFinite(filters.viewStartMs) && Number.isFinite(filters.viewEndMs);
  if (!hasWindow) return { ...selected, zoom: 1 };
  const startTime = Math.max(selected.startTime, filters.viewStartMs);
  const endTime = Math.min(selected.endTime, Math.max(filters.viewEndMs, startTime + minSpan));
  const span = Math.max(minSpan, endTime - startTime);
  return { ...selected, startTime, endTime: Math.min(selected.endTime, startTime + span), span, zoom: selected.span / span };
}

function setDashboardVisibleWindow(startTime, endTime) {
  const selected = dashboardSelectedRangeMs();
  const minSpan = Math.min(selected.span, Math.max(dashboardMinWindowMs, selected.span / dashboardMaxZoom));
  const span = Math.min(selected.span, Math.max(minSpan, endTime - startTime));
  let nextStart = startTime;
  let nextEnd = startTime + span;
  if (nextStart < selected.startTime) {
    nextStart = selected.startTime;
    nextEnd = nextStart + span;
  }
  if (nextEnd > selected.endTime) {
    nextEnd = selected.endTime;
    nextStart = nextEnd - span;
  }
  state.dashboardFilters.viewStartMs = nextStart <= selected.startTime && nextEnd >= selected.endTime ? null : nextStart;
  state.dashboardFilters.viewEndMs = nextStart <= selected.startTime && nextEnd >= selected.endTime ? null : nextEnd;
}

function resetDashboardViewWindow() {
  state.dashboardFilters.viewStartMs = null;
  state.dashboardFilters.viewEndMs = null;
}

function applyDashboardPreset(mode) {
  const today = todayString();
  if (mode === "week") {
    state.dashboardFilters.startDate = addDays(today, -6);
    state.dashboardFilters.endDate = today;
  } else if (mode === "month") {
    state.dashboardFilters.startDate = addDays(today, -29);
    state.dashboardFilters.endDate = today;
  } else if (mode === "day") {
    state.dashboardFilters.startDate = today;
    state.dashboardFilters.endDate = today;
  }
}

function syncDashboardDateInputs() {
  const filters = state.dashboardFilters;
  const startDate = filters.startDate || todayString();
  const endDate = filters.endDate || startDate;
  const mode = document.getElementById("dashboard-range-mode");
  const start = document.getElementById("dashboard-start-date");
  const end = document.getElementById("dashboard-end-date");
  if (mode) mode.value = filters.rangeMode || "day";
  if (start && document.activeElement !== start) start.value = startDate;
  if (end && document.activeElement !== end) end.value = endDate;
}

function updateDashboardTypeFilters(event) {
  const typeContainer = document.getElementById("dashboard-type-filters");
  const boxes = Array.from(typeContainer.querySelectorAll("input[type='checkbox']"));
  const allBox = boxes.find((box) => box.value === "all");
  let selected = boxes.filter((box) => box.checked).map((box) => box.value);

  if (event?.target?.value === "all" && event.target.checked) {
    boxes.forEach((box) => {
      box.checked = box.value === "all";
    });
    selected = ["all"];
  } else if (event?.target?.value !== "all") {
    if (allBox) allBox.checked = false;
    selected = boxes.filter((box) => box.checked && box.value !== "all").map((box) => box.value);
    if (!selected.length && allBox) {
      allBox.checked = true;
      selected = ["all"];
    }
  }
  if (!selected.length && allBox) {
    allBox.checked = true;
    selected = ["all"];
  }

  state.dashboardFilters.types = selected.includes("all") ? ["all"] : selected;
  updateEventTypeDropdownSummary(typeContainer, state.dashboardFilters.types);
  renderDashboard();
}

function setupSettingsPanel() {
  document.getElementById("profile-form").addEventListener("submit", saveProfile);
  document.getElementById("overview-settings-form").addEventListener("submit", saveOverviewSettings);
  document.getElementById("overview-review-mode").addEventListener("change", () => {
    syncOverviewSettingsVisibility(document.getElementById("overview-review-mode").value);
  });
  document.getElementById("bath-reminder-form").addEventListener("submit", saveBathReminder);
  document.getElementById("tummy-reminder-form").addEventListener("submit", saveTummyReminder);
  document.getElementById("reminder-voice-select").addEventListener("change", saveReminderVoice);
  document.getElementById("settings-weight-unit").addEventListener("change", saveSettingsWeightUnit);
  document.getElementById("settings-height-unit").addEventListener("change", saveSettingsHeightUnit);
  document.getElementById("test-reminder-voice").addEventListener("click", testReminderVoice);
  document.getElementById("generate-analytics-button").addEventListener("click", generateAnalyticsJson);
  document.getElementById("generate-trends-button").addEventListener("click", generateTrendJson);
  document.getElementById("clear-data-button").addEventListener("click", clearData);
}

function setupQuizPanel() {
  const panel = document.getElementById("quiz-panel");
  if (!panel) return;

  panel.addEventListener("change", (event) => {
    const quiz = state.quiz;
    if (event.target.id === "quiz-set-select") quiz.selectedSetId = event.target.value;
    if (event.target.id === "quiz-count-select") quiz.questionCount = Number(event.target.value);
    if (event.target.id === "quiz-timer-select") {
      quiz.timerDuration = Math.min(20, Math.max(0, Number(event.target.value)));
      if (quiz.status === "active") startQuizTimer();
    }
    renderQuiz();
  });

  panel.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.dataset.quizAction === "get") startQuiz();
    if (target.dataset.quizAction === "sound") toggleQuizSound();
    if (target.dataset.quizChoice) selectQuizAnswer(target.dataset.quizChoice);
    if (target.dataset.quizAction === "next") nextQuizQuestion();
    if (target.dataset.quizAction === "restart") resetQuizSession();
  });
}

async function startQuiz() {
  const quiz = state.quiz;
  const set = quizSets.find((item) => item.id === quiz.selectedSetId) || quizSets[0];
  stopQuizTimer();
  quiz.status = "loading";
  quiz.error = "";
  quiz.set = set;
  renderQuiz();

  try {
    const data = await fetchJson(set.jsonPath);
    const questions = normalizeQuizQuestions(data);
    if (!questions.length) throw new Error("This quiz set has no questions.");
    quiz.questions = shuffleArray(questions).slice(0, Math.min(quiz.questionCount, questions.length));
    quiz.currentIndex = 0;
    quiz.selectedChoiceId = null;
    quiz.result = null;
    quiz.score = 0;
    quiz.answered = 0;
    quiz.correct = 0;
    quiz.status = "active";
    startQuizTimer();
  } catch (error) {
    quiz.status = "idle";
    quiz.error = `Could not load quiz: ${error.message}`;
  }
  renderQuiz();
}

function normalizeQuizQuestions(data) {
  const rawQuestions = Array.isArray(data) ? data : data.questions || data.items || [];
  return rawQuestions.map((item, index) => normalizeQuizQuestion(item, index)).filter(Boolean);
}

function normalizeQuizQuestion(item, index) {
  if (!item || typeof item !== "object") return null;
  const choicesSource = Array.isArray(item.choices) ? item.choices : item.answers;
  if (!Array.isArray(choicesSource) || !choicesSource.length) return null;
  const choices = choicesSource.map((choice, choiceIndex) => normalizeQuizChoice(choice, choiceIndex));
  const correctChoiceId = String(
    item.correctChoiceId ||
    item.correct_choice_id ||
    item.correctAnswerId ||
    item.correct_answer_id ||
    item.correct ||
    item.answer ||
    choices.find((choice) => choice.isCorrect)?.id ||
    ""
  );
  const matchingChoice = choices.find((choice) => choice.id === correctChoiceId || choice.text === correctChoiceId);
  return {
    id: String(item.id || `question-${index + 1}`),
    question: String(item.question || item.prompt || item.text || ""),
    scenarioTitle: cleanQuizText(item.scenarioTitle || item.scenario_title),
    scenario: cleanQuizText(item.scenario),
    strategyName: cleanQuizText(item.strategyName || item.strategy_name),
    strategySummary: cleanQuizText(item.strategySummary || item.strategy_summary),
    brainModelLink: cleanQuizText(item.brainModelLink || item.brain_model_link),
    parentScript: normalizeParentScript(item.parentScript || item.parent_script),
    choices,
    correctChoiceId: matchingChoice?.id || correctChoiceId || choices[0].id,
    answerExplanation: String(item.answerExplanation || item.answer_explanation || item.explanation || ""),
    keyTakeaway: String(item.keyTakeaway || item.key_takeaway || item.takeaway || "")
  };
}

function cleanQuizText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeParentScript(value) {
  if (Array.isArray(value)) return value.map(cleanQuizText).filter(Boolean).slice(0, 4);
  const text = cleanQuizText(value);
  return text ? [text] : [];
}

function normalizeQuizChoice(choice, index) {
  if (typeof choice === "string") {
    return { id: String.fromCharCode(97 + index), text: choice, explanation: "", isCorrect: false };
  }
  const id = String(choice.id || choice.key || choice.value || String.fromCharCode(97 + index));
  return {
    id,
    text: String(choice.text || choice.label || choice.answer || ""),
    explanation: String(choice.explanation || choice.reason || ""),
    isCorrect: Boolean(choice.isCorrect || choice.is_correct || choice.correct)
  };
}

function shuffleArray(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function selectQuizAnswer(choiceId) {
  const quiz = state.quiz;
  if (quiz.status !== "active" || quiz.result) return;
  const question = currentQuizQuestion();
  if (!question) return;
  const isCorrect = choiceId === question.correctChoiceId;
  const bonus = isCorrect && quiz.timerDuration > 0 && quiz.timerRemaining > quiz.timerDuration / 2 ? 2 : 0;
  stopQuizTimer();
  quiz.selectedChoiceId = choiceId;
  quiz.result = {
    type: isCorrect ? "correct" : "wrong",
    isCorrect,
    points: isCorrect ? 10 + bonus : 0,
    bonus
  };
  quiz.score += quiz.result.points;
  quiz.answered += 1;
  if (isCorrect) quiz.correct += 1;
  renderQuiz();
}

function handleQuizTimeout() {
  const quiz = state.quiz;
  if (quiz.status !== "active" || quiz.result) return;
  stopQuizTimer();
  quiz.selectedChoiceId = null;
  quiz.result = { type: "timeout", isCorrect: false, points: 0, bonus: 0 };
  quiz.answered += 1;
  renderQuiz();
}

function nextQuizQuestion() {
  const quiz = state.quiz;
  stopQuizTimer();
  if (quiz.currentIndex >= quiz.questions.length - 1) {
    quiz.status = "complete";
    quiz.result = null;
    quiz.selectedChoiceId = null;
    renderQuiz();
    return;
  }
  quiz.currentIndex += 1;
  quiz.selectedChoiceId = null;
  quiz.result = null;
  startQuizTimer();
  renderQuiz();
}

function resetQuizSession() {
  stopQuizTimer();
  Object.assign(state.quiz, {
    status: "idle",
    error: "",
    questions: [],
    currentIndex: 0,
    selectedChoiceId: null,
    result: null,
    score: 0,
    answered: 0,
    correct: 0,
    timerRemaining: 0,
    timerStartedAt: 0
  });
  renderQuiz();
}

function currentQuizQuestion() {
  return state.quiz.questions[state.quiz.currentIndex] || null;
}

function startQuizTimer() {
  const quiz = state.quiz;
  stopQuizTimer();
  if (quiz.status !== "active" || quiz.result || quiz.timerDuration <= 0) return;
  quiz.timerRemaining = quiz.timerDuration;
  quiz.timerStartedAt = Date.now();
  startQuizTicking();
  quiz.timerId = setInterval(() => {
    const elapsed = (Date.now() - quiz.timerStartedAt) / 1000;
    quiz.timerRemaining = Math.max(0, quiz.timerDuration - elapsed);
    if (quiz.timerRemaining <= 0) {
      handleQuizTimeout();
      return;
    }
    renderQuiz();
  }, 200);
}

function stopQuizTimer() {
  const quiz = state.quiz;
  clearInterval(quiz.timerId);
  quiz.timerId = null;
  stopQuizTicking();
}

function toggleQuizSound() {
  const quiz = state.quiz;
  quiz.soundEnabled = !quiz.soundEnabled;
  if (!quiz.soundEnabled) {
    stopQuizTicking();
  } else {
    ensureAudioContext();
    startQuizTicking();
  }
  renderQuiz();
}

function startQuizTicking() {
  const quiz = state.quiz;
  if (!quiz.soundEnabled || quiz.timerDuration <= 0 || quiz.status !== "active" || quiz.result) return;
  if (quiz.tickTimerId) return;
  playQuizTick();
  quiz.tickTimerId = setInterval(playQuizTick, 1000);
}

function stopQuizTicking() {
  const quiz = state.quiz;
  clearInterval(quiz.tickTimerId);
  quiz.tickTimerId = null;
  if (quiz.tickOscillator) {
    try {
      quiz.tickOscillator.stop();
    } catch {}
    quiz.tickOscillator = null;
  }
  quiz.tickGain = null;
}

function playQuizTick() {
  const quiz = state.quiz;
  const context = ensureAudioContext();
  if (!context || !quiz.soundEnabled) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 540;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.035, context.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.08);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.09);
  quiz.tickOscillator = oscillator;
  quiz.tickGain = gain;
}

function ensureAudioContext() {
  if (!window.AudioContext && !window.webkitAudioContext) return null;
  if (!state.audioContext) state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (state.audioContext.state === "suspended") state.audioContext.resume();
  return state.audioContext;
}

function renderQuiz() {
  const panel = document.getElementById("quiz-panel");
  if (!panel) return;
  const quiz = state.quiz;
  const set = quizSets.find((item) => item.id === quiz.selectedSetId) || quizSets[0];
  const total = quiz.questions.length;
  const completed = quiz.answered;
  const accuracy = completed ? Math.round((quiz.correct / completed) * 100) : 0;

  panel.innerHTML = `
    <div class="quiz-toolbar">
      <label>
        Quiz Set
        <select id="quiz-set-select">
          ${quizSets.map((item) => `<option value="${escapeAttr(item.id)}"${item.id === quiz.selectedSetId ? " selected" : ""}>${escapeHtml(item.displayName)}</option>`).join("")}
        </select>
      </label>
      <label>
        Number of Questions
        <select id="quiz-count-select">
          ${quizQuestionCounts.map((count) => `<option value="${count}"${count === quiz.questionCount ? " selected" : ""}>${count}</option>`).join("")}
        </select>
      </label>
      <label>
        Timer Duration
        <select id="quiz-timer-select">
          ${quizTimerDurations.map((timer) => `<option value="${timer.value}"${timer.value === quiz.timerDuration ? " selected" : ""}>${timer.label}</option>`).join("")}
        </select>
      </label>
      <button class="ghost quiz-sound-button" type="button" data-quiz-action="sound" aria-pressed="${quiz.soundEnabled ? "true" : "false"}">
        <span aria-hidden="true">${quiz.soundEnabled ? "🔊" : "🔇"}</span>
        ${quiz.soundEnabled ? "Sound On" : "Sound Off"}
      </button>
      <button class="primary" type="button" data-quiz-action="get">${quiz.status === "loading" ? "Loading..." : "Get Quiz"}</button>
    </div>
    <p class="quiz-description">${escapeHtml(set.description || "")}</p>
    ${quiz.error ? `<p class="quiz-error">${escapeHtml(quiz.error)}</p>` : ""}
    ${renderQuizStats(total, completed, accuracy)}
    ${renderQuizBody()}
  `;
}

function renderQuizStats(total, completed, accuracy) {
  const quiz = state.quiz;
  const progressPercent = total ? Math.round((completed / total) * 100) : 0;
  const width = total ? Math.min(100, (completed / total) * 100) : 0;
  return `
    <div class="quiz-progress-card">
      <div class="quiz-progress-heading">
        <strong>${escapeHtml(parentTitleForProgress(progressPercent))}</strong>
        <span>${completed} / ${total || quiz.questionCount} questions completed</span>
      </div>
      <div class="quiz-progress-track" aria-hidden="true">
        <span style="width: ${width}%"></span>
      </div>
      <div class="quiz-stat-grid">
        <span><strong>${quiz.score}</strong> Score</span>
        <span><strong>${completed}</strong> Answered</span>
        <span><strong>${quiz.correct}</strong> Correct</span>
        <span><strong>${accuracy}%</strong> Accuracy</span>
      </div>
    </div>
  `;
}

function renderQuizBody() {
  const quiz = state.quiz;
  if (quiz.status === "loading") return `<p class="empty-state">Loading quiz questions...</p>`;
  if (quiz.status === "complete") return renderQuizComplete();
  if (quiz.status !== "active") {
    return `<p class="empty-state">Choose a quiz set, pick your options, and tap Get Quiz.</p>`;
  }
  const question = currentQuizQuestion();
  if (!question) return `<p class="empty-state">No question is ready yet.</p>`;
  const total = quiz.questions.length;
  return `
    <article class="quiz-card">
      <div class="quiz-question-top">
        <span>Question ${quiz.currentIndex + 1} of ${total}</span>
        ${quiz.timerDuration > 0 ? renderQuizTimer() : ""}
      </div>
      ${renderQuizScenario(question)}
      <h3>${escapeHtml(question.question)}</h3>
      <div class="quiz-choices">
        ${question.choices.map((choice) => renderQuizChoice(question, choice)).join("")}
      </div>
      ${quiz.result ? renderQuizResult(question) : ""}
    </article>
  `;
}

function renderQuizScenario(question) {
  if (!question.scenarioTitle && !question.scenario) return "";
  return `
    <div class="quiz-scenario-card">
      ${question.scenarioTitle ? `<strong>${escapeHtml(question.scenarioTitle)}</strong>` : ""}
      ${question.scenario ? `<p>${escapeHtml(question.scenario)}</p>` : ""}
    </div>
  `;
}

function renderQuizTimer() {
  const quiz = state.quiz;
  const fraction = quiz.timerDuration ? Math.max(0, Math.min(1, quiz.timerRemaining / quiz.timerDuration)) : 0;
  const degrees = Math.round(fraction * 360);
  const seconds = Math.ceil(quiz.timerRemaining);
  const warning = quiz.timerRemaining <= 5;
  const pulse = quiz.timerRemaining <= 3;
  return `
    <div class="quiz-timer ${warning ? "warning" : ""} ${pulse ? "pulse" : ""}" style="--quiz-timer-deg: ${degrees}deg">
      <span>${seconds}s</span>
    </div>
  `;
}

function renderQuizChoice(question, choice) {
  const quiz = state.quiz;
  const answered = Boolean(quiz.result);
  const isCorrect = choice.id === question.correctChoiceId;
  const isSelected = choice.id === quiz.selectedChoiceId;
  const classes = ["quiz-choice"];
  if (answered && isCorrect) classes.push("correct");
  if (answered && isSelected && !isCorrect) classes.push("wrong");
  return `
    <button class="${classes.join(" ")}" type="button" data-quiz-choice="${escapeAttr(choice.id)}" ${answered ? "disabled" : ""}>
      <span class="quiz-choice-letter">${escapeHtml(choiceLabel(choice.id))}</span>
      <span>${escapeHtml(choice.text)}</span>
    </button>
  `;
}

function choiceLabel(choiceId) {
  const normalized = String(choiceId || "").trim();
  if (/^[a-d]$/i.test(normalized)) return normalized.toUpperCase();
  return normalized.slice(0, 1).toUpperCase() || "";
}

function renderQuizResult(question) {
  const quiz = state.quiz;
  const result = quiz.result;
  const title = result.type === "timeout" ? "Time is up" : result.isCorrect ? "Correct" : "Not quite";
  return `
    <div class="quiz-result ${result.isCorrect ? "correct" : "wrong"}">
      <div class="quiz-result-title">
        <strong>${title}</strong>
        <span>${result.points} points${result.bonus ? `, including +${result.bonus} speed bonus` : ""}</span>
      </div>
      <div class="quiz-explanations">
        ${question.choices.map((choice) => `
          <div>
            <strong>${choice.id.toUpperCase()}. ${escapeHtml(choice.text)}</strong>
            <p>${escapeHtml(choice.explanation || "No choice explanation provided.")}</p>
          </div>
        `).join("")}
      </div>
      ${question.answerExplanation ? `<p class="quiz-overall">${escapeHtml(question.answerExplanation)}</p>` : ""}
      ${question.keyTakeaway ? `<p class="quiz-takeaway"><strong>Key takeaway:</strong> ${escapeHtml(question.keyTakeaway)}</p>` : ""}
      ${renderQuizStrategy(question)}
      ${renderParentScript(question)}
      <button class="primary" type="button" data-quiz-action="next">
        ${quiz.currentIndex >= quiz.questions.length - 1 ? "Finish Quiz" : "Next Question"}
      </button>
    </div>
  `;
}

function renderQuizStrategy(question) {
  if (!question.strategyName && !question.strategySummary && !question.brainModelLink) return "";
  return `
    <div class="quiz-strategy">
      <strong>${escapeHtml(question.strategyName || "Strategy")}</strong>
      ${question.strategySummary ? `<p>${escapeHtml(question.strategySummary)}</p>` : ""}
      ${question.brainModelLink ? `<p>${escapeHtml(question.brainModelLink)}</p>` : ""}
    </div>
  `;
}

function renderParentScript(question) {
  if (!question.parentScript.length) return "";
  return `
    <div class="quiz-parent-script">
      <strong>Parent Next Steps</strong>
      <ol>
        ${question.parentScript.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
      </ol>
    </div>
  `;
}

function renderQuizComplete() {
  const quiz = state.quiz;
  const accuracy = quiz.answered ? Math.round((quiz.correct / quiz.answered) * 100) : 0;
  const title = parentTitleForProgress(100);
  return `
    <div class="quiz-complete">
      <h3>${escapeHtml(title)}</h3>
      <p>You finished the quiz with ${quiz.score} points and ${accuracy}% accuracy. Tiny steady practice counts.</p>
      <div class="quiz-stat-grid">
        <span><strong>${quiz.score}</strong> Final score</span>
        <span><strong>${quiz.correct}</strong> Correct</span>
        <span><strong>${quiz.answered}</strong> Answered</span>
        <span><strong>${accuracy}%</strong> Accuracy</span>
      </div>
      <button class="primary" type="button" data-quiz-action="restart">Start Another Quiz</button>
    </div>
  `;
}

function parentTitleForProgress(percent) {
  if (percent >= 100) return "Everyday Parenting Champion";
  if (percent >= 75) return "Hero Parent";
  if (percent >= 50) return "Brain-Building Parent";
  if (percent >= 25) return "Calm Parent in Training";
  return "New Parent Recruit";
}

function renderSettings() {
  const birthdayInput = document.getElementById("birthday-input");
  if (birthdayInput && document.activeElement !== birthdayInput) birthdayInput.value = state.profile.birthday || "";

  const reminderInput = document.getElementById("bath-reminder-seconds");
  if (reminderInput && document.activeElement !== reminderInput) reminderInput.value = state.bathReminderSeconds;

  const tummyReminderInput = document.getElementById("tummy-reminder-seconds");
  if (tummyReminderInput && document.activeElement !== tummyReminderInput) tummyReminderInput.value = state.tummyReminderSeconds;

  const weightUnitSelect = document.getElementById("settings-weight-unit");
  if (weightUnitSelect && document.activeElement !== weightUnitSelect) weightUnitSelect.value = state.weightUnit;

  const heightUnitSelect = document.getElementById("settings-height-unit");
  if (heightUnitSelect && document.activeElement !== heightUnitSelect) heightUnitSelect.value = state.heightUnit;

  syncOverviewSettingsInputs();
  renderVoiceOptions();

  const container = document.getElementById("category-settings");
  if (!container) return;

  container.innerHTML = activities.map((activity) => `
    <label class="category-toggle">
      <input type="checkbox" value="${activity.key}" ${state.visibleCards.includes(activity.key) ? "checked" : ""}>
      <span>${activity.title}</span>
    </label>
  `).join("");

  container.querySelectorAll("input").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const selected = Array.from(container.querySelectorAll("input:checked")).map((input) => input.value);
      state.visibleCards = selected.length ? selected : activities.map((activity) => activity.key);
      saveVisibleCards();
      renderActivities();
      renderActivityStats();
      updateActivityButtons();
      renderSettings();
      showSettingsStatus("Category cards updated.");
    });
  });
}

function cleanOverviewSettings(value = {}) {
  const current = value && typeof value === "object" ? value : {};
  const normalizedMode = current.reviewMode === "llama_strict" || current.reviewMode === "rules_then_llama" ? "ollama_strict" : current.reviewMode;
  const reviewMode = overviewReviewModes.some((item) => item.value === normalizedMode) ? normalizedMode : "rules_only";
  const llamaModel = overviewLlamaModels.includes(current.llamaModel) ? current.llamaModel : "llama3.2";
  const gptModel = overviewGptModels.includes(current.gptModel) ? current.gptModel : "gpt-4.1-mini";
  const careVoice = overviewCareVoices.includes(current.careVoice) ? current.careVoice : "parent_friendly";
  return {
    reviewMode,
    llamaModel,
    gptModel,
    careVoice,
    refreshIntervalMinutes: Math.max(1, Math.min(60, Math.round(Number(current.refreshIntervalMinutes) || 5))),
    maxOutputTokens: Math.max(200, Math.min(1600, Math.round(Number(current.maxOutputTokens) || 700))),
    reviewWindowDays: Math.max(1, Math.min(14, Math.round(Number(current.reviewWindowDays) || 3)))
  };
}

function syncOverviewSettingsInputs() {
  const settings = cleanOverviewSettings(state.overviewSettings);
  const inputs = {
    "overview-review-mode": settings.reviewMode,
    "overview-llama-model": settings.llamaModel,
    "overview-gpt-model": settings.gptModel,
    "overview-care-voice": settings.careVoice,
    "overview-refresh-interval": String(settings.refreshIntervalMinutes),
    "overview-review-window": String(settings.reviewWindowDays),
    "overview-output-tokens": String(settings.maxOutputTokens)
  };
  Object.entries(inputs).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element && document.activeElement !== element) element.value = value;
  });
  syncOverviewSettingsVisibility(settings.reviewMode);
}

function syncOverviewSettingsVisibility(reviewMode) {
  const mode = reviewMode === "llama_strict" || reviewMode === "rules_then_llama" ? "ollama_strict" : reviewMode;
  document.querySelectorAll("[data-overview-setting]").forEach((element) => {
    const scope = element.dataset.overviewSetting;
    const visible = scope === "shared"
      || (scope === "llama" && mode === "ollama_strict")
      || (scope === "gpt" && mode === "gpt_strict")
      || (scope === "auto" && mode !== "gpt_strict");
    element.hidden = !visible;
    element.classList.toggle("is-hidden", !visible);
  });
}

function readOverviewSettingsInputs() {
  return cleanOverviewSettings({
    reviewMode: document.getElementById("overview-review-mode")?.value,
    llamaModel: document.getElementById("overview-llama-model")?.value,
    gptModel: document.getElementById("overview-gpt-model")?.value,
    careVoice: document.getElementById("overview-care-voice")?.value,
    refreshIntervalMinutes: document.getElementById("overview-refresh-interval")?.value,
    reviewWindowDays: document.getElementById("overview-review-window")?.value,
    maxOutputTokens: document.getElementById("overview-output-tokens")?.value
  });
}

async function saveOverviewSettings(event) {
  event.preventDefault();
  const next = readOverviewSettingsInputs();
  showSettingsStatus("Saving overview settings...");
  try {
    const result = await fetchJson("/api/overview-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next)
    });
    state.overviewSettings = cleanOverviewSettings(result.overview_settings || next);
    syncOverviewSettingsInputs();
    state.dashboardOverview.lastInputHash = "";
    state.dashboardOverview.serverInputHash = "";
    startDashboardOverviewReviews();
    renderDashboardOverview();
    showSettingsStatus("Overview settings saved.");
    showReaction("Overview settings saved", overviewReviewModeLabel(state.overviewSettings.reviewMode));
  } catch (error) {
    showSettingsStatus(`Save failed: ${error.message}`);
  }
}

function overviewReviewModeLabel(value) {
  return overviewReviewModes.find((item) => item.value === value)?.label || value;
}

function renderVoiceOptions() {
  const select = document.getElementById("reminder-voice-select");
  if (!select || document.activeElement === select) return;

  const voices = loadSpeechVoices();
  const current = state.reminderVoiceURI;
  select.innerHTML = `
    <option value="">Device default</option>
    ${voices.map((voice) => `
      <option value="${escapeAttr(voice.voiceURI)}">${escapeHtml(formatVoiceLabel(voice))}</option>
    `).join("")}
  `;
  select.value = voices.some((voice) => voice.voiceURI === current) ? current : "";
}

function saveReminderVoice(event) {
  state.reminderVoiceURI = event.target.value;
  saveReminderVoiceURI();
  showSettingsStatus(state.reminderVoiceURI ? "Reminder voice saved for this device." : "Reminder voice set to device default.");
}

function testReminderVoice() {
  prepareReminderSound("Two minutes");
}

function saveSettingsWeightUnit(event) {
  state.weightUnit = event.target.value;
  saveWeightUnit();
  renderActivityStats();
  renderDashboard();
  updateTopbarBabyStats();
  showSettingsStatus(`Weight unit saved: ${state.weightUnit}.`);
}

function saveSettingsHeightUnit(event) {
  state.heightUnit = event.target.value;
  saveHeightUnit();
  renderActivityStats();
  renderDashboard();
  updateTopbarBabyStats();
  showSettingsStatus(`Height unit saved: ${state.heightUnit}.`);
}

function saveBathReminder(event) {
  event.preventDefault();
  const input = document.getElementById("bath-reminder-seconds");
  const seconds = Math.round(Number(input.value));
  if (!Number.isFinite(seconds) || seconds < 5) {
    showSettingsStatus("Bath reminder must be at least 5 seconds.");
    return;
  }

  state.bathReminderSeconds = Math.min(3600, seconds);
  state.lastBathAnnouncementStep = 0;
  saveBathReminderSeconds();
  renderAll();
  showSettingsStatus(`Bath reminder saved: every ${formatReminderPeriod(state.bathReminderSeconds)}.`);
  showReaction("Bath reminder saved", `Every ${formatReminderPeriod(state.bathReminderSeconds)}`);
}

function saveTummyReminder(event) {
  event.preventDefault();
  const input = document.getElementById("tummy-reminder-seconds");
  const seconds = Math.round(Number(input.value));
  if (!Number.isFinite(seconds) || seconds < 5) {
    showSettingsStatus("Tummy reminder must be at least 5 seconds.");
    return;
  }

  state.tummyReminderSeconds = Math.min(3600, seconds);
  state.lastTummyAnnouncementStep = 0;
  saveTummyReminderSeconds();
  renderAll();
  showSettingsStatus(`Tummy reminder saved: every ${formatReminderPeriod(state.tummyReminderSeconds)}.`);
  showReaction("Tummy reminder saved", `Every ${formatReminderPeriod(state.tummyReminderSeconds)}`);
}

async function generateAnalyticsJson() {
  const button = document.getElementById("generate-analytics-button");
  const days = document.getElementById("analytics-days-select")?.value || "7";
  if (button) button.disabled = true;
  showSettingsStatus("Generating daily analytics JSONs...");
  try {
    const result = await fetchJson("/api/analytics/daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days })
    });
    showSettingsStatus(`Generated ${result.filesWritten || 0} daily JSONs recently.`);
    showReaction("Daily analytics generated", `${result.filesWritten || 0} files`);
  } catch (error) {
    showSettingsStatus(`Analytics failed: ${error.message}`);
  } finally {
    if (button) button.disabled = false;
  }
}

async function generateTrendJson() {
  const button = document.getElementById("generate-trends-button");
  if (button) button.disabled = true;
  showSettingsStatus("Generating trend analytics JSONs...");
  try {
    const result = await fetchJson("/api/analytics/trends", { method: "POST" });
    showSettingsStatus(`Generated ${result.filesWritten || 0} trend JSONs recently.`);
    showReaction("Trend analytics generated", `${result.recentFilesWritten || 0} recent, ${result.monthlyFilesWritten || 0} monthly`);
  } catch (error) {
    showSettingsStatus(`Trend analytics failed: ${error.message}`);
  } finally {
    if (button) button.disabled = false;
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const birthday = document.getElementById("birthday-input").value;
  showSettingsStatus("Saving birthday...");

  try {
    const result = await fetchJson("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birthday })
    });
    state.profile = result.profile || {};
    renderAll();
    showSettingsStatus("Birthday saved.");
    showReaction("Profile saved", birthday || "Birthday cleared");
  } catch (error) {
    showSettingsStatus(`Save failed: ${error.message}`);
  }
}

async function clearData() {
  if (!confirm("Clear all logs and milestones? This resets cards, history, today totals, milestone progress, and recent info.")) return;
  showSettingsStatus("Clearing data...");

  try {
    const result = await fetchJson("/api/logs", { method: "DELETE" });
    state.logs = [];
    state.recent = result.recent || {};
    state.summary = result.todaySummary || {};
    state.milestoneProgress = result.milestone_progress || {};
    renderAll();
    showSettingsStatus("All logs and milestones cleared.");
    showReaction("Data cleared", "Logs and milestones reset.");
  } catch (error) {
    showSettingsStatus(`Clear failed: ${error.message}`);
  }
}

async function deleteLog(logId, cardKey = "") {
  const log = state.logs.find((item) => item.id === logId);
  if (!log) return;
  if (!confirm(`Delete this log?\n\n${labelForLog(log)} at ${formatLogClock(log)}`)) return;

  try {
    const result = await fetchJson(`/api/logs/${encodeURIComponent(logId)}`, { method: "DELETE" });
    state.logs = state.logs.filter((item) => item.id !== logId);
    state.recent = result.recent || state.recent;
    state.summary = result.todaySummary || state.summary;
    renderAll();
    if (cardKey) openActivityLogs(cardKey);
    showReaction("Log deleted", labelForLog(log));
  } catch (error) {
    showToast(`Delete failed: ${error.message}`);
  }
}

function showSettingsStatus(message) {
  const element = document.getElementById("settings-status");
  if (element) element.textContent = message;
}

function loadVisibleCards() {
  try {
    const saved = JSON.parse(storageGet("visibleCards") || "[]");
    if (Array.isArray(saved) && saved.length) {
      const validKeys = new Set(activities.map((activity) => activity.key));
      const filtered = saved.filter((key) => validKeys.has(key));
      if (filtered.length) {
        [
          ["outdoor", "visibleCardsOutdoorAdded"],
          ["growth", "visibleCardsGrowthAdded"],
          ["routine", "visibleCardsRoutineAdded"]
        ].forEach(([key, flag]) => {
          if (!filtered.includes(key) && storageGet(flag) !== "true") {
            filtered.push(key);
            storageSet(flag, "true");
            storageSet("visibleCards", JSON.stringify(filtered));
          }
        });
        return filtered;
      }
    }
  } catch {
    return activities.map((activity) => activity.key);
  }
  return activities.map((activity) => activity.key);
}

function saveVisibleCards() {
  storageSet("visibleCards", JSON.stringify(state.visibleCards));
}

function loadBathReminderSeconds() {
  const saved = Number(storageGet("bathReminderSeconds"));
  return Number.isFinite(saved) && saved >= 5 ? Math.min(3600, Math.round(saved)) : 120;
}

function saveBathReminderSeconds() {
  storageSet("bathReminderSeconds", String(state.bathReminderSeconds));
}

function loadTummyReminderSeconds() {
  const saved = Number(storageGet("tummyReminderSeconds"));
  return Number.isFinite(saved) && saved >= 5 ? Math.min(3600, Math.round(saved)) : 120;
}

function saveTummyReminderSeconds() {
  storageSet("tummyReminderSeconds", String(state.tummyReminderSeconds));
}

function loadWeightUnit() {
  const saved = storageGet("weightUnit");
  return ["oz", "lb", "g", "kg"].includes(saved) ? saved : "lb";
}

function saveWeightUnit() {
  storageSet("weightUnit", state.weightUnit);
}

function loadHeightUnit() {
  const saved = storageGet("heightUnit");
  return ["in", "ft", "cm", "mm"].includes(saved) ? saved : "in";
}

function saveHeightUnit() {
  storageSet("heightUnit", state.heightUnit);
}

function loadReminderVoiceURI() {
  return storageGet("reminderVoiceURI") || "";
}

function saveReminderVoiceURI() {
  if (state.reminderVoiceURI) {
    storageSet("reminderVoiceURI", state.reminderVoiceURI);
  } else {
    storageRemove("reminderVoiceURI");
  }
}

function storageGet(key) {
  try {
    return window.localStorage?.getItem(key) || "";
  } catch {
    return "";
  }
}

function storageSet(key, value) {
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    return false;
  }
  return true;
}

function storageRemove(key) {
  try {
    window.localStorage?.removeItem(key);
  } catch {
    return false;
  }
  return true;
}

async function createLog(payload, reminder) {
  const logPayload = prepareLogPayload(payload);
  try {
    const conflict = transitionConflict(logPayload);
    if (conflict) {
      showToast(conflict);
      return;
    }

    const result = await postLogPayload(logPayload);

    state.logs.push(result.log);
    state.recent = result.recent;
    state.summary = result.todaySummary;
    renderAll();
    showReaction("Yay, logged!", reminder || labelForLog(result.log));
    await retryPendingLogSyncs({ quiet: true });
  } catch (error) {
    if (!shouldQueueLogError(error)) {
      showToast(`Could not log activity: ${error.message}`);
      return;
    }

    const queued = queuePendingLog(logPayload);
    showReaction("Saved offline", labelForLog(localLogFromPendingItem(queued)));
  }
}

function openBottleDialog() {
  updateBottleDefaults();
  document.getElementById("bottle-dialog").showModal();
}

function openGrowthDialog(stat = "weight") {
  if (stat === "height") {
    updateHeightDialogDefaults();
    document.getElementById("height-dialog").showModal();
    return;
  }
  updateWeightDialogDefaults();
  document.getElementById("weight-dialog").showModal();
}

function openPoopColorDialog() {
  resetPendingCardAction();
  const picker = document.getElementById("poop-color-picker");
  const consistency = document.getElementById("poop-consistency");
  const notes = document.getElementById("poop-notes");
  if (consistency) consistency.value = "";
  if (notes) notes.value = "";
  if (picker) {
    picker.innerHTML = PoopColorPicker(state.poopColors);
    picker.querySelectorAll("[data-poop-color-id]").forEach((button) => {
      button.addEventListener("click", () => logPoopWithColor(button.dataset.poopColorId));
    });
  }
  document.getElementById("poop-color-dialog").showModal();
}

function PoopColorPicker(colors) {
  return colors.map(renderPoopColorCard).join("");
}

function renderPoopColorCard(color) {
  const status = getPoopColorStatus(color.id, babyAgeDays());
  return `
    <button class="poop-color-card status-${escapeAttr(status)}" type="button" data-poop-color-id="${escapeAttr(color.id)}">
      <span class="poop-card-topline">
        <img class="poop-color-swatch" src="${escapeAttr(color.swatch)}" alt="">
        <span class="poop-status-badge">${escapeHtml(statusLabel(status))}</span>
      </span>
      <strong>${escapeHtml(color.label)}</strong>
      <span>${escapeHtml(color.parentAction)}</span>
    </button>
  `;
}

async function logPoopWithColor(poopColorId) {
  const color = poopColorById(poopColorId);
  const status = getPoopColorStatus(poopColorId, babyAgeDays());
  const consistency = document.getElementById("poop-consistency")?.value || "";
  const notes = document.getElementById("poop-notes")?.value.trim() || "";

  document.getElementById("poop-color-dialog").close();
  await createLog({
    type: "diaper",
    kind: "poop",
    poopColorId,
    consistency,
    notes
  }, color?.label || "Poo diaper");

  if (status === "call" || status === "urgent") {
    showToast(status === "urgent" ? "Urgent: call pediatrician." : "Call pediatrician.");
  }
}

function getPoopColorStatus(poopColorId, babyAgeDays) {
  if (poopColorId === "dark-brown-black") return babyAgeDays <= 3 ? "normal" : "call";
  if (poopColorId === "red-blood") return "call";
  if (poopColorId === "white-pale-gray") return "urgent";
  return poopColorById(poopColorId)?.category || "normal";
}

function babyAgeDays() {
  if (!state.profile.birthday) return Number.POSITIVE_INFINITY;
  return daysBetween(state.profile.birthday, todayString()) + 1;
}

function poopColorById(id) {
  return state.poopColors.find((color) => color.id === id) || null;
}

function statusLabel(status) {
  const labels = {
    normal: "Usually normal",
    watch: "Watch",
    call: "Call",
    urgent: "Urgent"
  };
  return labels[status] || status;
}

function updateBottleDefaults() {
  const slider = document.getElementById("bottle-slider");
  const amount = Math.min(8, Math.max(0, Number(state.recent.bottleOunces || 3)));
  slider.value = amount;
  document.getElementById("bottle-value").textContent = amount.toFixed(2).replace(/0$/, "");
}

function updateWeightDialogDefaults() {
  const latestWeight = lastGrowthLog("weight");
  const weight = document.getElementById("growth-weight");
  const weightUnitLabel = document.getElementById("growth-weight-unit-label");

  if (weightUnitLabel) weightUnitLabel.textContent = state.weightUnit;
  if (weight && document.activeElement !== weight) weight.value = latestWeight ? formatUnitValue(readWeightGrams(latestWeight), state.weightUnit, "weight") : "";
}

function updateHeightDialogDefaults() {
  const latestHeight = lastGrowthLog("height");
  const height = document.getElementById("growth-height");
  const heightUnitLabel = document.getElementById("growth-height-unit-label");

  if (heightUnitLabel) heightUnitLabel.textContent = state.heightUnit;
  if (height && document.activeElement !== height) height.value = latestHeight ? formatUnitValue(readHeightMm(latestHeight), state.heightUnit, "height") : "";
}

function startTicker() {
  if (state.ticker) return;
  state.ticker = setInterval(async () => {
    updateClock();
    if (state.currentDate !== todayString()) {
      state.currentDate = todayString();
      await refreshData();
      return;
    }
    renderActivityStats();
    if (state.activeTab === "home" && state.activeHomeTab === "dashboard") renderDashboard();
    updateActivityButtons();
    if (Date.now() - state.weatherLastUpdated > 30 * 60 * 1000) refreshWeather();
    maybeRefreshBabyCriesAssistant();
    announceBathProgress();
    announceTummyProgress();
  }, 1000);
}

function updateClock() {
  const clock = document.getElementById("current-clock");
  if (!clock) return;
  const now = new Date();
  clock.dateTime = now.toISOString();
  clock.textContent = now.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  });
  updateTopbarBabyAge();
}

function updateTopbarBabyAge() {
  const ageElement = document.getElementById("topbar-baby-age");
  if (!ageElement) return;
  const age = formatBabyAge(state.profile.birthday || "");
  ageElement.textContent = age ? `Baby age: ${age}` : "";
  updateTopbarBabyStats();
}

function updateTopbarBabyStats() {
  const element = document.getElementById("topbar-baby-stats");
  if (!element) return;
  const weight = lastGrowthLog("weight");
  const height = lastGrowthLog("height");
  const parts = [];
  if (weight) parts.push(formatWeightLog(weight));
  if (height) parts.push(formatHeightLog(height));
  element.textContent = parts.length ? parts.join(" / ") : "Stats: --";
}

async function refreshWeather() {
  state.weatherLastUpdated = Date.now();
  try {
    const { latitude, longitude } = await weatherCoordinates();
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph`;
    const data = await fetchJson(url);
    const current = data.current || {};
    const weatherInfo = weatherCodeInfo(Number(current.weather_code), Number(current.wind_speed_10m));

    state.weather = {
      latitude,
      longitude,
      temperature: Math.round(Number(current.temperature_2m)),
      humidity: Number.isFinite(Number(current.relative_humidity_2m)) ? Math.round(Number(current.relative_humidity_2m)) : null,
      description: weatherInfo.description,
      icon: weatherInfo.icon,
      websiteUrl: `https://weather.com/weather/today/l/${latitude},${longitude}`
    };
  } catch (error) {
    state.weather = state.weather || {
      temperature: null,
      description: "Weather unavailable",
      icon: "?",
      websiteUrl: "https://weather.com/"
    };
  }
  updateWeatherDisplay();
  renderCare();
}

async function weatherCoordinates() {
  try {
    const position = await currentPosition();
    return {
      latitude: Number(position.coords.latitude.toFixed(4)),
      longitude: Number(position.coords.longitude.toFixed(4))
    };
  } catch (error) {
    const location = await fetchJson("https://ipapi.co/json/");
    if (!Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) {
      throw new Error("Weather location is not available.");
    }
    return {
      latitude: Number(Number(location.latitude).toFixed(4)),
      longitude: Number(Number(location.longitude).toFixed(4))
    };
  }
}

function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not available."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 30 * 60 * 1000,
      timeout: 8000
    });
  });
}

function updateWeatherDisplay() {
  const button = document.getElementById("weather-shortcut");
  const icon = document.getElementById("weather-icon");
  const temp = document.getElementById("weather-temp");
  if (!button || !icon || !temp) return;

  const weather = state.weather;
  icon.textContent = weather?.icon || "--";
  temp.textContent = Number.isFinite(weather?.temperature) ? `${weather.temperature}°F` : "Weather";
  button.title = weather?.description || "Local weather";
  button.setAttribute("aria-label", `Open weather${weather?.description ? `, ${weather.description}` : ""}`);
}

function weatherCodeInfo(code, windSpeed) {
  if (Number.isFinite(windSpeed) && windSpeed >= 25) return { icon: "🌬", description: "Windy" };
  if ([0].includes(code)) return { icon: "☀", description: "Sunny" };
  if ([1, 2].includes(code)) return { icon: "🌤", description: "Partly cloudy" };
  if ([3, 45, 48].includes(code)) return { icon: "☁", description: "Cloudy" };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { icon: "🌧", description: "Rainy" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { icon: "❄", description: "Snowy" };
  if ([95, 96, 99].includes(code)) return { icon: "⛈", description: "Stormy" };
  return { icon: "🌡", description: "Weather" };
}

function openWeatherShortcut() {
  const webUrl = state.weather?.websiteUrl || "https://weather.com/";
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (!isMobile) {
    window.open(webUrl, "_blank", "noopener");
    return;
  }

  const probe = document.createElement("iframe");
  let fallbackTimer = window.setTimeout(() => {
    probe.remove();
    window.location.href = webUrl;
  }, 900);

  window.addEventListener("blur", () => {
    window.clearTimeout(fallbackTimer);
    probe.remove();
  }, { once: true });

  probe.style.display = "none";
  probe.src = "weather://";
  document.body.appendChild(probe);
}

function openChatGptShortcut() {
  const webUrl = "https://chatgpt.com/";
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (!isMobile) {
    window.open(webUrl, "_blank", "noopener");
    return;
  }

  const probe = document.createElement("iframe");
  let fallbackTimer = window.setTimeout(() => {
    probe.remove();
    window.location.href = webUrl;
  }, 900);

  window.addEventListener("blur", () => {
    window.clearTimeout(fallbackTimer);
    probe.remove();
  }, { once: true });

  probe.style.display = "none";
  probe.src = "chatgpt://";
  document.body.appendChild(probe);
}

function renderActivityStats() {
  const stats = getActivityStats();
  updateSleepHeader();
  updateMotionHeaders();
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

function updateMotionHeaders() {
  const bath = getCurrentState("bath");
  const tummy = getCurrentState("tummy_time");
  const outdoor = getCurrentState("outdoor_time");
  const states = {
    bath: bath.status === "start",
    tummy: tummy.status === "start",
    outdoor: outdoor.status === "start"
  };

  Object.entries(states).forEach(([key, active]) => {
    const card = document.querySelector(`[data-activity-card="${key}"]`);
    if (!card) return;
    card.classList.toggle(`${key}-active-header`, active);
  });
}

function updateSleepHeader() {
  const card = document.querySelector('[data-activity-card="sleep"]');
  const subtitle = document.querySelector('[data-card-subtitle="sleep"]');
  if (!card || !subtitle) return;

  const sleep = getCurrentState("sleep");
  const isSleeping = sleep.status === "asleep";
  card.style.setProperty("--card-image", `url('/assets/activity/header-sleep-${isSleeping ? "asleep" : "awake"}.png')`);
  card.classList.toggle("sleeping-header", isSleeping);
  card.classList.toggle("awake-header", !isSleeping);
  subtitle.textContent = isSleeping ? "Baby is sleeping." : "Baby is awaking.";
}

function updateActivityButtons() {
  const sleep = getCurrentState("sleep");
  const tummy = getCurrentState("tummy_time");
  const outdoor = getCurrentState("outdoor_time");
  const bath = getCurrentState("bath");

  document.querySelectorAll(".action-button").forEach((button) => {
    const card = button.dataset.card;
    const label = button.dataset.actionLabel;
    const shouldDisable =
      (card === "sleep" && ((sleep.status === "asleep" && label === "Asleep") || (sleep.status === "awake" && label === "Awake"))) ||
      (card === "tummy" && ((tummy.status === "start" && label === "Start") || (tummy.status === "end" && label === "End"))) ||
      (card === "outdoor" && ((outdoor.status === "start" && label === "Start") || (outdoor.status === "end" && label === "End"))) ||
      (card === "bath" && ((bath.status === "start" && label === "Start") || (bath.status === "end" && label === "Stop")));

    button.disabled = shouldDisable;
    button.setAttribute("aria-disabled", shouldDisable ? "true" : "false");
    if (shouldDisable && button.dataset.confirming === "true") resetPendingCardAction();
  });

  document.querySelectorAll("[data-bath-sound-toggle]").forEach((button) => {
    button.classList.toggle("sound-on", state.bathSoundEnabled);
    button.setAttribute("aria-label", `Bath sound is ${state.bathSoundEnabled ? "on" : "off"}`);
    button.setAttribute("aria-pressed", state.bathSoundEnabled ? "true" : "false");
  });

  document.querySelectorAll("[data-tummy-sound-toggle]").forEach((button) => {
    button.classList.toggle("sound-on", state.tummySoundEnabled);
    button.setAttribute("aria-label", `Tummy Time sound is ${state.tummySoundEnabled ? "on" : "off"}`);
    button.setAttribute("aria-pressed", state.tummySoundEnabled ? "true" : "false");
  });
}

function getActivityStats() {
  const sleep = getCurrentState("sleep");
  const tummy = getCurrentState("tummy_time");
  const outdoor = getCurrentState("outdoor_time");
  const bath = getCurrentState("bath");
  const todaySummary = summarizeLogsToday();
  const sleepLabel = sleep.status === "asleep" ? "Asleep" : "Awake";
  const tummyLabel = activityStatusLabel(tummy, "Started");
  const outdoorLabel = activityStatusLabel(outdoor, "Started");
  const bathLabel = activityStatusLabel(bath, "Bathing");

  return {
    sleep: {
      label: `${sleepLabel} ${formatDuration(elapsedTodaySince(sleep.log))}${formatSince(sleep.log)}`,
      value: formatTotalDuration(totalToday("sleep", "asleep", "awake")),
      helper: "Total sleep today"
    },
    boobie: {
      label: "Breast feeds",
      value: todaySummary.breastFeeds,
      helper: `<small>➡️ Next side with good latch (breast should not be too full): ${state.recent.nextBreastSide || "left"}</small>
              <br>
              <small> 
               <small>🌙 Empty breasts before sleep</small>`
    },
    bottle: {
      label: "Bottle total",
      value: `${todaySummary.bottleOunces} oz`,
      helper: `Last time ${formatSinceTime(lastLogOfType("bottle"))}`
    },
    routine: {
      html: `
        <div class="hygiene-list stats-list">
          <span><img src="/assets/activity/icon-routine-morning.png" alt="">${todaySummary.morningRoutines} morning</span>
          <span><img src="/assets/activity/icon-routine-naptime.png" alt="">${todaySummary.naptimeRoutines} nap</span>
          <span><img src="/assets/activity/icon-routine-bedtime.png" alt="">${todaySummary.bedtimeRoutines} bedtime</span>
        </div>
      `
    },
    diaper: {
      html: `
        <div class="hygiene-list">
          <span><img src="/assets/activity/icon-pee.png" alt="">${todaySummary.wetDiapers} wee</span>
          <span><img src="/assets/activity/icon-poop.png" alt="">${todaySummary.poops} poo</span>
        </div>
      `
    },
    growth: {
      html: renderGrowthCardInfo()
    },
    bath: {
      label: bathLabel,
      value: formatTotalDuration(totalToday("bath", "start", "end")),
      helper: `Sound ${state.bathSoundEnabled ? "on" : "off"} - every ${formatReminderPeriod(state.bathReminderSeconds)}`
    },
    tummy: {
      label: tummyLabel,
      value: formatTotalDuration(totalToday("tummy_time", "start", "end")),
      helper: `Sound ${state.tummySoundEnabled ? "on" : "off"} - every ${formatReminderPeriod(state.tummyReminderSeconds)}`
    },
    outdoor: {
      label: outdoorLabel,
      value: formatTotalDuration(totalToday("outdoor_time", "start", "end")),
      helper: `${todaySummary.outdoorTimeEvents} start/end taps today`
    },
    gym: {
      label: "Baby gym",
      value: todaySummary.babyGymEvents,
      helper: "Play sessions today"
    }
  };
}

function activityStatusLabel(activity, activeLabel) {
  if (activity.status === "start") {
    return `${activeLabel} ${formatDuration(elapsedTodaySince(activity.log))}${formatSince(activity.log)}`;
  }
  const endTime = formatSinceTime(activity.log);
  return `Ended since ${endTime === "not logged yet" ? "--" : endTime}`;
}

function summarizeLogsToday() {
  const logs = todayLogs();
  const count = (predicate) => logs.filter(predicate).length;
  const sum = (predicate, field) => logs.filter(predicate).reduce((total, log) => total + Number(log[field] || 0), 0);

  return {
    breastFeeds: count((log) => log.type === "feeding" && log.method === "breast"),
    bottleOunces: +sum((log) => log.type === "bottle", "ounces").toFixed(1),
    routineEvents: count((log) => log.type === "routine"),
    morningRoutines: count((log) => log.type === "routine" && log.routine === "morning"),
    naptimeRoutines: count((log) => log.type === "routine" && log.routine === "naptime"),
    bedtimeRoutines: count((log) => log.type === "routine" && log.routine === "bedtime"),
    wetDiapers: count((log) => log.type === "diaper" && log.pee),
    poops: count((log) => log.type === "diaper" && log.poop),
    baths: count((log) => log.type === "bath" && (log.status === "start" || !log.status)),
    outdoorTimeEvents: count((log) => log.type === "outdoor_time"),
    growthStats: count((log) => log.type === "growth_stats"),
    babyGymEvents: count((log) => log.type === "baby_gym")
  };
}

function renderGrowthCardInfo() {
  const weight = lastGrowthLog("weight");
  const height = lastGrowthLog("height");
  if (!weight && !height) {
    return `
      <span>Latest stats</span>
      <strong>--</strong>
      <small>No stats logged yet</small>
    `;
  }

  return `
    <div class="hygiene-list stats-list">
      <span>Weight: ${weight ? formatWeightLog(weight) : "--"}</span>
      <span>Height: ${height ? formatHeightLog(height) : "--"}</span>
    </div>
  `;
}

function getCurrentState(type) {
  const now = Date.now();
  const events = state.logs
    .filter((log) => log.type === type && log.status)
    .filter((log) => logTime(log) <= now)
    .sort((a, b) => logTime(b) - logTime(a));
  const log = events[0] || null;
  const fallback = type === "sleep" ? "awake" : "end";
  return { status: log?.status || fallback, log };
}

function pairedConfig(type) {
  const config = eventCategoryConfig[type];
  return config?.kind === "period" ? config : null;
}

function transitionConflict(input, excludeId) {
  const config = pairedConfig(input.type);
  if (!config || !input.status) return "";

  const eventTime = input.date && input.time
    ? logTime({ date: input.date, time: input.time })
    : Date.now();
  if (eventTime > Date.now() + 30 * 1000) return "Time cannot be in the future.";

  const activeBefore = isActiveAt(input.type, eventTime, excludeId);
  const isStart = input.status === config.start;
  const isEnd = input.status === config.end;

  if (isStart && activeBefore) return `Already ${config.startLabel}. Stop first to avoid overlapping time.`;
  if (isEnd && !activeBefore) return `Already ${config.endLabel}. Start first before stopping.`;

  const nextCandidate = nextTimedStatus(input.type, eventTime, excludeId);
  const next = !input.date && !input.time && nextCandidate && logTime(nextCandidate) > Date.now() + 30 * 1000
    ? null
    : nextCandidate;
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

async function toggleBathSound() {
  state.bathSoundEnabled = !state.bathSoundEnabled;
  state.lastBathAnnouncementStep = 0;
  if (state.bathSoundEnabled) prepareReminderSound("Bath sound on");
  if (!state.bathSoundEnabled) stopReminderSound();
  updateActivityButtons();
  renderActivityStats();
  showReaction(state.bathSoundEnabled ? "Bath sound on" : "Bath sound off", `Every ${formatReminderPeriod(state.bathReminderSeconds)}`);
  await saveSoundSettings();
}

async function toggleTummySound() {
  state.tummySoundEnabled = !state.tummySoundEnabled;
  state.lastTummyAnnouncementStep = 0;
  if (state.tummySoundEnabled) prepareReminderSound("Tummy sound on");
  if (!state.tummySoundEnabled) stopReminderSound();
  updateActivityButtons();
  renderActivityStats();
  showReaction(state.tummySoundEnabled ? "Tummy sound on" : "Tummy sound off", `Every ${formatReminderPeriod(state.tummyReminderSeconds)}`);
  await saveSoundSettings();
}

async function saveSoundSettings() {
  try {
    const result = await fetchJson("/api/sound-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bathSoundEnabled: state.bathSoundEnabled,
        tummySoundEnabled: state.tummySoundEnabled
      })
    });
    state.bathSoundEnabled = Boolean(result.sound_settings?.bathSoundEnabled);
    state.tummySoundEnabled = Boolean(result.sound_settings?.tummySoundEnabled);
    updateActivityButtons();
    renderActivityStats();
  } catch (error) {
    showToast(`Could not save sound setting: ${error.message}`);
  }
}

function prepareReminderSound(message) {
  loadSpeechVoices();
  unlockReminderAudio();
  speakReminder(message);
}

function setupSpeechVoices() {
  loadSpeechVoices();
  if (!("speechSynthesis" in window) || !("onvoiceschanged" in window.speechSynthesis)) return;
  window.speechSynthesis.onvoiceschanged = () => {
    renderVoiceOptions();
  };
}

function loadSpeechVoices() {
  if (!("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices();
}

function formatVoiceLabel(voice) {
  const parts = [voice.name];
  if (voice.lang) parts.push(voice.lang);
  if (voice.localService === false) parts.push("online");
  return parts.join(" - ");
}

function unlockReminderAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  if (!state.audioContext) state.audioContext = new AudioContextClass();
  if (state.audioContext.state === "suspended") state.audioContext.resume();
}

function stopReminderSound() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

function speakReminder(message) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    playReminderChime();
    return;
  }

  let started = false;
  const utterance = new SpeechSynthesisUtterance(message);
  const voice = pickReminderVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || "en-US";
  utterance.pitch = 1.18;
  utterance.rate = 0.92;
  utterance.volume = 1;
  utterance.onstart = () => {
    started = true;
  };
  utterance.onerror = () => {
    if (!started) playReminderChime();
  };

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  setTimeout(() => {
    if (!started && !window.speechSynthesis.speaking) playReminderChime();
  }, 900);
}

function pickReminderVoice() {
  const voices = loadSpeechVoices();
  const selected = voices.find((voice) => voice.voiceURI === state.reminderVoiceURI);
  if (selected) return selected;

  return (
    voices.find((voice) => /samantha/i.test(`${voice.name} ${voice.voiceURI}`)) ||
    voices.find((voice) => isGoogleUSEnglishVoice(voice)) ||
    voices.find((voice) => /ava|allison|susan|karen|moira|tessa|zira|jenny|aria|female|girl/i.test(`${voice.name} ${voice.voiceURI}`)) ||
    voices.find((voice) => /^en(-|_)/i.test(voice.lang)) ||
    voices[0] ||
    null
  );
}

function isGoogleUSEnglishVoice(voice) {
  const label = `${voice.name} ${voice.voiceURI} ${voice.lang}`.toLowerCase();
  const isGoogle = label.includes("google");
  const isUSEnglish = label.includes("us english") || /^en(-|_)us$/i.test(voice.lang || "");
  return isGoogle && isUSEnglish;
}

function playReminderChime() {
  unlockReminderAudio();
  const audioContext = state.audioContext;
  if (!audioContext) return;

  const now = audioContext.currentTime;
  [660, 880].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = now + index * 0.14;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.2);
  });
}

function announceBathProgress() {
  if (!state.bathSoundEnabled) return;

  const bath = getCurrentState("bath");
  if (bath.status !== "start" || !bath.log) {
    state.lastBathAnnouncementStep = 0;
    return;
  }

  const seconds = Math.floor(elapsedSince(bath.log) / 1000);
  const step = Math.floor(seconds / state.bathReminderSeconds);
  if (step < 1 || step === state.lastBathAnnouncementStep) return;

  state.lastBathAnnouncementStep = step;
  const elapsedSeconds = step * state.bathReminderSeconds;
  speakReminder(formatSpokenReminder(elapsedSeconds));
}

function announceTummyProgress() {
  if (!state.tummySoundEnabled) return;

  const tummy = getCurrentState("tummy_time");
  if (tummy.status !== "start" || !tummy.log) {
    state.lastTummyAnnouncementStep = 0;
    return;
  }

  const seconds = Math.floor(elapsedSince(tummy.log) / 1000);
  const step = Math.floor(seconds / state.tummyReminderSeconds);
  if (step < 1 || step === state.lastTummyAnnouncementStep) return;

  state.lastTummyAnnouncementStep = step;
  const elapsedSeconds = step * state.tummyReminderSeconds;
  speakReminder(formatSpokenReminder(elapsedSeconds));
}

function formatSpokenReminder(seconds) {
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${numberWords(minutes)} ${minutes === 1 ? "minute" : "minutes"}`;
  }
  return `${numberWords(seconds)} ${seconds === 1 ? "second" : "seconds"}`;
}

function formatReminderPeriod(seconds) {
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }
  return `${seconds} seconds`;
}

function numberWords(value) {
  if (value >= 1000) return String(value);
  const words = {
    0: "zero", 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine",
    10: "ten", 11: "eleven", 12: "twelve", 13: "thirteen", 14: "fourteen", 15: "fifteen", 16: "sixteen",
    17: "seventeen", 18: "eighteen", 19: "nineteen", 20: "twenty", 30: "thirty", 40: "forty", 50: "fifty",
    60: "sixty", 70: "seventy", 80: "eighty", 90: "ninety"
  };
  if (words[value]) return words[value];
  if (value < 100) return `${words[Math.floor(value / 10) * 10]} ${words[value % 10]}`;
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  return `${words[hundreds]} hundred${remainder ? ` ${numberWords(remainder)}` : ""}`;
}

function totalToday(type, startStatus, endStatus) {
  const { start: dayStart, end: dayEnd } = todayBounds();
  const now = Date.now();
  const clipEnd = Math.min(dayEnd, now);
  let totalMs = 0;
  let activeStart = null;

  state.logs
    .filter((log) => log.type === type)
    .filter((log) => logTime(log) <= clipEnd)
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

function formatBabyAge(birthday) {
  if (!birthday) return "";

  const birthDate = new Date(`${birthday}T00:00:00`);
  const today = new Date(`${todayString()}T00:00:00`);

  if (!Number.isFinite(birthDate.getTime()) || birthDate > today) return "";

  let months =
    (today.getFullYear() - birthDate.getFullYear()) * 12 +
    (today.getMonth() - birthDate.getMonth());

  const monthAnchor = new Date(birthDate);
  monthAnchor.setMonth(birthDate.getMonth() + months);

  if (monthAnchor > today) {
    months -= 1;
    monthAnchor.setMonth(birthDate.getMonth() + months);
  }

  const daysAfterMonths = Math.floor((today - monthAnchor) / 86400000);
  const weeks = Math.floor(daysAfterMonths / 7);
  const days = daysAfterMonths % 7;

  const part = (value, unit) => value ? `${value} ${unit}${value === 1 ? "" : "s"}` : "";

  if (months < 1) {
    const totalDays = Math.floor((today - birthDate) / 86400000);
    const babyWeeks = Math.floor(totalDays / 7);
    const babyDays = totalDays % 7;
    return [part(babyWeeks, "week"), part(babyDays, "day")].filter(Boolean).join(" ") || "0 days old";
  }

  return [
    part(months, "month"),
    part(weeks, "week"),
    part(days, "day")
  ].filter(Boolean).join(" ") + " old";
}

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetween(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${endDate}T00:00:00`).getTime();
  return Math.max(0, Math.round((end - start) / (24 * 60 * 60 * 1000)));
}

function logTime(log) {
  const [hour = "00", minute = "00"] = String(log.time || "00:00").split(":");
  const local = new Date(`${log.date || todayString()}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00`);
  if (Number.isFinite(local.getTime())) {
    const created = log.createdAt ? new Date(log.createdAt) : null;
    const offset = created && Number.isFinite(created.getTime())
      ? created.getSeconds() * 1000 + created.getMilliseconds()
      : 0;
    return local.getTime() + offset;
  }

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
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")} hrs ${String(minutes).padStart(2, "0")}min ${String(seconds).padStart(2, "0")}sec`;
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

function formatLogClock(log) {
  const date = new Date(logTime(log));
  if (Number.isNaN(date.getTime())) return log.time || "--:--";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function formatDashboardTick(date, span) {
  if (span <= 36 * 60 * 60 * 1000) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatCompactDuration(value) {
  const totalMinutes = Math.max(0, Math.round(value / 60000));
  return formatMinutesAsHoursMinutes(totalMinutes);
}

function formatMinutesAsHoursMinutes(totalMinutes) {
  const safeMinutes = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

function renderTodaySummary() {
  const container = document.getElementById("today-metrics");
  if (!container) return;

  const cards = [
    ["Logs", state.summary.totalLogs || 0, "All activities"],
    ["Breast", state.summary.breastFeeds || 0, "Feeds"],
    ["Bottle", `${state.summary.bottleOunces || 0} oz`, "Today total"],
    ["Routines", state.summary.routineEvents || 0, "Done"],
    ["Wee", state.summary.wetDiapers || 0, "Wee diapers"],
    ["Poo", state.summary.poops || 0, "Poo diapers"],
    ["Sleep", state.summary.sleepEvents || 0, "Sleep events"],
    ["Bath", state.summary.baths || 0, "Baths"],
    ["Tummy", state.summary.tummyTimeEvents || 0, "Start/end taps"],
    ["Outdoor", state.summary.outdoorTimeEvents || 0, "Start/end taps"]
  ];

  container.innerHTML = cards.map(([label, value, helper]) => `
    <article class="metric">
      <p>${label}</p>
      <strong>${value}</strong>
      <p>${helper}</p>
    </article>
  `).join("");
}

function renderRecent() {
  const container = document.getElementById("recent-list");
  if (!container) return;

  const rows = [
    ["Next breast side", state.recent.nextBreastSide || "left"],
    ["Last bottle", formatSinceTime(lastLogOfType("bottle"))],
    ["Last feed", formatWhen(state.recent.lastFeedAt)],
    ["Last sleep", formatWhen(state.recent.lastSleepAt)],
    ["Last diaper", formatWhen(state.recent.lastDiaperAt)],
    ["Last activity", formatWhen(state.recent.lastActivityAt)]
  ];

  container.innerHTML = rows.map(([label, value]) => `
    <div class="recent-row">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");
}

function renderHistory() {
  const list = document.getElementById("history-list");
  const logs = filteredHistoryLogs();
  list.innerHTML = logs.length ? logs.map((log) => `
    ${renderHistoryLogRow(log)}
  `).join("") : `<p class="empty-state">No logs match these filters.</p>`;

  list.querySelectorAll("[data-history-edit]").forEach((button) => {
    button.addEventListener("click", () => startHistoryEdit(button.dataset.historyEdit));
  });
  list.querySelectorAll("[data-delete-log]").forEach((button) => {
    button.addEventListener("click", () => deleteLog(button.dataset.deleteLog));
  });
}

function renderDashboardOverview() {
  const container = document.getElementById("dashboard-overview");
  if (!container) return;
  const overviewState = state.dashboardOverview;
  const overview = overviewState.publishedReview;
  if (!overview) {
    const isReviewing = overviewState.status === "reviewing";
    container.innerHTML = `
      <details class="dashboard-overview-expander" data-dashboard-overview-expander ${overviewState.overviewOpen ? "open" : ""}>
        <summary class="dashboard-overview-top">
          <div>
            <span>Overview</span>
            <h3>${isReviewing ? "Preparing overview..." : "Overview not ready yet"}</h3>
            <p>${overviewState.error ? escapeHtml(overviewState.error) : "Local baseline review will prepare first. Press Refresh for GPT when you want the deeper review."}</p>
          </div>
          <div class="dashboard-overview-actions">
            <span class="overview-status status-insufficient-data">Insufficient data</span>
          </div>
        </summary>
        <div class="dashboard-overview-body">
          <button class="ghost" type="button" data-dashboard-overview-refresh ${isReviewing ? "disabled" : ""}>${isReviewing ? "Reviewing..." : "Refresh"}</button>
        </div>
      </details>
    `;
    container.querySelector("[data-dashboard-overview-refresh]")?.addEventListener("click", () => {
      maybeRefreshDashboardOverview(true);
    });
    setupOverviewExpanderToggle(container);
    setupOverviewTraceToggle(container);
    return;
  }
  const cards = overview?.cards || [];
  const isReviewing = overviewState.status === "reviewing";
  const source = overviewState.source === "gpt" ? "GPT" : overviewState.source === "llama" ? "Ollama" : overviewState.source === "rules" ? "Local rules" : "Local overview";
  const updated = overviewUpdatedAt(overviewState, overview);
  const priority = overview.overall?.priority || overview.overallStatus || "insufficient_data";
  const statusClassName = overviewStatusClass(priority);
  const statusMessage = isReviewing
    ? "Reviewing in background..."
    : overviewState.status === "error"
      ? (overviewState.error || "Could not refresh review. Showing last review.")
      : "";

  container.innerHTML = `
    <details class="dashboard-overview-expander" data-dashboard-overview-expander ${overviewState.overviewOpen ? "open" : ""}>
      <summary class="dashboard-overview-top">
        <div>
          <span>Overview</span>
          <h3>${escapeHtml(overviewHeadline(overview))}</h3>
          <p>${escapeHtml(overviewSummary(overview))}</p>
        </div>
        <div class="dashboard-overview-actions">
          <span class="overview-status status-${escapeAttr(statusClassName)}">${escapeHtml(overviewPriorityLabel(priority))}</span>
          <span class="dashboard-overview-updated">${escapeHtml(updated)}</span>
        </div>
      </summary>
      <div class="dashboard-overview-body">
        <div class="dashboard-overview-toolbar">
          <button class="ghost" type="button" data-dashboard-overview-refresh ${isReviewing ? "disabled" : ""}>${isReviewing ? "Reviewing..." : "Refresh"}</button>
        </div>
        ${overview.summaryBullets?.length ? `
          <ul class="dashboard-overview-bullets">
            ${overview.summaryBullets.slice(0, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        ` : ""}
        ${overview.overall?.reviewText ? `
          <div class="dashboard-overview-next">
            <strong>Overall</strong>
            ${renderOverviewBulletsFromText(overview.overall.reviewText)}
          </div>
        ` : ""}
        ${cards.length ? `
          <div class="dashboard-overview-grid">
            ${cards.map((card) => renderDashboardOverviewCard(card)).join("")}
          </div>
        ` : ""}
        ${overview?.parentNextSteps?.length ? `
          <div class="dashboard-overview-next">
            <strong>Parent next steps</strong>
            <ul>${overview.parentNextSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ul>
          </div>
        ` : ""}
        ${renderOverviewReviewTrace(overviewState.reviewTrace)}
        <div class="dashboard-overview-meta">
          <span>${escapeHtml(source)}</span>
          <span>Last reviewed: ${escapeHtml(updated)}</span>
          ${overview.dataQualityNotes?.length ? `<span>${escapeHtml(overview.dataQualityNotes[0])}</span>` : ""}
          ${statusMessage ? `<span>${escapeHtml(statusMessage)}</span>` : ""}
        </div>
      </div>
    </details>
  `;

  container.querySelector("[data-dashboard-overview-refresh]")?.addEventListener("click", () => {
    maybeRefreshDashboardOverview(true);
  });
  setupOverviewExpanderToggle(container);
  setupOverviewCardDetailsToggle(container);
  setupOverviewTraceToggle(container);
}

function renderOverviewReviewTrace(trace) {
  if (!trace || !Array.isArray(trace.steps) || !trace.steps.length) return "";
  return `
    <details class="dashboard-overview-trace" data-overview-trace ${state.dashboardOverview.reviewTraceOpen ? "open" : ""}>
      <summary>
        <span>Review log</span>
        <span>${escapeHtml(formatDurationMs(trace.totalMs || 0))}</span>
      </summary>
      <div class="overview-trace-body">
        <div class="overview-trace-row overview-trace-row-head">
          <span>Step</span>
          <span>Time</span>
          <span>Details</span>
        </div>
        ${trace.steps.map((step) => `
          <div class="overview-trace-row">
            <span>${escapeHtml(formatTraceStepName(step.name))}</span>
            <span>${escapeHtml(formatDurationMs(step.ms || 0))}</span>
            <span>${escapeHtml(formatTraceDetails(step.details))}</span>
          </div>
        `).join("")}
      </div>
    </details>
  `;
}

function setupOverviewTraceToggle(container) {
  const trace = container.querySelector("[data-overview-trace]");
  if (!trace) return;
  trace.addEventListener("toggle", () => {
    state.dashboardOverview.reviewTraceOpen = trace.open;
    localStorage.setItem("tinyNewborn.dashboardOverview.reviewTraceOpen", trace.open ? "1" : "0");
  });
}

function setupOverviewExpanderToggle(container) {
  const expander = container.querySelector("[data-dashboard-overview-expander]");
  if (!expander) return;
  expander.addEventListener("toggle", () => {
    state.dashboardOverview.overviewOpen = expander.open;
    localStorage.setItem("tinyNewborn.dashboardOverview.overviewOpen", expander.open ? "1" : "0");
  });
}

function setupOverviewCardDetailsToggle(container) {
  container.querySelectorAll("[data-overview-card-details]").forEach((details) => {
    details.addEventListener("toggle", () => {
      const cardId = details.dataset.overviewCardDetails;
      if (!cardId) return;
      if (details.open) {
        state.dashboardOverview.openCardDetails.add(cardId);
      } else {
        state.dashboardOverview.openCardDetails.delete(cardId);
      }
      localStorage.setItem(
        "tinyNewborn.dashboardOverview.openCardDetails",
        JSON.stringify(Array.from(state.dashboardOverview.openCardDetails))
      );
    });
  });
}


function formatDurationMs(ms) {
  const value = Math.max(0, Number(ms) || 0);
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)} s`;
}

function formatTraceStepName(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTraceDetails(details) {
  if (!details || typeof details !== "object") return "";
  return Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${formatTraceStepName(key)}: ${Array.isArray(value) ? value.length : value}`)
    .join(" | ");
}

function overviewHeadline(overview) {
  return overview?.overall?.headline || overview?.summaryTitle || "Recent parent overview";
}

function overviewSummary(overview) {
  return overview?.overall?.oneLineSummary || "Recent logs, care guidance, stool color actions, milestones, and weather in one parent-friendly board.";
}

function overviewUpdatedAt(overviewState, overview) {
  const updatedAt = overviewState.updatedAt || overview?.updatedAt || overview?.reviewMeta?.generatedAt || overview?.overall?.lastReviewedAt || "";
  return updatedAt ? formatAssistantUpdatedAt(updatedAt) : "--";
}

function overviewStatusClass(priority) {
  return String(priority || "insufficient_data").toLowerCase().replace(/[^a-z]+/g, "-");
}

function overviewPriorityLabel(priority) {
  const labels = {
    ok: "No urgent flags",
    watch: "Watch",
    call_doctor: "Call doctor",
    urgent: "Urgent",
    insufficient_data: "Insufficient data"
  };
  return labels[priority] || String(priority || "Insufficient data");
}

function renderDashboardOverviewCard(card) {
  if (card.id) return renderCautiousDashboardOverviewCard(card);
  const confidence = String(card.confidence || "Low").toLowerCase();
  return `
    <article class="dashboard-overview-card">
      <div class="dashboard-overview-card-head">
        <h4>${escapeHtml(card.section || "Overview")}</h4>
        <span class="overview-confidence confidence-${escapeAttr(confidence)}">${escapeHtml(card.confidence || "Low")}</span>
      </div>
      <dl>
        <div>
          <dt>Recent</dt>
          <dd>${escapeHtml(card.recentPattern || "No recent information found.")}</dd>
        </div>
        <div>
          <dt>Meaning</dt>
          <dd>${escapeHtml(card.meaning || "Not enough information yet.")}</dd>
        </div>
        <div>
          <dt>Recommendation</dt>
          <dd>${escapeHtml(card.recommendation || "Keep logging and watch baby cues.")}</dd>
        </div>
      </dl>
      ${card.flags?.length ? `<div class="overview-flags">${card.flags.map((flag) => `<span>${escapeHtml(flag)}</span>`).join("")}</div>` : ""}
    </article>
  `;
}

function renderCautiousDashboardOverviewCard(card) {
  const confidence = String(card.confidence || "low").toLowerCase();
  if (card.review) {
    const headline = card.headline || card.title || "Overview updated";
    const detailBullets = overviewDetailBullets(card);
    const detailsId = card.id || card.title || "overview";
    const detailsOpen = state.dashboardOverview.openCardDetails.has(detailsId);
    return `
      <article class="dashboard-overview-card">
        <div class="dashboard-overview-card-head">
          <h4>${escapeHtml(card.title || "Overview")}</h4>
          <span class="overview-confidence confidence-${escapeAttr(confidence)}">${escapeHtml(card.confidence || "low")}</span>
        </div>
        <p class="overview-card-headline">${escapeHtml(headline)}</p>
        <details class="overview-card-details" data-overview-card-details="${escapeAttr(detailsId)}" ${detailsOpen ? "open" : ""}>
          <summary>Learn more</summary>
          ${detailBullets.length ? `<ul>${detailBullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p>${escapeHtml(card.review)}</p>`}
          ${card.citations?.length ? renderOverviewCitations(card.citations) : ""}
        </details>
      </article>
    `;
  }
  return `
    <article class="dashboard-overview-card">
      <div class="dashboard-overview-card-head">
        <h4>${escapeHtml(card.title || "Overview")}</h4>
        <span class="overview-confidence confidence-${escapeAttr(confidence)}">${escapeHtml(card.confidence || "low")}</span>
      </div>
      <dl>
        <div>
          <dt>Observed</dt>
          <dd>${renderOverviewList(card.observed, "No recent information found.")}</dd>
        </div>
        <div>
          <dt>Meaning</dt>
          <dd>${escapeHtml(card.meaning || "Not enough information yet.")}</dd>
        </div>
        ${card.cannotConclude?.length ? `
          <div>
            <dt>Cannot conclude</dt>
            <dd>${renderOverviewList(card.cannotConclude, "")}</dd>
          </div>
        ` : ""}
        ${card.recommendations?.length ? `
          <div>
            <dt>Recommendations</dt>
            <dd>${renderOverviewList(card.recommendations, "")}</dd>
          </div>
        ` : ""}
        ${card.whenToCallDoctor?.length ? `
          <div>
            <dt>When to call</dt>
            <dd>${renderOverviewList(card.whenToCallDoctor, "")}</dd>
          </div>
        ` : ""}
        ${card.citations?.length ? `
          <div>
            <dt>Sources</dt>
            <dd>${renderOverviewCitations(card.citations)}</dd>
          </div>
        ` : ""}
      </dl>
    </article>
  `;
}

function overviewDetailBullets(card) {
  const bullets = Array.isArray(card.detailBullets) ? card.detailBullets.filter(Boolean).slice(0, 4) : [];
  if (bullets.length) return bullets;
  const review = String(card.review || "");
  return review
    .match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)
    ?.map((item) => item.trim().replace(/[.!?]+$/, ""))
    .filter(Boolean)
    .slice(0, 4) || [];
}

function renderOverviewBulletsFromText(text) {
  const bullets = String(text || "")
    .match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)
    ?.map((item) => item.trim().replace(/[.!?]+$/, ""))
    .filter(Boolean)
    .slice(0, 7) || [];
  if (!bullets.length) return `<p>${escapeHtml(text || "")}</p>`;
  return `<ul>${bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderOverviewCitations(citations) {
  const safeCitations = Array.isArray(citations) ? citations.filter((citation) => citation?.url && citation?.title).slice(0, 3) : [];
  if (!safeCitations.length) return "";
  return `<ul class="overview-sources">${safeCitations.map((citation) => `
    <li><a href="${escapeAttr(citation.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(citation.title)}</a></li>
  `).join("")}</ul>`;
}

function renderOverviewList(items, fallback) {
  const list = Array.isArray(items) ? items.filter(Boolean).slice(0, 3) : [];
  if (!list.length) return escapeHtml(fallback);
  if (list.length === 1) return escapeHtml(list[0]);
  return `<ul>${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function dashboardOverviewSignature() {
  const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const guideline = state.doctorGuideline || {};
  const milestoneGuide = guideline.milestoneGuide || {};
  const recentLogs = state.logs
    .slice()
    .filter((log) => logTime(log) >= cutoff)
    .sort((a, b) => logTime(b) - logTime(a))
    .slice(0, 90)
    .map((log) => ({
      id: log.id,
      type: log.type,
      date: log.date,
      time: log.time,
      status: log.status || "",
      method: log.method || "",
      side: log.side || "",
      ounces: log.ounces || "",
      pee: Boolean(log.pee),
      poop: Boolean(log.poop),
      stat: log.stat || "",
      poopColorId: log.poopColorId || log.poopColor || "",
      notes: log.notes || ""
    }));
  return JSON.stringify({
    birthday: state.profile.birthday || "",
    recent: state.recent || {},
    overviewSettings: state.overviewSettings || {},
    weather: state.weather ? {
      temperature: state.weather.temperature,
      humidity: state.weather.humidity,
      description: state.weather.description
    } : null,
    milestoneProgress: state.milestoneProgress || {},
    doctorGuideline: {
      updatedAt: guideline.updatedAt || "",
      recommendations: arrayGuideValue(guideline.recommendations).map((item) => item.id || item.summary || ""),
      careGuides: Object.keys(objectGuideValue(guideline.careGuides)),
      milestoneDefinitions: arrayGuideValue(milestoneGuide.definitions).map((item) => item.id || item.name || "")
    },
    poopColors: state.poopColors.map((item) => ({
      id: item.id,
      category: item.category,
      parentAction: item.parentAction
    })),
    recentLogs
  });
}

function dashboardOverviewReviewFromPayload(payload) {
  return payload?.publishedReview || payload?.review || payload?.overview || null;
}

function validateDashboardOverviewPayload(payload) {
  const review = dashboardOverviewReviewFromPayload(payload);
  const allowedPriorities = new Set(["ok", "watch", "call_doctor", "urgent", "insufficient_data"]);
  const allowedConfidence = new Set(["high", "medium", "low"]);
  const requiredCards = ["eat", "sleep", "hygiene_diaper", "health", "safety", "exercise", "play"];
  const allowedCards = new Set(requiredCards);
  if (!review || review.schemaVersion !== 1 || review.reviewStatus !== "ready") return false;
  if (!review.overall || !allowedPriorities.has(review.overall.priority) || !allowedConfidence.has(review.overall.confidence)) return false;
  if (!review.overall.headline || !review.overall.oneLineSummary || !review.overall.dataWindowLabel || !review.overall.lastReviewedAt) return false;
  if (!review.overall.reviewText) return false;
  if (!Array.isArray(review.cards) || review.cards.length !== requiredCards.length) return false;
  if (!requiredCards.every((id, index) => review.cards[index]?.id === id)) return false;
  if (!Array.isArray(review.parentNextSteps) || review.parentNextSteps.length < 1 || review.parentNextSteps.length > 10) return false;
  return review.cards.every((card) => (
    allowedCards.has(card.id)
    && card.title
    && allowedPriorities.has(card.priority)
    && allowedConfidence.has(card.confidence)
    && card.review
  ));
}

function loadDashboardOverviewCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(dashboardOverviewCacheKey) || "null");
    if (!cached || !validateDashboardOverviewPayload({ review: cached.publishedReview })) return false;
    const overviewState = state.dashboardOverview;
    overviewState.publishedReview = cached.publishedReview;
    overviewState.pendingReview = null;
    overviewState.status = "ready";
    overviewState.source = cached.source || "rules";
    overviewState.updatedAt = cached.updatedAt || cached.publishedReview.updatedAt || "";
    overviewState.lastInputHash = cached.lastInputHash || "";
    overviewState.serverInputHash = cached.serverInputHash || "";
    overviewState.reviewTrace = cached.reviewTrace || null;
    overviewState.error = "";
    return true;
  } catch (error) {
    return false;
  }
}

function saveDashboardOverviewCache() {
  const overviewState = state.dashboardOverview;
  if (!overviewState.publishedReview) return;
  try {
    localStorage.setItem(dashboardOverviewCacheKey, JSON.stringify({
      publishedReview: overviewState.publishedReview,
      source: overviewState.source || "rules",
      updatedAt: overviewState.updatedAt || overviewState.publishedReview.updatedAt || "",
      lastInputHash: overviewState.lastInputHash || "",
      serverInputHash: overviewState.serverInputHash || "",
      reviewTrace: overviewState.reviewTrace || null
    }));
  } catch (error) {
    // Cache failures should never block the displayed review.
  }
}

function publishDashboardOverviewReviewAtomically(payload, clientInputHash) {
  const overviewState = state.dashboardOverview;
  const pendingReview = overviewState.pendingReview;
  if (!pendingReview) throw new Error("Overview review was not staged.");
  overviewState.publishedReview = pendingReview;
  overviewState.pendingReview = null;
  overviewState.status = "ready";
  overviewState.source = payload.source || "rules";
  overviewState.updatedAt = payload.updatedAt || pendingReview.updatedAt || new Date().toISOString();
  overviewState.lastInputHash = clientInputHash;
  overviewState.serverInputHash = payload.inputHash || "";
  overviewState.reviewTrace = payload.reviewTrace || null;
  overviewState.error = "";
  saveDashboardOverviewCache();
}

function startDashboardOverviewReviews() {
  const overviewState = state.dashboardOverview;
  const loadedFromCache = !overviewState.publishedReview && loadDashboardOverviewCache();
  if (loadedFromCache) renderDashboardOverview();
  if (overviewState.timerId) clearInterval(overviewState.timerId);
  const isManualOnly = state.overviewSettings?.reviewMode === "gpt_strict";
  if (!overviewState.publishedReview) {
    maybeRefreshDashboardOverview(false, isManualOnly ? "rules_only" : "");
  }
  const intervalMinutes = Math.max(1, Math.min(60, Number(state.overviewSettings?.refreshIntervalMinutes) || 5));
  overviewState.timerId = setInterval(() => {
    if (state.overviewSettings?.reviewMode === "gpt_strict") return;
    maybeRefreshDashboardOverview(false);
  }, intervalMinutes * 60 * 1000);
}

async function maybeRefreshDashboardOverview(force = false, reviewModeOverride = "") {
  const overviewState = state.dashboardOverview;
  if (overviewState.status === "reviewing") {
    renderDashboardOverview();
    return;
  }
  const inputHash = dashboardOverviewSignature();
  if (!force && !reviewModeOverride && overviewState.publishedReview && state.overviewSettings?.reviewMode === "gpt_strict") return;
  if (!force && overviewState.publishedReview && inputHash === overviewState.lastInputHash) return;
  const requestOverviewSettings = {
    ...(state.overviewSettings || {}),
    ...(reviewModeOverride ? { reviewMode: reviewModeOverride } : {})
  };

  overviewState.status = "reviewing";
  overviewState.pendingReview = null;
  overviewState.error = "";
  renderDashboardOverview();

  try {
    const payload = await fetchJson("/api/dashboard-overview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        days: requestOverviewSettings.reviewWindowDays || 3,
        overviewSettings: requestOverviewSettings,
        weather: state.weather ? {
          temperature: state.weather.temperature,
          humidity: state.weather.humidity,
          description: state.weather.description,
          icon: state.weather.icon
        } : null
      })
    });
    if (!validateDashboardOverviewPayload(payload)) throw new Error("Overview response did not pass validation.");
    overviewState.pendingReview = dashboardOverviewReviewFromPayload(payload);
    publishDashboardOverviewReviewAtomically(payload, inputHash);
  } catch (error) {
    overviewState.pendingReview = null;
    overviewState.status = "error";
    overviewState.reviewTrace = error.payload?.reviewTrace || overviewState.reviewTrace;
    overviewState.error = overviewState.publishedReview
      ? `Could not refresh review: ${error.message}. Showing last review.`
      : `Could not prepare overview: ${error.message}.`;
  }
  renderDashboardOverview();
}

function renderDashboard() {
  syncDashboardDateInputs();
  renderDashboardOverview();

  const chart = document.getElementById("dashboard-chart");
  const detail = document.getElementById("dashboard-event-detail");
  const zoomLabel = document.getElementById("dashboard-zoom-label");
  const zoomOut = document.getElementById("dashboard-zoom-out");
  const zoomIn = document.getElementById("dashboard-zoom-in");
  if (!chart || !detail) return;

  const rangeLogs = dashboardLogsInSelectedRange();
  const logs = filteredDashboardLogs(rangeLogs);
  const rows = dashboardRows(rangeLogs);
  const totals = rows.map((row) => [row.label, logs.filter((log) => log.type === row.value).length]);
  detail.innerHTML = logs.length
    ? `<strong>${logs.length} events</strong><span>${escapeHtml(totals.filter(([, count]) => count).map(([label, count]) => `${label}: ${count}`).join(" · "))}</span>`
    : `<strong>No events</strong><span>Try a wider date range or more event types.</span>`;
  const visible = dashboardVisibleRangeMs();
  const zoom = visible.zoom || 1;
  if (zoomLabel) zoomLabel.textContent = `${formatZoomLabel(zoom)} · ${formatVisibleWindowLabel(visible)}`;
  if (zoomOut) zoomOut.disabled = zoom <= 1;
  if (zoomIn) zoomIn.disabled = zoom >= dashboardMaxZoom;

  chart.innerHTML = rangeLogs.length ? renderDashboardChart(logs, rows, rangeLogs) : `<p class="empty-state">No events match these dashboard filters.</p>`;
  renderDashboardAnalytics(rangeLogs);
  setupTrendPlotInteractions();

  chart.querySelectorAll("[data-dashboard-log]").forEach((point) => {
    const show = () => showDashboardEvent(point.dataset.dashboardLog);
    point.addEventListener("mouseenter", show);
    point.addEventListener("focus", show);
    point.addEventListener("click", show);
    point.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        show();
      }
    });
  });
  chart.querySelectorAll("[data-dashboard-period-start]").forEach((item) => {
    const show = () => showDashboardPeriod(item.dataset.dashboardPeriodStart, item.dataset.dashboardPeriodEnd || "");
    item.addEventListener("mouseenter", show);
    item.addEventListener("focus", show);
    item.addEventListener("click", show);
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        show();
      }
    });
  });
  renderDashboardSelection();
}

function renderDashboardAnalytics(rangeLogs) {
  const container = document.getElementById("dashboard-analytics");
  if (!container) return;

  const analytics = buildDashboardAnalytics(rangeLogs);
  container.innerHTML = `
    <section class="analytics-section">
      <div class="section-heading">
        <h3>Duration Events</h3>
        <p>Period-based activities in this date range.</p>
      </div>
      <div class="analytics-grid">
        ${analytics.durationStats.length ? analytics.durationStats.map(renderDurationStatCard).join("") : `<p class="empty-state">No completed duration events in this range.</p>`}
      </div>
    </section>
    <section class="analytics-section">
      <div class="section-heading">
        <h3>Quick Events</h3>
        <p>Counts and amounts for instant logs.</p>
      </div>
      <div class="analytics-grid">
        ${analytics.quickStats.length ? analytics.quickStats.map(renderQuickStatCard).join("") : `<p class="empty-state">No quick events in this range.</p>`}
      </div>
    </section>
    <section class="analytics-section">
      <div class="section-heading">
        <h3>Feeding Rhythm</h3>
        <p>Time from the previous feed to care events.</p>
      </div>
      <div class="analytics-grid">
        ${analytics.intervalStats.length ? analytics.intervalStats.map(renderIntervalStatCard).join("") : `<p class="empty-state">Not enough feeding rhythm data yet.</p>`}
      </div>
    </section>
    <section class="analytics-section">
      <div class="section-heading">
        <h3>Trends</h3>
        <p>Daily plots for parenting patterns and reports.</p>
      </div>
      <div class="plot-grid">
        ${analytics.plots.map(renderLinePlot).join("")}
      </div>
    </section>
  `;
  setupHelpTooltips(container);
}

function buildDashboardAnalytics(rangeLogs) {
  const periodRecords = dashboardEventPairs(rangeLogs)
    .filter((period) => !period.active)
    .map(({ startLog, endLog }) => ({
      type: startLog.type,
      label: labelForType(startLog.type),
      startLog,
      endLog,
      duration: logTime(endLog) - logTime(startLog)
    }))
    .filter((period) => period.duration > 0);

  const durationStats = Object.values(periodRecords.reduce((acc, period) => {
    acc[period.type] = acc[period.type] || { type: period.type, label: period.label, total: 0, count: 0, longest: period };
    acc[period.type].total += period.duration;
    acc[period.type].count += 1;
    if (period.duration > acc[period.type].longest.duration) acc[period.type].longest = period;
    return acc;
  }, {})).map((item) => ({ ...item, average: item.total / item.count }));

  const quickLogs = rangeLogs.filter((log) => eventCategory(log.type).kind !== "period");
  const quickStats = Object.values(quickLogs.reduce((acc, log) => {
    const key = log.type === "diaper" ? (log.poop ? "poop" : "pee") : log.type;
    const label = log.type === "diaper" ? (log.poop ? "Poo" : "Pee") : labelForType(log.type);
    acc[key] = acc[key] || { key, label, count: 0, amounts: [], weights: [], heights: [] };
    acc[key].count += 1;
    if (log.type === "bottle" && Number.isFinite(Number(log.ounces))) acc[key].amounts.push(Number(log.ounces));
    if (log.type === "growth_stats" && readWeightGrams(log) > 0) acc[key].weights.push(readWeightGrams(log));
    if (log.type === "growth_stats" && readHeightMm(log) > 0) acc[key].heights.push(readHeightMm(log));
    return acc;
  }, {})).map((item) => ({
    ...item,
    averageAmount: item.amounts.length ? item.amounts.reduce((sum, value) => sum + value, 0) / item.amounts.length : null,
    totalAmount: item.amounts.reduce((sum, value) => sum + value, 0),
    latestWeightGrams: item.weights.length ? item.weights[item.weights.length - 1] : null,
    latestHeightMm: item.heights.length ? item.heights[item.heights.length - 1] : null
  }));

  const intervalStats = buildFeedingIntervalStats(rangeLogs);
  const plots = buildDashboardPlots(rangeLogs, periodRecords);
  return { durationStats, quickStats, intervalStats, plots };
}

function renderDurationStatCard(stat) {
  return `
    <article class="analytics-card">
      <h4>${escapeHtml(stat.label)} ${helpIcon("Total, count, average period length, and longest period in the selected range.")}</h4>
      <strong>${escapeHtml(formatCompactDuration(stat.total))}</strong>
      <span>${stat.count} times · avg ${escapeHtml(formatCompactDuration(stat.average))}</span>
      <small>Longest: ${escapeHtml(formatCompactDuration(stat.longest.duration))}, ${escapeHtml(formatLogClock(stat.longest.startLog))} to ${escapeHtml(formatLogClock(stat.longest.endLog))}</small>
    </article>
  `;
}

function renderQuickStatCard(stat) {
  const growth = stat.latestWeightGrams == null && stat.latestHeightMm == null
    ? ""
    : `<small>Latest: ${stat.latestWeightGrams ? formatMeasurement(Number(formatUnitValue(stat.latestWeightGrams, state.weightUnit, "weight")), state.weightUnit) : "--"} - ${stat.latestHeightMm ? formatMeasurement(Number(formatUnitValue(stat.latestHeightMm, state.heightUnit, "height")), state.heightUnit) : "--"}</small>`;
  const amount = stat.averageAmount == null ? "" : `<small>Avg amount: ${Number(stat.averageAmount.toFixed(2))} oz · total ${Number(stat.totalAmount.toFixed(2))} oz</small>`;
  return `
    <article class="analytics-card">
      <h4>${escapeHtml(stat.label)} ${helpIcon("How many times this quick event happened. Bottle also shows average and total amount.")}</h4>
      <strong>${stat.count}</strong>
      <span>times</span>
      ${amount}
      ${growth}
    </article>
  `;
}

function renderIntervalStatCard(stat) {
  return `
    <article class="analytics-card">
      <h4>${escapeHtml(stat.label)} ${helpIcon("Average elapsed time from the previous feeding or bottle to this event.")}</h4>
      <strong>${escapeHtml(formatCompactDuration(stat.average))}</strong>
      <span>${stat.count} matched events</span>
      <small>Range: ${escapeHtml(formatCompactDuration(stat.min))} to ${escapeHtml(formatCompactDuration(stat.max))}</small>
    </article>
  `;
}

function helpIcon(text) {
  return `<button class="help-icon" type="button" title="${escapeAttr(text)}" aria-label="${escapeAttr(text)}" data-help-text="${escapeAttr(text)}">?</button>`;
}

function setupHelpTooltips(container = document) {
  container.querySelectorAll("[data-help-text]").forEach((button) => {
    const show = () => showToast(button.dataset.helpText || "");
    button.addEventListener("mouseenter", show);
    button.addEventListener("focus", show);
    button.addEventListener("click", show);
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        show();
      }
    });
  });
}

function buildFeedingIntervalStats(rangeLogs) {
  const allFeeds = state.logs
    .filter((log) => log.type === "feeding" || log.type === "bottle")
    .sort((a, b) => logTime(a) - logTime(b));
  const targets = [
    { key: "pee", label: "Previous feed to pee", test: (log) => log.type === "diaper" && log.pee },
    { key: "poop", label: "Previous feed to poo", test: (log) => log.type === "diaper" && log.poop },
    { key: "bath", label: "Previous feed to bath", test: (log) => log.type === "bath" && log.status === "start" }
  ];

  return targets.map((target) => {
    const values = rangeLogs
      .filter(target.test)
      .map((log) => {
        const time = logTime(log);
        const previous = [...allFeeds].reverse().find((feed) => logTime(feed) < time);
        return previous ? time - logTime(previous) : null;
      })
      .filter((value) => value != null && value >= 0);
    if (!values.length) return null;
    return {
      key: target.key,
      label: target.label,
      count: values.length,
      average: values.reduce((sum, value) => sum + value, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }).filter(Boolean);
}

function buildDashboardPlots(rangeLogs, periodRecords) {
  const days = dashboardDateKeys();
  const sleepSessions = getSleepSessionRecords(periodRecords);
  let latestWeight = 0;
  let latestHeight = 0;
  const dayRows = days.map((date) => {
    const logs = rangeLogs.filter((log) => log.date === date);
    const bottles = logs.filter((log) => log.type === "bottle" && Number.isFinite(Number(log.ounces)));
    const stats = logs.filter((log) => log.type === "growth_stats");
    const sortedStats = stats.sort((a, b) => logTime(a) - logTime(b));
    const weightStats = sortedStats.filter((log) => readWeightGrams(log) > 0);
    const heightStats = sortedStats.filter((log) => readHeightMm(log) > 0);
    const latestWeightStats = weightStats[weightStats.length - 1];
    const latestHeightStats = heightStats[heightStats.length - 1];
    if (latestWeightStats) latestWeight = readWeightGrams(latestWeightStats);
    if (latestHeightStats) latestHeight = readHeightMm(latestHeightStats);
    const sleep = sleepSessions.filter((session) => session.date === date);
    const tummy = periodRecords.filter((period) => period.type === "tummy_time" && period.startLog.date === date);
    const outdoor = periodRecords.filter((period) => period.type === "outdoor_time" && period.startLog.date === date);
    const sleepDay = sleep.filter((session) => session.period === "daytime").reduce((sum, session) => sum + session.durationMinutes, 0);
    const sleepNight = sleep.filter((session) => session.period === "nighttime").reduce((sum, session) => sum + session.durationMinutes, 0);
    return {
      date,
      milkAvg: bottles.length ? bottles.reduce((sum, log) => sum + Number(log.ounces || 0), 0) / bottles.length : 0,
      weight: Number(formatUnitValue(latestWeight, state.weightUnit, "weight") || 0),
      height: Number(formatUnitValue(latestHeight, state.heightUnit, "height") || 0),
      sleepDay,
      sleepNight,
      sleepDayAvg: getAverageSleepSessionDuration(sleep.filter((session) => session.period === "daytime")),
      sleepNightAvg: getAverageSleepSessionDuration(sleep.filter((session) => session.period === "nighttime")),
      pee: logs.filter((log) => log.type === "diaper" && log.pee).length,
      poop: logs.filter((log) => log.type === "diaper" && log.poop).length,
      tummyAvg: tummy.length ? tummy.reduce((sum, period) => sum + period.duration, 0) / tummy.length / 60000 : 0,
      outdoorTotal: outdoor.reduce((sum, period) => sum + period.duration, 0) / 60000
    };
  });

  return [
    {
      title: "Average Milk Per Bottle",
      help: "Average bottle ounces per bottle feeding each day.",
      unit: "oz",
      series: [{ label: "Milk", values: dayRows.map((row) => row.milkAvg), color: eventCategory("bottle").color }],
      labels: days
    },
    {
      title: "Weight",
      help: "Latest logged weight for each day.",
      unit: state.weightUnit,
      series: [{ label: "Weight", values: dayRows.map((row) => row.weight), color: eventCategory("growth_stats").color }],
      labels: days
    },
    {
      title: "Height",
      help: "Latest logged height for each day.",
      unit: state.heightUnit,
      series: [{ label: "Height", values: dayRows.map((row) => row.height), color: "#365f91" }],
      labels: days
    },
    {
      title: "Sleep Time",
      help: "Daytime 9:00 AM to 6:00 PM. Nighttime 6PM to 9AM. If a sleep session crosses daytime/nighttime boundaries, it is counted toward whichever period contains the majority of that session.",
      unit: "duration",
      series: [
        { label: "Daytime sleep", values: dayRows.map((row) => row.sleepDay), color: "#4078b9" },
        { label: "Nighttime sleep", values: dayRows.map((row) => row.sleepNight), color: "#10243f" }
      ],
      labels: days
    },
    {
      title: "Average Sleep Session",
      help: "Average length of completed sleep sessions by start date, split by daytime and nighttime majority classification.",
      unit: "duration",
      series: [
        { label: "Daytime average", values: dayRows.map((row) => row.sleepDayAvg), color: "#4078b9" },
        { label: "Nighttime average", values: dayRows.map((row) => row.sleepNightAvg), color: "#10243f" }
      ],
      labels: days
    },
    {
      title: "Diaper Counts",
      help: "Daily pee and poo event counts.",
      unit: "count",
      series: [
        { label: "Pee", values: dayRows.map((row) => row.pee), color: "#d99a2b" },
        { label: "Poo", values: dayRows.map((row) => row.poop), color: "#8f5f2f" }
      ],
      labels: days
    },
    {
      title: "Average Tummy Time",
      help: "Average completed tummy-time session length each day.",
      unit: "min",
      series: [{ label: "Tummy", values: dayRows.map((row) => row.tummyAvg), color: eventCategory("tummy_time").color }],
      labels: days
    },
    {
      title: "Outdoor Time",
      help: "Total completed outdoor-time minutes each day.",
      unit: "min",
      series: [{ label: "Outdoor", values: dayRows.map((row) => row.outdoorTotal), color: eventCategory("outdoor_time").color }],
      labels: days
    }
  ];
}

function getSleepSessionRecords(periodRecords) {
  return periodRecords
    .filter((period) => period.type === "sleep" && !period.active && period.endLog)
    .map((period) => {
      const startTime = logTime(period.startLog);
      const endTime = logTime(period.endLog);
      const classification = classifySleepSessionByMajority(startTime, endTime);
      return {
        ...period,
        date: period.startLog.date,
        period: classification.period,
        durationMinutes: classification.totalMinutes,
        daytimeMinutes: classification.daytimeMinutes,
        nighttimeMinutes: classification.nighttimeMinutes
      };
    })
    .filter((session) => session.durationMinutes > 0);
}

function classifySleepSessionByMajority(startTime, endTime) {
  const startMs = Number(startTime);
  const endMs = Number(endTime);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return { period: "nighttime", daytimeMinutes: 0, nighttimeMinutes: 0, totalMinutes: 0 };
  }

  let daytimeMs = 0;
  const cursor = new Date(startMs);
  cursor.setHours(0, 0, 0, 0);

  // Daytime is 9:00 AM to 6:00 PM for each local calendar day touched by the session.
  // If daytime and nighttime minutes tie exactly, default to nighttime for consistency.
  while (cursor.getTime() < endMs) {
    const dayStart = new Date(cursor);
    dayStart.setHours(9, 0, 0, 0);
    const dayEnd = new Date(cursor);
    dayEnd.setHours(18, 0, 0, 0);
    daytimeMs += Math.max(0, Math.min(endMs, dayEnd.getTime()) - Math.max(startMs, dayStart.getTime()));
    cursor.setDate(cursor.getDate() + 1);
  }

  const totalMs = endMs - startMs;
  const nighttimeMs = Math.max(0, totalMs - daytimeMs);
  return {
    period: daytimeMs > nighttimeMs ? "daytime" : "nighttime",
    daytimeMinutes: Math.round(daytimeMs / 60000),
    nighttimeMinutes: Math.round(nighttimeMs / 60000),
    totalMinutes: Math.round(totalMs / 60000)
  };
}

function getAverageSleepSessionDuration(sessions) {
  if (!sessions.length) return 0;
  return sessions.reduce((sum, session) => sum + session.durationMinutes, 0) / sessions.length;
}

function dashboardDateKeys() {
  const selected = dashboardSelectedRangeMs();
  const dates = [];
  let cursor = selected.start;
  while (cursor <= selected.end) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function renderLinePlot(plot) {
  const flat = plot.series.flatMap((series) => series.values);
  const max = Math.max(1, ...flat);
  const latest = plot.series.map((series) => `${series.label}: ${formatPlotValue(series.values[series.values.length - 1] || 0, plot.unit)}`).join(" · ");
  const latestIndex = Math.max(0, plot.labels.length - 1);
  const latestDate = plot.labels[latestIndex] || "";
  const width = 520;
  const height = 210;
  const left = 42;
  const right = 18;
  const top = 20;
  const bottom = 34;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const xFor = (index) => left + (plot.labels.length <= 1 ? 0 : index / (plot.labels.length - 1)) * plotWidth;
  const yFor = (value) => top + (1 - value / max) * plotHeight;
  const seriesMarkup = plot.series.map((series, seriesIndex) => {
    const points = series.values.map((value, index) => `${xFor(index)},${yFor(value)}`).join(" ");
    const dots = series.values.map((value, index) => {
      const label = plot.labels[index] || "";
      const formattedDate = formatDisplayDate(label);
      const formattedValue = formatPlotValue(value, plot.unit);
      const ariaLabel = `${plot.title}, ${series.label}, ${formattedDate}, ${formattedValue}`;
      return `
        <g class="plot-point" tabindex="0" role="button"
          data-plot-point
          data-series="${escapeAttr(series.label)}"
          data-date="${escapeAttr(formattedDate)}"
          data-value="${escapeAttr(formattedValue)}"
          data-series-index="${seriesIndex}"
          aria-label="${escapeAttr(ariaLabel)}">
          <circle class="plot-point-hit" cx="${xFor(index)}" cy="${yFor(value)}" r="12"></circle>
          <circle class="plot-point-dot" cx="${xFor(index)}" cy="${yFor(value)}" r="4.6" fill="${escapeAttr(series.color)}">
            <title>${escapeHtml(`${formattedDate}: ${formattedValue}`)}</title>
          </circle>
        </g>
      `;
    }).join("");
    return `<polyline points="${points}" fill="none" stroke="${series.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>${dots}`;
  }).join("");
  const legend = plot.series.map((series) => `<span><i style="background:${series.color}"></i>${escapeHtml(series.label)}</span>`).join("");

  return `
    <article class="plot-card">
      <div>
        <h4>${escapeHtml(plot.title)} ${helpIcon(plot.help)}</h4>
        <p>${escapeHtml(latest)}</p>
      </div>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttr(plot.title)} trend">
        <line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" class="plot-axis"></line>
        <line x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}" class="plot-axis"></line>
        <text x="${left - 8}" y="${top + 5}" text-anchor="end">${escapeHtml(formatPlotValue(max, plot.unit))}</text>
        <text x="${left - 8}" y="${height - bottom}" text-anchor="end">0</text>
        ${seriesMarkup}
      </svg>
      <div class="plot-legend">${legend}</div>
      <div class="plot-detail" aria-live="polite">
        <strong>${escapeHtml(latestDate ? formatDisplayDate(latestDate) : "Latest")}</strong>
        <span>${escapeHtml(latest || "No trend data yet")}</span>
      </div>
    </article>
  `;
}

function setupTrendPlotInteractions() {
  document.querySelectorAll("[data-plot-point]").forEach((point) => {
    const show = () => showTrendPlotPoint(point);
    point.addEventListener("mouseenter", show);
    point.addEventListener("focus", show);
    point.addEventListener("click", show);
    point.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        show();
      }
    });
  });
}

function showTrendPlotPoint(point) {
  const card = point.closest(".plot-card");
  const detail = card?.querySelector(".plot-detail");
  if (!card || !detail) return;
  card.querySelectorAll("[data-plot-point]").forEach((item) => {
    item.classList.toggle("active", item === point);
  });
  detail.innerHTML = `
    <strong>${escapeHtml(point.dataset.date || "")}</strong>
    <span>${escapeHtml(point.dataset.series || "Value")}: ${escapeHtml(point.dataset.value || "")}</span>
  `;
}

function formatPlotValue(value, unit) {
  if (unit === "duration") return formatMinutesAsHoursMinutes(value);
  const rounded = Number(value.toFixed(value >= 10 ? 0 : 1));
  return `${rounded} ${unit}`;
}

function formatMeasurement(value, unit) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return `-- ${unit}`;
  return `${Number(number.toFixed(2))} ${unit}`;
}

function formatUnitValue(canonicalValue, unit, kind) {
  const factor = kind === "height" ? heightUnits[unit]?.mm : weightUnits[unit]?.grams;
  const value = Number(canonicalValue) / (factor || 1);
  if (!Number.isFinite(value) || value <= 0) return "";
  if (unit === "g" || unit === "mm") return String(Math.round(value));
  return String(Number(value.toFixed(unit === "kg" || unit === "ft" ? 3 : 2)));
}

function formatWeightLog(log, unit = state.weightUnit) {
  return formatMeasurement(Number(formatUnitValue(readWeightGrams(log), unit, "weight")), unit);
}

function formatHeightLog(log, unit = state.heightUnit) {
  return formatMeasurement(Number(formatUnitValue(readHeightMm(log), unit, "height")), unit);
}

function readWeightGrams(log) {
  if (!log) return 0;
  if (Number.isFinite(Number(log.weightGrams))) return Number(log.weightGrams);
  const unit = log.weightUnit || "lb";
  return Number(log.weight || 0) * (weightUnits[unit]?.grams || weightUnits.lb.grams);
}

function readHeightMm(log) {
  if (!log) return 0;
  if (Number.isFinite(Number(log.heightMm))) return Number(log.heightMm);
  const unit = log.heightUnit || "in";
  return Number(log.height || 0) * (heightUnits[unit]?.mm || heightUnits.in.mm);
}

function lastGrowthLog(stat) {
  return state.logs
    .filter((log) => log.type === "growth_stats")
    .filter((log) => {
      if (stat === "weight") return log.stat === "weight" || (!log.stat && (log.weight || log.weightGrams));
      return log.stat === "height" || (!log.stat && (log.height || log.heightMm));
    })
    .sort((a, b) => logTime(b) - logTime(a))[0] || null;
}

function dashboardLogsInSelectedRange() {
  const filters = state.dashboardFilters || {};
  const startDate = filters.startDate || todayString();
  const endDate = filters.endDate || startDate;
  const [start, end] = startDate <= endDate ? [startDate, endDate] : [endDate, startDate];
  const types = filters.types || ["all"];
  return state.logs
    .filter((log) => {
      if (log.date < start || log.date > end) return false;
      if (!types.includes("all") && !types.includes(log.type)) return false;
      return true;
    })
    .sort((a, b) => logTime(a) - logTime(b));
}

function filteredDashboardLogs(logs = dashboardLogsInSelectedRange()) {
  const visible = dashboardVisibleRangeMs();
  return logs.filter((log) => {
    const time = logTime(log);
    return time >= visible.startTime && time <= visible.endTime;
  });
}

function dashboardRows(logs) {
  const selected = state.dashboardFilters.types || ["all"];
  const base = selected.includes("all")
    ? historyEventTypes.filter((type) => type.value !== "all")
    : historyEventTypes.filter((type) => selected.includes(type.value));
  const withLoggedTypes = logs.reduce((rows, log) => {
    if (!rows.some((row) => row.value === log.type)) rows.push({ value: log.type, label: labelForType(log.type) });
    return rows;
  }, [...base]);
  return withLoggedTypes;
}

function renderDashboardChart(logs, rows, rangeLogs = logs) {
  const filters = state.dashboardFilters;
  const visible = dashboardVisibleRangeMs();
  const startTime = visible.startTime;
  const endTime = visible.endTime;
  const span = Math.max(1, endTime - startTime);
  const left = dashboardPlotLeft;
  const right = 28;
  const top = 40;
  const rowHeight = 58;
  const bottom = 58;
  const plotWidth = dashboardRenderedPlotWidth();
  const width = left + plotWidth + right;
  const height = top + bottom + Math.max(1, rows.length) * rowHeight;
  const now = Date.now();
  const showNow = now >= startTime && now <= endTime;
  const nowX = left + ((now - startTime) / span) * plotWidth;
  const tickCount = span <= 24 * 60 * 60 * 1000 ? 7 : Math.min(12, Math.max(2, Math.ceil(span / (24 * 60 * 60 * 1000)) + 1));
  const toX = (time) => left + ((time - startTime) / span) * plotWidth;
  const rowY = (type) => {
    const rowIndex = Math.max(0, rows.findIndex((row) => row.value === type));
    return top + rowIndex * rowHeight + rowHeight / 2;
  };

  const rowLines = rows.map((row, index) => {
    const y = top + index * rowHeight + rowHeight / 2;
    return `
      <text class="dashboard-axis-label" x="${left - 14}" y="${y + 5}" text-anchor="end">${escapeHtml(row.label)}</text>
      <line class="dashboard-row-line" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"></line>
    `;
  }).join("");

  const ticks = Array.from({ length: tickCount }, (_, index) => {
    const ratio = tickCount === 1 ? 0 : index / (tickCount - 1);
    const x = left + ratio * plotWidth;
    const date = new Date(startTime + span * ratio);
    return `
      <line class="dashboard-tick" x1="${x}" y1="${top - 12}" x2="${x}" y2="${height - bottom + 12}"></line>
      <text class="dashboard-time-label" x="${x}" y="${height - 18}" text-anchor="middle">${escapeHtml(formatDashboardTick(date, span))}</text>
    `;
  }).join("");

  const periodItems = dashboardEventPairs(rangeLogs).filter(({ startLog, endLog, active }) => {
    const periodEnd = active ? now : logTime(endLog);
    return periodEnd >= startTime && logTime(startLog) <= endTime;
  }).map(({ startLog, endLog, active }) => {
    const effectiveEnd = active ? now : logTime(endLog);
    const x1 = toX(Math.max(startTime, logTime(startLog)));
    const x2 = toX(Math.min(endTime, effectiveEnd));
    const y = rowY(startLog.type);
    const category = eventCategory(startLog.type);
    const color = category.color;
    const duration = formatCompactDuration(effectiveEnd - logTime(startLog));
    const label = active
      ? `${category.label} running ${duration}, started ${formatLogClock(startLog)}`
      : `${category.label} ${duration}, ${formatLogClock(startLog)} to ${formatLogClock(endLog)}`;
    const barX = Math.min(x1, x2);
    const barWidth = Math.max(12, Math.abs(x2 - x1));
    const labelX = barX + barWidth / 2;
    const iconX = Math.min(width - right - 28, Math.max(left, barX + 7));
    const showLabel = barWidth >= 62;
    return `
      <rect class="dashboard-period-bar${active ? " active" : ""}" data-dashboard-period-start="${escapeAttr(startLog.id)}" data-dashboard-period-end="${escapeAttr(endLog?.id || "")}"
        x="${barX}" y="${y - 16}" width="${barWidth}" height="32" rx="16" fill="${color}">
        <title>${escapeHtml(label)}</title>
      </rect>
      <circle class="dashboard-period-icon-glow${active ? " active" : ""}" cx="${iconX + 14}" cy="${y}" r="20" fill="${color}"></circle>
      <circle class="dashboard-icon-avatar" data-dashboard-period-start="${escapeAttr(startLog.id)}" data-dashboard-period-end="${escapeAttr(endLog?.id || "")}" cx="${iconX + 14}" cy="${y}" r="14"></circle>
      <image class="dashboard-period-icon${active ? " active" : ""}" data-dashboard-period-start="${escapeAttr(startLog.id)}" data-dashboard-period-end="${escapeAttr(endLog?.id || "")}"
        href="${escapeAttr(category.icon)}" x="${iconX}" y="${y - 14}" width="28" height="28" tabindex="0" role="button" aria-label="${escapeAttr(label)}"></image>
      ${showLabel ? `<text class="dashboard-duration-label" x="${labelX}" y="${y + 5}" text-anchor="middle">${escapeHtml(duration)}</text>` : ""}
    `;
  }).join("");

  const quickMarks = logs.filter((log) => eventCategory(log.type).kind !== "period").map((log) => {
    const x = toX(logTime(log));
    const y = rowY(log.type);
    const category = eventCategory(log.type);
    const label = `${labelForLog(log)} at ${formatLogClock(log)} on ${formatDisplayDate(log.date)}`;
    return `
      <circle class="dashboard-quick-bg dashboard-event-icon-glow" cx="${x}" cy="${y}" r="18" fill="${escapeAttr(category.color)}"></circle>
      <circle class="dashboard-icon-avatar" data-dashboard-log="${escapeAttr(log.id)}" cx="${x}" cy="${y}" r="13"></circle>
      <image class="dashboard-event-icon" data-dashboard-log="${escapeAttr(log.id)}" tabindex="0" role="button"
        aria-label="${escapeAttr(label)}" href="${escapeAttr(iconForLog(log))}" x="${x - 13}" y="${y - 13}" width="26" height="26">
        <title>${escapeHtml(label)}</title>
      </image>
    `;
  }).join("");

  return `
    <svg width="${width}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttr(dashboardRangeLabel())} event timeline">
      <rect class="dashboard-plot-bg" x="${left}" y="${top - 18}" width="${plotWidth}" height="${height - top - bottom + 36}" rx="8"></rect>
      ${ticks}
      ${rowLines}
      ${periodItems}
      ${showNow ? `
        <line class="dashboard-now-line" x1="${nowX}" y1="${top - 18}" x2="${nowX}" y2="${height - bottom + 18}"></line>
        <text class="dashboard-now-label" x="${Math.min(width - right - 42, nowX + 8)}" y="${top - 24}">Now</text>
      ` : ""}
      ${quickMarks}
    </svg>
  `;
}

function dashboardEventPairs(logs) {
  const pending = {};
  const pairs = [];

  logs.forEach((log) => {
    const config = pairedConfig(log.type);
    if (!config) return;
    if (log.status === config.start) {
      pending[log.type] = log;
      return;
    }
    if (log.status === config.end && pending[log.type]) {
      pairs.push({ startLog: pending[log.type], endLog: log });
      pending[log.type] = null;
    }
  });

  Object.values(pending)
    .filter(Boolean)
    .forEach((startLog) => pairs.push({ startLog, endLog: null, active: true }));

  return pairs;
}

function showDashboardEvent(logId) {
  state.dashboardSelection = { kind: "quick", logId };
  renderDashboardEventDetail(logId);
}

function renderDashboardEventDetail(logId) {
  const detail = document.getElementById("dashboard-event-detail");
  const log = state.logs.find((item) => item.id === logId);
  if (!detail || !log) return;
  detail.innerHTML = `
    <img src="${activityIconForLog(log)}" alt="">
    <div>
      <strong>${escapeHtml(labelForLog(log))}</strong>
      <span>${escapeHtml(formatDisplayDate(log.date))} · ${escapeHtml(formatLogClock(log))}${log.notes ? ` · ${escapeHtml(log.notes)}` : ""}</span>
    </div>
  `;
}

function showDashboardPeriod(startId, endId) {
  state.dashboardSelection = { kind: "period", startId, endId };
  renderDashboardPeriodDetail(startId, endId);
}

function renderDashboardPeriodDetail(startId, endId) {
  const detail = document.getElementById("dashboard-event-detail");
  const startLog = state.logs.find((item) => item.id === startId);
  const endLog = state.logs.find((item) => item.id === endId);
  if (!detail || !startLog) return;
  const category = eventCategory(startLog.type);
  const active = !endLog;
  const endTime = active ? Date.now() : logTime(endLog);
  const duration = formatCompactDuration(endTime - logTime(startLog));
  const endLabel = active ? "still going" : formatLogClock(endLog);
  if (active) {
    detail.innerHTML = `
      <img src="${escapeAttr(category.icon)}" alt="">
      <div>
        <strong>${escapeHtml(category.label)} - ${escapeHtml(duration)} so far</strong>
        <span>${escapeHtml(formatDisplayDate(startLog.date))} - ${escapeHtml(formatLogClock(startLog))} to ${escapeHtml(endLabel)}</span>
      </div>
    `;
    return;
  }
  detail.innerHTML = `
    <img src="${escapeAttr(category.icon)}" alt="">
    <div>
      <strong>${escapeHtml(category.label)} · ${escapeHtml(duration)}</strong>
      <span>${escapeHtml(formatDisplayDate(startLog.date))} · ${escapeHtml(formatLogClock(startLog))} to ${escapeHtml(formatLogClock(endLog))}</span>
    </div>
  `;
}

function renderDashboardSelection() {
  const selection = state.dashboardSelection;
  if (!selection) return;
  if (selection.kind === "quick") {
    renderDashboardEventDetail(selection.logId);
    return;
  }
  if (selection.kind === "period") renderDashboardPeriodDetail(selection.startId, selection.endId || "");
}

function renderDashboardDetailSummary(logs, totals) {
  const detail = document.getElementById("dashboard-event-detail");
  if (!detail) return;
  detail.innerHTML = logs.length
    ? `<strong>${logs.length} events</strong><span>${escapeHtml(totals.filter(([, count]) => count).map(([label, count]) => `${label}: ${count}`).join(" - "))}</span>`
    : `<strong>No events</strong><span>Try a wider date range or more event types.</span>`;
}

function dashboardRangeLabel() {
  const visible = dashboardVisibleRangeMs();
  return formatVisibleWindowLabel(visible);
}

function formatZoomLabel(zoom) {
  if (zoom <= 1.01) return "Full range";
  return `${Number(zoom.toFixed(zoom < 2 ? 1 : 0))}x zoom`;
}

function formatVisibleWindowLabel(visible) {
  const start = new Date(visible.startTime);
  const end = new Date(visible.endTime);
  const sameDay = start.toDateString() === end.toDateString();
  const startText = sameDay
    ? start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : start.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const endText = sameDay
    ? end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : end.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return `${startText} to ${endText}`;
}

function filteredHistoryLogs() {
  const filters = state.historyFilters || {};
  const types = filters.types || ["all"];
  return state.logs
    .filter((log) => {
      if (filters.startDate && log.date < filters.startDate) return false;
      if (filters.endDate && log.date > filters.endDate) return false;
      if (!types.includes("all") && !types.includes(log.type)) return false;
      return true;
    })
    .sort((a, b) => logTime(b) - logTime(a))
    .slice(0, 80);
}

function renderHistoryLogRow(log) {
  return `
    <div class="list-item history-log-row" data-history-row="${escapeAttr(log.id)}">
      <img class="history-log-icon" src="${activityIconForLog(log)}" alt="">
      <div>
        <span>Date</span>
        <strong>${escapeHtml(formatDisplayDate(log.date || ""))}</strong>
      </div>
      <div>
        <span>Time</span>
        <strong>${escapeHtml(formatLogClock(log))}</strong>
      </div>
      <div class="history-log-main">
        <span>${escapeHtml(log.type || "Log")}</span>
        <strong>${escapeHtml(labelForLog(log))}</strong>
        ${log.notes ? `<small>${escapeHtml(log.notes)}</small>` : ""}
      </div>
      ${renderLogMenu(log)}
    </div>
  `;
}

function startHistoryEdit(logId) {
  const log = state.logs.find((item) => item.id === logId);
  const row = Array.from(document.querySelectorAll("[data-history-row]")).find((item) => item.dataset.historyRow === logId);
  if (!log || !row) return;

  row.outerHTML = `
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
      <button class="ghost history-cancel" type="button" data-history-cancel="${escapeAttr(log.id)}">Cancel</button>
      <p class="history-status" aria-live="polite">${escapeHtml(labelForLog(log))}</p>
    </form>
  `;

  const form = Array.from(document.querySelectorAll(".history-editor")).find((item) => item.dataset.logId === logId);
  form.addEventListener("submit", saveHistoryCorrection);
  form.querySelector("[data-history-cancel]").addEventListener("click", renderHistory);
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

  if (log.type === "outdoor_time") {
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

  if (log.type === "growth_stats") {
    const stat = log.stat === "height" || (!log.stat && readHeightMm(log) > 0 && readWeightGrams(log) <= 0) ? "height" : "weight";
    if (stat === "height") {
      const unit = log.heightUnit || state.heightUnit;
      return `
        <input name="stat" type="hidden" value="height">
        <label>
          Height
          <input name="height" type="number" min="0" max="3000" step="0.01" value="${escapeAttr(formatUnitValue(readHeightMm(log), unit, "height"))}">
        </label>
        <label>
          Unit
          <select name="heightUnit">
            ${Object.keys(heightUnits).map((item) => `<option value="${item}"${item === unit ? " selected" : ""}>${item}</option>`).join("")}
          </select>
        </label>
      `;
    }

    const unit = log.weightUnit || state.weightUnit;
    return `
      <input name="stat" type="hidden" value="weight">
      <label>
        Weight
        <input name="weight" type="number" min="0" max="30000" step="0.01" value="${escapeAttr(formatUnitValue(readWeightGrams(log), unit, "weight"))}">
      </label>
      <label>
        Unit
        <select name="weightUnit">
          ${Object.keys(weightUnits).map((item) => `<option value="${item}"${item === unit ? " selected" : ""}>${item}</option>`).join("")}
        </select>
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
  if (log.type === "routine") return `${routineLabel(log.routine)} done`;
  if (log.type === "growth_stats") {
    if (readWeightGrams(log) > 0 && (log.stat === "weight" || !log.stat)) return `Weight, ${formatWeightLog(log)}`;
    if (readHeightMm(log) > 0) return `Height, ${formatHeightLog(log)}`;
    return "Baby stats";
  }
  if (log.type === "diaper") {
    if (!log.poop) return "Wee diaper";
    const color = poopColorById(log.poopColorId || log.poopColor);
    return color ? `Poo: ${color.label}` : "Poo diaper";
  }
  if (log.type === "sleep") return `Sleep: ${log.status || "logged"}`;
  if (log.type === "tummy_time") return `Tummy time: ${log.status || "logged"}`;
  if (log.type === "outdoor_time") return `Outdoor time: ${log.status || "logged"}`;
  if (log.type === "baby_gym") return "Baby gym time";
  if (log.type === "bath") return `Bath: ${log.status === "end" ? "stop" : "start"}`;
  return (log.type || "activity").replaceAll("_", " ");
}

function labelForType(type) {
  return eventCategory(type).label;
}

function colorForLogType(type) {
  return eventCategory(type).color;
}

function eventCategory(type) {
  return eventCategoryConfig[type] || {
    label: String(type || "Log").replaceAll("_", " "),
    kind: "quick",
    color: "#66736d",
    icon: "/assets/activity/icon-success.png"
  };
}

function iconForLog(log) {
  if (log.type === "feeding") return `/assets/activity/icon-${log.side === "right" ? "right" : "left"}.png`;
  if (log.type === "diaper") return `/assets/activity/icon-${log.poop ? "poop" : "pee"}.png`;
  if (log.type === "routine") return `/assets/activity/icon-routine-${log.routine || "morning"}.png`;
  return eventCategory(log.type).icon;
}

function routineLabel(routine) {
  const labels = {
    morning: "Morning routine",
    naptime: "Naptime routine",
    bedtime: "Bedtime routine"
  };
  return labels[routine] || "Routine";
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
