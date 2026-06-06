const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");

const LEGACY_DATA_PATH = path.join(DATA_DIR, "appData.json");
const LEGACY_RECENT_PATH = path.join(DATA_DIR, "recentInfo.json");
const APP_DATA_PATH = path.join(DATA_DIR, "app_data.json");
const BABY_LOG_PATH = path.join(DATA_DIR, "baby_log.json");
const MILESTONE_LOG_PATH = path.join(DATA_DIR, "milestone_log.json");
const DOCTOR_GUIDELINE_PATH = path.join(DATA_DIR, "doctor_guideline.json");
const POOP_COLORS_PATH = path.join(DATA_DIR, "poop-colors.json");

const DEFAULT_PROFILE = {
  name: "Phuong Nam Cu Ti",
  birthday: "",
  timezone: "America/Los_Angeles"
};

const DEFAULT_RECENT_STATE = {
  bottleOunces: 2.5,
  formulaBottleOunces: 2.5,
  breastMilkBottleOunces: 2.5,
  lastBottleMilkType: "formula",
  nextBreastSide: "left",
  lastActivityAt: null,
  lastFeedAt: null,
  lastSleepAt: null,
  lastDiaperAt: null,
  notes: ""
};

const DEFAULT_OVERVIEW_SETTINGS = {
  reviewMode: "rules_only",
  llamaModel: "llama3.2",
  gptModel: "gpt-4.1-mini",
  careVoice: "parent_friendly",
  refreshIntervalMinutes: 5,
  maxOutputTokens: 700,
  reviewWindowDays: 3
};

const DEFAULT_UNIT_SETTINGS = {
  milkUnit: "ml",
  weightUnit: "lb",
  heightUnit: "in"
};

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function objectMap(value) {
  return value && !Array.isArray(value) && typeof value === "object" ? value : {};
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function legacyData() {
  return readJson(LEGACY_DATA_PATH, {});
}

function legacyRecent() {
  return readJson(LEGACY_RECENT_PATH, {});
}

function buildAppDataFromLegacy(data = legacyData(), recent = legacyRecent()) {
  return {
    baby_profile: { ...DEFAULT_PROFILE, ...objectMap(data.baby_profile) },
    recent_state: normalizeRecentState(data, recent),
    goals: arrayValue(data.goals),
    schedule_templates: arrayValue(data.schedule_templates),
    foods: arrayValue(data.foods),
    sound_settings: objectMap(data.sound_settings),
    unit_settings: { ...DEFAULT_UNIT_SETTINGS, ...objectMap(data.unit_settings) },
    overview_settings: { ...DEFAULT_OVERVIEW_SETTINGS, ...objectMap(data.overview_settings) }
  };
}

function normalizeRecentState(data = {}, recent = {}) {
  const sourceRecent = objectMap(recent);
  const sourceLegacy = objectMap(data.recent_state);
  return cleanRecentState({
    ...DEFAULT_RECENT_STATE,
    ...sourceRecent,
    lastFeedAt: sourceRecent.lastFeedAt || sourceLegacy.last_feed || DEFAULT_RECENT_STATE.lastFeedAt,
    lastSleepAt: sourceRecent.lastSleepAt || sourceLegacy.last_sleep || DEFAULT_RECENT_STATE.lastSleepAt,
    lastDiaperAt: sourceRecent.lastDiaperAt || sourceLegacy.last_diaper || DEFAULT_RECENT_STATE.lastDiaperAt,
    notes: sourceRecent.notes || sourceLegacy.notes || DEFAULT_RECENT_STATE.notes
  });
}

function cleanRecentState(value) {
  const recent = { ...DEFAULT_RECENT_STATE, ...objectMap(value) };
  delete recent.last_feed;
  delete recent.last_sleep;
  delete recent.last_diaper;
  return recent;
}

function buildMilestoneLogFromLegacy(data = legacyData()) {
  return {
    milestone_history: arrayValue(data.milestones),
    milestone_progress: objectMap(data.milestone_progress)
  };
}

function buildDoctorGuidelineFromSources(data = legacyData()) {
  const recommendations = [];
  const legacyRecommendations = data.doctor_recommendations || data.pediatrician_recommendations;

  if (typeof legacyRecommendations === "string" && legacyRecommendations.trim()) {
    recommendations.push({
      id: "legacy-doctor-recommendations",
      source: "legacy-app-data",
      category: "doctor-note",
      urgency: "as-written",
      summary: legacyRecommendations.trim(),
      action: legacyRecommendations.trim()
    });
  } else if (Array.isArray(legacyRecommendations)) {
    legacyRecommendations.forEach((item, index) => {
      recommendations.push({
        id: item.id || `legacy-doctor-recommendation-${index + 1}`,
        source: "legacy-app-data",
        category: item.category || "doctor-note",
        urgency: item.urgency || "as-written",
        summary: item.summary || item.title || item.text || "",
        action: item.action || item.recommendation || item.text || ""
      });
    });
  }

  readJson(POOP_COLORS_PATH, [])
    .filter((item) => ["call", "urgent", "watch"].includes(item.category) && /pediatrician|doctor|urgent/i.test(item.parentAction || ""))
    .forEach((item) => {
      recommendations.push({
        id: `poop-color-${item.id}`,
        source: "poop-colors",
        category: "diaper",
        urgency: item.category,
        summary: item.meaning || item.label,
        action: item.parentAction,
        trigger: item.label
      });
    });

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    notes: "Parent-maintained pediatrician recommendations and care-sheet red flags. Add future doctor guidance here.",
    careGuides: {},
    recommendations
  };
}

function ensureDataFiles() {
  const data = legacyData();
  const recent = legacyRecent();

  if (!fs.existsSync(APP_DATA_PATH)) writeJson(APP_DATA_PATH, buildAppDataFromLegacy(data, recent));
  if (!fs.existsSync(BABY_LOG_PATH)) writeJson(BABY_LOG_PATH, arrayValue(data.baby_log));
  if (!fs.existsSync(MILESTONE_LOG_PATH)) writeJson(MILESTONE_LOG_PATH, buildMilestoneLogFromLegacy(data));
  if (!fs.existsSync(DOCTOR_GUIDELINE_PATH)) writeJson(DOCTOR_GUIDELINE_PATH, buildDoctorGuidelineFromSources(data));
}

function loadAppData() {
  ensureDataFiles();
  const data = readJson(APP_DATA_PATH, buildAppDataFromLegacy());
  return {
    ...data,
    baby_profile: { ...DEFAULT_PROFILE, ...objectMap(data.baby_profile) },
    recent_state: cleanRecentState(data.recent_state),
    overview_settings: { ...DEFAULT_OVERVIEW_SETTINGS, ...objectMap(data.overview_settings) }
  };
}

function saveAppData(data) {
  const { baby_log, milestones, milestone_progress, doctor_guideline, ...appFields } = objectMap(data);
  writeJson(APP_DATA_PATH, {
    ...appFields,
    baby_profile: { ...DEFAULT_PROFILE, ...objectMap(data.baby_profile) },
    recent_state: cleanRecentState(data.recent_state),
    goals: arrayValue(data.goals),
    schedule_templates: arrayValue(data.schedule_templates),
    foods: arrayValue(data.foods),
    sound_settings: objectMap(data.sound_settings),
    unit_settings: { ...DEFAULT_UNIT_SETTINGS, ...objectMap(data.unit_settings) },
    overview_settings: { ...DEFAULT_OVERVIEW_SETTINGS, ...objectMap(data.overview_settings) }
  });
}

function loadBabyLog() {
  ensureDataFiles();
  return readJson(BABY_LOG_PATH, []);
}

function saveBabyLog(logs) {
  writeJson(BABY_LOG_PATH, arrayValue(logs));
}

function loadMilestoneLog() {
  ensureDataFiles();
  return readJson(MILESTONE_LOG_PATH, buildMilestoneLogFromLegacy());
}

function saveMilestoneLog(value) {
  writeJson(MILESTONE_LOG_PATH, {
    milestone_history: arrayValue(value.milestone_history),
    milestone_progress: objectMap(value.milestone_progress)
  });
}

function loadDoctorGuideline() {
  ensureDataFiles();
  return readJson(DOCTOR_GUIDELINE_PATH, buildDoctorGuidelineFromSources());
}

function saveDoctorGuideline(value) {
  const guideline = objectMap(value);
  writeJson(DOCTOR_GUIDELINE_PATH, {
    ...guideline,
    version: guideline.version || 1,
    updatedAt: guideline.updatedAt || new Date().toISOString(),
    notes: guideline.notes || "",
    recommendations: arrayValue(guideline.recommendations)
  });
}

function loadRecent() {
  return loadAppData().recent_state;
}

function saveRecent(recent) {
  const appData = loadAppData();
  appData.recent_state = cleanRecentState(recent);
  saveAppData(appData);
}

function loadData() {
  const appData = loadAppData();
  const milestoneLog = loadMilestoneLog();
  return {
    ...appData,
    baby_log: loadBabyLog(),
    milestones: milestoneLog.milestone_history,
    milestone_progress: milestoneLog.milestone_progress,
    doctor_guideline: loadDoctorGuideline()
  };
}

function saveData(data) {
  saveAppData(data);
  saveBabyLog(data.baby_log);
  saveMilestoneLog({
    milestone_history: data.milestones,
    milestone_progress: data.milestone_progress
  });
  if (data.doctor_guideline) saveDoctorGuideline(data.doctor_guideline);
}

module.exports = {
  paths: {
    APP_DATA_PATH,
    BABY_LOG_PATH,
    MILESTONE_LOG_PATH,
    DOCTOR_GUIDELINE_PATH,
    POOP_COLORS_PATH
  },
  readJson,
  writeJson,
  ensureDataFiles,
  loadAppData,
  saveAppData,
  loadBabyLog,
  saveBabyLog,
  loadMilestoneLog,
  saveMilestoneLog,
  loadDoctorGuideline,
  saveDoctorGuideline,
  loadRecent,
  saveRecent,
  loadData,
  saveData
};
