const state = {
  logs: [],
  recent: {},
  summary: {},
  profile: {},
  designStyle: localStorage.getItem("tinyNewborn.designStyle") || "kiddo",
  activeTab: "home",
  activeHomeTab: "log",
  activeSettingsView: "settings",
  activeSettingsGroup: "profile",
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
  selectedCareIssue: "troubleshoot",
  selectedCareSubtab: {},
  selectedDentalTooth: "lower-central-incisors",
  childProofProgress: {},
  diaperBagProgress: {},
  careInfo: {},
  lastCareGuidanceNotificationKey: localStorage.getItem("tinyNewborn.care.lastGuidanceNotificationKey") || "",
  scheduleTemplates: [],
  selectedScheduleTemplateId: localStorage.getItem("tinyNewborn.schedule.selectedTemplateId") || "",
  scheduleLogs: [],
  selectedScheduleDate: localStorage.getItem("tinyNewborn.schedule.selectedDate") || todayString(),
  scheduleEdits: JSON.parse(localStorage.getItem("tinyNewborn.schedule.edits") || "{}"),
  scheduleTimerId: null,
  scheduleNotificationsEnabled: localStorage.getItem("tinyNewborn.schedule.notificationsEnabled") === "1",
  sentScheduleNotifications: new Set(JSON.parse(localStorage.getItem("tinyNewborn.schedule.sentNotifications") || "[]")),
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
    history: [],
    selectedHistoryId: localStorage.getItem("tinyNewborn.dashboardOverview.selectedHistoryId") || "latest",
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
  milkUnit: loadMilkUnit(),
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

const milkUnits = {
  ml: { label: "ml", ounces: 1 / 29.5735, max: 240, step: 5 },
  oz: { label: "oz", ounces: 1, max: 8, step: 0.25 }
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
  { key: "routines", title: "Routines", helper: "Morning, nap, and bedtime rhythm.", header: "sleep-routine-guide" },
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
const dashboardOverviewCacheKey = "tinyNewborn.dashboardOverview.publishedReview.v3";
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

document.querySelectorAll("[data-settings-group]").forEach((button) => {
  button.addEventListener("click", () => activateSettingsGroup(button.dataset.settingsGroup));
});

document.getElementById("chatgpt-shortcut")?.addEventListener("click", openChatGptShortcut);
document.getElementById("weather-shortcut")?.addEventListener("click", openWeatherShortcut);
setupPageSearch();

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
  updateBottleAmountDisplay(Number(event.target.value));
});

document.getElementById("bottle-milk-type").addEventListener("change", updateBottleDefaults);

document.getElementById("bottle-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const ounces = milkAmountToOunces(Number(document.getElementById("bottle-slider").value), state.milkUnit);
  const milkType = document.getElementById("bottle-milk-type").value;
  document.getElementById("bottle-dialog").close();
  await createLog({ type: "bottle", ounces, milkType }, feedingBurpReminder);
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
  applyDesignStyle();
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
  startScheduleTimelineTimer();
}

async function refreshData() {
  const [appData, recent, summary, poopColors, schedulePayload, scheduleLogPayload] = await Promise.all([
    fetchJson("/api/app-data"),
    fetchJson("/api/recent"),
    fetchJson("/api/today-summary"),
    fetchJson("/api/poop-colors"),
    fetchJson("/api/schedule-templates"),
    fetchJson("/api/schedule-logs")
  ]);

  state.profile = appData.baby_profile || {};
  state.logs = appData.baby_log || [];
  mergePendingLogsIntoState();
  state.recent = recent;
  state.summary = summary;
  state.poopColors = Array.isArray(poopColors) ? poopColors : [];
  state.scheduleTemplates = Array.isArray(schedulePayload.templates) ? schedulePayload.templates : [];
  state.scheduleLogs = Array.isArray(scheduleLogPayload.schedule_logs) ? scheduleLogPayload.schedule_logs : [];
  state.selectedScheduleTemplateId = currentScheduleLog().templateId || bestScheduleTemplateIdForDate(state.selectedScheduleDate);
  state.bathSoundEnabled = Boolean(appData.sound_settings?.bathSoundEnabled);
  state.tummySoundEnabled = Boolean(appData.sound_settings?.tummySoundEnabled);
  applyUnitSettings(appData.unit_settings);
  state.overviewSettings = cleanOverviewSettings(appData.overview_settings);
  state.milestoneProgress = appData.milestone_progress || (Array.isArray(appData.milestones) ? {} : appData.milestones || {});
  state.childProofProgress = appData.child_proof_progress || {};
  state.diaperBagProgress = appData.diaper_bag_progress || {};
  syncDashboardOverviewHistory(appData.overview_history);
  if (!state.dashboardOverview.publishedReview) applyDashboardOverviewHistorySelection();

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
  const payload = normalizeClientLogPayload(item.payload);
  return {
    ...payload,
    id: item.id,
    timestamp: payload.createdAt,
    createdAt: payload.createdAt,
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

function normalizeMilkType(value, fallback = "formula") {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "breast_milk" || normalized === "breastmilk") return "breast_milk";
  if (normalized === "formula") return "formula";
  return fallback;
}

function normalizeClientLogPayload(payload) {
  if (payload?.type !== "bottle") return payload;
  const milkType = normalizeMilkType(payload.milkType);
  return {
    ...payload,
    milkType,
    notes: payload.notes || `${milkTypeLabel(milkType)} bottle feed`
  };
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
  const homeViews = ["log", "care", "schedule", "milestones", "dashboard"];
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
  if (state.activeTab === "settings" && state.activeSettingsView === "settings") activateSettingsGroup(state.activeSettingsGroup);
}

function activateSettingsGroup(group = "profile") {
  const validGroups = ["profile", "schedule", "overview", "cards", "tools"];
  state.activeSettingsGroup = validGroups.includes(group) ? group : "profile";
  document.querySelectorAll("[data-settings-group]").forEach((button) => {
    button.classList.toggle("active", button.dataset.settingsGroup === state.activeSettingsGroup);
  });
  document.querySelectorAll("[data-settings-group-panel]").forEach((panel) => {
    const isActive = panel.dataset.settingsGroupPanel === state.activeSettingsGroup;
    panel.classList.toggle("active", isActive);
    panel.hidden = !isActive;
  });
}

function renderAll() {
  
  const birthday = state.profile.birthday || "";
  const age = formatBabyAge(birthday);
  const babySummary = document.getElementById("baby-summary");
  if (babySummary) {
    babySummary.textContent = age ? `${age}.` : "";
  }
  updateTopbarBabyAge();
  renderTodaySummary();
  renderRecent();
  renderCare();
  renderSchedule();
  renderHistory();
  renderDashboard();
  renderMilestones();
  renderQuiz();
  renderSettings();
  renderActivityStats();
  updateActivityButtons();
  updateBottleDefaults();
  refreshPageSearch();
  checkCareGuidanceNotification();
  startTicker();
}

function setupPageSearch() {
  const input = document.getElementById("page-search-input");
  const clearButton = document.getElementById("page-search-clear");
  const results = document.getElementById("page-search-results");
  if (!input || !clearButton || !results) return;

  input.addEventListener("input", () => updatePageSearch(input.value));
  clearButton.addEventListener("click", () => {
    input.value = "";
    updatePageSearch("");
    input.focus();
  });
  results.addEventListener("click", (event) => {
    const link = event.target.closest("[data-search-target]");
    if (!link) return;
    event.preventDefault();
    openPageSearchResult(link.dataset.searchTarget);
  });
}

function refreshPageSearch() {
  const input = document.getElementById("page-search-input");
  if (input?.value.trim()) updatePageSearch(input.value);
}

function updatePageSearch(query) {
  const input = document.getElementById("page-search-input");
  const clearButton = document.getElementById("page-search-clear");
  const results = document.getElementById("page-search-results");
  if (!input || !clearButton || !results) return;

  const cleanQuery = String(query || "").trim();
  clearButton.hidden = !cleanQuery;
  if (cleanQuery.length < 2) {
    results.hidden = true;
    results.innerHTML = "";
    return;
  }

  const matches = pageSearchResults(cleanQuery).slice(0, 8);
  results.hidden = false;
  results.innerHTML = matches.length
    ? matches.map((match) => `
      <a class="page-search-result" href="#${escapeAttr(match.id)}" data-search-target="${escapeAttr(match.id)}">
        <strong>${escapeHtml(match.title)}</strong>
        <small>${escapeHtml(match.location)}</small>
        <span>${escapeHtml(match.snippet)}</span>
      </a>
    `).join("")
    : `<p class="page-search-empty">No matching sections found.</p>`;
}

function pageSearchResults(query) {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const seen = new Set();
  return pageSearchCandidates()
    .map((element) => {
      const text = normalizeSearchText(element.innerText || element.textContent || "");
      if (!terms.every((term) => text.includes(term))) return null;
      const id = ensurePageSearchTargetId(element);
      if (!id || seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        title: pageSearchTitle(element),
        location: pageSearchLocation(element),
        snippet: pageSearchSnippet(element.innerText || element.textContent || "", terms[0])
      };
    })
    .filter(Boolean);
}

function pageSearchCandidates() {
  const selectors = [
    ".page-title",
    ".activity-card",
    ".care-side-button",
    ".baby-cries-card",
    ".eat-info-row",
    ".care-guide-card",
    ".schedule-info",
    ".schedule-slot",
    ".milestone-card",
    ".dashboard-overview-card",
    ".dashboard-card",
    ".settings-card",
    ".quiz-card",
    ".quiz-panel"
  ];
  return Array.from(document.querySelectorAll(selectors.join(",")))
    .filter((element) => !element.closest(".page-search") && normalizeSearchText(element.innerText || element.textContent || "").length > 1);
}

function ensurePageSearchTargetId(element) {
  if (!element.id) {
    const title = pageSearchTitle(element);
    element.id = `search-${slugifyId(title)}-${Array.from(document.querySelectorAll("[id^='search-']")).length + 1}`;
  }
  return element.id;
}

function pageSearchTitle(element) {
  const titleElement = element.matches(".page-title")
    ? element.querySelector("h2")
    : element.querySelector(".troubleshoot-expander-title span, h2, h3, h4, strong");
  const title = (titleElement?.textContent || element.getAttribute("aria-label") || "Section").trim();
  return title || "Section";
}

function pageSearchLocation(element) {
  const panel = element.closest(".panel");
  if (!panel) return "Current page";
  const panelNames = {
    log: "Home / Log",
    care: "Home / Care",
    schedule: "Home / Schedule",
    milestones: "Home / Milestones",
    dashboard: "Home / Dashboard",
    quiz: "Quiz",
    settings: "Settings",
    history: "Settings / History",
    exports: "Settings / Exports"
  };
  return panelNames[panel.id] || panel.id;
}

function pageSearchSnippet(text, firstTerm) {
  const cleanText = String(text || "").replace(/\s+/g, " ").trim();
  const normalized = normalizeSearchText(cleanText);
  const index = normalized.indexOf(firstTerm);
  if (index < 0) return cleanText.slice(0, 150);
  const start = Math.max(0, index - 55);
  return `${start > 0 ? "... " : ""}${cleanText.slice(start, start + 150)}${start + 150 < cleanText.length ? " ..." : ""}`;
}

function normalizeSearchText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function openPageSearchResult(id) {
  let target = document.getElementById(id);
  if (!target) return;
  const panel = target.closest(".panel");
  if (panel) activateTab(panel.id);

  target = document.getElementById(id) || target;
  if ("open" in target) target.open = true;
  target.closest("details")?.setAttribute("open", "");
  target.classList.add("search-spotlight");
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => target.classList.remove("search-spotlight"), 1800);
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
    button.addEventListener("click", () => openCareShortcut(button.dataset.careShortcut, button.dataset.careSubtabShortcut, button.dataset.careAnchorShortcut));
  });

  document.querySelectorAll("[data-bath-sound-toggle]").forEach((button) => {
    button.addEventListener("click", toggleBathSound);
  });

  document.querySelectorAll("[data-tummy-sound-toggle]").forEach((button) => {
    button.addEventListener("click", toggleTummySound);
  });
}

function openCareShortcut(issueKey, subtabKey = "", anchorId = "") {
  if (!careIssues.some((issue) => issue.key === issueKey)) return;
  state.selectedCareIssue = issueKey;
  if (subtabKey) state.selectedCareSubtab[issueKey] = subtabKey;
  activateTab("care");
  renderCare();
  const anchor = anchorId ? document.getElementById(anchorId) : null;
  if (anchor && "open" in anchor) anchor.open = true;
  (anchor || document.getElementById("care"))?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderCare() {
  const panel = document.getElementById("care-panel");
  if (!panel) return;

  const selected = careIssues.find((issue) => issue.key === state.selectedCareIssue) || careIssues[0];
  state.selectedCareIssue = selected.key;
  panel.innerHTML = `
    <div class="care-layout">
      ${renderCareSideNavigator(selected.key)}
      <div class="care-content">
        ${renderCareIssueView(selected, { showBack: false })}
      </div>
    </div>
  `;

  panel.querySelector("[data-care-back]")?.addEventListener("click", () => {
    state.selectedCareIssue = "troubleshoot";
    renderCare();
  });
  panel.querySelectorAll("[data-care-issue]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCareIssue = button.dataset.careIssue;
      renderCare();
    });
  });

  panel.querySelectorAll("[data-care-subtab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCareSubtab[selected.key] = button.dataset.careSubtab;
      renderCare();
    });
  });
  panel.querySelectorAll("[data-dental-tooth]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedDentalTooth = button.dataset.dentalTooth;
      state.selectedCareSubtab.health = "health:dental-guide";
      renderCare();
    });
  });
  panel.querySelectorAll("[data-child-proof-check]").forEach((input) => {
    input.addEventListener("change", () => updateChildProofProgress(input.dataset.childProofCheck, input.checked));
  });
  panel.querySelectorAll("[data-diaper-bag-check]").forEach((input) => {
    input.addEventListener("change", () => updateDiaperBagProgress(input.dataset.diaperBagCheck, input.checked));
  });
  panel.querySelector("[data-baby-cries-gpt]")?.addEventListener("click", () => {
    state.babyCriesAssistant.open = true;
    updateBabyCriesAssistantPanel();
    maybeRefreshBabyCriesAssistant(true);
  });
  panel.querySelector("[data-baby-cries-close]")?.addEventListener("click", () => {
    state.babyCriesAssistant.open = false;
    updateBabyCriesAssistantPanel();
  });
}

function renderCareSideNavigator(activeKey = "overview") {
  return `
    <nav class="care-side-nav" aria-label="Care subjects">
      ${careIssues.map((issue) => `
        <button class="care-side-button ${activeKey === issue.key ? "active" : ""}" type="button" data-care-issue="${escapeAttr(issue.key)}" aria-current="${activeKey === issue.key ? "page" : "false"}">
          <img src="${escapeAttr(careHeaderImage(issue.header))}" alt="">
          <span>
            <strong>${escapeHtml(issue.title)}</strong>
            <small>${escapeHtml(issue.helper)}</small>
          </span>
        </button>
      `).join("")}
    </nav>
  `;
}

function renderSchedule() {
  const panel = document.getElementById("schedule-panel");
  if (!panel) return;

  const templates = state.scheduleTemplates || [];
  if (!templates.length) {
    panel.innerHTML = `
      <section class="schedule-info">
        <h3>Doctor schedule</h3>
        <p>No schedule templates found in the shared database yet.</p>
      </section>
    `;
    return;
  }

  const scheduleLog = currentScheduleLog();
  const template = selectedScheduleTemplate(scheduleLog.templateId);
  const rows = currentScheduleRows(scheduleLog, template);
  const locked = isPastScheduleDate(state.selectedScheduleDate);
  panel.innerHTML = `
    <section class="schedule-info">
      <div>
        <h3>${escapeHtml(template.name || "Daily schedule")}</h3>
        <p>${escapeHtml(scheduleTemplateSummary(template))}</p>
      </div>
      <div class="schedule-controls">
        <label class="schedule-template-picker">
          <span>Date</span>
          <input id="schedule-date-select" type="date" value="${escapeAttr(state.selectedScheduleDate)}">
        </label>
      </div>
    </section>
    <section class="schedule-timeline" aria-label="Daily schedule timeline">
      ${rows.map((row, index) => renderScheduleSlot(row, index, rows, locked)).join("")}
    </section>
  `;

  panel.querySelector("#schedule-date-select")?.addEventListener("change", (event) => {
    state.selectedScheduleDate = event.target.value || todayString();
    localStorage.setItem("tinyNewborn.schedule.selectedDate", state.selectedScheduleDate);
    state.selectedScheduleTemplateId = currentScheduleLog().templateId || bestScheduleTemplateIdForDate(state.selectedScheduleDate);
    renderSchedule();
  });
  panel.querySelectorAll("[data-schedule-edit]").forEach((input) => {
    input.addEventListener("change", saveScheduleEdit);
  });
}

function startScheduleTimelineTimer() {
  if (state.scheduleTimerId) window.clearInterval(state.scheduleTimerId);
  state.scheduleTimerId = window.setInterval(() => {
    if (state.activeTab === "home" && state.activeHomeTab === "schedule") renderSchedule();
    checkScheduleNotifications();
  }, 60000);
  checkScheduleNotifications();
}

function scheduleNotificationsButtonText() {
  if (!("Notification" in window)) return "Notifications unavailable";
  if (Notification.permission === "denied") return "Notifications blocked";
  return state.scheduleNotificationsEnabled ? "Schedule reminders on" : "Enable schedule reminders";
}

async function toggleScheduleNotifications() {
  if (!("Notification" in window)) {
    showToast("This browser does not support schedule notifications.");
    return;
  }
  if (Notification.permission === "denied") {
    showToast("Notifications are blocked. In Chrome, click the site controls icon by the address bar, allow Notifications, then refresh.");
    renderScheduleNotificationSettings();
    return;
  }
  if (!state.scheduleNotificationsEnabled) {
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") {
      showToast("Schedule notifications were not enabled.");
      renderSchedule();
      return;
    }
    state.scheduleNotificationsEnabled = true;
    localStorage.setItem("tinyNewborn.schedule.notificationsEnabled", "1");
    showToast("Schedule reminders enabled on this device.");
    checkScheduleNotifications();
  } else {
    state.scheduleNotificationsEnabled = false;
    localStorage.setItem("tinyNewborn.schedule.notificationsEnabled", "0");
    showToast("Schedule reminders paused on this device.");
  }
  renderScheduleNotificationSettings();
  renderSchedule();
}

function selectedScheduleTemplate(templateId = "") {
  const templates = state.scheduleTemplates || [];
  return templates.find((template) => template.id === templateId)
    || templates.find((template) => template.id === state.selectedScheduleTemplateId)
    || templates.find((template) => template.id === bestScheduleTemplateIdForDate(state.selectedScheduleDate))
    || templates[0]
    || {};
}

function currentScheduleLog() {
  return scheduleLogForDate(state.selectedScheduleDate);
}

function scheduleLogForDate(date) {
  return (state.scheduleLogs || []).find((log) => log.date === date) || {
    date,
    templateId: defaultScheduleTemplateIdForDate(date),
    rows: []
  };
}

function currentScheduleRows(scheduleLog, template) {
  return Array.isArray(scheduleLog.rows) && scheduleLog.rows.length
    ? scheduleLog.rows
    : (template.rows || []).map((row) => ({ ...row }));
}

function upsertScheduleLog(nextLog) {
  state.scheduleLogs = [
    ...(state.scheduleLogs || []).filter((log) => log.date !== nextLog.date),
    nextLog
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

async function persistScheduleLog(nextLog) {
  upsertScheduleLog(nextLog);
  try {
    const result = await fetchJson(`/api/schedule-logs/${encodeURIComponent(nextLog.date)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextLog)
    });
    if (result.schedule_log) upsertScheduleLog(result.schedule_log);
    if (Array.isArray(result.schedule_logs)) state.scheduleLogs = result.schedule_logs;
  } catch (error) {
    showToast(`Schedule not saved: ${error.message}`);
  }
}

function buildScheduleLog(date, templateId, rows) {
  return {
    ...scheduleLogForDate(date),
    date,
    templateId,
    rows
  };
}

async function applyScheduleTemplateToToday(templateId) {
  const template = selectedScheduleTemplate(templateId);
  state.selectedScheduleTemplateId = template.id;
  localStorage.setItem("tinyNewborn.schedule.selectedTemplateId", state.selectedScheduleTemplateId);
  await persistScheduleLog(buildScheduleLog(todayString(), template.id, (template.rows || []).map((row) => ({ ...row }))));
  renderSchedule();
}

function saveScheduleEdit(event) {
  if (isPastScheduleDate(state.selectedScheduleDate)) {
    renderSchedule();
    showToast("Past schedule logs are frozen.");
    return;
  }
  const input = event.currentTarget;
  const scheduleLog = currentScheduleLog();
  const template = selectedScheduleTemplate(scheduleLog.templateId);
  const index = input.dataset.scheduleIndex;
  const field = input.dataset.scheduleField;
  if (index === undefined || !field) return;
  const rows = currentScheduleRows(scheduleLog, template).map((row) => ({ ...row }));
  const value = field === "timeOfDay" && input.dataset.scheduleTimePart
    ? scheduleTimePickerValue(input.closest("[data-schedule-time-picker]"))
    : field === "sleepGoal" && input.dataset.scheduleSleepGoalPart
      ? scheduleSleepGoalPickerValue(input.closest("[data-schedule-sleep-goal-picker]"))
    : input.value;
  rows[Number(index)] = { ...objectGuideValue(rows[Number(index)]), [field]: value };
  persistScheduleLog(buildScheduleLog(state.selectedScheduleDate, template.id, rows));
  if (field === "timeOfDay") renderSchedule();
}

function defaultScheduleTemplateIdForDate(date = todayString()) {
  if (!isPastScheduleDate(date) && state.selectedScheduleTemplateId) return state.selectedScheduleTemplateId;
  return bestScheduleTemplateIdForDate(date);
}

function isPastScheduleDate(date) {
  return String(date || "") < todayString();
}

function bestScheduleTemplateIdForDate(date = todayString()) {
  const templates = state.scheduleTemplates || [];
  if (!templates.length) return "";
  const ageMonths = babyAgeMonthsAtDate(date);
  if (!Number.isFinite(ageMonths)) return templates[0].id;
  const match = templates.find((template) => {
    const range = template.ageRange || {};
    const min = Number(range.min);
    const max = Number(range.max);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return false;
    const scale = range.unit === "weeks" ? 0.25 : 1;
    return ageMonths >= min * scale && ageMonths <= max * scale;
  });
  return (match || templates[0]).id;
}

function babyAgeMonthsAtDate(date = todayString()) {
  if (!state.profile?.birthday) return NaN;
  const born = new Date(`${state.profile.birthday}T00:00:00`);
  const target = new Date(`${date}T00:00:00`);
  if (!Number.isFinite(born.getTime()) || !Number.isFinite(target.getTime())) return NaN;
  return Math.max(0, (target.getTime() - born.getTime()) / (1000 * 60 * 60 * 24 * 30.4375));
}

function scheduleTemplateSummary(template) {
  const summary = template.summary || {};
  const parts = [
    summary.plannedNaps ? `${summary.plannedNaps} naps` : "",
    summary.plannedDaytimeSleep ? `${summary.plannedDaytimeSleep} daytime sleep` : "",
    summary.plannedFeedings ? `${summary.plannedFeedings} feeds` : "",
    summary.plannedBathTime ? `bath ${summary.plannedBathTime}` : "",
    summary.plannedBedtime ? `bedtime ${summary.plannedBedtime}` : ""
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Editable plan connected to today's actual activity logs.";
}

function formatScheduleDurationValue(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return text;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return text;
  return formatCompactDurationParts(hours, minutes);
}

function scheduleSlotDurationMinutes(row) {
  const range = scheduleTimeRange(row.timeOfDay);
  return range ? Math.max(0, range.end - range.start) : 0;
}

function scheduleSlotDurationLabel(row) {
  const minutes = scheduleSlotDurationMinutes(row);
  return minutes ? formatCompactDurationParts(Math.floor(minutes / 60), minutes % 60) : "--";
}

function renderScheduleSlot(row, index, rows = [], locked = false) {
  const kind = scheduleActivityKind(row);
  const actualItems = scheduleActualItemsForSlot(row);
  const timeState = scheduleSlotTimeState(row);
  const goalState = scheduleGoalState(row);
  const timeConflict = scheduleTimeConflictMessage(rows, index);
  return `
    <article class="schedule-slot schedule-slot-${escapeAttr(kind)} schedule-slot-${escapeAttr(timeState)}${timeConflict ? " schedule-slot-conflict" : ""}${locked ? " schedule-slot-locked" : ""}${isScheduleAfterFivePm(row) ? " schedule-after-5pm" : ""}">
      <div class="schedule-time-node">
        <span class="schedule-edge schedule-edge-before" aria-hidden="true"></span>
        <span class="schedule-dot" aria-hidden="true"></span>
        <span class="schedule-edge schedule-edge-after" aria-hidden="true"></span>
      </div>
      <div class="schedule-card">
        <div class="schedule-card-main">
          <img src="${escapeAttr(scheduleActivityIcon(row))}" alt="">
          <div>
            <h3><span class="schedule-goal-check ${escapeAttr(goalState.state)}" title="${escapeAttr(goalState.label)}">✓</span>${escapeHtml(row.activity || "Activity")}</h3>
            ${timeState === "current" ? `<div class="schedule-current-context">${renderCurrentHighlight("Current schedule slot")}</div>` : ""}
            <div class="schedule-card-time-controls">
              ${renderScheduleTimePicker(row, index, locked)}
              <span class="schedule-duration-display" aria-label="Calculated slot duration">${escapeHtml(scheduleSlotDurationLabel(row))}</span>
            </div>
            ${timeConflict ? `<p class="schedule-time-conflict">${escapeHtml(timeConflict)}</p>` : ""}
            ${renderScheduleGoalControl(row, kind, index, locked)}
          </div>
        </div>
        <div class="schedule-actual">
          <strong>Actual</strong>
          ${actualItems.length ? `
            <ul>
              ${actualItems.map((item) => `
                <li>
                  <img src="${escapeAttr(item.icon)}" alt="">
                  <span>${escapeHtml(item.label)}${item.time ? ` <small>${escapeHtml(item.time)}</small>` : ""}</span>
                </li>
              `).join("")}
            </ul>
          ` : `<p>No matching logs yet.</p>`}
        </div>
      </div>
    </article>
  `;
}

function renderScheduleTimePicker(row, index, locked = false) {
  const parts = scheduleTimePickerParts(row.timeOfDay);
  return `
    <div class="schedule-time-picker" data-schedule-time-picker data-schedule-index="${index}" aria-label="Slot time">
      ${renderScheduleTimeInput(index, "start", "Start time", parts.startValue, locked)}
      <span class="schedule-time-separator" aria-hidden="true">-</span>
      ${renderScheduleTimeInput(index, "end", "End time", parts.endValue, locked)}
    </div>
  `;
}

function renderScheduleTimeInput(index, part, label, value, locked = false) {
  return `
    <input class="schedule-time-input" type="time" data-schedule-edit data-schedule-index="${index}" data-schedule-field="timeOfDay" data-schedule-time-part="${escapeAttr(part)}" aria-label="${escapeAttr(label)}" value="${escapeAttr(value)}" ${locked ? "disabled" : ""}>
  `;
}

function scheduleTimePickerParts(value) {
  const range = scheduleTimeRange(value) || { start: 7 * 60, end: 7 * 60 + 30 };
  const start = scheduleTimePartsFromMinutes(range.start);
  const end = scheduleTimePartsFromMinutes(range.end);
  return {
    startValue: start.value,
    endValue: end.value
  };
}

function scheduleTimePartsFromMinutes(totalMinutes) {
  const normalized = ((Math.round(totalMinutes) % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hour24 = Math.floor(normalized / 60);
  const minute = String(normalized % 60).padStart(2, "0");
  const hour = String(hour24).padStart(2, "0");
  return { value: `${hour}:${minute}` };
}

function scheduleTimePickerValue(container) {
  const start = formatScheduleTimeInputValue(container.querySelector('[data-schedule-time-part="start"]')?.value);
  const end = formatScheduleTimeInputValue(container.querySelector('[data-schedule-time-part="end"]')?.value);
  return `${start}-${end}`;
}

function formatScheduleTimeInputValue(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  const hour24 = Number(match[1]);
  const minute = match[2];
  const meridiem = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minute} ${meridiem}`;
}

function scheduleTimeConflictMessage(rows, changedIndex) {
  const index = Number(changedIndex);
  const current = scheduleTimeRange(rows[index]?.timeOfDay);
  if (!current) return "Choose a valid time range.";
  if (current.end <= current.start) return "End time must be after start time.";

  const previous = index > 0 ? scheduleTimeRange(rows[index - 1]?.timeOfDay) : null;
  if (previous && previous.end !== current.start) {
    return previous.end > current.start
      ? "This start time overlaps the previous slot."
      : "This start time leaves a gap after the previous slot.";
  }

  const next = index < rows.length - 1 ? scheduleTimeRange(rows[index + 1]?.timeOfDay) : null;
  if (next && current.end !== next.start) {
    return current.end > next.start
      ? "This end time overlaps the next slot."
      : "This end time leaves a gap before the next slot.";
  }

  return "";
}

function isScheduleAfterFivePm(row) {
  const range = scheduleTimeRange(row.timeOfDay);
  return Boolean(range && range.start >= 17 * 60);
}

function scheduleSlotTimeState(row) {
  const range = scheduleTimeRange(row.timeOfDay);
  if (!range) return "upcoming";
  const now = Date.now();
  const start = scheduleMinutesToMs(range.start);
  const end = scheduleMinutesToMs(range.end);
  if (now < start) return "upcoming";
  if (now >= end) return "past";
  return "current";
}

function scheduleGoalState(row) {
  const range = scheduleTimeRange(row.timeOfDay);
  if (!range) return { state: "not-yet", label: "Time not reached yet" };
  const now = Date.now();
  const start = scheduleMinutesToMs(range.start);
  if (now < start) return { state: "not-yet", label: "Time not reached yet" };

  const kind = scheduleActivityKind(row);
  if (kind === "feeding") return scheduleFeedingGoalState(row);
  if (kind === "sleep") return scheduleDurationGoalState(row, ["sleep"]);
  if (kind === "bath") return scheduleDurationGoalState(row, ["bath"]);
  if (kind === "play") {
    const playGoal = String(row.playGoal || "").toLowerCase();
    if (playGoal.includes("tummy")) return scheduleDurationGoalState(row, ["tummy_time"]);
    if (playGoal.includes("outdoor")) return scheduleDurationGoalState(row, ["outdoor_time"]);
    if (playGoal.includes("gym")) return scheduleAnyLogGoalState(row, ["baby_gym"]);
    return scheduleAnyLogGoalState(row, ["tummy_time", "baby_gym", "outdoor_time", "routine"]);
  }

  return scheduleAnyLogGoalState(row, []);
}

function scheduleFeedingGoalState(row) {
  const breastFeed = scheduleLogsInGoalWindow(row, (log) => log.type === "feeding").length > 0;
  if (breastFeed) return { state: "complete", label: "Completed: breastfeeding logged nearby" };

  const goalOz = scheduleFeedGoalOz(row);
  const actualOz = scheduleFeedingActualOunces(row);
  const lower = goalOz * 0.9;
  const upper = goalOz * 1.1;
  if (actualOz >= lower && actualOz <= upper) {
    return { state: "complete", label: `Completed: ${formatOunces(actualOz)} of ${formatOunces(goalOz)}` };
  }
  return { state: "incomplete", label: `Not complete: ${formatOunces(actualOz)} of ${formatOunces(goalOz)}` };
}

function scheduleFeedingActualOunces(row) {
  return scheduleLogsInGoalWindow(row, (log) => log.type === "bottle")
    .reduce((sum, log) => sum + numberValue(log.ounces, 0), 0);
}

function scheduleDurationGoalState(row, types) {
  const goalMinutes = scheduleDurationGoalMinutes(row);
  if (!goalMinutes) return scheduleAnyLogGoalState(row, types);
  const actualMs = types.reduce((sum, type) => sum + schedulePeriodDurationMs(row, type), 0);
  const actualMinutes = actualMs / 60000;
  const lower = goalMinutes * 0.9;
  const upper = goalMinutes * 1.1;
  if (actualMinutes >= lower && actualMinutes <= upper) {
    return { state: "complete", label: `Completed: ${formatCompactDurationMs(actualMs)} of ${formatCompactDurationParts(Math.floor(goalMinutes / 60), goalMinutes % 60)}` };
  }
  return { state: "incomplete", label: `Not complete: ${formatCompactDurationMs(actualMs)} of ${formatCompactDurationParts(Math.floor(goalMinutes / 60), goalMinutes % 60)}` };
}

function scheduleAnyLogGoalState(row, types) {
  const logs = types.length ? scheduleLogsInGoalWindow(row, (log) => types.includes(log.type)) : [];
  return logs.length
    ? { state: "complete", label: "Completed: activity logged nearby" }
    : { state: "incomplete", label: "Not complete: no nearby activity log" };
}

function scheduleGoalWindow(row) {
  const range = scheduleTimeRange(row.timeOfDay);
  if (!range) return null;
  return {
    start: scheduleMinutesToMs(range.start) - 10 * 60 * 1000,
    end: scheduleMinutesToMs(range.end) + 10 * 60 * 1000
  };
}

function scheduleLogsInGoalWindow(row, predicate) {
  const windowRange = scheduleGoalWindow(row);
  if (!windowRange) return [];
  return (state.logs || [])
    .filter(predicate)
    .filter((log) => {
      const time = logTime(log);
      return Number.isFinite(time) && time >= windowRange.start && time <= windowRange.end;
    });
}

function scheduleDurationGoalMinutes(row) {
  return scheduleDurationTextToMinutes(row.sleepGoal || row.plannedDuration || "");
}

function scheduleDurationTextToMinutes(value) {
  const text = String(value || "").trim();
  const colon = text.match(/^(\d{1,2}):(\d{2})$/);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
  const compact = text.match(/^(?:(\d+)\s*hrs?)?\s*(?:(\d+)\s*min)?$/i);
  if (compact && (compact[1] || compact[2])) return Number(compact[1] || 0) * 60 + Number(compact[2] || 0);
  return 0;
}

function schedulePeriodDurationMs(row, type) {
  const config = eventCategoryConfig[type];
  const startStatus = config?.start || "asleep";
  const endStatus = config?.end || "awake";
  const windowRange = scheduleGoalWindow(row);
  if (!windowRange) return 0;
  let activeStart = null;
  let total = 0;
  (state.logs || [])
    .filter((log) => log.type === type && log.status)
    .sort((a, b) => logTime(a) - logTime(b))
    .forEach((log) => {
      if (log.status === startStatus) activeStart = logTime(log);
      if (log.status === endStatus && activeStart) {
        total += clippedDuration(activeStart, logTime(log), windowRange.start, windowRange.end);
        activeStart = null;
      }
    });
  if (activeStart) total += clippedDuration(activeStart, Date.now(), windowRange.start, windowRange.end);
  return total;
}

function checkScheduleNotifications() {
  if (!state.scheduleNotificationsEnabled || !("Notification" in window) || Notification.permission !== "granted") return;
  const notificationDate = todayString();
  const scheduleLog = scheduleLogForDate(notificationDate);
  const template = selectedScheduleTemplate(scheduleLog.templateId);
  const rows = currentScheduleRows(scheduleLog, template);
  const now = Date.now();
  rows.forEach((row, index) => {
    const range = scheduleTimeRange(row.timeOfDay);
    if (!range) return;
    const start = scheduleMinutesToMs(range.start, notificationDate);
    const reminderAt = start - 60 * 1000;
    const ageMs = now - reminderAt;
    if (ageMs < 0 || ageMs > 75 * 1000) return;
    const key = `${notificationDate}-${index}-${row.timeOfDay}-${row.activity}`;
    if (state.sentScheduleNotifications.has(key)) return;
    state.sentScheduleNotifications.add(key);
    saveSentScheduleNotifications();
    sendScheduleNotification(row);
  });
}

function saveSentScheduleNotifications() {
  const recentKeys = Array.from(state.sentScheduleNotifications).slice(-200);
  state.sentScheduleNotifications = new Set(recentKeys);
  localStorage.setItem("tinyNewborn.schedule.sentNotifications", JSON.stringify(recentKeys));
}

function sendScheduleNotification(row) {
  const activity = row.activity || "Schedule";
  const title = `Schedule: ${activity}`;
  const goal = scheduleNotificationGoal(row);
  const bodyParts = [
    row.timeOfDay ? `Time ${row.timeOfDay}` : "",
    `Activity ${activity}`,
    goal ? `Goal ${goal}` : ""
  ].filter(Boolean);
  try {
    new Notification(title, {
      body: bodyParts.join(" | "),
      icon: scheduleActivityIcon(row),
      tag: `tiny-newborn-schedule-${todayString()}-${row.timeOfDay}`,
      renotify: true
    });
  } catch {
    showToast(`${title}: ${bodyParts.join(" | ")}`);
  }
  showToast(`${activity} time`);
}

function currentEatGuidanceNotification() {
  const data = state.careInfo.eat;
  const row = data ? relevantFeedingRow(data) : null;
  if (!state.profile.birthday || !row) return null;
  const key = `eat:${row.age || "unknown"}:${row.howOften || ""}:${row.amountPerFeed || ""}:${row.bottleNipple || ""}`;
  const title = "Eat guidance updated";
  const body = `${row.age}: ${row.howOften}; ${row.amountPerFeed}; nipple ${row.bottleNipple || "age-based"}. Review the Eat card.`;
  return { key, title, body, issueKey: "eat", icon: "/assets/care/eat.png" };
}

function currentSleepGuidanceNotification() {
  const data = state.careInfo.sleep;
  const row = data ? relevantSleepRow(data) : null;
  if (!state.profile.birthday || !row) return null;
  const key = `sleep:${row.age || "unknown"}:${row.sleepMilestone || ""}:${row.nap || ""}:${row.wakeWindow || ""}`;
  const title = "Sleep guidance updated";
  const body = `${row.age}: ${row.sleepMilestone}; wake ${row.wakeWindow}. Review the Sleep card.`;
  return { key, title, body, issueKey: "sleep", icon: "/assets/care/sleep.png" };
}

function checkCareGuidanceNotification() {
  const guidanceItems = [currentEatGuidanceNotification(), currentSleepGuidanceNotification()].filter(Boolean);
  if (!guidanceItems.length) return;
  const nextKey = guidanceItems.map((guidance) => guidance.key).join("|");
  if (!state.lastCareGuidanceNotificationKey) {
    saveCareGuidanceNotificationKey(nextKey);
    return;
  }
  if (!state.lastCareGuidanceNotificationKey.includes("|")) {
    saveCareGuidanceNotificationKey(nextKey);
    return;
  }
  if (state.lastCareGuidanceNotificationKey === nextKey) return;
  const changedGuidance = guidanceItems.find((guidance) => !state.lastCareGuidanceNotificationKey.includes(guidance.key)) || guidanceItems[0];
  saveCareGuidanceNotificationKey(nextKey);
  sendCareGuidanceNotification(changedGuidance);
}

function saveCareGuidanceNotificationKey(key) {
  state.lastCareGuidanceNotificationKey = key;
  localStorage.setItem("tinyNewborn.care.lastGuidanceNotificationKey", key);
}

function sendCareGuidanceNotification(guidance) {
  const openCareGuidance = () => {
    const issueKey = guidance.issueKey || "eat";
    state.selectedCareIssue = issueKey;
    state.selectedCareSubtab[issueKey] = issueKey === "sleep" ? "sleep-milestones-guide" : "overall";
    activateTab("care");
    renderCare();
    document.getElementById("care")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if ("Notification" in window && Notification.permission === "granted") {
    try {
      const notification = new Notification(guidance.title, {
        body: guidance.body,
        icon: guidance.icon || "/assets/care/eat.png",
        tag: `tiny-newborn-care-${guidance.key}`,
        renotify: true
      });
      notification.onclick = () => {
        window.focus();
        openCareGuidance();
        notification.close();
      };
    } catch {
      showToast(`${guidance.title}: ${guidance.body}`);
    }
  } else {
    showToast(`${guidance.title}: ${guidance.body}`);
  }
}

function scheduleNotificationGoal(row) {
  const kind = scheduleActivityKind(row);
  if (kind === "feeding") return formatOunces(scheduleFeedGoalOz(row));
  if (kind === "sleep") return formatScheduleDurationValue(row.sleepGoal || row.plannedDuration || "");
  if (kind === "play") return row.playGoal || scheduleSlotDurationLabel(row) || "Play time";
  return scheduleSlotDurationLabel(row);
}

function renderScheduleGoalControl(row, kind, index, locked = false) {
  if (kind === "feeding") {
    const value = scheduleFeedGoalOz(row);
    return `
      <label class="schedule-goal-control">
        <span>Goal</span>
        <select data-schedule-edit data-schedule-index="${index}" data-schedule-field="feedGoalOz" aria-label="Feeding ounces goal" ${locked ? "disabled" : ""}>
          ${feedingGoalOptions().map((amount) => `<option value="${amount}" ${amount === value ? "selected" : ""}>${formatOunces(amount)}</option>`).join("")}
        </select>
      </label>
    `;
  }
  if (kind === "sleep") {
    return renderScheduleSleepGoalControl(row, index, locked);
  }
  if (kind === "play") {
    return `
      <label class="schedule-goal-control">
        <span>Activity</span>
        <select data-schedule-edit data-schedule-index="${index}" data-schedule-field="playGoal" aria-label="Playtime activity goal" ${locked ? "disabled" : ""}>
          ${["Tummy time", "Baby gym", "Reading", "Outdoor time", "Free play"].map((option) => `<option ${option === (row.playGoal || "Free play") ? "selected" : ""}>${option}</option>`).join("")}
        </select>
      </label>
    `;
  }
  return `<p class="schedule-goal-note">${escapeHtml(row.notes || "Use this slot as a guide, then compare with logs.")}</p>`;
}

function renderScheduleSleepGoalControl(row, index, locked = false) {
  const parts = scheduleDurationPickerParts(row.sleepGoal || row.plannedDuration || "", scheduleSlotDurationMinutes(row) || 30);
  const hourOptions = Array.from({ length: 13 }, (_, hour) => (
    `<option value="${hour}" ${hour === parts.hours ? "selected" : ""}>${hour} hr</option>`
  )).join("");
  const minuteOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((minute) => (
    `<option value="${minute}" ${minute === parts.minutes ? "selected" : ""}>${String(minute).padStart(2, "0")} min</option>`
  )).join("");
  return `
    <label class="schedule-goal-control">
      <span>Sleep goal</span>
      <span class="schedule-sleep-goal-picker" data-schedule-sleep-goal-picker>
        <select class="schedule-sleep-goal-select" data-schedule-edit data-schedule-index="${index}" data-schedule-field="sleepGoal" data-schedule-sleep-goal-part="hours" aria-label="Sleep goal hours" ${locked ? "disabled" : ""}>
          ${hourOptions}
        </select>
        <select class="schedule-sleep-goal-select" data-schedule-edit data-schedule-index="${index}" data-schedule-field="sleepGoal" data-schedule-sleep-goal-part="minutes" aria-label="Sleep goal minutes" ${locked ? "disabled" : ""}>
          ${minuteOptions}
        </select>
      </span>
    </label>
  `;
}

function scheduleDurationPickerParts(value, fallbackMinutes = 30) {
  const parsed = scheduleDurationTextToMinutes(value);
  const total = Math.max(0, parsed || fallbackMinutes || 0);
  let hours = Math.floor(total / 60);
  let minutes = Math.round((total % 60) / 5) * 5;
  if (minutes === 60) {
    hours += 1;
    minutes = 0;
  }
  return {
    hours: Math.max(0, Math.min(12, hours)),
    minutes
  };
}

function scheduleSleepGoalPickerValue(container) {
  const hours = Number(container?.querySelector("[data-schedule-sleep-goal-part='hours']")?.value || 0);
  const minutes = Number(container?.querySelector("[data-schedule-sleep-goal-part='minutes']")?.value || 0);
  return formatCompactDurationParts(Math.max(0, hours), Math.max(0, minutes));
}

function scheduleActivityKind(row) {
  const activity = String(row.activity || "").toLowerCase();
  if (activity.includes("feed")) return "feeding";
  if (activity.includes("nap") || activity.includes("sleep") || activity.includes("bedtime")) return "sleep";
  if (activity.includes("play")) return "play";
  if (activity.includes("bath")) return "bath";
  return "other";
}

function scheduleActivityIcon(row) {
  const icons = {
    feeding: "/assets/activity/icon-bottle.png",
    sleep: "/assets/activity/icon-asleep.png",
    play: "/assets/activity/icon-gym.png",
    bath: "/assets/activity/icon-bath.png",
    other: "/assets/activity/icon-success.png"
  };
  return icons[scheduleActivityKind(row)] || icons.other;
}

function scheduleFeedGoalOz(row) {
  const raw = Number(row.feedGoalOz || row.feedGoal);
  return Number.isFinite(raw) ? Math.max(0.5, Math.min(8, Math.round(raw * 4) / 4)) : 3;
}

function feedingGoalOptions() {
  const options = [];
  for (let amount = 0.5; amount <= 8.001; amount += 0.25) {
    options.push(Math.round(amount * 4) / 4);
  }
  return options;
}

function scheduleTimeRange(value) {
  const parts = String(value || "").split("-");
  const inferredMeridiem = scheduleMeridiem(parts[1]) || scheduleMeridiem(parts[0]);
  const start = timeToMinutes(parts[0], inferredMeridiem);
  if (!Number.isFinite(start)) return null;
  const endMinutes = timeToMinutes(parts[1], inferredMeridiem);
  const end = Number.isFinite(endMinutes) ? endMinutes : start + 30;
  return { start, end: end < start ? end + 24 * 60 : end };
}

function scheduleActualItemsForSlot(row) {
  const range = scheduleTimeRange(row.timeOfDay);
  if (!range) return [];
  const slotStart = scheduleMinutesToMs(range.start);
  const slotEnd = scheduleMinutesToMs(range.end);
  if (Date.now() < slotStart) return [];
  const slotCenter = slotStart + (slotEnd - slotStart) / 2;
  const nearLogs = logsNearSlot(slotStart, slotEnd);
  const items = [];
  const sleepItem = scheduleSleepActualItem(slotStart, slotEnd, slotCenter, nearLogs);
  if (sleepItem) items.push(sleepItem);
  items.push(...scheduleFeedActualItems(nearLogs, slotCenter));
  items.push(...scheduleDiaperActualItems(nearLogs, slotCenter));
  items.push(...scheduleActivityActualItems(nearLogs, slotCenter));
  return dedupeScheduleActualItems(items).slice(0, 5);
}

function scheduleMinutesToMs(minutes, date = state.selectedScheduleDate || todayString()) {
  const base = new Date(`${date}T00:00:00`).getTime();
  return base + minutes * 60 * 1000;
}

function logsNearSlot(slotStart, slotEnd) {
  return (state.logs || [])
    .filter((log) => {
      const time = logTime(log);
      return Number.isFinite(time) && time >= slotStart && time < slotEnd;
    })
    .sort((a, b) => logTime(a) - logTime(b));
}

function scheduleSleepActualItem(slotStart, slotEnd, slotCenter, nearLogs) {
  const sleepLogs = (state.logs || [])
    .filter((log) => log.type === "sleep" && log.status)
    .sort((a, b) => logTime(a) - logTime(b));
  const previous = sleepLogs.filter((log) => logTime(log) <= slotEnd).at(-1);
  const nearbyAwake = nearLogs
    .filter((log) => log.type === "sleep" && log.status === "awake")
    .sort((a, b) => Math.abs(logTime(a) - slotCenter) - Math.abs(logTime(b) - slotCenter))[0];

  if (nearbyAwake) {
    const start = sleepLogs
      .filter((log) => log.status === "asleep" && logTime(log) <= logTime(nearbyAwake))
      .at(-1);
    if (start) {
      return {
        key: `sleep-awake-${nearbyAwake.id || logTime(nearbyAwake)}`,
        icon: "/assets/activity/icon-awake.png",
        label: `Slept ${formatCompactDurationMs(logTime(nearbyAwake) - logTime(start))}`,
        time: `woke ${formatScheduleWakeTime(logTime(nearbyAwake))}`
      };
    }
  }

  if (previous?.status === "asleep") {
    const awakeAfter = sleepLogs.find((log) => log.status === "awake" && logTime(log) > logTime(previous));
    const stillSleepingAtSlot = !awakeAfter || logTime(awakeAfter) > slotEnd;
    if (stillSleepingAtSlot) {
      const durationEnd = awakeAfter ? slotEnd : Date.now();
      return {
        key: `sleeping-${previous.id || logTime(previous)}`,
        icon: "/assets/activity/icon-asleep.png",
        label: `Sleeping ${formatCompactDurationMs(durationEnd - logTime(previous))}`,
        time: `since ${formatScheduleWakeTime(logTime(previous))}`
      };
    }
  }

  return null;
}

function scheduleFeedActualItems(logs, slotCenter) {
  return logs
    .filter((log) => log.type === "bottle" || log.type === "feeding")
    .sort((a, b) => Math.abs(logTime(a) - slotCenter) - Math.abs(logTime(b) - slotCenter))
    .slice(0, 2)
    .map((log) => ({
      key: `feed-${log.id || logTime(log)}`,
      icon: iconForLog(log),
      label: log.type === "bottle"
        ? `${milkTypeLabel(log.milkType)} ${formatOunces(log.ounces)}`
        : `Boobie ${log.side || "feed"}`,
      time: formatScheduleWakeTime(logTime(log))
    }));
}

function scheduleDiaperActualItems(logs, slotCenter) {
  return logs
    .filter((log) => log.type === "diaper")
    .sort((a, b) => Math.abs(logTime(a) - slotCenter) - Math.abs(logTime(b) - slotCenter))
    .slice(0, 2)
    .map((log) => {
      const color = poopColorById(log.poopColorId || log.poopColor);
      return {
        key: `diaper-${log.id || logTime(log)}`,
        icon: iconForLog(log),
        label: log.poop ? `Poop ${color?.label || "logged"}` : log.pee ? "Pee" : "Diaper",
        time: formatScheduleWakeTime(logTime(log))
      };
    });
}

function scheduleActivityActualItems(logs, slotCenter) {
  return logs
    .filter((log) => ["tummy_time", "baby_gym", "outdoor_time", "bath"].includes(log.type))
    .sort((a, b) => Math.abs(logTime(a) - slotCenter) - Math.abs(logTime(b) - slotCenter))
    .slice(0, 2)
    .map((log) => ({
      key: `activity-${log.id || logTime(log)}`,
      icon: iconForLog(log),
      label: scheduleActualLogLabel(log),
      time: formatScheduleWakeTime(logTime(log))
    }));
}

function dedupeScheduleActualItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

function scheduleMeridiem(value) {
  return String(value || "").trim().match(/\b(am|pm)\b/i)?.[1]?.toLowerCase() || "";
}

function timeToMinutes(value, inferredMeridiem = "") {
  const match = String(value || "").trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return NaN;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = String(match[3] || inferredMeridiem || "").toLowerCase();
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return NaN;
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function scheduleActualLogLabel(log) {
  if (log.type === "bottle") return `${numberValue(log.ounces, 0) || "--"} oz bottle`;
  if (log.type === "feeding") return `${log.side || "breast"} feed`;
  if (log.type === "sleep") return log.status ? `sleep ${log.status}` : "sleep";
  if (log.type === "tummy_time") return `tummy ${log.status || ""}`.trim();
  if (log.type === "bath") return `bath ${log.status || ""}`.trim();
  return labelForLog(log);
}

function formatOunces(value) {
  const amount = numberValue(value, 0);
  if (!amount) return "-- oz";
  const label = Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
  return `${label} oz`;
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatCompactDurationMs(ms) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return formatCompactDurationParts(hours, minutes);
}

function formatCompactDurationParts(hours, minutes) {
  if (hours && minutes) return `${hours}hrs${minutes}min`;
  if (hours) return `${hours}hrs`;
  return `${minutes}min`;
}

function formatScheduleWakeTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "--";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function renderCareIssueCardInfo(issue) {
  const bullets = issue.key === "sleep" ? sleepCardBullets() : issue.key === "eat" ? eatCardBullets() : [];
  if (!bullets.length) return "";
  return `<ul class="care-card-bullets">${bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderCurrentHighlight(text, tone = "live") {
  const label = tone === "age" ? "Currently age-based" : tone === "weather" ? "Currently outdoor" : "Currently";
  return `<span class="current-context-highlight current-context-${escapeAttr(tone)}"><span>${label}</span>${escapeHtml(text)}</span>`;
}

function renderCurrentOrPlain(text, isCurrent = false, tone = "live") {
  return isCurrent ? renderCurrentHighlight(text, tone) : escapeHtml(text);
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

function eatInfoRows() {
  const data = state.careInfo.eat;
  if (!data) {
    return [
      { icon: "star", title: "Milestones", text: "Loading..." },
      { icon: "heart", title: "Breastfeeding", text: "Loading..." },
      { icon: "bottle", title: "Bottle Feeding", text: "Loading..." },
      { icon: "cue", title: "Hunger Cues", text: "Loading..." },
      { icon: "diaper", title: "Diaper / Red Flags", text: "Loading..." }
    ];
  }

  const row = relevantFeedingRow(data);
  const loggedWet = summarizeLogsToday().wetDiapers;
  return [
    {
      icon: "star",
      title: "Milestones",
      text: row ? `${row.age}; ${row.howOften}; ${row.amountPerFeed}` : "Set birthday for age-based guidance",
      current: Boolean(row),
      currentTone: "age",
      details: [
        "Typical bottle amounts: first week 1-2 oz, 0-1 month 2-3 oz, 1-3 months 3-5 oz, 3-6 months 4-6 oz.",
        "Amount increases as baby grows. Use hunger and fullness cues with age guidance."
      ],
      tabs: [
        { key: "feeding-milestones-guide", label: "Guide" }
      ]
    },
    {
      icon: "heart",
      title: "Breastfeeding",
      text: "8-12 feeds/day; feed by cues, not clock alone",
      details: [
        "Usually every 2-3 hours, with more frequent feeds during growth spurts.",
        "Good latch: tummy-to-tummy, wide mouth, chin first, nipple toward roof of mouth, areola in mouth, nose clear.",
        "Mostly breastfed babies usually need 400 IU Vitamin D daily shortly after birth unless pediatrician advises otherwise.",
        "If nipple pain persists, contact a lactation consultant."
      ],
      tabs: [
        { key: "breastfeeding-tips-guide", label: "Tips" },
        { key: "boobie-positions", label: "Boobie Positions" }
      ]
    },
    {
      icon: "bottle",
      title: "Bottle Feeding",
      text: `${bottleReminder(data, row)} Formula 8-12 feeds/day.`,
      current: Boolean(row || relevantNippleSize(data)),
      currentTone: "age",
      details: [
        "Formula feeding is usually 8-12 feeds/day; amount increases as baby grows.",
        "Stop when baby turns away, closes mouth, or stops sucking.",
        "Paced feeding: baby semi-upright, bottle mostly horizontal, pause frequently.",
        milkPumpReminder(data).replace(/\.\s+/g, "; "),
        "Morning often yields the most milk. Power pump: 20 pump, 10 rest, 20 pump, 10 rest, 10 pump.",
        "Milk storage: room 4h, fridge 4d, cooler 24h, freezer 6 months best.",
        "Never refreeze thawed milk. Label dates and use oldest first.",
        "Burping can take 1-10 minutes.",
        "Some babies do not burp much. No burp does not automatically mean something is wrong."
      ],
      tabs: [
        { key: "bottle-feeding-guide", label: "Bottle" },
        { key: "pumping-storage-guide", label: "Pumping / Storage" }
      ]
    },
    {
      icon: "cue",
      title: "Hunger Cues",
      text: "Feed before crying; crying makes feeding harder",
      details: [
        "Early cues: rooting, sucking fingers, lip smacking, opening mouth, stirring while asleep.",
        "Crying is a late hunger cue."
      ],
      tabs: [
        { key: "hunger-cues", label: "Guide" }
      ]
    },
    {
      icon: "diaper",
      title: "Diaper / Red Flags",
      text: `${loggedWet} wet logged today; ${wetDiaperReminder(data)}`,
      current: true,
      details: [
        "Expected wet diapers: Day 1: 1+, Day 2: 2+, Day 3: 3+, Day 4+: 6+ per day.",
        "By Day 5, too few wet diapers with poor feeding or excess sleepiness means contact pediatrician or lactation support.",
        "Call pediatrician for no wet diapers, very poor feeding, excessive lethargy, blood/red/white/gray stool.",
        "Dehydration signs: dry mouth, no tears, or no urine for 8+ hours."
      ],
      tabs: [
        { key: "wet-diapers-poop-guide", label: "Diaper / Poop" }
      ]
    }
  ];
}

function sleepInfoRows() {
  const data = state.careInfo.sleep;
  if (!data) {
    return [
      { icon: "moon", title: "Milestones", text: "Loading..." },
      { icon: "star", title: "Naps", text: "Loading..." },
      { icon: "shield", title: "Safe Sleep", text: "Loading..." },
      { icon: "clothes", title: "Clothing", text: "Loading..." },
      { icon: "routine", title: "Routine", text: "Loading..." },
      { icon: "eyes", title: "Sleep Cues", text: "Loading..." }
    ];
  }

  const row = relevantSleepRow(data);
  const ageGuidance = row ? `${row.age}; ${row.sleepMilestone}; wake ${row.wakeWindow}` : "Set birthday for age-based guidance";
  const napGuidance = row ? `${row.nap}; ${row.recommendedNapTime || "30 min-2 hrs each"}` : "Set birthday for age-based guidance";
  return [
    {
      icon: "moon",
      title: "Milestones",
      text: ageGuidance,
      current: Boolean(row),
      currentTone: "age",
      details: [
        "Sleep needs change quickly by age; use the current row as a guide, not a strict rule.",
        "Wake window means the time baby can usually stay awake between sleeps.",
        "0-8 weeks: baby often cycles Eat -> Awake -> Sleep -> Repeat across 24 hours, so a 2 PM nap and 2 AM sleep can feel similar.",
        "Newborns may sleep all day, stay awake at night, or show day/night confusion.",
        "Around 6-12 weeks, babies start developing circadian rhythm, their body clock."
      ],
      tabs: [
        { key: "sleep-milestones-guide", label: "Milestones" },
        { key: "sleep-goals", label: "Goals" }
      ]
    },
    {
      icon: "star",
      title: "Naps",
      text: napGuidance,
      current: Boolean(row),
      currentTone: "age",
      details: [
        "Keep naps in a dark, quiet room when possible.",
        "Newborn naps vary. For older babies, many naps land around 30 minutes to 2 hours.",
        "Limit long naps to 2-3 times per day unless pediatric guidance says otherwise."
      ],
      tabs: [
        { key: "sleep-naps-guide", label: "Naps" }
      ]
    },
    {
      icon: "shield",
      title: "Safe Sleep",
      text: "Back to sleep; firm flat mattress; no loose items",
      details: [
        "Use a crib, bassinet, portable crib, or play yard that meets safety standards.",
        "Keep pillows, blankets, bumpers, stuffed toys, and loose bedding out of the sleep area.",
        "Stop swaddling once baby begins to roll."
      ],
      tabs: [
        { key: "sleep-environment-guide", label: "Environment" }
      ]
    },
    {
      icon: "clothes",
      title: "Clothing",
      text: `${data.indoorClothing || "Keep room comfortable and avoid overheating"} ${outdoorClothingRecommendation(data)}`,
      current: Number.isFinite(state.weather?.temperature),
      currentTone: "weather",
      details: [
        "Check baby chest or neck, not hands or feet, to judge warmth.",
        "Signs of overheating can include sweating, hot red skin, rapid breathing, or restlessness.",
        "Use safe sleep clothing such as pajamas, swaddle, or sleep sack based on age and rolling status."
      ],
      tabs: [
        { key: "sleep-environment-guide", label: "Clothing" }
      ]
    },
    {
      icon: "routine",
      title: "Routine",
      text: "Start bedtime routine 30-60 min before bed",
      details: [
        "Example: bath, short massage, diaper and pajamas, quiet book, then bottle/bed if baby shows hunger cues.",
        "Keep nighttime care dim and calm; white noise can help if baby settles with it.",
        "Use morning light and bright daytime play to support day-night rhythm."
      ],
      tabs: [
        { key: "sleep-routine-guide", label: "Routine" }
      ]
    },
    {
      icon: "eyes",
      title: "Sleep Cues",
      text: "Start routine at sleepy cues; overtired babies settle harder",
      details: [
        "Sleepy cues: rubbing eyes, yawning, glassy eyes, looking away, fussing but calming with cuddles.",
        "Overtired cues: crying, arching back, fighting sleep, hyperactive, fussy or wired.",
        "Follow sleepy cues, not the clock alone."
      ],
      tabs: [
        { key: "sleep-cues-guide", label: "Cues" }
      ]
    }
  ];
}

function healthInfoRows() {
  const wetDiapers = summarizeLogsToday().wetDiapers;
  const latestWeight = lastGrowthLog("weight");
  const latestHeight = lastGrowthLog("height");
  const latestWeightText = latestWeight ? formatMeasurement(readWeightGrams(latestWeight) / weightUnits.lb.grams, "lb") : "No weight logged";
  const latestHeightText = latestHeight ? formatMeasurement(readHeightMm(latestHeight) / heightUnits.in.mm, "in") : "No length logged";

  return [
    {
      icon: "medicine",
      title: "Must Have For Health",
      text: "Everyday essentials and optional helpers with product photos",
      details: [
        "Product images and care notes were extracted from the provided health essentials guide.",
        "Use medicine, supplements, and optional drops only as directed by the pediatrician or product label."
      ],
      tabs: [
        { key: "health-products", label: "Products" }
      ]
    },
    {
      icon: "tooth",
      title: "Dental",
      text: "Tap baby teeth to see eruption timing and care steps",
      details: [
        "Most babies get a first tooth around 6-10 months, but timing varies.",
        "Start brushing as soon as the first tooth appears.",
        "Schedule the first dental visit around 12 months or within 6 months of the first tooth."
      ],
      tabs: [
        { key: "dental-guide", label: "Teeth" },
        { key: "dental-doctor", label: "Doctor" },
        { key: "baby-teeth-eruption-chart", label: "Chart" }
      ]
    },
    {
      icon: "health",
      title: "Common Syndromes",
      text: "Quick checks for everyday symptom patterns",
      details: [
        "Congestion or runny nose: use saline, gentle suction, humidity, and watch feeding and breathing.",
        "Gas or colic: try burping, bicycle legs, tummy time while awake, and paced feeding; call if belly is hard or baby cannot be consoled.",
        "Rash or diaper irritation: keep skin clean and dry, use barrier cream, and call for blisters, spreading redness, fever, or pus.",
        "Spit-up or vomiting: small spit-ups can be common; call for green vomit, blood, repeated forceful vomiting, poor feeding, or fewer wet diapers.",
        "Constipation or stool changes: watch comfort, feeding, and wet diapers; call for blood, white/gray/black stool, or hard belly.",
        "Teething discomfort: offer a chilled teether and gum massage; avoid numbing gels unless the pediatrician says to use them."
      ]
    },
    {
      icon: "thermometer",
      title: "Temperature",
      text: "Rectal 100.4F or higher needs pediatric guidance",
      details: [
        "For babies under 3 months, a rectal temperature of 100.4F or higher is urgent.",
        "Call the pediatrician for fever, low temperature, unusual sleepiness, poor feeding, or breathing concerns.",
        "Use a rectal thermometer when accuracy matters for a newborn."
      ]
    },
    {
      icon: "warning",
      title: "Call Now Signs",
      text: "Breathing trouble, blue lips, dehydration, or hard-to-wake",
      details: [
        "Seek urgent help for trouble breathing, blue lips or face, seizure, limpness, or hard-to-wake behavior.",
        "Call for no wet diapers, very poor feeding, repeated vomiting, blood in stool, or signs of dehydration.",
        "Trust parent instinct when baby looks very different from normal."
      ],
      tabs: [
        { key: "baby-cries", label: "Cries Check" }
      ]
    },
    {
      icon: "diaper",
      title: "Hydration",
      text: `${wetDiapers} wet logged today; watch diapers and feeding`,
      current: true,
      details: [
        "Wet diapers are one of the clearest daily signs baby is getting enough fluid.",
        "Dry mouth, no tears, sunken soft spot, or no urine for 8+ hours can be dehydration signs.",
        "Pair diaper counts with feeding quality and baby's alertness."
      ],
      tabs: [
        { key: "wet-diapers-poop-guide", label: "Diaper / Poop" }
      ]
    },
    {
      icon: "heart",
      title: "Comfort Check",
      text: "Try feed, diaper, burp, temperature, sleep, then sick check",
      details: [
        "Start with the common causes: hungry, wet diaper, gas, too hot or cold, overstimulated, or overtired.",
        "If comfort steps do not help and baby seems unwell, call the pediatrician.",
        "Crying peaks around 6-8 weeks for many babies and often improves after that."
      ],
      tabs: [
        { key: "baby-cries", label: "Cries Check" }
      ]
    },
    {
      icon: "growth",
      title: "Growth",
      text: `Latest: ${latestWeightText}; ${latestHeightText}`,
      current: Boolean(latestWeight || latestHeight),
      currentTone: "age",
      details: [
        "Use logged weight and length trends instead of one-off measurements.",
        "Bring feeding, diaper, sleep, and growth notes to checkups.",
        "Ask the pediatrician before changing feeding plans for weight concerns."
      ]
    },
    {
      icon: "doctor",
      title: "Checkups",
      text: "Track questions before appointments",
      details: [
        "Write down questions as they come up so they are ready for the visit.",
        "Mention fever, feeding changes, diaper changes, rash, breathing, sleepiness, or unusual crying.",
        "Keep emergency contacts and pediatrician instructions easy to find."
      ]
    }
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
  return `${temperature}F outdoor: ${rule?.text || "Dress in light layers and check baby often."}`;
}

function renderCareBackButton(showBack = true) {
  return showBack ? `<button class="ghost care-back-button" type="button" data-care-back>Back to Care</button>` : "";
}

function renderCareIssueInfoPanel(issue) {
  if (issue.key === "eat") return renderEatCareInfoPanel(issue);
  if (issue.key === "sleep") return renderSleepCareInfoPanel(issue);
  if (issue.key === "health") return renderHealthCareInfoPanel(issue);
  const info = renderCareIssueCardInfo(issue);
  return `
    <section class="care-detail-info" aria-label="${escapeAttr(issue.title)} information">
      ${info || `<p>${escapeHtml(issue.helper)}</p>`}
    </section>
  `;
}

function renderEatCareInfoPanel(issue) {
  return `
    <section class="care-detail-info eat-care-info" aria-label="${escapeAttr(issue.title)} information">
      ${eatInfoRows().map(renderEatInfoRow).join("")}
    </section>
  `;
}

function renderSleepCareInfoPanel(issue) {
  return `
    <section class="care-detail-info eat-care-info sleep-care-info" aria-label="${escapeAttr(issue.title)} information">
      ${sleepInfoRows().map(renderSleepInfoRow).join("")}
    </section>
  `;
}

function renderHealthCareInfoPanel(issue) {
  const rows = healthInfoRows();
  const topRows = rows.slice(0, 3);
  const basics = rows.slice(3);

  return `
    <section class="care-detail-info eat-care-info health-care-info" aria-label="${escapeAttr(issue.title)} information">
      ${topRows.map(renderHealthInfoRow).join("")}
      ${renderHealthBasicsGroup(basics)}
    </section>
  `;
}

function renderEatInfoRow(item) {
  const activeKey = state.selectedCareSubtab.eat || "overall";
  const activeSubviewKey = activeKey.startsWith("overall:") ? activeKey.slice("overall:".length) : activeKey;
  const activeItemTab = (item.tabs || []).find((tab) => tab.key === activeSubviewKey) || null;
  const defaultItemTab = (item.tabs || [])[0] || null;
  const selectedItemTab = activeItemTab || defaultItemTab;
  const isOpen = Boolean(activeItemTab);
  const rowFace = `
    <span class="eat-info-icon icon-${escapeAttr(item.icon)}" aria-hidden="true">${eatInfoIcon(item.icon)}</span>
    <span class="eat-info-copy">
      <strong>${escapeHtml(item.title)}</strong>
      <small>${renderCurrentOrPlain(item.text, item.current, item.currentTone)}</small>
    </span>
    <span class="eat-info-chevron" aria-hidden="true">&#8250;</span>
  `;

  return `
    <details class="eat-info-row" ${isOpen ? "open" : ""}>
      <summary>${rowFace}</summary>
      ${Array.isArray(item.details) && item.details.length ? `
        <ul class="eat-info-details">
          ${item.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}
        </ul>
      ` : ""}
      ${item.tabs?.length ? `
        <div class="eat-info-tabs" role="tablist" aria-label="${escapeAttr(item.title)} references">
          ${item.tabs.map((tab) => `
            <button class="${selectedItemTab?.key === tab.key ? "active" : ""}" type="button" role="tab" aria-selected="${selectedItemTab?.key === tab.key ? "true" : "false"}" data-care-subtab="overall:${escapeAttr(tab.key)}">
              ${escapeHtml(tab.label)}
            </button>
          `).join("")}
        </div>
        ${selectedItemTab ? renderEatInfoTabImage(selectedItemTab.key) : ""}
      ` : ""}
    </details>
  `;
}

function renderSleepInfoRow(item) {
  const activeKey = state.selectedCareSubtab.sleep || "overview";
  const activeSubviewKey = activeKey.startsWith("sleep:") ? activeKey.slice("sleep:".length) : activeKey;
  const activeItemTab = (item.tabs || []).find((tab) => tab.key === activeSubviewKey) || null;
  const defaultItemTab = (item.tabs || [])[0] || null;
  const selectedItemTab = activeItemTab || defaultItemTab;
  const isOpen = Boolean(activeItemTab);
  const rowFace = `
    <span class="eat-info-icon icon-${escapeAttr(item.icon)}" aria-hidden="true">${eatInfoIcon(item.icon)}</span>
    <span class="eat-info-copy">
      <strong>${escapeHtml(item.title)}</strong>
      <small>${renderCurrentOrPlain(item.text, item.current, item.currentTone)}</small>
    </span>
    <span class="eat-info-chevron" aria-hidden="true">&#8250;</span>
  `;

  return `
    <details class="eat-info-row sleep-info-row" ${isOpen ? "open" : ""}>
      <summary>${rowFace}</summary>
      ${Array.isArray(item.details) && item.details.length ? `
        <ul class="eat-info-details">
          ${item.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}
        </ul>
      ` : ""}
      ${item.tabs?.length ? `
        <div class="eat-info-tabs" role="tablist" aria-label="${escapeAttr(item.title)} references">
          ${item.tabs.map((tab) => `
            <button class="${selectedItemTab?.key === tab.key ? "active" : ""}" type="button" role="tab" aria-selected="${selectedItemTab?.key === tab.key ? "true" : "false"}" data-care-subtab="sleep:${escapeAttr(tab.key)}">
              ${escapeHtml(tab.label)}
            </button>
          `).join("")}
        </div>
        ${selectedItemTab ? renderSleepInfoTabImage(selectedItemTab.key) : ""}
      ` : ""}
    </details>
  `;
}

function renderHealthInfoRow(item) {
  const activeKey = state.selectedCareSubtab.health || "overview";
  const activeSubviewKey = activeKey.startsWith("health:") ? activeKey.slice("health:".length) : activeKey;
  const activeItemTab = (item.tabs || []).find((tab) => tab.key === activeSubviewKey) || null;
  const defaultItemTab = (item.tabs || [])[0] || null;
  const selectedItemTab = activeItemTab || defaultItemTab;
  const isOpen = Boolean(activeItemTab);
  const rowFace = `
    <span class="eat-info-icon icon-${escapeAttr(item.icon)}" aria-hidden="true">${eatInfoIcon(item.icon)}</span>
    <span class="eat-info-copy">
      <strong>${escapeHtml(item.title)}</strong>
      <small>${renderCurrentOrPlain(item.text, item.current, item.currentTone)}</small>
    </span>
    <span class="eat-info-chevron" aria-hidden="true">&#8250;</span>
  `;

  return `
    <details class="eat-info-row health-info-row" ${isOpen ? "open" : ""}>
      <summary>${rowFace}</summary>
      ${Array.isArray(item.details) && item.details.length ? `
        <ul class="eat-info-details">
          ${item.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}
        </ul>
      ` : ""}
      ${item.tabs?.length ? `
        <div class="eat-info-tabs" role="tablist" aria-label="${escapeAttr(item.title)} references">
          ${item.tabs.map((tab) => `
            <button class="${selectedItemTab?.key === tab.key ? "active" : ""}" type="button" role="tab" aria-selected="${selectedItemTab?.key === tab.key ? "true" : "false"}" data-care-subtab="health:${escapeAttr(tab.key)}">
              ${escapeHtml(tab.label)}
            </button>
          `).join("")}
        </div>
        ${selectedItemTab ? renderHealthInfoTabImage(selectedItemTab.key) : ""}
      ` : ""}
    </details>
  `;
}

function renderHealthBasicsGroup(rows) {
  const activeKey = state.selectedCareSubtab.health || "overview";
  const activeSubviewKey = activeKey.startsWith("health:") ? activeKey.slice("health:".length) : activeKey;
  const hasActiveChild = rows.some((row) => (row.tabs || []).some((tab) => tab.key === activeSubviewKey));
  const rowFace = `
    <span class="eat-info-icon icon-health" aria-hidden="true">${eatInfoIcon("health")}</span>
    <span class="eat-info-copy">
      <strong>General</strong>
      <small>Temperature, urgent signs, hydration, comfort, growth, and checkups</small>
    </span>
    <span class="eat-info-chevron" aria-hidden="true">&#8250;</span>
  `;

  return `
    <details class="eat-info-row health-info-row health-basics-group" ${hasActiveChild ? "open" : ""}>
      <summary>${rowFace}</summary>
      <div class="health-basics-list">
        ${rows.map(renderHealthInfoRow).join("")}
      </div>
    </details>
  `;
}

function renderEatInfoTabImage(tabKey) {
  const tab = eatReferenceTabs().find((item) => item.key === tabKey);
  if (!tab) return "";
  return `
    <div class="eat-info-image-frame">
      ${tab.key === "hunger-cues" ? renderHungerCuesQuickCardClean() : ""}
      <img src="${escapeAttr(tab.image)}" alt="${escapeAttr(tab.alt)}">
    </div>
  `;
}

function renderSleepInfoTabImage(tabKey) {
  const tab = sleepReferenceTabs().find((item) => item.key === tabKey);
  if (!tab) return "";
  return `
    <div class="eat-info-image-frame sleep-info-image-frame">
      <img src="${escapeAttr(tab.image)}" alt="${escapeAttr(tab.alt)}">
    </div>
  `;
}

function renderHealthInfoTabImage(tabKey) {
  const tab = healthReferenceTabs().find((item) => item.key === tabKey);
  if (!tab) return "";
  return `
    <div class="eat-info-image-frame health-info-image-frame">
      ${tab.key === "baby-cries" ? renderBabyCriesCardClean({ embedded: true }) : ""}
      ${tab.key === "health-products" ? renderHealthProductList() : ""}
      ${tab.key === "dental-guide" ? renderDentalTeethGuide() : ""}
      ${tab.key === "dental-doctor" ? renderDentalDoctorGuide() : ""}
      ${tab.image ? `<img src="${escapeAttr(tab.image)}" alt="${escapeAttr(tab.alt)}">` : ""}
    </div>
  `;
}

function eatInfoIcon(icon) {
  const icons = {
    star: "&#9733;",
    heart: "&#9829;",
    formula: "&#129371;",
    cue: "&#128064;",
    pump: "&#9878;",
    bottle: "&#127868;",
    burp: "&#128168;",
    storage: "&#10052;",
    sun: "&#9728;",
    moon: "&#9789;",
    shield: "&#128737;",
    clothes: "&#128085;",
    routine: "&#128214;",
    eyes: "&#128064;",
    diaper: "&#129514;",
    water: "&#128167;",
    thermometer: "&#127777;",
    doctor: "&#9877;",
    medicine: "&#128138;",
    growth: "&#128200;",
    health: "&#9877;",
    tooth: "&#129463;",
    warning: "!"
  };
  return icons[icon] || "&#8226;";
}

function renderCareIssueView(issue, options = {}) {
  if (issue.key === "troubleshoot") return renderTroubleshootCareView(issue, options);
  if (issue.key === "eat") return renderEatCareView(issue, options);
  if (issue.key === "sleep") return renderSleepCareView(issue, options);
  if (issue.key === "routines") return renderRoutinesCareView(issue, options);
  if (issue.key === "hygiene") return renderHygieneCareView(issue, options);
  if (issue.key === "safety") return renderChildProofCareView(issue, options);
  if (issue.key === "health") return renderHealthCareView(issue, options);
  const showBack = options.showBack !== false;

  return `
    <section class="care-detail">
      ${renderCareBackButton(showBack)}
      <div class="care-detail-hero" style="--card-image: url('${careHeaderImage(issue.header)}')">
        <h3>${escapeHtml(issue.title)}</h3>
        <p>${escapeHtml(issue.helper)}</p>
      </div>
      ${renderCareIssueInfoPanel(issue)}
      <div class="care-detail-body"></div>
    </section>
  `;
}

function renderChildProofCareView(issue, options = {}) {
  const showBack = options.showBack !== false;
  const rooms = [
    {
      icon: "&#128719;",
      title: "Nursery",
      text: "Sleep space, furniture, cords, outlets, and room setup",
      items: [
        { icon: "&#129523;", title: "Anchor Furniture", text: "Secure dressers and furniture to walls to prevent tip-overs." },
        { icon: "&#128268;", title: "Outlet Covers", text: "Prevent access to electrical outlets." },
        { icon: "&#128682;", title: "Safety Gates", text: "Block access to unsafe rooms or stairs." },
        { icon: "&#128680;", title: "Smoke Detector", text: "Detect smoke and provide early fire warnings." },
        { icon: "&#128719;", title: "Safe Crib", text: "Use a crib that meets current safety standards." },
        { icon: "&#129681;", title: "Firm Mattress", text: "Reduce suffocation and entrapment risks." },
        { icon: "&#11093;", title: "Empty Crib", text: "Keep pillows, blankets, bumpers, and toys out of the crib." },
        { icon: "&#127912;", title: "Mobile Safety", text: "Remove mobiles when baby can reach or stand." },
        { icon: "&#128257;", title: "Cord-Free Zone", text: "Keep cords away from the crib area." },
        { icon: "&#128205;", title: "Safe Crib Location", text: "Keep crib away from windows, heaters, and furniture." },
        { icon: "&#127788;", title: "Room Ventilation", text: "Maintain comfortable airflow and temperature." },
        { icon: "&#129528;", title: "Secure Rug", text: "Use non-slip pads under rugs." },
        { icon: "&#129681;", title: "Safe Rocker & Glider", text: "Prevent pinched fingers and tipping hazards." }
      ]
    },
    {
      icon: "&#127859;",
      title: "Kitchen",
      text: "Cabinets, heat, chemicals, sharp tools, and pull-down hazards",
      items: [
        { icon: "&#128274;", title: "Cabinet Locks", text: "Restrict access to dangerous items." },
        { icon: "&#127860;", title: "Dishwasher Lock", text: "Prevent opening and access to sharp utensils." },
        { icon: "&#129524;", title: "Cleaning Agent Storage", text: "Keep chemicals locked away." },
        { icon: "&#128298;", title: "Knives Out of Reach", text: "Prevent cuts and injuries." },
        { icon: "&#128268;", title: "Small Appliances Unplugged", text: "Eliminate electrical and cord hazards." },
        { icon: "&#127859;", title: "Stove Knob Covers", text: "Prevent accidental burner activation." },
        { icon: "&#127858;", title: "Pot Handle Safety", text: "Turn handles inward to prevent spills." },
        { icon: "&#129482;", title: "Refrigerator Lock", text: "Limit access to food and containers." },
        { icon: "&#129522;", title: "Magnet Safety", text: "Prevent choking hazards from loose magnets." },
        { icon: "&#128306;", title: "Sharp Corner Protection", text: "Reduce injury from falls." },
        { icon: "&#129533;", title: "No Tablecloths", text: "Prevent children from pulling objects down." },
        { icon: "&#129371;", title: "Glassware Storage", text: "Keep breakable items out of reach." }
      ]
    },
    {
      icon: "&#128715;",
      title: "Living Room",
      text: "Stairs, outlets, lamps, fireplace, cords, corners, and decor",
      items: [
        { icon: "&#128682;", title: "Baby Gate", text: "Restrict access to stairs and hazards." },
        { icon: "&#128268;", title: "Outlet Covers", text: "Cover unused electrical outlets." },
        { icon: "&#128161;", title: "Floor Lamp Safety", text: "Prevent lamps from being pulled over." },
        { icon: "&#128293;", title: "Fireplace Screen", text: "Protect against burns and hot surfaces." },
        { icon: "&#129521;", title: "Fireplace Edge Padding", text: "Cushion hard fireplace edges." },
        { icon: "&#129695;", title: "Blind Cord Safety", text: "Reduce strangulation hazards." },
        { icon: "&#128682;", title: "Door Knob Covers", text: "Prevent access to unsafe areas." },
        { icon: "&#128306;", title: "Sharp Corner Guards", text: "Cushion furniture corners." },
        { icon: "&#127994;", title: "Decorative Object Safety", text: "Remove breakable or heavy objects." },
        { icon: "&#129716;", title: "Houseplant Safety", text: "Keep toxic plants out of reach." }
      ]
    },
    {
      icon: "&#128705;",
      title: "Bathroom",
      text: "Water, medicine, outlets, appliances, chemicals, and slipping",
      items: [
        { icon: "&#128701;", title: "Toilet Lock", text: "Prevent drowning and contamination risks." },
        { icon: "&#128268;", title: "Outlet Covers", text: "Protect against electrical shock." },
        { icon: "&#128138;", title: "Medication Storage", text: "Keep medicine inaccessible to children." },
        { icon: "&#128274;", title: "Medicine Cabinet Lock", text: "Add extra protection for medications." },
        { icon: "&#128268;", title: "Appliance Safety", text: "Unplug and store electrical devices." },
        { icon: "&#129524;", title: "Cleaning Agent Storage", text: "Secure toxic chemicals." },
        { icon: "&#129528;", title: "Non-Slip Mat", text: "Reduce slipping and fall risks." },
        { icon: "&#128688;", title: "Faucet Cover", text: "Protect from bumps and injuries." },
        { icon: "&#9832;", title: "Hot Water Safety", text: "Prevent scalding from hot water." }
      ]
    },
    {
      icon: "&#127795;",
      title: "Backyard",
      text: "Fire, water, plants, gates, chemicals, tools, vehicles, and grills",
      items: [
        { icon: "&#128293;", title: "Fire Pit Cover", text: "Prevent burns and falls into fire pits." },
        { icon: "&#128306;", title: "Patio Corner Guards", text: "Cushion sharp outdoor furniture edges." },
        { icon: "&#127946;", title: "Pool Fence", text: "Restrict access to pools and water hazards." },
        { icon: "&#128274;", title: "Pool Gate Lock", text: "Prevent unsupervised pool entry." },
        { icon: "&#9752;", title: "Toxic Plant Check", text: "Remove poisonous plants." },
        { icon: "&#128682;", title: "Yard Fence", text: "Prevent wandering into unsafe areas." },
        { icon: "&#129514;", title: "Lawn Chemical Storage", text: "Secure fertilizers and pesticides." },
        { icon: "&#128682;", title: "Garage Door Safety", text: "Prevent injury from automatic doors." },
        { icon: "&#128663;", title: "Vehicle Safety", text: "Keep vehicles locked and inaccessible." },
        { icon: "&#128736;", title: "Garden Tool Storage", text: "Secure sharp tools and equipment." },
        { icon: "&#127860;", title: "BBQ Safety", text: "Keep children away from hot grills." }
      ]
    },
    {
      icon: "&#128733;",
      title: "Playground",
      text: "Supervision, age-appropriate equipment, surfaces, weather, and outdoor play rules",
      items: [
        { icon: "&#128065;", title: "Adult Supervision", text: "Always stay close and actively watch children." },
        { icon: "&#128118;", title: "Age Appropriate Equipment", text: "Use playgrounds designed for your child's age group." },
        { icon: "&#129682;", title: "Soft Landing Surface", text: "Play on mulch, rubber, sand, or other impact-absorbing surfaces." },
        { icon: "&#128733;", title: "Safe Slide Use", text: "Go down feet first and one child at a time." },
        { icon: "&#128171;", title: "Safe Swing Use", text: "Stay clear of moving swings and supervise use." },
        { icon: "&#129521;", title: "Monkey Bar Safety", text: "Assist children on climbing equipment appropriate for their ability." },
        { icon: "&#127777;", title: "Check Equipment Temperature", text: "Test slides and metal surfaces before use on hot days." },
        { icon: "&#128085;", title: "Secure Clothing", text: "Avoid drawstrings, scarves, and loose clothing that can snag." },
        { icon: "&#9937;", title: "Helmet Removal", text: "Remove bike helmets before using playground equipment." },
        { icon: "&#128269;", title: "Equipment Inspection", text: "Check for broken, rusted, or damaged equipment." },
        { icon: "&#128737;", title: "Guardrails Present", text: "Ensure elevated platforms have protective barriers." },
        { icon: "&#129495;", title: "Safe Climbing", text: "Teach children to climb carefully and use handholds." },
        { icon: "&#9995;", title: "No Pushing or Rough Play", text: "Prevent falls and collisions." },
        { icon: "&#129529;", title: "Clear Play Area", text: "Remove toys, bags, and obstacles from walkways." },
        { icon: "&#128167;", title: "Stay Hydrated", text: "Bring water during outdoor play." },
        { icon: "&#9728;", title: "Sun Protection", text: "Use sunscreen, hats, and shade when appropriate." },
        { icon: "&#128095;", title: "Safe Footwear", text: "Wear closed-toe shoes with good traction." },
        { icon: "&#9995;", title: "Watch for Pinch Points", text: "Keep fingers away from moving parts." },
        { icon: "&#128064;", title: "Stranger Awareness", text: "Stay within sight and supervise interactions with others." },
        { icon: "&#128222;", title: "Emergency Contact Ready", text: "Keep phone and emergency contacts accessible." },
        { icon: "&#127906;", title: "Older Toddler: Safe Zip Line Use", text: "Supervise and verify equipment is age appropriate." },
        { icon: "&#129432;", title: "Older Toddler: Trampoline Safety", text: "One jumper at a time and use safety enclosures." },
        { icon: "&#129495;", title: "Older Toddler: Climbing Wall Safety", text: "Stay below recommended heights and supervise closely." },
        { icon: "&#9878;", title: "Older Toddler: Balance Beam Safety", text: "Assist beginners and use low-height equipment." },
        { icon: "&#128166;", title: "Older Toddler: Water Play Supervision", text: "Closely supervise splash pads and water features." },
        { icon: "&#128690;", title: "Older Toddler: Bicycle & Scooter Helmet", text: "Wear a properly fitted helmet when riding nearby." },
        { icon: "&#128664;", title: "Older Toddler: Parking Lot Awareness", text: "Hold hands near roads and parking areas." },
        { icon: "&#128054;", title: "Older Toddler: Dog Awareness", text: "Teach children not to approach unfamiliar dogs." },
        { icon: "&#127781;", title: "Older Toddler: Weather Check", text: "Avoid playgrounds during storms, high heat, or icy conditions." },
        { icon: "&#128027;", title: "Older Toddler: Bug & Plant Awareness", text: "Watch for bees, poison ivy, and other outdoor hazards." }
      ]
    },
    {
      icon: "&#9888;",
      title: "Choking Hazards",
      text: "Small objects, loose parts, button batteries, coins, toys, food shape",
      items: [
        { icon: "&#128270;", title: "Small Object Sweep", text: "Check floors, couches, and low shelves for anything baby could mouth." },
        { icon: "&#128267;", title: "Button Batteries", text: "Keep remotes, scales, cards, and toys with batteries secured." },
        { icon: "&#129528;", title: "Toy Part Check", text: "Remove loose, broken, or age-inappropriate toy parts." },
        { icon: "&#127869;", title: "Food Shape", text: "Modify round, firm, sticky, or hard foods before serving." }
      ]
    },
    {
      icon: "&#128062;",
      title: "Pets",
      text: "Supervision, pet gates, bowls, litter, toys, calm introductions",
      items: [
        { icon: "&#128065;", title: "Supervised Contact", text: "Never leave baby alone with pets, even familiar ones." },
        { icon: "&#128679;", title: "Pet Gates", text: "Create baby-free and pet-free zones when needed." },
        { icon: "&#129379;", title: "Bowls & Food", text: "Keep pet food and water bowls away from crawling areas." },
        { icon: "&#129532;", title: "Litter & Waste", text: "Keep litter boxes and waste areas inaccessible." },
        { icon: "&#128054;", title: "Calm Introductions", text: "Reward calm behavior and separate pets when overstimulated." }
      ]
    }
  ];
  const itemId = (room, item) => `child-proof:${slugifyId(room.title)}:${slugifyId(item.title)}`;

  return `
    <section class="care-detail">
      ${renderCareBackButton(showBack)}
      <article class="eat-overview-card child-proof-overview-card">
        <div class="care-detail-hero" style="--card-image: url('${careHeaderImage(issue.header)}')">
          <h3>${escapeHtml(issue.title)}</h3>
          <p>${escapeHtml(issue.helper)}</p>
        </div>
        ${renderCareIssueInfoPanel(issue)}
        <section class="child-proof-grid" aria-label="Child proof home areas">
          ${rooms.map((room) => `
            <details class="child-proof-room-card child-proof-expander">
              <summary class="child-proof-room-summary">
                <span class="child-proof-room-icon" aria-hidden="true">${room.icon}</span>
                <div>
                  <h4>${escapeHtml(room.title)}</h4>
                  <p>${escapeHtml(room.text)}</p>
                </div>
              </summary>
              <ul class="child-proof-placeholder-list">
                ${room.items.map((item) => `
                  <li>
                    <label class="child-proof-check-row">
                      <input type="checkbox" data-child-proof-check="${escapeAttr(itemId(room, item))}" ${state.childProofProgress[itemId(room, item)]?.checked ? "checked" : ""}>
                      <span class="child-proof-list-emoji" aria-hidden="true">${item.icon}</span>
                      <span><strong>${escapeHtml(item.title)}</strong>${escapeHtml(item.text)}</span>
                    </label>
                  </li>
                `).join("")}
              </ul>
            </details>
          `).join("")}
        </section>
      </article>
    </section>
  `;
}

function slugifyId(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function updateChildProofProgress(id, checked) {
  if (!id) return;
  const previous = { ...state.childProofProgress };
  if (checked) {
    state.childProofProgress[id] = { checked: true, updatedAt: new Date().toISOString() };
  } else {
    delete state.childProofProgress[id];
  }
  try {
    const result = await fetchJson("/api/child-proof-progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, checked })
    });
    state.childProofProgress = result.child_proof_progress || {};
  } catch (error) {
    state.childProofProgress = previous;
    renderCare();
    showToast(`Could not save checklist: ${error.message}`);
  }
}

function renderRoutinesCareView(issue, options = {}) {
  const showBack = options.showBack !== false;

  return `
    <section class="care-detail">
      ${renderCareBackButton(showBack)}
      <article class="eat-overview-card routines-overview-card">
        <div class="care-detail-hero" style="--card-image: url('${careHeaderImage(issue.header)}')">
          <h3>${escapeHtml(issue.title)}</h3>
          <p>${escapeHtml(issue.helper)}</p>
        </div>
        <section class="care-detail-info eat-care-info routines-care-info" aria-label="Routine guidance">
          ${routineInfoRows().map(renderRoutineInfoRow).join("")}
        </section>
      </article>
    </section>
  `;
}

function routineInfoRows() {
  return [
    {
      icon: "sun",
      title: "Morning",
      text: "Light, feed, diaper, and gentle awake time",
      details: [
        "Expose baby to natural morning light when practical.",
        "Start with feed and diaper checks, then keep awake time age-appropriate.",
        "Use logs to spot the first nap window instead of forcing a fixed clock time."
      ]
    },
    {
      icon: "moon",
      title: "Naptime",
      text: "Short repeatable cue sequence before naps",
      details: [
        "Use a simple pattern: diaper, sleep sack or swaddle if safe, dim room, white noise if helpful.",
        "Begin when sleepy cues appear: yawning, glassy eyes, looking away, rubbing eyes, or fussing.",
        "If a nap is short, give 10-15 minutes to resettle; if still awake, move on."
      ]
    },
    {
      icon: "routine",
      title: "Bedtime",
      text: "Simple 10-20 min wind-down",
      details: [
        "Keep lights dim and the sequence calm.",
        "Bath or warm wipe-down is only needed 2-3 times per week.",
        "Put baby down drowsy or asleep, using safe sleep rules."
      ]
    },
    {
      icon: "star",
      title: "Daily Rhythm",
      text: "Bright days, calm nights, flexible timing",
      details: [
        "Keep daytime bright and interactive; keep nighttime boring and quiet.",
        "Track sleep, feeds, diapers, and notes to learn baby patterns.",
        "Adjust routines during growth spurts, illness, travel, or big sleep changes."
      ]
    }
  ];
}

function renderRoutineInfoRow(item) {
  const rowFace = `
    <span class="eat-info-icon icon-${escapeAttr(item.icon)}" aria-hidden="true">${eatInfoIcon(item.icon)}</span>
    <span class="eat-info-copy">
      <strong>${escapeHtml(item.title)}</strong>
      <small>${escapeHtml(item.text)}</small>
    </span>
    <span class="eat-info-chevron" aria-hidden="true">&#8250;</span>
  `;

  return `
    <details class="eat-info-row routine-info-row">
      <summary>${rowFace}</summary>
      <ul class="eat-info-details">
        ${item.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}
      </ul>
      ${item.title === "Morning" ? renderMorningRoutineFlow() : ""}
      ${item.title === "Naptime" ? renderNapRoutineFlow() : ""}
      ${item.title === "Bedtime" ? renderBedtimeRoutineFlows() : ""}
    </details>
  `;
}

function renderMorningRoutineFlow() {
  const steps = [
    { icon: "&#9728;", label: "Wake Up" },
    { icon: "&#129695;", label: "Open Curtains" },
    { icon: "&#128522;", label: "Good Morning Talk / Smiles" },
    { icon: "&#129514;", label: "Diaper Change" },
    { icon: "&#127868;", label: "Feed" },
    { icon: "&#127774;", label: "Day Begins" }
  ];

  return `
    <section class="bedtime-flow-card morning-flow-card" aria-label="Morning routine">
      <div class="bedtime-flow-title">
        <strong>Morning Routine</strong>
        <span>5-10 min</span>
      </div>
      <div class="bedtime-flow-track nap-flow-track">
        ${steps.map((step, index) => `
          <div class="bedtime-flow-step" style="--step-index: ${index}">
            <span aria-hidden="true">${step.icon}</span>
            <small>${escapeHtml(step.label)}</small>
          </div>
        `).join("")}
      </div>
      <div class="routine-light-note">
        <strong>Light matters most</strong>
        <span>Within the first hour: open blinds, turn on lights, sit near a bright window, or take a short walk outside if practical. Daylight strongly supports circadian rhythm.</span>
      </div>
    </section>
  `;
}

function renderNapRoutineFlow() {
  const steps = [
    { icon: "&#129514;", label: "Diaper check / change" },
    { icon: "&#128085;", label: "Swaddle or sleep sack", note: "age appropriate" },
    { icon: "&#128266;", label: "White noise" },
    { icon: "&#127769;", label: "Dim lights / curtains" },
    { icon: "&#129303;", label: "Quick cuddle / rocking" },
    { icon: "&#9789;", label: "Put baby down" }
  ];

  return `
    <section class="bedtime-flow-card nap-flow-card" aria-label="Newborn nap routine">
      <div class="bedtime-flow-title">
        <strong>Newborn Nap Routine</strong>
        <span>2-5 min</span>
      </div>
      <div class="bedtime-flow-track nap-flow-track">
        ${steps.map((step, index) => `
          <div class="bedtime-flow-step" style="--step-index: ${index}">
            <span aria-hidden="true">${step.icon}</span>
            <small>${escapeHtml(step.label)}</small>
            ${step.note ? `<em>${escapeHtml(step.note)}</em>` : ""}
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderBedtimeRoutineFlows() {
  const steps = [
    { icon: "&#127769;", label: "Dim lights" },
    { icon: "&#129514;", label: "Fresh diaper" },
    { icon: "&#128705;", label: "Bath or warm wipe-down", note: "2-3x/week" },
    { icon: "&#128134;", label: "Lotion / gentle massage", note: "optional" },
    { icon: "&#128085;", label: "Pajamas + sleep sack / swaddle" },
    { icon: "&#127868;", label: "Feed" },
    { icon: "&#128168;", label: "Burp" },
    { icon: "&#127925;", label: "Cuddle / lullaby / white noise" },
    { icon: "&#9789;", label: "Down drowsy or asleep" }
  ];

  return `
    <section class="bedtime-flow-card bedtime-flow-single" aria-label="Simple newborn bedtime routine">
      <div class="bedtime-flow-title">
        <strong>Simple Newborn Bedtime Routine</strong>
        <span>10-20 min</span>
      </div>
      <div class="bedtime-flow-track bedtime-flow-track-long">
        ${steps.map((step, index) => `
          <div class="bedtime-flow-step" style="--step-index: ${index}">
            <span aria-hidden="true">${step.icon}</span>
            <small>${escapeHtml(step.label)}</small>
            ${step.note ? `<em>${escapeHtml(step.note)}</em>` : ""}
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderHygieneCareView(issue, options = {}) {
  const showBack = options.showBack !== false;

  return `
    <section class="care-detail">
      ${renderCareBackButton(showBack)}
      <article class="eat-overview-card hygiene-overview-card">
        <div class="care-detail-hero" style="--card-image: url('${careHeaderImage(issue.header)}')">
          <h3>${escapeHtml(issue.title)}</h3>
          <p>${escapeHtml(issue.helper)}</p>
        </div>
        ${renderCareIssueInfoPanel(issue)}
        ${renderCordCareHygieneSection()}
        ${renderSpongeBathSection()}
        ${renderTubBathSection()}
        ${renderDiaperChangingSection()}
        ${renderNailTrimmingSection()}
        ${renderDentalCareSection()}
      </article>
    </section>
  `;
}

function hygieneIconPath(name) {
  return `/assets/care/hygiene-icons/${name}.png`;
}

function renderHygieneHeaderIcon(name, fallback) {
  return `
    <span class="eat-info-icon icon-water hygiene-header-icon" aria-hidden="true">
      <img src="${escapeAttr(hygieneIconPath(name))}" alt="">
      <span>${fallback}</span>
    </span>
  `;
}

function renderHygieneFlowIcon(step) {
  if (step.iconSrc) {
    return `<span class="sponge-bath-icon" aria-hidden="true"><img src="${escapeAttr(step.iconSrc)}" alt=""></span>`;
  }
  return `<span class="sponge-bath-icon" aria-hidden="true">${step.icon || ""}</span>`;
}

function renderCordCareHygieneSection() {
  const steps = [
    { icon: "&#128167;", title: "Keep dry", text: "Sponge baths only until the stump falls off" },
    { icon: "&#129514;", title: "Fold diaper", text: "Keep diaper below stump so air can circulate" },
    { icon: "&#127811;", title: "Let go", text: "Do not pull, even if the stump looks loose" },
    { icon: "&#128222;", title: "Call signs", text: "Redness, swelling, pus, bad smell, active bleeding, pain, or fever" },
    { icon: "&#128308;", title: "Granuloma", text: "Small red bump after stump falls off can happen; ask pediatrician if it persists" },
    { icon: "&#128118;", title: "Outie", text: "Outie shape is not caused by how the cord was cut or clamped" }
  ];

  return `
    <details id="hygiene-cord-care" class="sponge-bath-card cord-care-card hygiene-expander" aria-label="Umbilical cord care">
      <summary class="sponge-bath-header">
        ${renderHygieneHeaderIcon("sponge-title", "&#129656;")}
        <div>
          <h4>Cord Care</h4>
          <p>Keep the stump dry, open to air, and watched for infection signs.</p>
        </div>
      </summary>
      <div class="sponge-bath-flow cord-care-flow" aria-label="Umbilical cord care basics">
        ${steps.map((step, index) => `
          <div class="sponge-bath-step" style="--step-index: ${index}">
            ${renderHygieneFlowIcon(step)}
            <strong>${escapeHtml(step.title)}</strong>
            <small>${escapeHtml(step.text)}</small>
          </div>
        `).join("")}
      </div>
      <p class="sponge-bath-note">A tiny spot of blood when the stump separates can be normal. Active bleeding means another drop appears right after wiping.</p>
      ${renderUmbilicalCordChecklist("hygiene")}
    </details>
  `;
}

function renderSpongeBathSection() {
  const steps = [
    { iconSrc: hygieneIconPath("sponge-frequency"), title: "2-3x/week", text: "Sponge baths in the first weeks" },
    { iconSrc: hygieneIconPath("sponge-supplies"), title: "Supplies", text: "Cloths, towel, diaper, mild unscented soap, 2 bowls warm water" },
    { iconSrc: hygieneIconPath("sponge-warm-setup"), title: "Warm setup", text: "Warm room, towel, safe flat surface; strap changing table" },
    { iconSrc: hygieneIconPath("sponge-one-hand"), title: "One hand", text: "Keep one hand on baby at all times" },
    { iconSrc: hygieneIconPath("sponge-face-first"), title: "Face first", text: "Plain warm water; eyes inner corner outward, then face and ears" },
    { iconSrc: hygieneIconPath("sponge-gentle-wash"), title: "Soapy wash", text: "Head and body; folds under arms, neck, ears, diaper area" },
    { iconSrc: hygieneIconPath("sponge-rinse"), title: "Rinse", text: "Plain warm water removes soap residue" },
    { iconSrc: hygieneIconPath("tub-wrap-fast"), title: "Dry + dress", text: "Pat dry, clean diaper, dress warmly" }
  ];

  return `
    <details class="sponge-bath-card hygiene-expander" aria-label="Sponge bath flow">
      <summary class="sponge-bath-header">
        ${renderHygieneHeaderIcon("sponge-title", "&#128167;")}
        <div>
          <h4>Sponge Bath</h4>
          <p>Keep baby warm, supported, and gently clean skin folds.</p>
        </div>
      </summary>
      <div class="sponge-bath-flow" aria-label="How to give a newborn sponge bath">
        ${steps.map((step, index) => `
          <div class="sponge-bath-step" style="--step-index: ${index}">
            ${renderHygieneFlowIcon(step)}
            <strong>${escapeHtml(step.title)}</strong>
            <small>${escapeHtml(step.text)}</small>
          </div>
        `).join("")}
      </div>
      <p class="sponge-bath-note">Newborns usually only need 2-3 baths per week. Keep baby warm, supported, and dry promptly.</p>
    </details>
  `;
}

function renderTubBathSection() {
  const steps = [
    { iconSrc: hygieneIconPath("tub-ready"), title: "Ready", text: "Cord stump off; circumcision fully healed" },
    { iconSrc: hygieneIconPath("tub-supplies"), title: "Supplies", text: "Infant tub, cloths, mild soap, cup, towel, diaper" },
    { iconSrc: hygieneIconPath("tub-warm-water"), title: "Warm water", text: "2-3 inches; test with elbow or wrist" },
    { iconSrc: hygieneIconPath("tub-feet-first"), title: "Feet first", text: "Lower baby feet first; support neck and bottom" },
    { iconSrc: hygieneIconPath("tub-one-hand"), title: "One hand", text: "Keep head above water and contact at all times" },
    { iconSrc: hygieneIconPath("tub-face"), title: "Face", text: "No soap near eyes; wipe inner corner outward" },
    { iconSrc: hygieneIconPath("tub-wash"), title: "Wash", text: "Scalp, body, and folds with a little baby soap" },
    { iconSrc: hygieneIconPath("tub-rinse"), title: "Rinse warm", text: "Rinse well; pour warm water to maintain warmth" },
    { iconSrc: hygieneIconPath("tub-wrap-fast"), title: "Wrap fast", text: "Lift carefully, wrap head and body, pat dry, dress" }
  ];

  return `
    <details class="sponge-bath-card tub-bath-card hygiene-expander" aria-label="Tub bath flow">
      <summary class="sponge-bath-header">
        ${renderHygieneHeaderIcon("tub-title", "&#128705;")}
        <div>
          <h4>Tub Bath</h4>
          <p>Start after healing; protect warmth, grip, and water safety.</p>
        </div>
      </summary>
      <div class="sponge-bath-flow tub-bath-flow" aria-label="How to give a baby tub bath">
        ${steps.map((step, index) => `
          <div class="sponge-bath-step" style="--step-index: ${index}">
            ${renderHygieneFlowIcon(step)}
            <strong>${escapeHtml(step.title)}</strong>
            <small>${escapeHtml(step.text)}</small>
          </div>
        `).join("")}
      </div>
      <p class="sponge-bath-note">Never leave baby unattended, even for a few seconds. Wet skin is slippery, so keep one hand on baby and wrap immediately after lifting out.</p>
    </details>
  `;
}

function renderDiaperChangingSection() {
  const steps = [
    { iconSrc: hygieneIconPath("diaper-prepare"), title: "Open first", text: "Open clean diaper and set it within reach" },
    { iconSrc: hygieneIconPath("diaper-wipes-ready"), title: "Wipes ready", text: "Put wipes, cream, and trash bag nearby" },
    { iconSrc: hygieneIconPath("diaper-open"), title: "Cover bottom", text: "Slide clean diaper or menu holder under bottom before opening dirty diaper" },
    { iconSrc: hygieneIconPath("diaper-splash-guard"), title: "Cover penis", text: "Place a cloth or wipe over penis before opening diaper" },
    { iconSrc: hygieneIconPath("diaper-open"), title: "Open dirty", text: "Open dirty diaper slowly and use it to catch extra mess" },
    { iconSrc: hygieneIconPath("diaper-clean"), title: "Front to back", text: "Wipe front to back and clean skin folds gently" },
    { iconSrc: hygieneIconPath("diaper-fresh"), title: "Clean diaper", text: "Remove dirty diaper, fasten clean diaper snugly" },
    { iconSrc: hygieneIconPath("diaper-fresh"), title: "Point down", text: "Point penis down to help prevent leaks up the back" }
  ];

  return `
    <details class="sponge-bath-card diaper-changing-card hygiene-expander" aria-label="Diaper changing flow">
      <summary class="sponge-bath-header">
        ${renderHygieneHeaderIcon("diaper-title", "&#129514;")}
        <div>
          <h4>Diaper Changing</h4>
          <p>Set up first, cover before opening, then clean and close fast.</p>
        </div>
      </summary>
      <div class="sponge-bath-flow diaper-changing-flow" aria-label="How to change a newborn diaper">
        ${steps.map((step, index) => `
          <div class="sponge-bath-step" style="--step-index: ${index}">
            ${renderHygieneFlowIcon(step)}
            <strong>${escapeHtml(step.title)}</strong>
            <small>${escapeHtml(step.text)}</small>
          </div>
        `).join("")}
      </div>
      <p class="sponge-bath-note">Cold air can trigger a pee reflex. Covering first and keeping supplies close reduces surprises.</p>
    </details>
  `;
}

function renderNailTrimmingSection() {
  const steps = [
    { icon: "&#128269;", title: "Check first", text: "Trim when nails feel sharp or catch on fabric" },
    { icon: "&#128161;", title: "Bright light", text: "Use daylight or a lamp so the nail edge is clear" },
    { icon: "&#128564;", title: "Sleepy time", text: "Try while baby is asleep, feeding, calm, or distracted" },
    { icon: "&#128204;", title: "0-4 weeks", text: "Use an emery board; newborn nails are soft" },
    { icon: "&#9986;", title: "1+ month", text: "Baby scissors or clippers are usually easier once nails firm up" },
    { icon: "&#9995;", title: "Trim tiny bits", text: "Hold the hand, pull fingertip pad back, and follow the nail curve" },
    { icon: "&#129534;", title: "If nicked", text: "Rinse, press with gauze or cotton, and skip bandages on fingers" }
  ];

  return `
    <details class="sponge-bath-card nail-trimming-card hygiene-expander" aria-label="Nail trimming guide">
      <summary class="sponge-bath-header">
        ${renderHygieneHeaderIcon("sponge-supplies", "&#9986;")}
        <div>
          <h4>Nail Trimming</h4>
          <p>File early, trim tiny amounts, and choose a calm sleepy moment.</p>
        </div>
      </summary>
      <div class="sponge-bath-flow nail-trimming-flow" aria-label="How to trim newborn nails safely">
        ${steps.map((step, index) => `
          <div class="sponge-bath-step" style="--step-index: ${index}">
            ${renderHygieneFlowIcon(step)}
            <strong>${escapeHtml(step.title)}</strong>
            <small>${escapeHtml(step.text)}</small>
          </div>
        `).join("")}
      </div>
      <p class="sponge-bath-note">Fingernails usually need more attention than toenails. File rough edges after trimming to reduce face scratches.</p>
    </details>
  `;
}

function renderDentalCareSection() {
  const steps = [
    { icon: "&#128167;", title: "0-4 months", text: "No teeth yet; wipe gums with a clean damp washcloth if desired" },
    { icon: "&#129463;", title: "4-10 months", text: "First tooth often appears; a wide range is normal" },
    { icon: "&#129532;", title: "Brush choice", text: "Soft bristles, small round head, child-size handle; avoid adult brushes" },
    { icon: "&#129489;", title: "Parents brush", text: "Use a soft cloth or infant brush; parents do the real brushing" },
    { icon: "&#127806;", title: "Under 3", text: "Use fluoride toothpaste about the size of a grain of rice" },
    { icon: "&#129372;", title: "Age 3+", text: "Use a pea-sized amount; supervise rinsing and spitting" },
    { icon: "&#128269;", title: "Watch spots", text: "White spots, brown spots, or pits may need pediatrician or dentist guidance" },
    { icon: "&#128513;", title: "Daddy hack", text: "Let baby brush your teeth first, then try their own brush" }
  ];

  return `
    <details class="sponge-bath-card dental-care-card hygiene-expander" id="hygiene-dental-care" aria-label="Baby dental care guide">
      <summary class="sponge-bath-header">
        ${renderHygieneHeaderIcon("sponge-gentle-wash", "&#129463;")}
        <div>
          <h4>Dental Care</h4>
          <p>Start at first tooth; keep toothpaste tiny and parent-led.</p>
        </div>
      </summary>
      <div class="sponge-bath-flow dental-care-flow" aria-label="Baby dental care from first tooth through age three">
        ${steps.map((step, index) => `
          <div class="sponge-bath-step" style="--step-index: ${index}">
            ${renderHygieneFlowIcon(step)}
            <strong>${escapeHtml(step.title)}</strong>
            <small>${escapeHtml(step.text)}</small>
          </div>
        `).join("")}
      </div>
      <p class="sponge-bath-note">After several teeth erupt, move toward morning and bedtime brushing. Bedtime brushing matters most.</p>
    </details>
  `;
}

function renderTroubleshootCareView(issue, options = {}) {
  const showBack = options.showBack !== false;
  return `
    <section class="care-detail">
      ${renderCareBackButton(showBack)}
      <article class="eat-overview-card troubleshoot-overview-card">
        <div class="care-detail-hero" style="--card-image: url('${careHeaderImage(issue.header)}')">
          <h3>${escapeHtml(issue.title)}</h3>
          <p>${escapeHtml(issue.helper)}</p>
        </div>
        ${renderCareIssueInfoPanel(issue)}
        <div class="troubleshoot-card-stack">
          ${renderClothingSizeTroubleshootCard()}
          <details id="troubleshoot-baby-cries" class="baby-cries-card troubleshoot-expander" open>
            <summary class="troubleshoot-expander-title">
              <span>Baby cries</span>
              <small>Fast checks, soothing, and GPT review</small>
            </summary>
            ${renderBabyCriesCardClean({ embedded: true })}
            <div class="baby-cries-gpt-row">
              <button class="baby-cries-gpt-button" type="button" data-baby-cries-gpt aria-expanded="${state.babyCriesAssistant.open ? "true" : "false"}">
                <img src="/assets/chatgpt-icon.png" alt="">
                <span>GPT, Why my baby cries?</span>
              </button>
            </div>
          <div id="baby-cries-assistant-slot">
            ${state.babyCriesAssistant.open ? renderBabyCriesAssistantPanel() : ""}
          </div>
        </details>
        ${renderPrepareDiaperBagSection()}
        ${renderRestaurantSurvivalSection()}
      </div>
    </article>
  </section>
  `;
}

function diaperBagChecklistGroups() {
  return [
    {
      title: "What You Need",
      items: [
        "3-4 diapers",
        "1 bottle of milk",
        "2 snacks",
        "1 sippy cup of water",
        "1 portable changing pad",
        "1 pack of disposable wipes",
        "2-3 plastic bags",
        "1 diaper rash ointment",
        "1 burping cloth",
        "1 extra bib",
        "1 baby personal care kit (nail clipper, comb, emery board)",
        "1 change of clothes for baby",
        "1 hat for baby",
        "2-3 baby toys",
        "1 pacifier and teether",
        "1 bottle liner",
        "Electric bottle warmer or hot water warmer and container",
        "1 blanket or swaddle",
        "1 emergency information list",
        "1 first aid kit",
        "Baby Tylenol or ibuprofen, only if pediatrician-approved"
      ]
    },
    {
      title: "If Breastfeeding",
      items: [
        "1 nursing cover",
        "2 breast pads"
      ]
    }
  ];
}

function diaperBagItemId(item) {
  return `diaper-bag:${slugifyId(item)}`;
}

function renderPrepareDiaperBagSection() {
  return `
    <details id="troubleshoot-diaper-bag" class="baby-cries-card troubleshoot-expander diaper-bag-card">
      <summary class="troubleshoot-expander-title">
        <span>Prepare Diaper Bag</span>
        <small>Prepack everything but perishables before leaving.</small>
      </summary>
      <div class="diaper-bag-body">
        ${diaperBagChecklistGroups().map((group) => `
          <section class="diaper-bag-group">
            <h4>${escapeHtml(group.title)}</h4>
            <ul class="diaper-bag-list">
              ${group.items.map((item) => {
                const id = diaperBagItemId(item);
                return `
                  <li>
                    <label class="child-proof-check-row diaper-bag-check-row">
                      <input type="checkbox" data-diaper-bag-check="${escapeAttr(id)}" ${state.diaperBagProgress[id]?.checked ? "checked" : ""}>
                      <span class="child-proof-list-emoji" aria-hidden="true">${diaperBagIcon(item)}</span>
                      <span><strong>${escapeHtml(item)}</strong></span>
                    </label>
                  </li>
                `;
              }).join("")}
            </ul>
          </section>
        `).join("")}
        <p class="diaper-bag-hack"><strong>Daddy Hack:</strong> Keep the diaper bag prepacked and ready with everything but perishables. An extra set of clothes for you is a smart backup too.</p>
      </div>
    </details>
  `;
}

function diaperBagIcon(item) {
  const text = String(item || "").toLowerCase();
  if (text.includes("warmer") || text.includes("hot water")) return "&#9832;";
  if (text.includes("diaper")) return "&#129514;";
  if (text.includes("milk") || text.includes("bottle")) return "&#127868;";
  if (text.includes("snack")) return "&#127838;";
  if (text.includes("water") || text.includes("sippy")) return "&#128167;";
  if (text.includes("wipe") || text.includes("changing")) return "&#129532;";
  if (text.includes("bag")) return "&#128717;";
  if (text.includes("ointment")) return "&#129658;";
  if (text.includes("cloth") || text.includes("bib")) return "&#129507;";
  if (text.includes("care kit") || text.includes("clipper")) return "&#9986;";
  if (text.includes("clothes") || text.includes("hat")) return "&#128085;";
  if (text.includes("toy")) return "&#129528;";
  if (text.includes("pacifier") || text.includes("teether")) return "&#128118;";
  if (text.includes("blanket") || text.includes("swaddle")) return "&#129509;";
  if (text.includes("emergency") || text.includes("first aid")) return "&#128657;";
  if (text.includes("tylenol") || text.includes("ibuprofen")) return "&#128138;";
  if (text.includes("nursing") || text.includes("breast")) return "&#129329;";
  return "&#10003;";
}

async function updateDiaperBagProgress(id, checked) {
  if (!id) return;
  const previous = { ...state.diaperBagProgress };
  if (checked) {
    state.diaperBagProgress[id] = { checked: true, updatedAt: new Date().toISOString() };
  } else {
    delete state.diaperBagProgress[id];
  }
  try {
    const result = await fetchJson("/api/diaper-bag-progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, checked })
    });
    state.diaperBagProgress = result.diaper_bag_progress || {};
  } catch (error) {
    state.diaperBagProgress = previous;
    renderCare();
    showToast(`Could not save diaper bag checklist: ${error.message}`);
  }
}

function restaurantDiningPhases() {
  return [
    {
      age: "0-2 months",
      title: "Sleepy Potato Phase",
      icon: "&#128164;",
      before: ["Feed completely before departure", "Fresh diaper before loading car seat", "Leave immediately after feeding"],
      restaurant: ["Keep baby in car seat if comfortable", "Choose a booth if possible", "Sit near an exit", "One parent orders for everyone"],
      expect: ["Sleep", "Looking around", "Maybe another feed"],
      avoid: ["Loud sports bars", "Long waits", "90-minute dinners"]
    },
    {
      age: "2-4 months",
      title: "Alert Observer Phase",
      icon: "&#128064;",
      before: ["Pacifier", "Lightweight blanket", "White noise app", "Toy that clips onto stroller"],
      restaurant: ["If baby fusses: Parent A eats, Parent B walks baby, then switch"],
      expect: ["Best window: after nap, after feed, before next nap"],
      avoid: ["Right before bedtime"]
    },
    {
      age: "4-6 months",
      title: "Bored Easily Phase",
      icon: "&#129528;",
      before: ["Pacifier", "Teether", "Crinkle toy", "Small soft toy"],
      restaurant: ["Rotate items; a toy hidden for 20 minutes can feel new again", "If fussing, walk stroller near the restaurant entrance, then come back"],
      expect: ["More entertainment needed", "Stroller motion may reset fussiness"],
      avoid: ["Showing every toy at once"]
    }
  ];
}

function restaurantDiningSupportTips() {
  return [
    {
      title: "Breastfeeding",
      icon: "&#129329;",
      items: ["Ask for a corner booth or quiet section", "Nursing-friendly tops reduce stress", "Feed at early hunger cues: rooting, hand sucking, lip smacking"]
    },
    {
      title: "Bottle Feeding",
      icon: "&#127868;",
      items: ["For Seattle weather around 44F, pack bottle, milk, and portable warmer or thermos", "Pre-warm water in a thermos, then place bottle in warm water", "Usually warms in 2-5 minutes"]
    },
    {
      title: "Blowout Kit",
      icon: "&#129514;",
      items: ["Keep one separate ziplock with 1 diaper, wipes, disposable changing pad, and spare onesie", "You do not want to dig through the whole diaper bag during an emergency"]
    }
  ];
}

function renderRestaurantPhaseCard(phase) {
  return `
    <article class="restaurant-phase-card">
      <div class="restaurant-phase-title">
        <span aria-hidden="true">${phase.icon}</span>
        <div>
          <small>${escapeHtml(phase.age)}</small>
          <strong>${escapeHtml(phase.title)}</strong>
        </div>
      </div>
      <div class="restaurant-phase-grid">
        ${renderRestaurantList("Before Leaving", phase.before)}
        ${renderRestaurantList("At Restaurant", phase.restaurant)}
        ${renderRestaurantList("Expect", phase.expect)}
        ${renderRestaurantList("Avoid", phase.avoid, "avoid")}
      </div>
    </article>
  `;
}

function renderRestaurantList(title, items, tone = "ok") {
  return `
    <section class="restaurant-list restaurant-list-${escapeAttr(tone)}">
      <h4>${escapeHtml(title)}</h4>
      <ul>
        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderRestaurantSurvivalSection() {
  return `
    <details id="troubleshoot-dine-out" class="baby-cries-card troubleshoot-expander restaurant-survival-card">
      <summary class="troubleshoot-expander-title">
        <span>How to dine out</span>
        <small>0-6 month restaurant survival plan.</small>
      </summary>
      <div class="restaurant-survival-body">
        <p class="restaurant-survival-intro">Babies under 6 months are usually the easiest age to take out: they do not crawl, run, or throw food yet.</p>
        <div class="restaurant-phase-stack">
          ${restaurantDiningPhases().map(renderRestaurantPhaseCard).join("")}
        </div>
        <div class="restaurant-support-grid">
          ${restaurantDiningSupportTips().map((tip) => `
            <article class="restaurant-support-card">
              <span aria-hidden="true">${tip.icon}</span>
              <strong>${escapeHtml(tip.title)}</strong>
              <ul>
                ${tip.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
              </ul>
            </article>
          `).join("")}
        </div>
        <p class="diaper-bag-hack"><strong>45-Minute Rule:</strong> Plan newborn restaurant trips around 45 minutes. Success means seated quickly, warm food, no major meltdown, and leaving before things go south.</p>
      </div>
    </details>
  `;
}

function babyClothingSizeChart() {
  return [
    { size: "Newborn", minWeightLb: 6, maxWeightLb: 9, minHeightIn: 0, maxHeightIn: 19 },
    { size: "0-3M", minWeightLb: 9, maxWeightLb: 12, minHeightIn: 19, maxHeightIn: 23 },
    { size: "3-6M", minWeightLb: 12, maxWeightLb: 17, minHeightIn: 23, maxHeightIn: 25 },
    { size: "6-9M", minWeightLb: 17, maxWeightLb: 20, minHeightIn: 25, maxHeightIn: 27 },
    { size: "9-12M", minWeightLb: 20, maxWeightLb: 22, minHeightIn: 27, maxHeightIn: 29 },
    { size: "12-18M", minWeightLb: 22, maxWeightLb: 27, minHeightIn: 29, maxHeightIn: 31 },
    { size: "18-24M", minWeightLb: 27, maxWeightLb: 30, minHeightIn: 31, maxHeightIn: 33 }
  ];
}

function clothingSizeRecommendation(weightLb, lengthIn) {
  const chart = babyClothingSizeChart();
  const hasWeight = Number.isFinite(weightLb) && weightLb > 0;
  const hasLength = Number.isFinite(lengthIn) && lengthIn > 0;
  if (!hasWeight && !hasLength) {
    return {
      recommended: null,
      outgrowing: null,
      alert: "Log weight or length to get an automatic size suggestion."
    };
  }

  const recommendedIndex = chart.findIndex((row) => {
    const weightFits = !hasWeight || weightLb <= row.maxWeightLb;
    const lengthFits = !hasLength || lengthIn <= row.maxHeightIn;
    return weightFits && lengthFits;
  });
  const index = recommendedIndex >= 0 ? recommendedIndex : chart.length - 1;
  const recommended = chart[index];
  const previous = chart[index - 1] || null;
  const next = chart[index + 1] || null;
  const outgrowing = previous && ((hasWeight && weightLb > previous.maxWeightLb) || (hasLength && lengthIn > previous.maxHeightIn))
    ? previous
    : null;
  const nearNext = next && (
    (hasWeight && weightLb >= recommended.maxWeightLb - 0.5)
    || (hasLength && lengthIn >= recommended.maxHeightIn - 0.5)
  );

  return {
    recommended,
    outgrowing,
    alert: nearNext ? `Consider preparing ${next.size} clothing soon.` : "Use weight first, then length and brand fit."
  };
}

function renderClothingSizeTroubleshootCard() {
  const latestWeight = lastGrowthLog("weight");
  const latestHeight = lastGrowthLog("height");
  const weightLb = readWeightGrams(latestWeight) / weightUnits.lb.grams;
  const lengthIn = readHeightMm(latestHeight) / heightUnits.in.mm;
  const recommendation = clothingSizeRecommendation(weightLb, lengthIn);
  const weightText = latestWeight ? formatMeasurement(weightLb, "lb") : "--";
  const lengthText = latestHeight ? formatMeasurement(lengthIn, "in") : "--";
  const recommendedText = recommendation.recommended?.size || "--";
  const outgrowingText = recommendation.outgrowing ? `Outgrowing ${recommendation.outgrowing.size}` : "No smaller-size warning yet";

  return `
    <details id="troubleshoot-clothing-size" class="baby-cries-card troubleshoot-expander clothing-size-card" open>
      <summary class="troubleshoot-expander-title">
        <span>How to Pick Baby Clothes</span>
        <small>Uses latest weight and length logs</small>
      </summary>
      <div class="clothing-size-summary">
        <div>
          <small>Weight</small>
          <strong>${latestWeight ? renderCurrentHighlight(weightText) : escapeHtml(weightText)}</strong>
        </div>
        <div>
          <small>Length</small>
          <strong>${latestHeight ? renderCurrentHighlight(lengthText) : escapeHtml(lengthText)}</strong>
        </div>
        <div>
          <small>Recommended</small>
          <strong>${renderCurrentHighlight(recommendedText, "age")}</strong>
        </div>
      </div>
      <div class="clothing-size-alerts">
        <span>${escapeHtml(outgrowingText)}</span>
        <span>${escapeHtml(recommendation.alert)}</span>
      </div>
      ${renderBabyClothingSizeTable()}
      <div class="clothing-size-guidance">
        <section>
          <strong>Real-world rule</strong>
          <p>Buy by weight, not age. Brands vary, and babies often outgrow clothes by length first.</p>
        </section>
        <section>
          <strong>July baby starter set</strong>
          <p>Newborn: 5-7 outfits. 0-3M: 10-14 outfits. 3-6M: 10-14 outfits. Do not overbuy newborn sizes.</p>
        </section>
        <section>
          <strong>Wash before wear</strong>
          <p>Wash new clothes to remove residue, dust, and storage dirt. Baby skin is sensitive.</p>
        </section>
        <section>
          <strong>Detergent</strong>
          <p>Choose Free & Clear: fragrance-free, dye-free, hypoallergenic, paraben-free, phthalate-free, phosphate-free, nontoxic.</p>
        </section>
        <section>
          <strong>Simple picks</strong>
          <p>All Free Clear, Tide Free & Gentle, or Seventh Generation Free & Clear. One fragrance-free family detergent is usually enough.</p>
        </section>
      </div>
    </details>
  `;
}

function renderBabyClothingSizeTable() {
  const rows = [
    ["Newborn", "6–9 lb", "Up to 19 in"],
    ["0–3 Months", "9–12 lb", "19–23 in"],
    ["3–6 Months", "12–17 lb", "23–25 in"],
    ["6–9 Months", "17–20 lb", "25–27 in"],
    ["9–12 Months", "20–22 lb", "27–29 in"],
    ["12–18 Months", "22–27 lb", "29–31 in"],
    ["18–24 Months", "27–30 lb", "31–33 in"]
  ];

  return `
    <div class="clothing-size-table-wrap">
      <table class="clothing-size-table">
        <thead>
          <tr>
            <th>Size</th>
            <th>Weight</th>
            <th>Height</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(([size, weight, height]) => `
            <tr>
              <td>${escapeHtml(size)}</td>
              <td>${escapeHtml(weight)}</td>
              <td>${escapeHtml(height)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderUmbilicalCordChecklist(context = "troubleshoot") {
  const checklist = [
    "Cord kept dry today",
    "Sponge bath only",
    "Diaper folded below stump",
    "No redness or swelling",
    "No foul smell",
    "No yellow discharge",
    "No active bleeding",
    "Cord fell off: record the date"
  ];

  return `
    <ul class="cord-troubleshoot-list cord-troubleshoot-list-${escapeAttr(context)}" aria-label="Umbilical cord care checklist">
      ${checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
}

function renderBabyCriesAssistantPanel() {
  const assistant = state.babyCriesAssistant;
  const result = assistant.result;
  const status = assistant.inFlight ? "Checking logs..." : assistant.error ? "Fallback guidance" : result ? "GPT Review" : "Waiting to review logs";
  const updated = assistant.updatedAt ? formatAssistantUpdatedAt(assistant.updatedAt) : "--";
  const source = assistant.source === "gpt" ? "GPT" : assistant.source === "fallback" ? "Fallback" : "Local review";
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
          <button type="button" data-baby-cries-close aria-label="Close GPT recommendation">x</button>
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
          <summary>User default prompt to GPT</summary>
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
    assistant.prompt = payload.prompt || payload.gptPrompt || "";
    assistant.lastSignature = signature;
    assistant.error = payload.gpt?.available === false && payload.gpt?.error ? "GPT unavailable; using fallback." : "";
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
  const button = document.querySelector("[data-baby-cries-gpt]");
  if (button) button.setAttribute("aria-expanded", state.babyCriesAssistant.open ? "true" : "false");
}

function formatAssistantUpdatedAt(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "--";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function eatReferenceTabs() {
  return [
    { key: "cheatsheet", label: "Cheatsheet", image: "/assets/care/feeding-cheatsheet.png", alt: "Baby feeding cheatsheet" },
    { key: "feeding-milestones-guide", label: "Milestones", image: "/assets/care/feeding-milestones-guide.png", alt: "Feeding milestones guide" },
    { key: "breastfeeding-tips-guide", label: "Breastfeeding Tips", image: "/assets/care/breastfeeding-tips-guide.png", alt: "Breastfeeding tips guide" },
    { key: "pumping-storage-guide", label: "Pumping & Storage", image: "/assets/care/pumping-storage-guide.png", alt: "Pumping and breast milk storage guide" },
    { key: "bottle-feeding-guide", label: "Bottle Feeding", image: "/assets/care/bottle-feeding-guide.png", alt: "Bottle feeding guide" },
    { key: "hunger-cues", label: "Hunger Cues", image: "/assets/care/feeding-hunger-cues.png", alt: "Baby feeding hunger cues" },
    { key: "wet-diapers-poop-guide", label: "Diaper & Poop", image: "/assets/care/wet-diapers-poop-guide.png", alt: "Wet diapers and poop guide" },
    { key: "solid-foods-guide", label: "Solid Foods", image: "/assets/care/solid-foods-guide.png", alt: "Solid foods guide" },
    { key: "boobie-positions", label: "Boobie Positions", image: "/assets/care/boobie-positions.png", alt: "Boobie breastfeeding positions" }
  ];
}

function sleepReferenceTabs() {
  return [
    { key: "sleep-goals", label: "Goals", image: "/assets/care/sleep-goals.png", alt: "Baby sleep goals" },
    { key: "sleep-milestones-guide", label: "Milestones", image: "/assets/care/sleep-milestones-guide.png", alt: "Baby sleep milestones guide" },
    { key: "sleep-naps-guide", label: "Naps", image: "/assets/care/sleep-naps-guide.png", alt: "Baby naps quick guide" },
    { key: "sleep-environment-guide", label: "Environment", image: "/assets/care/sleep-environment-guide.png", alt: "Baby safe sleep environment and clothing guide" },
    { key: "sleep-routine-guide", label: "Routine", image: "/assets/care/sleep-routine-guide.png", alt: "Baby bedtime routine and daytime strategy guide" },
    { key: "sleep-cues-guide", label: "Sleep Cues", image: "/assets/care/sleep-cues-guide.png", alt: "Baby sleepy cues and overtired cues guide" },
    { key: "sleep-cheatsheet", label: "Cheatsheet", image: "/assets/care/sleep-cheatsheet.png", alt: "Baby sleep cheatsheet" }
  ];
}

function healthMustHaveProducts() {
  const base = "/assets/care/health-products";
  return [
    {
      group: "Must Have",
      name: "Digital thermometer",
      image: `${base}/digital-thermometer.png`,
      why: "To check your baby's temperature. Fever in newborns can be a sign of infection.",
      when: "If your baby feels warm, is fussy, lethargic, not feeding well, or as advised by your doctor.",
      how: "Use rectally for the most accurate reading in infants under 3 months. Clean before and after with soap and water or alcohol."
    },
    {
      group: "Must Have",
      name: "Saline drops",
      image: `${base}/saline-drops.png`,
      why: "Helps loosen thick mucus so it is easier to remove. Keeps baby's nose moist.",
      when: "When your baby sounds congested, has a stuffy nose, or before using a nose aspirator.",
      how: "Put 1-2 drops in each nostril, wait a few seconds, then gently suction or let mucus loosen and drain."
    },
    {
      group: "Must Have",
      name: "Nose aspirator",
      image: `${base}/nose-aspirator.png`,
      why: "Clears mucus so your baby can breathe, feed, and sleep more comfortably.",
      when: "Whenever your baby has a stuffy or runny nose, especially before feeds and sleep.",
      how: "Use after saline drops. Gently insert the tip just inside the nostril, create suction, and remove mucus. Clean after each use."
    },
    {
      group: "Must Have",
      name: "Cool-mist humidifier",
      image: `${base}/cool-mist-humidifier.png`,
      why: "Adds moisture to the air to help with congestion, coughing, and dry air.",
      when: "During colds, in dry weather, or when your baby's room feels dry or stuffy.",
      how: "Use cool, not warm, mist. Place on a flat surface out of baby's reach. Clean daily to prevent mold and bacteria."
    },
    {
      group: "Must Have",
      name: "Infant Tylenol",
      image: `${base}/infant-tylenol.png`,
      why: "Reduces fever and relieves minor pain from teething, shots, or discomfort.",
      when: "Only if advised by your pediatrician or if your baby has a fever of 100.4F / 38C or higher.",
      how: "Use the correct dose for your baby's weight. Use the included syringe or dose tool. Never give without guidance."
    },
    {
      group: "Must Have",
      name: "Gauze pads",
      image: `${base}/gauze-pads.png`,
      why: "For cleaning small wounds, applying ointments, or umbilical cord care if advised.",
      when: "For minor cuts, scrapes, cord care, or when applying medications or petroleum jelly.",
      how: "Use clean hands. Gently hold the pad in place or clean the area. Dispose after each use."
    },
    {
      group: "Must Have",
      name: "Nail file / baby nail trimmer",
      image: `${base}/baby-nail-trimmer.png`,
      why: "Keeps baby's nails short and smooth to prevent scratches on their face and skin.",
      when: "1-2 times per week, or when nails look sharp or long.",
      how: "Gently file or trim while baby is calm or sleeping. Go slowly and avoid cutting too short."
    },
    {
      group: "Must Have",
      name: "Fragrance-free baby lotion",
      image: `${base}/fragrance-free-lotion.png`,
      why: "Keeps baby's skin moisturized and helps prevent dryness and irritation.",
      when: "After baths or anytime skin feels dry.",
      how: "Apply a small amount and gently massage into skin. Use gentle, fragrance-free products."
    },
    {
      group: "Must Have",
      name: "Petroleum jelly / diaper cream",
      image: `${base}/petroleum-jelly.png`,
      why: "Helps protect irritated diaper skin and creates a moisture barrier.",
      when: "For diaper rash, irritated skin, or as advised by your doctor.",
      how: "Apply a thin layer to clean, dry skin during diaper changes."
    },
    {
      group: "Must Have",
      name: "Medicine syringe",
      image: `${base}/medicine-syringe.png`,
      why: "Helps you give the right dose of liquid medications safely and accurately.",
      when: "Whenever giving liquid medicine, such as Tylenol or vitamin D.",
      how: "Draw up the prescribed amount. Give slowly into the cheek. Rinse and wash after use."
    },
    {
      group: "As Needed",
      name: "Gas drops",
      image: `${base}/gas-drops.png`,
      why: "Helps relieve gas bubbles and discomfort from gas.",
      when: "If your baby is fussy, gassy, or has trouble passing gas.",
      how: "Use as directed on the label for your baby's age and weight."
    },
    {
      group: "As Needed",
      name: "Probiotic drops",
      image: `${base}/probiotic-drops.png`,
      why: "Supports healthy gut bacteria and digestion. May help with colic or irregular stools.",
      when: "If recommended by your pediatrician.",
      how: "Add the drops to breast milk, formula, or breast, or give directly by mouth."
    },
    {
      group: "As Needed",
      name: "Gripe water",
      image: `${base}/gripe-water.png`,
      why: "Traditionally used to soothe gas, colic, and fussiness.",
      when: "If your baby is fussy from gas or colic. Ask your pediatrician if unsure.",
      how: "Shake well. Give the amount for your baby's age as directed on the label."
    },
    {
      group: "As Needed",
      name: "Teether",
      image: `${base}/teether.png`,
      why: "Soothes sore gums during teething.",
      when: "When teething symptoms start, usually around 4-6 months.",
      how: "Wash before use. Chill in the fridge, not the freezer. Inspect regularly and replace if damaged."
    }
  ];
}

function renderHealthProductList() {
  const products = healthMustHaveProducts();
  return `
    <section class="health-product-list" aria-label="Must Have For Health products">
      ${["Must Have", "As Needed"].map((group) => `
        <div class="health-product-group">
          <h4>${escapeHtml(group)}${group === "Must Have" ? " For Health" : " Optional"}</h4>
          <div class="health-product-items">
            ${products.filter((product) => product.group === group).map(renderHealthProductCard).join("")}
          </div>
        </div>
      `).join("")}
    </section>
  `;
}

function renderHealthProductCard(product) {
  return `
    <article class="health-product-card">
      <img src="${escapeAttr(product.image)}" alt="${escapeAttr(product.name)}">
      <div class="health-product-copy">
        <strong>${escapeHtml(product.name)}</strong>
        <dl>
          <div>
            <dt>Why</dt>
            <dd>${escapeHtml(product.why)}</dd>
          </div>
          <div>
            <dt>When</dt>
            <dd>${escapeHtml(product.when)}</dd>
          </div>
          <div>
            <dt>How</dt>
            <dd>${escapeHtml(product.how)}</dd>
          </div>
        </dl>
      </div>
    </article>
  `;
}

function dentalToothGroups() {
  return [
    {
      key: "lower-central-incisors",
      number: "1",
      name: "Lower central incisors",
      shortName: "Bottom front teeth",
      jaw: "Lower teeth",
      erupts: "6-10 months",
      note: "Often the first tiny teeth to pop through.",
      care: "Brush twice daily once visible with a rice-grain smear of fluoride toothpaste."
    },
    {
      key: "upper-central-incisors",
      number: "2",
      name: "Upper central incisors",
      shortName: "Top front teeth",
      jaw: "Upper teeth",
      erupts: "8-10 months",
      note: "These make the baby grin look very official.",
      care: "Lift the lip during brushing so milk residue does not hide along the gumline."
    },
    {
      key: "upper-lateral-incisors",
      number: "3",
      name: "Upper lateral incisors",
      shortName: "Side front teeth",
      jaw: "Upper teeth",
      erupts: "8-13 months",
      note: "These fill in beside the top front teeth.",
      care: "Keep brushing gentle; swollen gums can make this stage dramatic."
    },
    {
      key: "lower-lateral-incisors",
      number: "4",
      name: "Lower lateral incisors",
      shortName: "Side front teeth",
      jaw: "Lower teeth",
      erupts: "9-13 months",
      note: "These usually arrive soon after the front pair.",
      care: "Offer a chilled teether or clean wet washcloth for gum pressure."
    },
    {
      key: "first-molars",
      number: "5",
      name: "First molars",
      shortName: "Back teeth",
      jaw: "Upper and lower teeth",
      erupts: "13-19 months",
      note: "Molars are wider, so chewing and night waking may increase.",
      care: "Brush the chewing surfaces carefully; food can sit in the grooves."
    },
    {
      key: "canines",
      number: "6-7",
      name: "Canines",
      shortName: "Pointy teeth",
      jaw: "Upper and lower teeth",
      erupts: "16-23 months",
      note: "Upper canines often show around 16-22 months; lower canines around 17-23 months.",
      care: "Use playful brushing names like tiger teeth or sparkle teeth to keep it fun."
    },
    {
      key: "second-molars",
      number: "8-10",
      name: "Second molars",
      shortName: "Very back teeth",
      jaw: "Upper and lower teeth",
      erupts: "23-31 months",
      note: "These usually complete the baby-tooth set.",
      care: "By around 30 months, many children have all 20 baby teeth."
    }
  ];
}

function dentalToothPositions() {
  return [
    { key: "second-molars", label: "10", x: 15, y: 32 },
    { key: "first-molars", label: "5", x: 23, y: 18 },
    { key: "canines", label: "7", x: 36, y: 10 },
    { key: "upper-lateral-incisors", label: "3", x: 46, y: 7 },
    { key: "upper-central-incisors", label: "2", x: 56, y: 6 },
    { key: "upper-central-incisors", label: "2", x: 66, y: 6 },
    { key: "upper-lateral-incisors", label: "3", x: 76, y: 7 },
    { key: "canines", label: "7", x: 86, y: 10 },
    { key: "first-molars", label: "5", x: 99, y: 18 },
    { key: "second-molars", label: "10", x: 107, y: 32 },
    { key: "second-molars", label: "8-10", x: 18, y: 82 },
    { key: "canines", label: "6-7", x: 30, y: 94 },
    { key: "first-molars", label: "5", x: 44, y: 99 },
    { key: "lower-lateral-incisors", label: "4", x: 55, y: 102 },
    { key: "lower-central-incisors", label: "1", x: 63, y: 103 },
    { key: "lower-central-incisors", label: "1", x: 71, y: 103 },
    { key: "lower-lateral-incisors", label: "4", x: 79, y: 102 },
    { key: "first-molars", label: "5", x: 90, y: 99 },
    { key: "canines", label: "6-7", x: 104, y: 94 },
    { key: "second-molars", label: "8-10", x: 116, y: 82 }
  ];
}

function selectedDentalToothGroup() {
  const groups = dentalToothGroups();
  return groups.find((group) => group.key === state.selectedDentalTooth) || groups[0];
}

function renderDentalTeethGuide() {
  const selected = selectedDentalToothGroup();
  return `
    <section class="dental-guide" aria-label="Baby teeth eruption guide">
      <div class="dental-mouth-card">
        <div class="dental-mouth-title">
          <strong>Baby Teeth</strong>
          <span>Tap a tooth</span>
        </div>
        <div class="dental-mouth" aria-label="Interactive baby teeth chart">
          ${dentalToothPositions().map((tooth) => `
            <button class="dental-tooth ${tooth.key === selected.key ? "active" : ""}" type="button" data-dental-tooth="${escapeAttr(tooth.key)}" style="--tooth-x:${tooth.x}%; --tooth-y:${tooth.y}%;" aria-pressed="${tooth.key === selected.key ? "true" : "false"}">
              ${escapeHtml(tooth.label)}
            </button>
          `).join("")}
          <div class="dental-baby-face" aria-hidden="true">:)</div>
        </div>
      </div>
      <article class="dental-selected-card">
        <span class="dental-pill">${escapeHtml(selected.jaw)}</span>
        <h4>${escapeHtml(selected.name)}</h4>
        <p class="dental-erupts">Usually erupts: <strong>${escapeHtml(selected.erupts)}</strong></p>
        <p>${escapeHtml(selected.note)}</p>
        <p>${escapeHtml(selected.care)}</p>
      </article>
      <div class="dental-timeline">
        ${dentalToothGroups().map((group) => `
          <button class="${group.key === selected.key ? "active" : ""}" type="button" data-dental-tooth="${escapeAttr(group.key)}">
            <span>${escapeHtml(group.number)}</span>
            <strong>${escapeHtml(group.erupts)}</strong>
            <small>${escapeHtml(group.shortName)}</small>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function renderDentalDoctorGuide() {
  return `
    <section class="dental-doctor-guide" aria-label="Dental doctor guideline">
      <article class="dental-guideline-card">
        <h4>Dental Care Milestones</h4>
        <ul>
          <li><strong>First tooth:</strong> begin brushing twice daily.</li>
          <li><strong>Toothpaste:</strong> use a rice-grain sized smear of fluoride toothpaste.</li>
          <li><strong>Around 12 months:</strong> first dental visit is recommended.</li>
          <li><strong>Around 30 months:</strong> many children have all 20 baby teeth.</li>
        </ul>
      </article>
      <article class="dental-guideline-card warn">
        <h4>Call The Doctor</h4>
        <ul>
          <li>Fever over 100.4F / 38C, severe diarrhea, persistent vomiting, or significant lethargy.</li>
          <li>Signs of dehydration, poor feeding, or fewer wet diapers.</li>
          <li>Mouth injury, bleeding that will not stop, pus, swelling, or white/brown spots on teeth.</li>
          <li>If symptoms feel bigger than normal teething, treat it as illness until a clinician says otherwise.</li>
        </ul>
      </article>
      <article class="dental-guideline-card">
        <h4>What Teething Can Look Like</h4>
        <ul>
          <li>Drooling, chewing on everything, irritability, swollen gums, and waking more at night.</li>
          <li>Temporary decreased interest in feeding can happen, but baby should still hydrate.</li>
          <li>High fever, severe diarrhea, persistent vomiting, and major lethargy are not usually caused by teething.</li>
        </ul>
      </article>
    </section>
  `;
}

function healthReferenceTabs() {
  return [
    { key: "health-products", label: "Products" },
    { key: "dental-guide", label: "Teeth" },
    { key: "dental-doctor", label: "Doctor" },
    { key: "baby-teeth-eruption-chart", label: "Chart", image: "/assets/care/baby-teeth-eruption-chart.png", alt: "Baby teeth eruption chart" },
    { key: "baby-cries", label: "Cries Check" },
    { key: "wet-diapers-poop-guide", label: "Diaper / Poop", image: "/assets/care/wet-diapers-poop-guide.png", alt: "Wet diapers and poop guide" }
  ];
}

function renderEatCareView(issue, options = {}) {
  const showBack = options.showBack !== false;

  return `
    <section class="care-detail">
      ${renderCareBackButton(showBack)}
      <article class="eat-overview-card">
        <div class="care-detail-hero" style="--card-image: url('${careHeaderImage(issue.header)}')">
          <h3>${escapeHtml(issue.title)}</h3>
          <p>${escapeHtml(issue.helper)}</p>
        </div>
        ${renderCareIssueInfoPanel(issue)}
      </article>
    </section>
  `;
}

function renderSleepCareView(issue, options = {}) {
  const showBack = options.showBack !== false;

  return `
    <section class="care-detail">
      ${renderCareBackButton(showBack)}
      <article class="eat-overview-card sleep-overview-card">
        <div class="care-detail-hero" style="--card-image: url('${careHeaderImage(issue.header)}')">
          <h3>${escapeHtml(issue.title)}</h3>
          <p>${escapeHtml(issue.helper)}</p>
        </div>
        ${renderCareIssueInfoPanel(issue)}
      </article>
    </section>
  `;
}

function renderHealthCareView(issue, options = {}) {
  const showBack = options.showBack !== false;

  return `
    <section class="care-detail">
      ${renderCareBackButton(showBack)}
      <article class="eat-overview-card health-overview-card">
        <div class="care-detail-hero" style="--card-image: url('${careHeaderImage(issue.header)}')">
          <h3>${escapeHtml(issue.title)}</h3>
          <p>${escapeHtml(issue.helper)}</p>
        </div>
        ${renderCareIssueInfoPanel(issue)}
      </article>
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

function renderBabyCriesCardClean(options = {}) {
  const embedded = options.embedded === true;
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
    <section class="${embedded ? "baby-cries-inner" : "baby-cries-card"}" aria-label="Baby cries algorithm">
      ${embedded ? "" : `
        <div class="baby-cries-title">
          <strong>Baby cries?</strong>
        </div>
      `}
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

function renderCareCheatsheetImage(issue, imagePath, altText, options = {}) {
  const showBack = options.showBack !== false;
  return `
    <section class="care-detail">
      ${renderCareBackButton(showBack)}
      <div class="care-detail-hero" style="--card-image: url('${careHeaderImage(issue.header)}')">
        <h3>${escapeHtml(issue.title)}</h3>
        <p>${escapeHtml(issue.helper)}</p>
      </div>
      ${renderCareIssueInfoPanel(issue)}
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
  dialog.querySelectorAll("[data-milestone-care-link]").forEach((button) => {
    button.addEventListener("click", () => {
      dialog.close();
      openCareShortcut(button.dataset.careShortcut, button.dataset.careSubtabShortcut, button.dataset.careAnchorShortcut);
    });
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
      ${renderMilestoneCareLink(milestone)}
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

function renderMilestoneCareLink(milestone) {
  const link = milestone.careLink || null;
  if (!link?.issueKey) return "";
  return `
    <div class="milestone-care-link">
      <strong>${escapeHtml(link.title || "Related Care")}</strong>
      <p>${escapeHtml(link.description || "Open the related care guide for practical steps.")}</p>
      <button class="ghost" type="button" data-milestone-care-link data-care-shortcut="${escapeAttr(link.issueKey)}" data-care-subtab-shortcut="${escapeAttr(link.subtabKey || "")}" data-care-anchor-shortcut="${escapeAttr(link.anchorId || "")}">
        ${escapeHtml(link.buttonLabel || "Open Care Guide")}
      </button>
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
      body: JSON.stringify(data)
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
  document.getElementById("settings-design-style").addEventListener("change", saveDesignStyle);
  document.getElementById("settings-milk-unit").addEventListener("change", saveSettingsMilkUnit);
  document.getElementById("settings-weight-unit").addEventListener("change", saveSettingsWeightUnit);
  document.getElementById("settings-height-unit").addEventListener("change", saveSettingsHeightUnit);
  document.getElementById("test-reminder-voice").addEventListener("click", testReminderVoice);
  document.getElementById("schedule-notifications-settings-toggle").addEventListener("change", toggleScheduleNotifications);
  document.getElementById("settings-schedule-template-apply").addEventListener("click", applySettingsScheduleTemplate);
  document.getElementById("settings-schedule-template-reset").addEventListener("click", resetTodayScheduleTemplate);
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

  const milkUnitSelect = document.getElementById("settings-milk-unit");
  if (milkUnitSelect && document.activeElement !== milkUnitSelect) milkUnitSelect.value = state.milkUnit;

  const weightUnitSelect = document.getElementById("settings-weight-unit");
  if (weightUnitSelect && document.activeElement !== weightUnitSelect) weightUnitSelect.value = state.weightUnit;

  const heightUnitSelect = document.getElementById("settings-height-unit");
  if (heightUnitSelect && document.activeElement !== heightUnitSelect) heightUnitSelect.value = state.heightUnit;

  const designStyleSelect = document.getElementById("settings-design-style");
  if (designStyleSelect && document.activeElement !== designStyleSelect) designStyleSelect.value = state.designStyle;

  syncOverviewSettingsInputs();
  renderVoiceOptions();
  renderScheduleNotificationSettings();
  renderSettingsScheduleTemplate();
  activateSettingsGroup(state.activeSettingsGroup);

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

function applyDesignStyle() {
  const style = ["kiddo", "calm", "glassy"].includes(state.designStyle) ? state.designStyle : "kiddo";
  state.designStyle = style;
  document.documentElement.dataset.designStyle = style;
  document.body?.setAttribute("data-design-style", style);
}

function saveDesignStyle(event) {
  state.designStyle = event.target.value || "kiddo";
  localStorage.setItem("tinyNewborn.designStyle", state.designStyle);
  applyDesignStyle();
  const label = { kiddo: "Kiddo", calm: "Calm", glassy: "Glassy" }[state.designStyle] || "Kiddo";
  showSettingsStatus(`Design style set to ${label}.`);
}

function renderScheduleNotificationSettings() {
  const toggle = document.getElementById("schedule-notifications-settings-toggle");
  const label = document.getElementById("schedule-notifications-settings-label");
  if (!toggle) return;
  const isBlocked = ("Notification" in window) && Notification.permission === "denied";
  toggle.checked = Boolean(state.scheduleNotificationsEnabled);
  toggle.disabled = isBlocked || !("Notification" in window);
  toggle.closest(".settings-switch")?.classList.toggle("blocked", isBlocked || !("Notification" in window));
  if (label) label.textContent = scheduleNotificationsButtonText();
}

function renderSettingsScheduleTemplate() {
  const select = document.getElementById("settings-schedule-template-select");
  if (!select) return;
  const templates = state.scheduleTemplates || [];
  const selectedId = selectedScheduleTemplate(state.selectedScheduleTemplateId).id;
  select.disabled = !templates.length;
  select.innerHTML = templates.length
    ? templates.map((template) => `
        <option value="${escapeAttr(template.id)}" ${template.id === selectedId ? "selected" : ""}>${escapeHtml(template.ageRange?.label || template.name || template.id)}</option>
      `).join("")
    : `<option value="">No schedule templates</option>`;
}

async function applySettingsScheduleTemplate() {
  const select = document.getElementById("settings-schedule-template-select");
  if (!select?.value) return;
  await applyScheduleTemplateToToday(select.value);
  renderSettings();
  showToast("Schedule template applied to today.");
}

async function resetTodayScheduleTemplate() {
  const templateId = state.selectedScheduleTemplateId || document.getElementById("settings-schedule-template-select")?.value;
  if (!templateId) return;
  const ok = window.confirm("Reset today's schedule back to the doctor template? This will replace today's edited times and goals.");
  if (!ok) return;
  try {
    const result = await fetchJson(`/api/schedule-templates/${encodeURIComponent(templateId)}/reset`, { method: "POST" });
    if (Array.isArray(result.templates)) state.scheduleTemplates = result.templates;
    const template = result.template || selectedScheduleTemplate(templateId);
    state.selectedScheduleTemplateId = template.id;
    localStorage.setItem("tinyNewborn.schedule.selectedTemplateId", state.selectedScheduleTemplateId);
    await persistScheduleLog(buildScheduleLog(todayString(), template.id, (template.rows || []).map((row) => ({ ...row }))));
    renderSettings();
    renderSchedule();
    showToast("Today was reset to the doctor template.");
  } catch (error) {
    showToast(`Reset failed: ${error.message}`);
  }
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

function cleanUnitSettings(value = {}) {
  const current = value && typeof value === "object" ? value : {};
  return {
    milkUnit: Object.keys(milkUnits).includes(current.milkUnit) ? current.milkUnit : "ml",
    weightUnit: Object.keys(weightUnits).includes(current.weightUnit) ? current.weightUnit : "lb",
    heightUnit: Object.keys(heightUnits).includes(current.heightUnit) ? current.heightUnit : "in"
  };
}

function applyUnitSettings(value = {}) {
  const settings = cleanUnitSettings(value);
  state.milkUnit = settings.milkUnit;
  state.weightUnit = settings.weightUnit;
  state.heightUnit = settings.heightUnit;
  saveMilkUnit();
  saveWeightUnit();
  saveHeightUnit();
}

async function saveUnitSettings(statusMessage) {
  const next = cleanUnitSettings({
    milkUnit: state.milkUnit,
    weightUnit: state.weightUnit,
    heightUnit: state.heightUnit
  });
  applyUnitSettings(next);
  try {
    const result = await fetchJson("/api/unit-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next)
    });
    applyUnitSettings(result.unit_settings || next);
    renderSettings();
    updateBottleDefaults();
    updateWeightDialogDefaults();
    updateHeightDialogDefaults();
    renderActivityStats();
    renderDashboard();
    updateTopbarBabyStats();
    showSettingsStatus(statusMessage);
  } catch (error) {
    showSettingsStatus(`Save failed: ${error.message}`);
  }
}

function saveSettingsMilkUnit(event) {
  state.milkUnit = event.target.value;
  saveUnitSettings(`Milk unit saved: ${state.milkUnit}.`);
}

function saveSettingsWeightUnit(event) {
  state.weightUnit = event.target.value;
  saveUnitSettings(`Weight unit saved: ${state.weightUnit}.`);
}

function saveSettingsHeightUnit(event) {
  state.heightUnit = event.target.value;
  saveUnitSettings(`Height unit saved: ${state.heightUnit}.`);
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
  if (!confirm("Clear all logs, milestones, and checklists? This resets cards, history, today totals, milestone progress, child proof checklist progress, and recent info.")) return;
  showSettingsStatus("Clearing data...");

  try {
    const result = await fetchJson("/api/logs", { method: "DELETE" });
    state.logs = [];
    state.recent = result.recent || {};
    state.summary = result.todaySummary || {};
    state.milestoneProgress = result.milestone_progress || {};
    state.childProofProgress = result.child_proof_progress || {};
    state.diaperBagProgress = result.diaper_bag_progress || {};
    renderAll();
    showSettingsStatus("All logs, milestones, and checklists cleared.");
    showReaction("Data cleared", "Logs, milestones, and checklists reset.");
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

function loadMilkUnit() {
  const saved = storageGet("milkUnit");
  return ["ml", "oz"].includes(saved) ? saved : "ml";
}

function saveMilkUnit() {
  storageSet("milkUnit", state.milkUnit);
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
  const logPayload = prepareLogPayload(normalizeClientLogPayload(payload));
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
  const milkType = document.getElementById("bottle-milk-type");
  if (milkType) milkType.value = normalizeMilkType(state.recent.lastBottleMilkType);
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
  const milkType = normalizeMilkType(document.getElementById("bottle-milk-type")?.value, state.recent.lastBottleMilkType || "formula");
  const recentAmount = milkType === "breast_milk" ? state.recent.breastMilkBottleOunces : state.recent.formulaBottleOunces;
  const ounces = Math.min(8, Math.max(0, Number(recentAmount || state.recent.bottleOunces || 3)));
  const amount = ouncesToMilkAmount(ounces, state.milkUnit);
  const config = milkUnits[state.milkUnit] || milkUnits.ml;
  slider.min = "0";
  slider.max = String(config.max);
  slider.step = String(config.step);
  slider.value = amount;
  updateBottleAmountDisplay(amount);
}

function milkAmountToOunces(value, unit = state.milkUnit) {
  const config = milkUnits[unit] || milkUnits.ml;
  return +(Number(value || 0) * config.ounces).toFixed(3);
}

function ouncesToMilkAmount(ounces, unit = state.milkUnit) {
  if (unit === "oz") return +Number(ounces || 0).toFixed(2);
  return Math.round(Number(ounces || 0) * 29.5735 / 5) * 5;
}

function formatMilkAmount(value, unit = state.milkUnit) {
  const number = Number(value || 0);
  if (unit === "oz") return number.toFixed(2).replace(/\.?0+$/, "");
  return String(Math.round(number));
}

function formatMilkVolume(ounces, unit = state.milkUnit) {
  return `${formatMilkAmount(ouncesToMilkAmount(Number(ounces || 0), unit), unit)} ${unit}`;
}

function updateBottleAmountDisplay(value) {
  const label = document.getElementById("bottle-unit-label");
  if (label) label.textContent = state.milkUnit;
  document.getElementById("bottle-value").textContent = formatMilkAmount(value, state.milkUnit);
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
  temp.textContent = Number.isFinite(weather?.temperature) ? `${weather.temperature}F outdoor` : "Weather";
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
        <span>${escapeHtml(stat.label)}</span>
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
      helper: "Total sleep today",
      current: true
    },
    boobie: {
      label: "Breast feeds",
      value: todaySummary.breastFeeds,
      current: true,
      helper: `<small>${lastLogSummary("feeding")}</small>
              <br>
              <small>Next time ${String(state.recent.nextBreastSide || "left").replace(/^./, (letter) => letter.toUpperCase())}</small>
              <br>
              <small> 
               <small>🌙 Empty breasts before sleep</small>`
    },
    bottle: {
      label: "Bottle total",
      value: formatMilkVolume(todaySummary.bottleOunces),
      helper: lastLogSummary("bottle"),
      current: true
    },
    routine: {
      html: `
        <div class="hygiene-list stats-list">
          <span>Today routine totals</span>
          <span><img src="/assets/activity/icon-routine-morning.png" alt="">${todaySummary.morningRoutines} morning</span>
          <span><img src="/assets/activity/icon-routine-naptime.png" alt="">${todaySummary.naptimeRoutines} nap</span>
          <span><img src="/assets/activity/icon-routine-bedtime.png" alt="">${todaySummary.bedtimeRoutines} bedtime</span>
          <span>${lastLogSummary("routine")}</span>
        </div>
      `
    },
    diaper: {
      html: `
        <div class="hygiene-list">
          <span>Today diaper totals</span>
          <span><img src="/assets/activity/icon-pee.png" alt="">${todaySummary.wetDiapers} wee</span>
          <span><img src="/assets/activity/icon-poop.png" alt="">${todaySummary.poops} poo</span>
          <span>${lastLogSummary("diaper")}</span>
        </div>
      `
    },
    growth: {
      html: renderGrowthCardInfo()
    },
    bath: {
      label: bathLabel,
      value: formatTotalDuration(totalToday("bath", "start", "end")),
      helper: `Sound ${state.bathSoundEnabled ? "on" : "off"} - every ${formatReminderPeriod(state.bathReminderSeconds)}`,
      current: true
    },
    tummy: {
      label: tummyLabel,
      value: formatTotalDuration(totalToday("tummy_time", "start", "end")),
      helper: `Sound ${state.tummySoundEnabled ? "on" : "off"} - every ${formatReminderPeriod(state.tummyReminderSeconds)}`,
      current: true
    },
    outdoor: {
      label: outdoorLabel,
      value: formatTotalDuration(totalToday("outdoor_time", "start", "end")),
      helper: `${todaySummary.outdoorTimeEvents} start/end taps today`,
      current: true
    },
    gym: {
      label: "Baby gym",
      value: todaySummary.babyGymEvents,
      helper: lastLogSummary("baby_gym"),
      current: true
    }
  };
}

function lastLogSummary(type) {
  const log = lastLogOfType(type);
  return log ? `Last time: ${formatWhen(log.createdAt || `${log.date}T${log.time || "00:00"}`)} ${labelForLog(log)}` : "Last time: not logged yet";
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
      <span>${lastLogSummary("growth_stats")}</span>
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
    ["Bottle", formatMilkVolume(state.summary.bottleOunces || 0), "Today total"],
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
  const cards = orderedOverviewCards(overview?.cards || []);
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
          <h3>${renderOverviewInline(overviewHeadline(overview))}</h3>
          <p>${renderOverviewInline(overviewSummary(overview))}</p>
        </div>
        <div class="dashboard-overview-actions">
          <span class="overview-status status-${escapeAttr(statusClassName)}">${escapeHtml(overviewPriorityLabel(priority))}</span>
          <span class="dashboard-overview-updated">${escapeHtml(updated)}</span>
        </div>
      </summary>
      <div class="dashboard-overview-body">
        <div class="dashboard-overview-toolbar">
          ${renderDashboardOverviewHistoryPicker()}
          <button class="ghost" type="button" data-dashboard-overview-refresh ${isReviewing ? "disabled" : ""}>${isReviewing ? "Reviewing..." : "Refresh"}</button>
        </div>
        <div class="dashboard-overview-summary-grid">
          <section class="dashboard-overview-summary-panel dashboard-overview-summary-panel-main">
            <span>Overall summary</span>
            ${overview.overall?.reviewText ? renderOverviewParagraphs(overview.overall.reviewText) : `<p>${renderOverviewInline(overviewSummary(overview))}</p>`}
            ${overview.summaryBullets?.length ? `
              <ul>
                ${overview.summaryBullets.slice(0, 3).map((item) => `<li>${renderOverviewInline(item)}</li>`).join("")}
              </ul>
            ` : ""}
          </section>
          <section class="dashboard-overview-summary-panel">
            <span>Parent next steps</span>
            ${overview?.parentNextSteps?.length
              ? `<ol>${overview.parentNextSteps.slice(0, 4).map((step) => `<li>${renderOverviewInline(step)}</li>`).join("")}</ol>`
              : `<p>${renderOverviewInline("Keep logging feeds, diapers, sleep, and new symptoms.")}</p>`}
          </section>
        </div>
        ${cards.length ? `
          <div class="dashboard-overview-grid">
            ${cards.map((card) => renderDashboardOverviewCard(card)).join("")}
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
  setupOverviewHistoryPicker(container);
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

function setupOverviewHistoryPicker(container) {
  const picker = container.querySelector("[data-dashboard-overview-history]");
  if (!picker) return;
  picker.addEventListener("change", () => {
    state.dashboardOverview.selectedHistoryId = picker.value || "latest";
    localStorage.setItem("tinyNewborn.dashboardOverview.selectedHistoryId", state.dashboardOverview.selectedHistoryId);
    if (applyDashboardOverviewHistorySelection()) renderDashboardOverview();
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

function renderOverviewInline(value) {
  const text = String(value || "");
  const markerPattern = /\[\[(important|warning|urgent|emergency):([\s\S]*?)\]\]/gi;
  let html = "";
  let lastIndex = 0;
  let match;
  while ((match = markerPattern.exec(text)) !== null) {
    html += escapeHtml(text.slice(lastIndex, match.index));
    const tone = ["urgent", "emergency"].includes(match[1].toLowerCase()) ? "warning" : match[1].toLowerCase();
    html += `<strong class="overview-emphasis overview-emphasis-${escapeAttr(tone)}">${escapeHtml(match[2].trim())}</strong>`;
    lastIndex = markerPattern.lastIndex;
  }
  html += escapeHtml(text.slice(lastIndex));
  return html;
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
    ok: "Good",
    watch: "Watch",
    call_doctor: "Call",
    urgent: "Urgent",
    insufficient_data: "Unknown"
  };
  return labels[priority] || String(priority || "Insufficient data");
}

const overviewCategoryConfigs = {
  eat: { label: "Feed", icon: "/assets/activity/icon-bottle.png", order: 0 },
  sleep: { label: "Sleep", icon: "/assets/activity/icon-asleep.png", order: 1 },
  hygiene_diaper: { label: "Hygiene", icon: "/assets/activity/icon-poop.png", order: 2 },
  exercise: { label: "Exercise", icon: "/assets/activity/icon-tummy-start.png", order: 3 },
  play: { label: "Play", icon: "/assets/activity/icon-gym.png", order: 4 },
  safety: { label: "Safety", icon: "/assets/activity/icon-success.png", order: 5 },
  health: { label: "Others", icon: "/assets/activity/icon-weight.png", order: 6 }
};

function overviewCategoryConfig(card = {}) {
  return overviewCategoryConfigs[card.id] || {
    label: card.title || "Others",
    icon: "/assets/activity/icon-success.png",
    order: 99
  };
}

function orderedOverviewCards(cards) {
  return cards
    .slice()
    .sort((a, b) => overviewCategoryConfig(a).order - overviewCategoryConfig(b).order);
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
          <dd>${renderOverviewInline(card.recentPattern || "No recent information found.")}</dd>
        </div>
        <div>
          <dt>Meaning</dt>
          <dd>${renderOverviewInline(card.meaning || "Not enough information yet.")}</dd>
        </div>
        <div>
          <dt>Recommendation</dt>
          <dd>${renderOverviewInline(card.recommendation || "Keep logging and watch baby cues.")}</dd>
        </div>
      </dl>
      ${card.flags?.length ? `<div class="overview-flags">${card.flags.map((flag) => `<span>${renderOverviewInline(flag)}</span>`).join("")}</div>` : ""}
    </article>
  `;
}

function renderCautiousDashboardOverviewCard(card) {
  const confidence = String(card.confidence || "low").toLowerCase();
  const config = overviewCategoryConfig(card);
  const priority = card.priority || "insufficient_data";
  const categoryLabel = config.label;
  if (card.review) {
    const headline = card.headline || card.title || "Overview updated";
    const detailBullets = overviewDetailBullets(card);
    const detailsId = card.id || card.title || "overview";
    const detailsOpen = state.dashboardOverview.openCardDetails.has(detailsId);
    return `
      <details class="dashboard-overview-card overview-category-expander" data-overview-card-details="${escapeAttr(detailsId)}" ${detailsOpen ? "open" : ""}>
        <summary class="dashboard-overview-card-head">
          <div class="overview-category-title">
            <img src="${escapeAttr(config.icon)}" alt="">
            <h4>${escapeHtml(categoryLabel)}</h4>
          </div>
          <p class="overview-card-headline">${renderOverviewInline(headline)}</p>
          <div class="overview-card-badges">
            <span class="overview-status status-${escapeAttr(overviewStatusClass(priority))}">${escapeHtml(overviewPriorityLabel(priority))}</span>
            <span class="overview-confidence confidence-${escapeAttr(confidence)}">${escapeHtml(card.confidence || "low")}</span>
          </div>
          <span class="overview-learn-more">Learn more</span>
        </summary>
        <div class="overview-card-details">
          <p>${renderOverviewInline(card.review)}</p>
          ${detailBullets.length ? `<ul>${detailBullets.map((item) => `<li>${renderOverviewInline(item)}</li>`).join("")}</ul>` : ""}
          ${card.citations?.length ? renderOverviewCitations(card.citations) : ""}
        </div>
      </details>
    `;
  }
  return `
    <details class="dashboard-overview-card overview-category-expander">
      <summary class="dashboard-overview-card-head">
        <div class="overview-category-title">
          <img src="${escapeAttr(config.icon)}" alt="">
          <h4>${escapeHtml(categoryLabel)}</h4>
        </div>
        <p class="overview-card-headline">${renderOverviewInline(card.meaning || card.title || "Overview updated")}</p>
        <div class="overview-card-badges">
          <span class="overview-status status-${escapeAttr(overviewStatusClass(priority))}">${escapeHtml(overviewPriorityLabel(priority))}</span>
          <span class="overview-confidence confidence-${escapeAttr(confidence)}">${escapeHtml(card.confidence || "low")}</span>
        </div>
        <span class="overview-learn-more">Learn more</span>
      </summary>
      <dl class="overview-card-details">
        <div>
          <dt>Observed</dt>
          <dd>${renderOverviewList(card.observed, "No recent information found.")}</dd>
        </div>
        <div>
          <dt>Meaning</dt>
          <dd>${renderOverviewInline(card.meaning || "Not enough information yet.")}</dd>
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
    </details>
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
  if (!bullets.length) return `<p>${renderOverviewInline(text || "")}</p>`;
  return `<ul>${bullets.map((item) => `<li>${renderOverviewInline(item)}</li>`).join("")}</ul>`;
}

function renderOverviewParagraphs(text) {
  const sentences = String(text || "")
    .match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)
    ?.map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3) || [];
  if (!sentences.length) return `<p>${renderOverviewInline(text || "")}</p>`;
  return sentences.map((item) => `<p>${renderOverviewInline(item)}</p>`).join("");
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
  if (list.length === 1) return renderOverviewInline(list[0]);
  return `<ul>${list.map((item) => `<li>${renderOverviewInline(item)}</li>`).join("")}</ul>`;
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
  const requiredCards = ["eat", "sleep", "hygiene_diaper", "exercise", "play", "safety", "health"];
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

function normalizeDashboardOverviewHistory(rawHistory) {
  return (Array.isArray(rawHistory) ? rawHistory : [])
    .filter((entry) => entry && validateDashboardOverviewPayload({ review: entry.review || entry.publishedReview }))
    .map((entry) => {
      const review = entry.review || entry.publishedReview;
      return {
        id: entry.id || `${entry.updatedAt || review.updatedAt || Date.now()}-${entry.source || "overview"}`,
        updatedAt: entry.updatedAt || review.updatedAt || review.overall?.lastReviewedAt || "",
        source: entry.source || "rules",
        inputHash: entry.inputHash || review.reviewMeta?.inputHash || "",
        model: entry.model || review.reviewMeta?.model || "",
        review,
        reviewTrace: entry.reviewTrace || null
      };
    })
    .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
    .slice(0, 12);
}

function syncDashboardOverviewHistory(rawHistory) {
  const history = normalizeDashboardOverviewHistory(rawHistory);
  if (history.length) state.dashboardOverview.history = history;
  return state.dashboardOverview.history;
}

function currentDashboardOverviewHistoryEntry() {
  const history = state.dashboardOverview.history || [];
  if (!history.length) return null;
  const selectedId = state.dashboardOverview.selectedHistoryId || "latest";
  if (selectedId !== "latest") {
    const selected = history.find((entry) => entry.id === selectedId);
    if (selected) return selected;
  }
  return history[0];
}

function applyDashboardOverviewHistorySelection() {
  const entry = currentDashboardOverviewHistoryEntry();
  if (!entry) return false;
  const overviewState = state.dashboardOverview;
  overviewState.publishedReview = entry.review;
  overviewState.pendingReview = null;
  overviewState.status = "ready";
  overviewState.source = entry.source || "rules";
  overviewState.updatedAt = entry.updatedAt || entry.review?.updatedAt || "";
  overviewState.serverInputHash = entry.inputHash || "";
  overviewState.lastInputHash = dashboardOverviewSignature();
  overviewState.reviewTrace = entry.reviewTrace || null;
  overviewState.error = "";
  return true;
}

function dashboardOverviewHistoryLabel(entry) {
  const source = entry.source === "gpt" ? "GPT" : entry.source === "llama" ? "Ollama" : "Local";
  const when = entry.updatedAt ? formatWhen(entry.updatedAt) : "Saved review";
  const windowLabel = entry.review?.overall?.dataWindowLabel ? ` - ${entry.review.overall.dataWindowLabel}` : "";
  return `${source} ${when}${windowLabel}`;
}

function renderDashboardOverviewHistoryPicker() {
  const history = state.dashboardOverview.history || [];
  if (!history.length) return "";
  const selectedId = state.dashboardOverview.selectedHistoryId || "latest";
  return `
    <label class="overview-history-picker">
      <span>Review</span>
      <select data-dashboard-overview-history>
        <option value="latest" ${selectedId === "latest" ? "selected" : ""}>Latest saved</option>
        ${history.map((entry) => `
          <option value="${escapeAttr(entry.id)}" ${selectedId === entry.id ? "selected" : ""}>${escapeHtml(dashboardOverviewHistoryLabel(entry))}</option>
        `).join("")}
      </select>
    </label>
  `;
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
  overviewState.selectedHistoryId = "latest";
  localStorage.setItem("tinyNewborn.dashboardOverview.selectedHistoryId", "latest");
  syncDashboardOverviewHistory(payload.overviewHistory);
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
  const summaryRows = renderAnalyticsSummaryRows(analytics);
  container.innerHTML = `
    <section class="analytics-section">
      <div class="section-heading">
        <h3>Activity Summary</h3>
        <p>Duration, quick counts, and feeding rhythm in one view.</p>
      </div>
      <div class="analytics-summary-card">
        ${summaryRows.length ? summaryRows.join("") : `<p class="empty-state">No summary data in this range yet.</p>`}
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

function renderAnalyticsSummaryRows(analytics) {
  return [
    ...analytics.durationStats.map(renderDurationSummaryRow),
    ...analytics.quickStats.map(renderQuickSummaryRow),
    ...analytics.intervalStats.map(renderIntervalSummaryRow)
  ];
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

function renderDurationSummaryRow(stat) {
  return `
    <div class="analytics-summary-row">
      <span>${escapeHtml(stat.label)} ${helpIcon("Total duration, count, average length, and longest period.")}</span>
      <strong>${escapeHtml(formatCompactDuration(stat.total))}</strong>
      <small>${stat.count} times, avg ${escapeHtml(formatCompactDuration(stat.average))}, longest ${escapeHtml(formatCompactDuration(stat.longest.duration))}</small>
    </div>
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

function renderQuickSummaryRow(stat) {
  const details = [];
  details.push(`${stat.count} times`);
  if (stat.averageAmount != null) details.push(`avg ${Number(stat.averageAmount.toFixed(2))} oz, total ${Number(stat.totalAmount.toFixed(2))} oz`);
  if (stat.latestWeightGrams != null || stat.latestHeightMm != null) {
    details.push(`latest ${stat.latestWeightGrams ? formatMeasurement(Number(formatUnitValue(stat.latestWeightGrams, state.weightUnit, "weight")), state.weightUnit) : "--"} / ${stat.latestHeightMm ? formatMeasurement(Number(formatUnitValue(stat.latestHeightMm, state.heightUnit, "height")), state.heightUnit) : "--"}`);
  }
  return `
    <div class="analytics-summary-row">
      <span>${escapeHtml(stat.label)} ${helpIcon("Count for this quick event. Bottle also shows average and total amount.")}</span>
      <strong>${stat.count}</strong>
      <small>${escapeHtml(details.join(", "))}</small>
    </div>
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

function renderIntervalSummaryRow(stat) {
  return `
    <div class="analytics-summary-row">
      <span>${escapeHtml(stat.label)} ${helpIcon("Average elapsed time from the previous feeding or bottle to this event.")}</span>
      <strong>${escapeHtml(formatCompactDuration(stat.average))}</strong>
      <small>${stat.count} matched, range ${escapeHtml(formatCompactDuration(stat.min))} to ${escapeHtml(formatCompactDuration(stat.max))}</small>
    </div>
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
      milkAvg: bottles.length ? ouncesToMilkAmount(bottles.reduce((sum, log) => sum + Number(log.ounces || 0), 0) / bottles.length, state.milkUnit) : 0,
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
      help: "Average bottle amount per bottle feeding each day.",
      unit: state.milkUnit,
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
        Milk
        <select name="milkType">
          <option value="formula"${(log.milkType || "formula") === "formula" ? " selected" : ""}>Formula</option>
          <option value="breast_milk"${log.milkType === "breast_milk" ? " selected" : ""}>Breast Milk</option>
        </select>
      </label>
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
  if (log.type === "bottle") return `${milkTypeLabel(log.milkType)} bottle, ${formatMilkVolume(log.ounces)}`;
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

function milkTypeLabel(milkType) {
  return milkType === "breast_milk" ? "Breast Milk" : "Formula";
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
