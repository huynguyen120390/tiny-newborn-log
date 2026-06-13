const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile, spawn } = require("child_process");
const {
  makeReport,
  resolveRange,
  saveCsv,
  saveJson,
  savePdf,
  saveXlsx
} = require("./exportService");
const { saveAllMetrics, saveDailyMetrics, saveTrendMetrics } = require("./analyticsService");
const {
  loadData,
  saveData,
  loadAppData,
  loadBabyLog,
  loadDoctorGuideline,
  loadMilestoneLog,
  loadRecent: loadStoredRecent,
  writeJson,
  saveAppData,
  saveRecent
} = require("./dataStore");

const PORT = process.argv[2] || process.env.PORT || 3002;
const ROOT_DIR = path.join(__dirname, "..");
const DEFAULT_DATA_ROOT = path.join("C:", "codelab", "databases", "TinyNewbornLog");
const DATA_ROOT = process.env.DATA_ROOT ? path.resolve(process.env.DATA_ROOT) : DEFAULT_DATA_ROOT;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(DATA_ROOT, "prod");
const SHARED_DATA_DIR = process.env.SHARED_DATA_DIR ? path.resolve(process.env.SHARED_DATA_DIR) : path.join(DATA_ROOT, "shared");
const SCHEDULE_LOGS_PATH = path.join(DATA_DIR, "schedule_logs.json");
const SCHEDULE_TEMPLATE_COPIES_PATH = path.join(DATA_DIR, "schedule_templates.json");
const APP_DATA_MODE = process.env.APP_DATA_MODE || (process.env.DATA_DIR ? path.basename(DATA_DIR) : "prod");
const PUBLIC_DIR = path.join(__dirname, "..", "frontend");
const POOP_COLORS_PATH = path.join(SHARED_DATA_DIR, "poop-colors.json");
const DOCTOR_GUIDELINE_MD_PATH = path.join(SHARED_DATA_DIR, "doctor_guideline.md");
const SLEEP_SCHEDULE_TEMPLATE_DIR = path.join(SHARED_DATA_DIR, "sleep_schedule_template");
const OVERVIEW_TREND_30D_PATH = path.join(DATA_DIR, "analytics", "trends", "recent-30d.json");
const ACTIVITY_CONFIG_PATH = path.join(SHARED_DATA_DIR, "activity_config.json");
const ACTIVITY_CONFIG = readJson(
  fs.existsSync(ACTIVITY_CONFIG_PATH) ? ACTIVITY_CONFIG_PATH : path.join(ROOT_DIR, "data", "activity_config.json"),
  { eventCategories: {} }
);
const LLAMA_ENDPOINT = process.env.LLAMA_ENDPOINT || "http://localhost:11434/api/generate";
const LLAMA_MODEL = process.env.LLAMA_MODEL || "llama3.2";
const OPENAI_ENDPOINT = process.env.OPENAI_ENDPOINT || "https://api.openai.com/v1/responses";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || loadExternalApiKey("open_ai");
const LLAMA_TIMEOUT_MS = cleanNumber(process.env.LLAMA_TIMEOUT_MS, 30000);
const LLAMA_OVERVIEW_TIMEOUT_MS = cleanNumber(process.env.LLAMA_OVERVIEW_TIMEOUT_MS, 60000);
const OPENAI_OVERVIEW_TIMEOUT_MS = cleanNumber(process.env.OPENAI_OVERVIEW_TIMEOUT_MS, 45000);
const BABY_CRIES_REVIEW_DAYS = 30;
const OVERVIEW_REVIEW_DAYS = 3;
const OVERVIEW_HISTORY_LIMIT = 12;
const DEFAULT_OVERVIEW_SETTINGS = {
  reviewMode: "rules_only",
  llamaModel: LLAMA_MODEL,
  gptModel: OPENAI_MODEL,
  careVoice: "parent_friendly",
  refreshIntervalMinutes: 5,
  maxOutputTokens: 700,
  reviewWindowDays: OVERVIEW_REVIEW_DAYS
};

const DEFAULT_UNIT_SETTINGS = {
  milkUnit: "ml",
  weightUnit: "lb",
  heightUnit: "in"
};

const SERVER_CONTROL_TARGETS = [
  { id: "dev", label: "dev", mode: "dev", port: 3003 },
  { id: "staging", label: "staging", mode: "staging", port: 3004 },
  { id: "main", label: "main", mode: "staging", port: 3001 },
  { id: "prod", label: "prod", mode: "prod", port: 3002 }
];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".csv": "text/csv; charset=utf-8",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

const EVENT_CATEGORY_CONFIG = ACTIVITY_CONFIG.eventCategories || {};

function loadExternalApiKey(keyName) {
  const keyFile = process.env.API_KEYS_FILE || path.join("C:", "codelab", "key", "keys.json");
  if (!fs.existsSync(keyFile)) return "";
  try {
    const keys = JSON.parse(fs.readFileSync(keyFile, "utf8").replace(/^\uFEFF/, ""));
    const value = keys?.api_keys?.[keyName];
    return typeof value === "string" ? value.trim() : "";
  } catch {
    return "";
  }
}

function cleanOverviewSettings(value = {}) {
  const settings = { ...DEFAULT_OVERVIEW_SETTINGS, ...objectMap(value) };
  const reviewModes = new Set(["rules_only", "rules_then_llama", "llama_strict", "ollama_strict", "gpt_strict"]);
  const llamaModels = new Set(["llama3.2", "llama3.2:latest", "qwen2.5:0.5b", "qwen2.5:1.5b", "gemma2:2b"]);
  const gptModels = new Set(["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-5.1", "gpt-5.4"]);
  const careVoices = new Set(["parent_friendly", "pediatrician_genz_professional"]);
  return {
    reviewMode: settings.reviewMode === "llama_strict" ? "ollama_strict" : (reviewModes.has(settings.reviewMode) ? settings.reviewMode : DEFAULT_OVERVIEW_SETTINGS.reviewMode),
    llamaModel: llamaModels.has(settings.llamaModel) ? settings.llamaModel : DEFAULT_OVERVIEW_SETTINGS.llamaModel,
    gptModel: gptModels.has(settings.gptModel) ? settings.gptModel : DEFAULT_OVERVIEW_SETTINGS.gptModel,
    careVoice: careVoices.has(settings.careVoice) ? settings.careVoice : DEFAULT_OVERVIEW_SETTINGS.careVoice,
    refreshIntervalMinutes: Math.max(1, Math.min(60, Math.round(cleanNumber(settings.refreshIntervalMinutes, DEFAULT_OVERVIEW_SETTINGS.refreshIntervalMinutes)))),
    maxOutputTokens: Math.max(200, Math.min(1600, Math.round(cleanNumber(settings.maxOutputTokens, DEFAULT_OVERVIEW_SETTINGS.maxOutputTokens)))),
    reviewWindowDays: Math.max(1, Math.min(14, Math.round(cleanNumber(settings.reviewWindowDays, DEFAULT_OVERVIEW_SETTINGS.reviewWindowDays))))
  };
}

function cleanUnitSettings(value = {}) {
  const settings = { ...DEFAULT_UNIT_SETTINGS, ...objectMap(value) };
  const milkUnits = new Set(["ml", "oz"]);
  const weightUnits = new Set(["oz", "lb", "g", "kg"]);
  const heightUnits = new Set(["in", "ft", "cm", "mm"]);
  return {
    milkUnit: milkUnits.has(settings.milkUnit) ? settings.milkUnit : DEFAULT_UNIT_SETTINGS.milkUnit,
    weightUnit: weightUnits.has(settings.weightUnit) ? settings.weightUnit : DEFAULT_UNIT_SETTINGS.weightUnit,
    heightUnit: heightUnits.has(settings.heightUnit) ? settings.heightUnit : DEFAULT_UNIT_SETTINGS.heightUnit
  };
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function readText(filePath, fallback = "") {
  if (!fs.existsSync(filePath)) return fallback;
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

function loadKnowledgeScheduleTemplates() {
  if (!fs.existsSync(SLEEP_SCHEDULE_TEMPLATE_DIR)) return [];
  return fs.readdirSync(SLEEP_SCHEDULE_TEMPLATE_DIR)
    .filter((file) => file.toLowerCase().endsWith(".json"))
    .map((file) => readJson(path.join(SLEEP_SCHEDULE_TEMPLATE_DIR, file), null))
    .filter(Boolean)
    .sort((a, b) => {
      const aAge = cleanNumber(a.ageRange?.min, 0) * (a.ageRange?.unit === "weeks" ? 0.25 : 1);
      const bAge = cleanNumber(b.ageRange?.min, 0) * (b.ageRange?.unit === "weeks" ? 0.25 : 1);
      return aAge - bAge;
    });
}

function loadScheduleTemplates() {
  const saved = readJson(SCHEDULE_TEMPLATE_COPIES_PATH, null);
  const templates = saved && !Array.isArray(saved) ? arrayValue(saved.schedule_templates) : arrayValue(saved);
  if (templates.length) return templates;

  const knowledgeTemplates = loadKnowledgeScheduleTemplates().map((template) => ({
    ...template,
    sourceTemplateId: template.id,
    copiedFrom: template.source || "shared_knowledge",
    copiedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  const latestLogByTemplateId = new Map();
  loadScheduleLogs().forEach((log) => {
    if (!latestLogByTemplateId.has(log.templateId) && Array.isArray(log.rows) && log.rows.length) {
      latestLogByTemplateId.set(log.templateId, log);
    }
  });
  const copiedTemplates = knowledgeTemplates.map((template) => {
    const latestLog = latestLogByTemplateId.get(template.id);
    return latestLog
      ? { ...template, rows: latestLog.rows.map((row) => ({ ...objectMap(row) })), updatedAt: latestLog.updatedAt || template.updatedAt }
      : template;
  });
  saveScheduleTemplates(copiedTemplates);
  return copiedTemplates;
}

function saveScheduleTemplates(templates) {
  writeJson(SCHEDULE_TEMPLATE_COPIES_PATH, { schedule_templates: arrayValue(templates) });
}

function loadScheduleLogs() {
  const data = readJson(SCHEDULE_LOGS_PATH, { schedule_logs: [] });
  const logs = Array.isArray(data) ? data : arrayValue(data.schedule_logs);
  return logs
    .filter((log) => log && typeof log.date === "string")
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function saveScheduleLogs(logs) {
  writeJson(SCHEDULE_LOGS_PATH, { schedule_logs: arrayValue(logs) });
}

function updateScheduleTemplateRows(templateId, rows) {
  if (!templateId || !Array.isArray(rows) || !rows.length) return;
  const templates = loadScheduleTemplates();
  const index = templates.findIndex((template) => template.id === templateId);
  if (index === -1) return;
  templates[index] = {
    ...templates[index],
    rows: rows.map((row) => ({ ...objectMap(row) })),
    updatedAt: new Date().toISOString()
  };
  saveScheduleTemplates(templates);
}

function resetScheduleTemplateRows(templateId) {
  if (!templateId) return null;
  const doctorTemplate = loadKnowledgeScheduleTemplates().find((template) => template.id === templateId || template.sourceTemplateId === templateId);
  if (!doctorTemplate) return null;
  const templates = loadScheduleTemplates();
  const index = templates.findIndex((template) => template.id === templateId);
  if (index === -1) return null;
  templates[index] = {
    ...templates[index],
    rows: arrayValue(doctorTemplate.rows).map((row) => ({ ...objectMap(row) })),
    resetAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  saveScheduleTemplates(templates);
  return templates[index];
}

function todayDateString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function objectMap(value) {
  return value && !Array.isArray(value) && typeof value === "object" ? value : {};
}

function loadRecent() {
  return loadStoredRecent();
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function postJson(targetUrl, payload, timeoutMs = 7000, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const serviceName = parsed.hostname.includes("openai.com") ? "OpenAI" : "Llama";
    const client = parsed.protocol === "https:" ? require("https") : require("http");
    const body = JSON.stringify(payload);
    const request = client.request({
      method: "POST",
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: `${parsed.pathname}${parsed.search}`,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        ...extraHeaders
      },
      timeout: timeoutMs
    }, (response) => {
      let responseBody = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        responseBody += chunk;
        if (responseBody.length > 1_000_000) request.destroy(new Error("Llama response too large"));
      });
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`${serviceName} returned ${response.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(responseBody));
        } catch {
          reject(new Error(`${serviceName} response was not valid JSON`));
        }
      });
    });

    request.on("timeout", () => request.destroy(new Error(`${serviceName} request timed out`)));
    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

function sendFile(res, filePath, download = false, extraHeaders = {}) {
  const ext = path.extname(filePath);
  const headers = { "Content-Type": MIME_TYPES[ext] || "application/octet-stream", ...extraHeaders };
  if (download) headers["Content-Disposition"] = `attachment; filename="${path.basename(filePath)}"`;
  if ([".html", ".css", ".js"].includes(ext)) {
    headers["Cache-Control"] = "no-store, max-age=0";
  }
  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
}

function runCommand(file, args) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function findServerTarget(id) {
  return SERVER_CONTROL_TARGETS.find((target) => target.id === id);
}

function isLocalRequest(req) {
  const address = req.socket.remoteAddress || "";
  return address === "::1" || address === "127.0.0.1" || address === "::ffff:127.0.0.1";
}

async function serverStatusForPort(port) {
  const { stdout } = await runCommand("netstat.exe", ["-ano", "-p", "tcp"]);
  const match = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.match(/^TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)$/i))
    .find((parts) => parts && Number(parts[1]) === Number(port));

  return {
    running: Boolean(match),
    pid: match ? Number(match[2]) : null
  };
}

async function getServerStatuses() {
  const statuses = [];
  for (const target of SERVER_CONTROL_TARGETS) {
    const status = await serverStatusForPort(target.port);
    statuses.push({ ...target, ...status });
  }
  return statuses;
}

function startServerTarget(target) {
  const dataDir = path.join(DATA_ROOT, target.mode);
  const child = spawn(process.execPath, [path.join(ROOT_DIR, "backend", "server.js"), String(target.port)], {
    cwd: ROOT_DIR,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: {
      ...process.env,
      APP_DATA_MODE: target.mode,
      DATA_ROOT,
      DATA_DIR: dataDir,
      SHARED_DATA_DIR,
      PORT: String(target.port)
    }
  });
  child.unref();
  return child.pid;
}

async function stopServerPid(pid) {
  if (Number(pid) === process.pid) return "self";
  await runCommand("taskkill.exe", ["/PID", String(pid), "/T", "/F"]);
  return "stopped";
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Request body must be valid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function nowParts() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return {
    iso: now.toISOString(),
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`
  };
}

function makeId() {
  return `log-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function cleanNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanText(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function cleanMilkType(value, fallback = "formula") {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "breast_milk" || normalized === "breastmilk") return "breast_milk";
  if (normalized === "formula") return "formula";
  return fallback;
}

function milkTypeLabel(milkType) {
  return milkType === "breast_milk" ? "Breast Milk" : "Formula";
}

function weightToGrams(value, unit = "lb") {
  const amount = cleanNumber(value, 0);
  const factors = { oz: 28.349523125, lb: 453.59237, g: 1, kg: 1000 };
  return +(amount * (factors[unit] || factors.lb)).toFixed(3);
}

function heightToMm(value, unit = "in") {
  const amount = cleanNumber(value, 0);
  const factors = { in: 25.4, ft: 304.8, cm: 10, mm: 1 };
  return +(amount * (factors[unit] || factors.in)).toFixed(3);
}

function pairedConfig(type) {
  const config = EVENT_CATEGORY_CONFIG[type];
  return config?.kind === "period" ? config : null;
}

function logTime(log) {
  const [hour = "00", minute = "00"] = String(log.time || "00:00").split(":");
  const local = new Date(`${log.date || nowParts().date}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00`);
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

function recentNativeLogs(logs, days = 2) {
  const safeDays = Math.max(1, Math.min(14, Math.round(cleanNumber(days, 2))));
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const windowStart = todayStart - ((safeDays - 1) * 24 * 60 * 60 * 1000);
  const windowEnd = todayStart + (24 * 60 * 60 * 1000);
  const sorted = arrayValue(logs).sort((a, b) => logTime(a) - logTime(b));
  const included = new Map();

  sorted.forEach((log) => {
    const time = logTime(log);
    if (time >= windowStart && time < windowEnd) {
      included.set(log.id, log);
    }
  });

  Object.entries(EVENT_CATEGORY_CONFIG).forEach(([type, config]) => {
    if (config?.kind !== "period") return;
    const last = [...sorted].reverse().find((log) => log.type === type && log.status);
    if (last && last.status === config.start && last.id) {
      included.set(last.id, last);
    }
  });

  return [...included.values()].sort((a, b) => logTime(a) - logTime(b));
}

function isActiveAt(logs, type, atTime, excludeId) {
  const config = pairedConfig(type);
  let active = false;
  logs
    .filter((log) => log.id !== excludeId && log.type === type && log.status && logTime(log) < atTime)
    .sort((a, b) => logTime(a) - logTime(b))
    .forEach((log) => {
      if (log.status === config.start) active = true;
      if (log.status === config.end) active = false;
    });
  return active;
}

function nextTimedStatus(logs, type, atTime, excludeId) {
  return logs
    .filter((log) => log.id !== excludeId && log.type === type && log.status && logTime(log) > atTime)
    .sort((a, b) => logTime(a) - logTime(b))[0] || null;
}

function validatePairedTransition(logs, candidate, excludeId, options = {}) {
  const config = pairedConfig(candidate.type);
  if (!config || !candidate.status) return "";

  const atTime = logTime(candidate);
  if (atTime > Date.now() + 30 * 1000) return "Time cannot be in the future.";

  const activeBefore = isActiveAt(logs, candidate.type, atTime, excludeId);
  const isStart = candidate.status === config.start;
  const isEnd = candidate.status === config.end;

  if (isStart && activeBefore) return `Already ${config.startLabel}. Stop first to avoid overlapping time.`;
  if (isEnd && !activeBefore) return `Already ${config.endLabel}. Start first before stopping.`;

  const nextCandidate = nextTimedStatus(logs, candidate.type, atTime, excludeId);
  const next = options.ignoreFutureNext && nextCandidate && logTime(nextCandidate) > Date.now() + 30 * 1000
    ? null
    : nextCandidate;
  if (next && isStart && next.status === config.start) return `This would overlap with another ${config.startLabel} time.`;
  if (next && isEnd && next.status === config.end) return "This would create two stop events in a row.";
  return "";
}

function buildLog(input) {
  const stamp = nowParts();
  const inputCreatedAt = typeof input.createdAt === "string" ? new Date(input.createdAt) : null;
  const createdAt = inputCreatedAt && Number.isFinite(inputCreatedAt.getTime()) ? inputCreatedAt.toISOString() : stamp.iso;
  const base = {
    id: cleanText(input.id, makeId()),
    date: input.date || stamp.date,
    time: input.time || stamp.time,
    type: input.type,
    timestamp: createdAt,
    createdAt
  };

  if (input.type === "sleep") {
    return { ...base, status: input.status, notes: input.status === "asleep" ? "Baby fell asleep" : "Baby woke up" };
  }

  if (input.type === "feeding" && input.method === "breast") {
    return { ...base, method: "breast", side: input.side, notes: `Started on ${input.side} side` };
  }

  if (input.type === "bottle") {
    const milkType = cleanMilkType(input.milkType);
    const milkLabel = milkTypeLabel(milkType);
    return { ...base, ounces: cleanNumber(input.ounces, 0), milkType, notes: `${milkLabel} bottle feed` };
  }

  if (input.type === "routine") {
    const routineLabels = {
      morning: "Morning routine",
      naptime: "Naptime routine",
      bedtime: "Bedtime routine"
    };
    const routine = routineLabels[input.routine] ? input.routine : "morning";
    return { ...base, routine, notes: `${routineLabels[routine]} done` };
  }

  if (input.type === "diaper") {
    const isPoop = input.kind === "poop";
    const poopColorId = isPoop ? cleanText(input.poopColorId) : "";
    const consistency = isPoop ? cleanText(input.consistency) : "";
    return {
      ...base,
      pee: input.kind === "pee",
      poop: isPoop,
      ...(isPoop && poopColorId ? { poopColorId, poopColor: poopColorId } : {}),
      ...(isPoop && consistency ? { consistency, poopTexture: consistency } : {}),
      notes: cleanText(input.notes, isPoop ? "Poo diaper" : "Wee diaper")
    };
  }

  if (input.type === "growth_stats") {
    const stat = input.stat === "height" ? "height" : "weight";
    if (stat === "weight") {
      const weight = cleanNumber(input.weight, 0);
      const weightUnit = ["oz", "lb", "g", "kg"].includes(input.weightUnit) ? input.weightUnit : "lb";
      const weightGrams = weightToGrams(weight, weightUnit);
      return { ...base, stat, weight, weightUnit, weightGrams, notes: `Weight ${weight} ${weightUnit}` };
    }

    const height = cleanNumber(input.height, 0);
    const heightUnit = ["in", "ft", "cm", "mm"].includes(input.heightUnit) ? input.heightUnit : "in";
    const heightMm = heightToMm(height, heightUnit);
    return { ...base, stat, height, heightUnit, heightMm, notes: `Height ${height} ${heightUnit}` };
  }

  if (input.type === "bath") {
    return { ...base, status: input.status || "start", notes: input.status === "end" ? "Bath ended" : "Bath started" };
  }

  if (input.type === "tummy_time") {
    return { ...base, status: input.status, notes: input.status === "start" ? "Tummy time started" : "Tummy time ended" };
  }

  if (input.type === "outdoor_time") {
    return { ...base, status: input.status, notes: input.status === "start" ? "Outdoor time started" : "Outdoor time ended" };
  }

  if (input.type === "baby_gym") {
    return { ...base, notes: "Baby gym time" };
  }

  throw new Error("Unsupported log type");
}

function updateRecent(recent, log) {
  recent.lastActivityAt = log.createdAt;

  if (log.type === "sleep") recent.lastSleepAt = log.createdAt;
  if (log.type === "diaper") recent.lastDiaperAt = log.createdAt;
  if (log.type === "routine") recent.lastRoutineAt = log.createdAt;
  if (log.type === "bath") recent.lastBathAt = log.createdAt;
  if (log.type === "tummy_time") recent.lastTummyTimeAt = log.createdAt;
  if (log.type === "outdoor_time") recent.lastOutdoorTimeAt = log.createdAt;
  if (log.type === "baby_gym") recent.lastBabyGymAt = log.createdAt;
  if (log.type === "growth_stats") recent.lastGrowthStatsAt = log.createdAt;

  if (log.type === "feeding") {
    recent.lastFeedAt = log.createdAt;
    if (log.method === "breast" && log.side) recent.nextBreastSide = log.side === "left" ? "right" : "left";
  }

  if (log.type === "bottle") {
    recent.lastFeedAt = log.createdAt;
    recent.bottleOunces = log.ounces;
    recent.lastBottleMilkType = cleanMilkType(log.milkType, recent.lastBottleMilkType || "formula");
    if (log.milkType === "breast_milk") recent.breastMilkBottleOunces = log.ounces;
    else recent.formulaBottleOunces = log.ounces;
  }

  return recent;
}

function rebuildRecent(data) {
  const recent = {
    bottleOunces: 2.5,
    formulaBottleOunces: 2.5,
    breastMilkBottleOunces: 2.5,
    lastBottleMilkType: "formula",
    nextBreastSide: "left",
    lastActivityAt: null,
    lastFeedAt: null,
    lastSleepAt: null,
    lastDiaperAt: null,
    lastRoutineAt: null,
    lastOutdoorTimeAt: null,
    lastGrowthStatsAt: null,
    notes: data.recent_state?.notes || ""
  };

  (data.baby_log || []).forEach((log) => updateRecent(recent, log));
  return recent;
}

function summarizeToday(data) {
  const today = nowParts().date;
  const logs = (data.baby_log || []).filter((log) => log.date === today);
  const count = (predicate) => logs.filter(predicate).length;
  const sum = (predicate, field) => logs.filter(predicate).reduce((total, log) => total + Number(log[field] || 0), 0);

  return {
    date: today,
    totalLogs: logs.length,
    sleepEvents: count((log) => log.type === "sleep"),
    breastFeeds: count((log) => log.type === "feeding" && log.method === "breast"),
    bottleFeeds: count((log) => log.type === "bottle"),
    bottleOunces: +sum((log) => log.type === "bottle", "ounces").toFixed(1),
    routineEvents: count((log) => log.type === "routine"),
    morningRoutines: count((log) => log.type === "routine" && log.routine === "morning"),
    naptimeRoutines: count((log) => log.type === "routine" && log.routine === "naptime"),
    bedtimeRoutines: count((log) => log.type === "routine" && log.routine === "bedtime"),
    wetDiapers: count((log) => log.type === "diaper" && log.pee),
    poops: count((log) => log.type === "diaper" && log.poop),
    baths: count((log) => log.type === "bath"),
    tummyTimeEvents: count((log) => log.type === "tummy_time"),
    outdoorTimeEvents: count((log) => log.type === "outdoor_time"),
    growthStats: count((log) => log.type === "growth_stats"),
    babyGymEvents: count((log) => log.type === "baby_gym")
  };
}

function babyAgeDays(profile = {}) {
  if (!profile.birthday) return null;
  const birth = new Date(`${profile.birthday}T00:00:00`);
  if (!Number.isFinite(birth.getTime())) return null;
  return Math.max(1, Math.floor((Date.now() - birth.getTime()) / (24 * 60 * 60 * 1000)) + 1);
}

function minutesSinceLog(log) {
  if (!log) return null;
  const minutes = Math.round((Date.now() - logTime(log)) / 60000);
  return Number.isFinite(minutes) ? minutes : null;
}

function formatDurationParts(minutes) {
  if (!Number.isFinite(minutes)) return "no information found";
  const total = Math.max(0, Math.round(minutes));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function latestLog(logs, predicate) {
  return logs.filter(predicate).sort((a, b) => logTime(b) - logTime(a))[0] || null;
}

function logsSince(logs, hours) {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return logs.filter((log) => logTime(log) >= cutoff).sort((a, b) => logTime(a) - logTime(b));
}

function logsSinceDays(logs, days) {
  return logsSince(logs, days * 24);
}

function compactLog(log) {
  const copy = {
    type: log.type,
    date: log.date,
    time: log.time,
    status: log.status || undefined,
    method: log.method || undefined,
    side: log.side || undefined,
    ounces: log.ounces || undefined,
    milkType: log.milkType || undefined,
    routine: log.routine || undefined,
    pee: log.pee || undefined,
    poop: log.poop || undefined,
    poopColorId: log.poopColorId || log.poopColor || undefined,
    stat: log.stat || undefined,
    weight: Number.isFinite(Number(log.weight)) ? Number(log.weight) : undefined,
    weightUnit: log.weightUnit || undefined,
    weightGrams: Number.isFinite(Number(log.weightGrams)) ? Number(log.weightGrams) : undefined,
    height: Number.isFinite(Number(log.height)) ? Number(log.height) : undefined,
    heightUnit: log.heightUnit || undefined,
    heightMm: Number.isFinite(Number(log.heightMm)) ? Number(log.heightMm) : undefined,
    notes: log.notes || undefined
  };
  Object.keys(copy).forEach((key) => copy[key] === undefined && delete copy[key]);
  return copy;
}

function sleepState(logs) {
  const last = latestLog(logs, (log) => log.type === "sleep" && log.status);
  return {
    current: last?.status || "unknown",
    minutesSinceChange: minutesSinceLog(last)
  };
}

function expectedWetDiapers(feedingCare, ageDays) {
  const rows = findCareSectionById(feedingCare.sections, "wet-diapers")?.rows || [];
  const label = Number.isFinite(ageDays) ? (ageDays >= 4 ? "Day 4+" : `Day ${Math.max(1, ageDays)}`) : "Day 4+";
  const row = rows.find((item) => item[0] === label) || rows[rows.length - 1];
  return row ? { day: row[0], expected: row[1] } : null;
}

function findCareSectionById(sections, id) {
  for (const section of sections || []) {
    if (section.id === id) return section;
    const found = findCareSectionById(section.subsections, id);
    if (found) return found;
  }
  return null;
}

function careGuidesFromData(data) {
  const guides = data.doctor_guideline?.careGuides || {};
  return {
    feeding: guides.eat || guides.feeding || {},
    sleep: guides.sleep || {}
  };
}

function buildBabyCriesContext(input = {}) {
  const data = loadData();
  const logs = Array.isArray(data.baby_log) ? data.baby_log : [];
  const careGuides = careGuidesFromData(data);
  const feedingCare = careGuides.feeding;
  const sleepCare = careGuides.sleep;
  const today = summarizeToday(data);
  const ageDays = babyAgeDays(data.baby_profile || {});
  const reviewLogs = logsSince(logs, BABY_CRIES_REVIEW_DAYS * 24);
  const lastFeed = latestLog(reviewLogs, (log) => log.type === "feeding" || log.type === "bottle");
  const lastDiaper = latestLog(reviewLogs, (log) => log.type === "diaper");
  const lastWetDiaper = latestLog(reviewLogs, (log) => log.type === "diaper" && log.pee);
  const lastSleep = latestLog(reviewLogs, (log) => log.type === "sleep");
  const lastBottle = latestLog(reviewLogs, (log) => log.type === "bottle");
  const lastBreast = latestLog(reviewLogs, (log) => log.type === "feeding");

  const keyRecencyMinutes = {
    lastFeed: minutesSinceLog(lastFeed),
    lastBottle: minutesSinceLog(lastBottle),
    lastBreast: minutesSinceLog(lastBreast),
    lastDiaper: minutesSinceLog(lastDiaper),
    lastWetDiaper: minutesSinceLog(lastWetDiaper),
    lastSleepChange: minutesSinceLog(lastSleep)
  };

  return {
    reviewWindow: `Last ${BABY_CRIES_REVIEW_DAYS} days only`,
    babyProfile: {
      name: data.baby_profile?.name || "",
      birthday: data.baby_profile?.birthday || "",
      ageDays,
      ageWeeks: Number.isFinite(ageDays) ? Math.floor(ageDays / 7) : null
    },
    weather: input.weather || null,
    todaySummary: today,
    keyRecencyMinutes,
    keyRecencyText: {
      lastFeed: formatDurationParts(keyRecencyMinutes.lastFeed),
      lastBottle: formatDurationParts(keyRecencyMinutes.lastBottle),
      lastBreast: formatDurationParts(keyRecencyMinutes.lastBreast),
      lastDiaper: formatDurationParts(keyRecencyMinutes.lastDiaper),
      lastWetDiaper: formatDurationParts(keyRecencyMinutes.lastWetDiaper),
      lastSleepChange: formatDurationParts(keyRecencyMinutes.lastSleepChange)
    },
    sleepState: sleepState(reviewLogs),
    careGuidance: {
      babyCriesAlgorithm: ["Hungry?", "Wet diaper?", "Need burp?", "Too hot/cold?", "Overtired?", "Sick / discomfort?"],
      hungerCues: findCareSectionById(feedingCare.sections, "early-hunger-cues")?.items || [],
      wetDiapers: expectedWetDiapers(feedingCare, ageDays),
      sleepMilestones: sleepCare.milestones || []
    },
    recentLogs: reviewLogs.slice(-80).map(compactLog)
  };
}

function fallbackBabyCriesRecommendation(context) {
  const recency = context.keyRecencyMinutes || {};
  const weather = context.weather || {};
  const sleep = context.sleepState || {};
  const flags = [];
  const temp = Number(weather.temperature);
  const inspections = babyCriesInspections(context);

  if (Number.isFinite(recency.lastFeed) && recency.lastFeed >= 120) {
    return {
      likelyReason: "Hungry",
      reasoning: `Last feed was about ${formatDurationParts(recency.lastFeed)} ago, so hunger is the most likely first check.`,
      suggestedAction: "Offer a feed and watch for calming or hunger cues.",
      confidence: recency.lastFeed >= 180 ? "High" : "Medium",
      flags,
      inspections
    };
  }

  if (Number.isFinite(recency.lastWetDiaper) && recency.lastWetDiaper >= 240) {
    flags.push("wet-diaper-check");
    return {
      likelyReason: "Wet diaper or diaper discomfort",
      reasoning: `No wet diaper has been logged for about ${formatDurationParts(recency.lastWetDiaper)}.`,
      suggestedAction: "Check and change diaper. Call pediatrician if diapers are unusually low or baby seems lethargic.",
      confidence: "Medium",
      flags,
      inspections
    };
  }

  if (Number.isFinite(recency.lastFeed) && recency.lastFeed <= 45) {
    return {
      likelyReason: "Needs burp",
      reasoning: `A feed was logged about ${formatDurationParts(recency.lastFeed)} ago, which often points to trapped air or feeding discomfort.`,
      suggestedAction: "Burp gently, hold upright, and watch for relief.",
      confidence: "Medium",
      flags,
      inspections
    };
  }

  if (Number.isFinite(temp) && (temp >= 84 || temp <= 45)) {
    return {
      likelyReason: "Too hot/cold",
      reasoning: `Local weather is about ${temp} F, so temperature or clothing may be contributing.`,
      suggestedAction: "Check baby's chest/neck, adjust layers, and move to a comfortable room.",
      confidence: "Medium",
      flags,
      inspections
    };
  }

  if (sleep.current === "awake" && Number.isFinite(sleep.minutesSinceChange) && sleep.minutesSinceChange >= 120) {
    return {
      likelyReason: "Overtired",
      reasoning: `Baby has been awake about ${formatDurationParts(sleep.minutesSinceChange)} since the last sleep change.`,
      suggestedAction: "Dim lights, reduce stimulation, and start a soothing sleep routine.",
      confidence: "Medium",
      flags,
      inspections
    };
  }

  flags.push("watch-symptoms");
  return {
    likelyReason: "Needs comfort or unclear discomfort",
    reasoning: "Recent logs do not clearly point to hunger, diaper, burp, temperature, or overtiredness.",
    suggestedAction: "Try soothing: hold close, white noise, gentle movement, dim lights. Call pediatrician if pain, fever, illness, unusual crying, or poor feeding is suspected.",
    confidence: "Low",
    flags,
    inspections
  };
}

function babyCriesInspections(context) {
  const recency = context.keyRecencyMinutes || {};
  const weather = context.weather || {};
  const sleep = context.sleepState || {};
  const temp = Number(weather.temperature);
  const lastFeed = formatDurationParts(recency.lastFeed);
  const lastWet = formatDurationParts(recency.lastWetDiaper);
  const lastDiaper = formatDurationParts(recency.lastDiaper);
  const awake = formatDurationParts(sleep.minutesSinceChange);

  return [
    {
      step: 1,
      label: "Hungry?",
      status: Number.isFinite(recency.lastFeed) ? (recency.lastFeed >= 120 ? "possible" : "less likely") : "unknown",
      reasoning: Number.isFinite(recency.lastFeed) ? `Last feed was ${lastFeed} ago.` : "No feeding log information found."
    },
    {
      step: 2,
      label: "Wet diaper?",
      status: Number.isFinite(recency.lastWetDiaper) ? (recency.lastWetDiaper >= 240 ? "possible" : "less likely") : "unknown",
      reasoning: Number.isFinite(recency.lastWetDiaper) ? `Last wet diaper was ${lastWet} ago. Last diaper log was ${lastDiaper} ago.` : "No wet diaper log information found."
    },
    {
      step: 3,
      label: "Need burp?",
      status: Number.isFinite(recency.lastFeed) ? (recency.lastFeed <= 45 ? "possible" : "less likely") : "unknown",
      reasoning: Number.isFinite(recency.lastFeed) ? `Last feed was ${lastFeed} ago; burp is most likely soon after feeding.` : "No recent feeding log information found."
    },
    {
      step: 4,
      label: "Too hot/cold?",
      status: Number.isFinite(temp) ? ((temp >= 84 || temp <= 45) ? "possible" : "less likely") : "unknown",
      reasoning: Number.isFinite(temp) ? `Local weather is ${temp} F (${weather.description || "no description"}).` : "No local weather information found."
    },
    {
      step: 5,
      label: "Overtired?",
      status: sleep.current === "awake" && Number.isFinite(sleep.minutesSinceChange) ? (sleep.minutesSinceChange >= 120 ? "possible" : "less likely") : "unknown",
      reasoning: sleep.current === "awake" && Number.isFinite(sleep.minutesSinceChange) ? `Baby has been awake for ${awake}.` : "No current awake-window information found."
    },
    {
      step: 6,
      label: "Sick / discomfort?",
      status: "watch",
      reasoning: "No symptom log database is available yet. Watch for fever, pain, unusual crying, poor feeding, lethargy, or parent concern."
    }
  ];
}

function babyCriesPrompt(context) {
  return `You are helping a parent reason about why a baby may be crying. Do not diagnose. Be brief, calm, and practical.

Only review logs inside this review window: ${context.reviewWindow || "Last 30 days only"}.

Inspect every step in this exact order:
1. Hungry?
2. Wet diaper?
3. Need burp?
4. Too hot/cold?
5. Overtired?
6. Sick / discomfort?

For each step, provide inspection reasoning from logs, care database, baby profile, or weather. If no useful information is found for a step, state that clearly.
Use the human-readable duration strings in keyRecencyText when mentioning elapsed time. If sick/discomfort is possible or unclear, recommend calling pediatrician when concerning symptoms are present.

Return strict JSON only, no markdown:
{
  "likelyReason": "",
  "reasoning": "",
  "suggestedAction": "",
  "confidence": "Low|Medium|High",
  "inspections": [
    { "step": 1, "label": "Hungry?", "status": "possible|less likely|unknown|watch", "reasoning": "" },
    { "step": 2, "label": "Wet diaper?", "status": "possible|less likely|unknown|watch", "reasoning": "" },
    { "step": 3, "label": "Need burp?", "status": "possible|less likely|unknown|watch", "reasoning": "" },
    { "step": 4, "label": "Too hot/cold?", "status": "possible|less likely|unknown|watch", "reasoning": "" },
    { "step": 5, "label": "Overtired?", "status": "possible|less likely|unknown|watch", "reasoning": "" },
    { "step": 6, "label": "Sick / discomfort?", "status": "possible|less likely|unknown|watch", "reasoning": "" }
  ],
  "flags": []
}

Context:
${JSON.stringify(context, null, 2)}`;
}

function extractJsonObject(text) {
  if (!text || typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function validateBabyCriesRecommendation(value) {
  const confidence = ["Low", "Medium", "High"].includes(value?.confidence) ? value.confidence : "Low";
  const statusValues = new Set(["possible", "less likely", "unknown", "watch"]);
  const inspections = Array.isArray(value?.inspections) && value.inspections.length
    ? value.inspections.slice(0, 6).map((item, index) => ({
      step: cleanNumber(item.step, index + 1),
      label: cleanText(item.label, `Step ${index + 1}`).slice(0, 40),
      status: statusValues.has(cleanText(item.status, "unknown")) ? cleanText(item.status, "unknown") : "unknown",
      reasoning: cleanText(item.reasoning, "No information found.").slice(0, 220)
    }))
    : [];
  const result = {
    likelyReason: cleanText(value?.likelyReason, "Needs comfort or unclear discomfort").slice(0, 80),
    reasoning: cleanText(value?.reasoning, "Logs do not clearly point to one cause yet.").slice(0, 260),
    suggestedAction: cleanText(value?.suggestedAction, "Try soothing and re-check feeding, diaper, burp, temperature, and sleep cues.").slice(0, 260),
    confidence,
    inspections,
    flags: Array.isArray(value?.flags) ? value.flags.slice(0, 6).map((item) => String(item).slice(0, 40)) : []
  };
  return result;
}

async function handleBabyCriesTroubleshoot(req, res) {
  const input = await readBody(req);
  const context = buildBabyCriesContext(input);
  const prompt = babyCriesPrompt(context);
  const fallback = fallbackBabyCriesRecommendation(context);
  let recommendation = fallback;
  let source = "fallback";
  let gptError = "";
  const model = input.model || OPENAI_MODEL;

  try {
    const parsed = await runGptBabyCriesRecommendation(prompt, { model });
    recommendation = validateBabyCriesRecommendation(parsed);
    recommendation.inspections = fallback.inspections;
    source = "gpt";
  } catch (error) {
    gptError = error.message;
    recommendation = validateBabyCriesRecommendation(fallback);
  }

  sendJson(res, 200, {
    recommendation,
    source,
    prompt,
    gpt: {
      endpoint: OPENAI_ENDPOINT,
      model,
      available: source === "gpt",
      error: source === "gpt" ? "" : (gptError || "GPT unavailable; fallback used.")
    },
    contextSummary: {
      reviewWindow: context.reviewWindow,
      babyProfile: context.babyProfile,
      weather: context.weather,
      todaySummary: context.todaySummary,
      keyRecencyMinutes: context.keyRecencyMinutes,
      keyRecencyText: context.keyRecencyText,
      sleepState: context.sleepState
    },
    updatedAt: new Date().toISOString()
  });
}

function durationBetween(startLog, endLog) {
  if (!startLog || !endLog) return 0;
  return Math.max(0, Math.round((logTime(endLog) - logTime(startLog)) / 60000));
}

function periodMinutes(logs, type, startStatus, endStatus) {
  let active = null;
  let total = 0;
  logs
    .filter((log) => log.type === type && log.status)
    .sort((a, b) => logTime(a) - logTime(b))
    .forEach((log) => {
      if (log.status === startStatus) active = log;
      if (log.status === endStatus && active) {
        total += durationBetween(active, log);
        active = null;
      }
    });
  if (active) total += Math.max(0, Math.round((Date.now() - logTime(active)) / 60000));
  return total;
}

function latestGrowth(logs, stat) {
  return latestLog(logs, (log) => log.type === "growth_stats" && log.stat === stat);
}

function growthHistory(logs) {
  return logs
    .filter((log) => log.type === "growth_stats")
    .sort((a, b) => logTime(a) - logTime(b))
    .slice(-12)
    .map(compactLog);
}

function growthMeasurementWarnings(history, ageDays) {
  const warnings = arrayValue(history).flatMap((log) => {
    const warnings = [];
    if (log.stat === "height") {
      const inches = log.heightUnit === "cm"
        ? cleanNumber(log.height, NaN) / 2.54
        : log.heightUnit === "mm"
          ? cleanNumber(log.height, NaN) / 25.4
          : log.heightMm
            ? cleanNumber(log.heightMm, NaN) / 25.4
            : cleanNumber(log.height, NaN);
      if (Number.isFinite(inches) && (inches < 15 || inches > 40)) {
        warnings.push({
          id: `growth_height_check_${log.date || "unknown"}`,
          severity: "watch",
          message: `Height entry ${log.height}${log.heightUnit || ""} on ${log.date || "unknown date"} may need verification before using it for growth review.`
        });
      }
    }
    if (log.stat === "weight") {
      const pounds = log.weightUnit === "kg"
        ? cleanNumber(log.weight, NaN) * 2.20462
        : log.weightGrams
          ? cleanNumber(log.weightGrams, NaN) / 453.59237
          : cleanNumber(log.weight, NaN);
      if (Number.isFinite(pounds) && (pounds < 3 || pounds > 40 || (Number.isFinite(ageDays) && ageDays > 90 && pounds < 7))) {
        warnings.push({
          id: `growth_weight_check_${log.date || "unknown"}`,
          severity: "watch",
          message: `Weight entry ${log.weight}${log.weightUnit || ""} on ${log.date || "unknown date"} may need verification before using it for growth review.`
        });
      }
    }
    return warnings;
  });
  return Array.from(new Map(warnings.map((warning) => [warning.id, warning])).values());
}

function formatDoctorGuideline(guideline) {
  const recommendations = Array.isArray(guideline?.recommendations) ? guideline.recommendations : [];
  if (!recommendations.length) return "Not available in doctor_guideline.json.";
  return recommendations
    .map((item) => ({
      category: item.category || "general",
      urgency: item.urgency || "as-written",
      trigger: item.trigger || "",
      summary: item.summary || "",
      action: item.action || ""
    }))
    .filter((item) => item.summary || item.action)
    .slice(0, 25);
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function loadOverviewTrendSummary() {
  try {
    return readJson(OVERVIEW_TREND_30D_PATH, null);
  } catch (error) {
    return {
      loadError: `Could not read recent-30d trend file: ${error.message || "unknown error"}`
    };
  }
}

function loadOverviewSources(input = {}) {
  const appData = loadAppData();
  const milestoneLog = loadMilestoneLog();
  const poopColors = readJson(POOP_COLORS_PATH, []);
  const overviewSettings = cleanOverviewSettings({ ...objectMap(appData.overview_settings), ...objectMap(input.overviewSettings) });
  return {
    reviewDays: Math.max(1, Math.min(14, cleanNumber(input.days, overviewSettings.reviewWindowDays))),
    overviewSettings,
    babyProfile: objectMap(appData.baby_profile),
    recentState: objectMap(appData.recent_state),
    babyLog: arrayValue(loadBabyLog()),
    milestoneLog: {
      milestone_history: arrayValue(milestoneLog.milestone_history),
      milestone_progress: objectMap(milestoneLog.milestone_progress)
    },
    doctorGuideline: objectMap(loadDoctorGuideline()),
    doctorGuidelineMarkdown: readText(DOCTOR_GUIDELINE_MD_PATH, ""),
    trendSummary30d: loadOverviewTrendSummary(),
    poopColors: arrayValue(poopColors),
    activityConfig: ACTIVITY_CONFIG,
    weather: input.weather || null
  };
}

function findPoopColor(log, poopColors) {
  const id = cleanText(log?.poopColorId || log?.poopColor);
  if (!id) return null;
  return poopColors.find((item) => item.id === id || item.label === id) || {
    id,
    label: id,
    category: "unknown",
    meaning: "",
    parentAction: ""
  };
}

function buildMilestoneOverview(milestoneLog, doctorGuideline, babyProfile) {
  const progress = objectMap(milestoneLog.milestone_progress);
  const history = arrayValue(milestoneLog.milestone_history);
  const definitions = arrayValue(doctorGuideline?.milestoneGuide?.definitions);
  const ageDays = babyAgeDays(babyProfile || {});
  const ageWeeks = Number.isFinite(ageDays) ? Math.floor(ageDays / 7) : null;
  const states = Object.values(progress).reduce((counts, item) => {
    const status = cleanText(item.state || item.status, "Not Yet");
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
  const merged = definitions
    .map((definition) => ({
      id: definition.id,
      name: definition.name,
      level: definition.level,
      ageStartWeeks: cleanNumber(definition.ageStartWeeks, 0),
      ageEndWeeks: cleanNumber(definition.ageEndWeeks, 999),
      ageLabel: definition.ageLabel || "",
      status: cleanText(progress[definition.id]?.state || progress[definition.id]?.status, "Not Yet"),
      exercises: arrayValue(definition.exercises).slice(0, 4)
    }))
    .sort((a, b) => (a.level || 0) - (b.level || 0) || a.ageStartWeeks - b.ageStartWeeks);
  const next = merged.find((item) => item.status !== "Confirmed") || null;
  const ageRelevant = Number.isFinite(ageWeeks)
    ? merged.filter((item) => item.ageStartWeeks <= ageWeeks + 8 && item.ageEndWeeks >= ageWeeks - 8).slice(0, 8)
    : merged.slice(0, 8);

  return {
    historyCount: history.length,
    recentHistory: history.slice(-5),
    trackedCount: Object.keys(progress).length,
    states,
    next,
    ageRelevant,
    definitionsCount: definitions.length
  };
}

function buildPoopColorOverview(logs, poopColors) {
  const counts = {};
  const actionFlags = [];
  const poopLogs = logs.filter((log) => log.type === "diaper" && log.poop);
  poopLogs.forEach((log) => {
    const color = findPoopColor(log, poopColors);
    if (!color) return;
    counts[color.category || "unknown"] = (counts[color.category || "unknown"] || 0) + 1;
    if (color.category && color.category !== "normal") {
      actionFlags.push({
        id: color.id,
        label: color.label || color.id,
        category: color.category,
        meaning: color.meaning || "",
        parentAction: color.parentAction || ""
      });
    }
  });
  const latestPoop = latestLog(poopLogs, () => true);
  const latestColor = findPoopColor(latestPoop, poopColors);
  return {
    counts,
    latest: latestColor ? {
      id: latestColor.id,
      label: latestColor.label,
      category: latestColor.category,
      parentAction: latestColor.parentAction || ""
    } : null,
    actionFlags: actionFlags.slice(-5)
  };
}

function overviewPriorityFromCategory(category) {
  if (category === "urgent") return "urgent";
  if (category === "call") return "call_doctor";
  if (category === "watch") return "watch";
  return "ok";
}

function overviewReviewWindow(sources) {
  const end = new Date();
  const start = new Date(end.getTime() - sources.reviewDays * 24 * 60 * 60 * 1000);
  return {
    label: `Last ${sources.reviewDays} days`,
    hours: sources.reviewDays * 24,
    start: start.toISOString(),
    end: end.toISOString()
  };
}

function approvedOverviewRecommendations(sources) {
  const recommendations = [
    { id: "track_feeds_24h", domain: "feeding", text: "Track each feed type and bottle amount for the next 24 hours." },
    { id: "track_diapers_24h", domain: "diapers", text: "Track every wet and stool diaper for the next 24 hours." },
    { id: "track_sleep_pairs", domain: "sleep", text: "Track sleep start and wake time so the app can calculate sleep duration." },
    { id: "track_growth_stats", domain: "growth", text: "Log growth measurements when they are measured with a reliable scale or tape." },
    { id: "track_milestone_progress", domain: "milestones", text: "Record milestone progress as not recorded yet, practicing, maybe, or confirmed." },
    { id: "continue_comfort_notes", domain: "comfort", text: "Keep using calming routines that continue to help baby settle." },
    { id: "check_environment_comfort", domain: "environment", text: "Use room temperature and humidity as environment context, not body temperature." }
  ];

  arrayValue(sources.poopColors).forEach((item) => {
    if (item?.parentAction) {
      recommendations.push({
        id: `poop_color_${item.id || item.label}`,
        domain: "diapers",
        text: item.parentAction
      });
    }
  });

  arrayValue(sources.doctorGuideline?.recommendations).forEach((item) => {
    const text = cleanText(item.action || item.summary);
    if (text) {
      recommendations.push({
        id: item.id || `doctor_guideline_${recommendations.length + 1}`,
        domain: item.category || "safety",
        text,
        sourceIds: arrayValue(item.sourceIds)
      });
    }
  });

  arrayValue(sources.doctorGuideline?.trustedRuleLibrary).forEach((rule) => {
    const text = cleanText(rule.parentAction);
    if (text) {
      recommendations.push({
        id: rule.id || `trusted_rule_${recommendations.length + 1}`,
        domain: rule.domain || "safety",
        text,
        priority: rule.priority || "watch",
        sourceIds: arrayValue(rule.sourceIds)
      });
    }
  });

  return recommendations;
}

function overviewSourceReferences(sources, approvedRecommendations) {
  const sourceIds = new Set();
  arrayValue(approvedRecommendations).forEach((item) => {
    arrayValue(item.sourceIds).forEach((sourceId) => sourceIds.add(sourceId));
  });
  const includeDetails = sources.overviewSettings?.reviewMode !== "gpt_strict";

  return arrayValue(sources.doctorGuideline?.trustedSourceCatalog)
    .filter((source) => sources.overviewSettings?.reviewMode === "gpt_strict" || sourceIds.has(source.id))
    .map((source) => ({
      id: source.id,
      organization: source.organization || "",
      title: source.title || source.id,
      url: source.url || "",
      ...(includeDetails ? {
        trustedFor: arrayValue(source.trustedFor).slice(0, 6),
        keyPoints: arrayValue(source.keyPoints).slice(0, 4)
      } : {})
    }));
}

function buildOverviewRuleFlags(metrics) {
  const flags = [];
  const diaperAgeMinutes = metrics.lastActivityMinutes?.diaper;
  if (!Number.isFinite(diaperAgeMinutes)) {
    flags.push({
      id: "diaper_data_missing",
      domain: "diapers",
      priority: "insufficient_data",
      confidence: "low",
      message: "Recent diaper output is unknown because no diaper timestamp is available.",
      evidenceIds: ["recent_state.lastDiaperAt"]
    });
  } else if (diaperAgeMinutes > 12 * 60) {
    flags.push({
      id: "diaper_data_stale",
      domain: "diapers",
      priority: "watch",
      confidence: "medium",
      message: "Diaper data may be stale because the last diaper record is older than expected for an overview.",
      evidenceIds: ["recent_state.lastDiaperAt"]
    });
  }

  arrayValue(metrics.poopColorSummary?.actionFlags).forEach((item) => {
    flags.push({
      id: `poop_color_${item.id || item.label || item.category}`,
      domain: "diapers",
      priority: overviewPriorityFromCategory(item.category),
      confidence: "high",
      message: `${item.label || "Stool color"} is categorized as ${item.category}.`,
      evidenceIds: [`poop_color.${item.id || item.label || item.category}`]
    });
  });

  if (!metrics.totals?.logs) {
    flags.push({
      id: "overview_data_sparse",
      domain: "safety",
      priority: "insufficient_data",
      confidence: "low",
      message: "The review window has too few logs for a confident overview.",
      evidenceIds: ["baby_log"]
    });
  }

  return flags;
}

function buildOverviewDataQuality(metrics) {
  const notes = [];
  if (!metrics.totals?.sleepEvents) {
    notes.push({
      id: "sleep_duration_missing",
      severity: "info",
      message: "Sleep duration is limited unless sleep start and wake events are paired."
    });
  }
  if (!Number.isFinite(metrics.lastActivityMinutes?.diaper) || metrics.lastActivityMinutes.diaper > 12 * 60) {
    notes.push({
      id: "diaper_stale",
      severity: "watch",
      message: "Recent diaper output is unknown because the last diaper timestamp is stale."
    });
  }
  if (!metrics.totals?.logs) {
    notes.push({
      id: "overview_sparse",
      severity: "watch",
      message: "The review has sparse recent data, so missing values should be treated as unknown."
    });
  }
  arrayValue(metrics.growth?.measurementWarnings).forEach((warning) => notes.push(warning));
  return notes;
}

function strongestOverviewPriority(flags, hasSparseData) {
  const order = ["ok", "insufficient_data", "watch", "call_doctor", "urgent"];
  const priorities = arrayValue(flags).map((flag) => flag.priority).filter((priority) => order.includes(priority));
  if (hasSparseData) priorities.push("insufficient_data");
  return priorities.sort((a, b) => order.indexOf(b) - order.indexOf(a))[0] || "ok";
}

function overviewConfidence(flags, dataQuality) {
  if (arrayValue(dataQuality).some((item) => item.severity === "watch")) return "medium";
  if (arrayValue(flags).some((item) => item.confidence === "low")) return "low";
  return "medium";
}

function overviewOverallHeadline(priority) {
  const headlines = {
    ok: "No urgent or doctor-call flags detected from available logs.",
    insufficient_data: "More logs are needed for a confident overview.",
    watch: "Watch flag detected from available logs.",
    call_doctor: "One doctor-call flag found.",
    urgent: "Urgent flag detected from available logs."
  };
  return headlines[priority] || headlines.insufficient_data;
}

function overviewOverallSummary(priority, fallback = "") {
  const summaries = {
    ok: "Available logs do not show [[important:urgent or doctor-call flags]]; missing data is still treated as unknown.",
    insufficient_data: "Available logs are limited, so missing or stale data should be treated as unknown.",
    watch: "Available logs include a watch item; keep tracking and follow the listed guidance.",
    call_doctor: "Available logs include a [[warning:doctor-call item]]; follow the listed guidance and keep tracking other care areas.",
    urgent: "Available logs include an [[urgent:urgent item]]; follow the listed urgent guidance."
  };
  return fallback || summaries[priority] || summaries.insufficient_data;
}

function splitOverviewBullets(text) {
  const sentences = cleanText(text)
    .match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)
    ?.map((item) => cleanText(item).replace(/[.!?]+$/, ""))
    .filter(Boolean) || [];
  return sentences.slice(0, 4).map((item) => item.slice(0, 180));
}

function buildSafeOverviewFallback(llamaInput, reason = "") {
  const flags = arrayValue(llamaInput.ruleFlags);
  const priority = strongestOverviewPriority(flags, !llamaInput?.metrics || !llamaInput.metrics?.feeding?.dataComplete);
  const confidence = overviewConfidence(flags, llamaInput.dataQuality);
  const diaperFlag = flags.find((flag) => flag.domain === "diapers");
  const diaperFlagText = diaperFlag?.priority === "call_doctor"
    ? "A diaper color doctor-call flag was detected; follow the listed guidance."
    : diaperFlag
      ? "Diaper data may need closer tracking today."
      : "No diaper escalation flag was detected from available logs.";
  const diaperHeadline = diaperFlag?.priority === "call_doctor"
    ? "Diaper color needs review; contact pediatrician and keep tracking"
    : diaperFlag
      ? "Diaper data needs tracking; keep recording diapers today"
      : "Diaper logs reviewed; keep tracking diaper changes";
  const nextSteps = [
    "Track feeds, diapers, and symptoms today.",
    "Follow any doctor-call guidance shown.",
    "Refresh after the next diaper or feed."
  ];
  const card = (id, title, review, cardPriority = "ok", cardConfidence = confidence) => ({
    id,
    title,
    priority: cardPriority,
    confidence: cardConfidence,
    headline: title === "Hygiene / Diaper" && diaperFlag
      ? diaperHeadline
      : `${title} logs were reviewed; keep tracking baby cues`,
    review,
    detailBullets: splitOverviewBullets(review),
    citations: []
  });

  return {
    schemaVersion: 1,
    reviewStatus: "ready",
    overall: {
      headline: overviewOverallHeadline(priority),
      priority,
      confidence,
      oneLineSummary: overviewOverallSummary(priority, reason),
      reviewText: `${llamaInput.reviewWindow?.label || "Recent logs"} were reviewed with local safety rules. Missing data is treated as unknown, not bad. ${diaperFlag ? `${diaperFlagText} ` : ""}This review stays conservative and only uses available logs.`,
      dataWindowLabel: llamaInput.reviewWindow?.label || "Last 3 days",
      lastReviewedAt: llamaInput.reviewMeta?.generatedAt || new Date().toISOString()
    },
    summaryBullets: [
      `${llamaInput.reviewWindow?.label || "Recent"} activity was reviewed from available logs.`,
      priority === "call_doctor" ? "A doctor-call flag was detected." : diaperFlag ? "Diaper data may be stale." : "No urgent or doctor-call diaper color flags were provided.",
      "Missing or unrecorded data is treated as unknown."
    ],
    cards: [
      card("eat", "Eat", llamaInput.metrics?.feeding?.dataComplete ? "Feeding logs are available for this window. This fallback cannot add deeper coaching without a completed model review." : "Feeding review is limited because some feeding metrics are missing."),
      card("sleep", "Sleep", llamaInput.metrics?.sleep?.dataComplete ? "Sleep logs are available, but complete duration depends on paired start and wake records." : "Sleep duration is limited when sleep start and wake times are not paired."),
      card("hygiene_diaper", "Hygiene / Diaper", diaperFlagText, diaperFlag?.priority || "ok", diaperFlag?.confidence || confidence),
      card("exercise", "Exercise", "Use logged milestones and tummy-time notes to guide exercise reminders. Missing exercise notes mean unknown, not a problem."),
      card("play", "Play", "Play and soothing review is based on parent notes and milestone history. Add short notes when a routine helps baby settle or practice a skill."),
      card("safety", "Safety", "Safe-sleep and emergency guidance should follow the doctor guideline knowledgebase. This fallback does not add new safety conclusions."),
      card("health", "Others", "No urgent flags detected from available logs. This review cannot evaluate symptoms that were not recorded.")
    ],
    parentNextSteps: nextSteps,
    dataQualityNotes: arrayValue(llamaInput.dataQuality).map((item) => item.message).slice(0, 5),
    reviewMeta: {
      model: llamaInput.reviewMeta?.model || LLAMA_MODEL,
      inputHash: llamaInput.reviewMeta?.inputHash || "",
      generatedAt: llamaInput.reviewMeta?.generatedAt || new Date().toISOString()
    }
  };
}

function buildOverviewMetrics(sources) {
  const allLogs = arrayValue(sources.babyLog);
  const logs = logsSinceDays(allLogs, sources.reviewDays);
  const eventConfig = objectMap(sources.activityConfig?.eventCategories);
  const byType = {};
  const quickCounts = {};
  const periodTotals = {};
  logs.forEach((log) => {
    byType[log.type] = (byType[log.type] || 0) + 1;
  });
  Object.entries(eventConfig).forEach(([type, config]) => {
    if (config?.kind === "period") {
      periodTotals[type] = periodMinutes(logs, type, config.start, config.end);
    } else {
      quickCounts[type] = byType[type] || 0;
    }
  });

  const count = (predicate) => logs.filter(predicate).length;
  const sum = (predicate, field) => logs
    .filter(predicate)
    .reduce((total, log) => total + cleanNumber(log[field], 0), 0);
  const lastFeed = latestLog(allLogs, (log) => log.type === "feeding" || log.type === "bottle");
  const lastBottle = latestLog(allLogs, (log) => log.type === "bottle");
  const lastBreast = latestLog(allLogs, (log) => log.type === "feeding");
  const lastDiaper = latestLog(allLogs, (log) => log.type === "diaper");
  const lastWetDiaper = latestLog(allLogs, (log) => log.type === "diaper" && log.pee);
  const lastSleep = latestLog(allLogs, (log) => log.type === "sleep");
  const lastOutdoor = latestLog(allLogs, (log) => log.type === "outdoor_time");
  const lastWeight = latestGrowth(allLogs, "weight");
  const lastHeight = latestGrowth(allLogs, "height");
  const ageDays = babyAgeDays(sources.babyProfile || {});
  const growthRecords = growthHistory(allLogs);

  return {
    reviewDays: sources.reviewDays,
    reviewWindow: `Last ${sources.reviewDays} days only`,
    babyProfile: {
      name: sources.babyProfile?.name || "",
      birthday: sources.babyProfile?.birthday || "",
      ageDays,
      ageWeeks: Number.isFinite(ageDays) ? Math.floor(ageDays / 7) : null,
      ageMonths: Number.isFinite(ageDays) ? +(ageDays / 30.4375).toFixed(1) : null
    },
    totals: {
      logs: logs.length,
      byType,
      quickCounts,
      periodMinutes: periodTotals,
      breastFeeds: count((log) => log.type === "feeding"),
      bottleFeeds: count((log) => log.type === "bottle"),
      bottleOunces: +sum((log) => log.type === "bottle", "ounces").toFixed(1),
      routineEvents: count((log) => log.type === "routine"),
      morningRoutines: count((log) => log.type === "routine" && log.routine === "morning"),
      naptimeRoutines: count((log) => log.type === "routine" && log.routine === "naptime"),
      bedtimeRoutines: count((log) => log.type === "routine" && log.routine === "bedtime"),
      wetDiapers: count((log) => log.type === "diaper" && log.pee),
      poops: count((log) => log.type === "diaper" && log.poop),
      sleepEvents: count((log) => log.type === "sleep"),
      sleepMinutes: periodTotals.sleep || 0,
      bathMinutes: periodTotals.bath || 0,
      tummyMinutes: periodTotals.tummy_time || 0,
      outdoorMinutes: periodTotals.outdoor_time || 0,
      growthStats: count((log) => log.type === "growth_stats"),
      babyGymEvents: count((log) => log.type === "baby_gym")
    },
    lastActivityText: {
      feed: formatDurationParts(minutesSinceLog(lastFeed)),
      bottle: formatDurationParts(minutesSinceLog(lastBottle)),
      breast: formatDurationParts(minutesSinceLog(lastBreast)),
      diaper: formatDurationParts(minutesSinceLog(lastDiaper)),
      wetDiaper: formatDurationParts(minutesSinceLog(lastWetDiaper)),
      sleepChange: formatDurationParts(minutesSinceLog(lastSleep)),
      outdoor: formatDurationParts(minutesSinceLog(lastOutdoor))
    },
    lastActivityMinutes: {
      feed: minutesSinceLog(lastFeed),
      bottle: minutesSinceLog(lastBottle),
      breast: minutesSinceLog(lastBreast),
      diaper: minutesSinceLog(lastDiaper),
      wetDiaper: minutesSinceLog(lastWetDiaper),
      sleepChange: minutesSinceLog(lastSleep),
      outdoor: minutesSinceLog(lastOutdoor)
    },
    currentSleepState: sleepState(allLogs),
    growth: {
      latestWeight: lastWeight ? compactLog(lastWeight) : null,
      latestHeight: lastHeight ? compactLog(lastHeight) : null,
      history: growthRecords,
      measurementWarnings: growthMeasurementWarnings(growthRecords, ageDays)
    },
    poopColorSummary: buildPoopColorOverview(logs, sources.poopColors),
    milestones: buildMilestoneOverview(sources.milestoneLog, sources.doctorGuideline, sources.babyProfile),
    recentLogs: logs.slice(-100).map(compactLog)
  };
}

function runOverviewRules(sources, metrics) {
  const careGuides = careGuidesFromData({ doctor_guideline: sources.doctorGuideline });
  const feedingCare = careGuides.feeding || {};
  const sleepCare = careGuides.sleep || {};
  const wetDiaperGuide = expectedWetDiapers(feedingCare, metrics.babyProfile.ageDays);
  const totals = metrics.totals || {};
  const confidence = totals.logs ? "Medium" : "Low";
  const temperature = sources.weather?.temperature;
  const humidity = sources.weather?.humidity;
  const weatherParts = [];
  if (Number.isFinite(temperature)) weatherParts.push(`${temperature}F`);
  if (Number.isFinite(humidity)) weatherParts.push(`${humidity}% humidity`);
  if (sources.weather?.description) weatherParts.push(sources.weather.description);
  const weatherText = weatherParts.length ? weatherParts.join(", ") : "No outdoor weather data available.";
  const stoolFlags = arrayValue(metrics.poopColorSummary.actionFlags);
  const latestStool = metrics.poopColorSummary.latest;
  const stoolMeaning = latestStool
    ? `${latestStool.label || latestStool.id} is categorized as ${latestStool.category || "unknown"}.`
    : "No recent stool color was logged.";
  const nextMilestone = metrics.milestones.next;
  const milestoneText = nextMilestone
    ? `Next tracked milestone: ${nextMilestone.name} (${nextMilestone.ageLabel || "age guidance available"}), currently ${nextMilestone.status}.`
    : "All listed milestone definitions are confirmed or no milestone guide is available.";

  const parentNextSteps = [
    "Keep logging feeds, diapers, sleep, growth, and milestone notes.",
    "Use Refresh after important new logs or weather changes.",
    "Call pediatrician for fever, pain, poor feeding, lethargy, unusual stool color, or parent concern."
  ];

  return {
    updatedAt: new Date().toISOString(),
    summaryTitle: `${metrics.reviewWindow}: parent overview`,
    overallStatus: stoolFlags.some((item) => item.category === "urgent" || item.category === "call") ? "Needs attention" : (totals.logs ? "Looks okay" : "Watch closely"),
    cards: [
      {
        section: "Sleep",
        recentPattern: `${formatDurationParts(totals.sleepMinutes || 0)} sleep across ${totals.sleepEvents || 0} sleep events.`,
        meaning: totals.sleepEvents ? "Recent sleep activity is available for age-aware review." : "No recent sleep logs found.",
        recommendation: sleepCare.note || "Keep logging sleep and watch sleepy cues, wake windows, and bedtime routine.",
        confidence,
        flags: []
      },
      {
        section: "Feeding",
        recentPattern: `${totals.breastFeeds || 0} breast feeds, ${totals.bottleFeeds || 0} bottles, ${totals.bottleOunces || 0} oz bottle total.`,
        meaning: totals.breastFeeds || totals.bottleFeeds ? "Recent feeding data is available." : "No recent feeding logs found.",
        recommendation: feedingCare.note || "Follow hunger and fullness cues and burp after feeds.",
        confidence,
        flags: []
      },
      {
        section: "Diapers",
        recentPattern: `${totals.wetDiapers || 0} wet diapers and ${totals.poops || 0} poops. ${stoolMeaning}`,
        meaning: wetDiaperGuide?.expected ? `Doctor guideline source expects ${wetDiaperGuide.expected}.` : "Expected wet diaper guidance is limited for this age.",
        recommendation: latestStool?.parentAction || "Keep tracking wet diapers and stool color; call pediatrician if diapers are unusually low or baby seems lethargic.",
        confidence: stoolFlags.length ? "High" : confidence,
        flags: stoolFlags.map((item) => `${item.label}: ${item.category}`)
      },
      {
        section: "Comfort / crying",
        recentPattern: `Last feed: ${metrics.lastActivityText.feed}; last wet diaper: ${metrics.lastActivityText.wetDiaper}; sleep change: ${metrics.lastActivityText.sleepChange}.`,
        meaning: "Comfort review should use feeding, diaper, burp, temperature, overtired, and sick/discomfort checks.",
        recommendation: "Use the Troubleshoot Baby cries checklist when crying is hard to settle.",
        confidence,
        flags: []
      },
      {
        section: "Outdoor / temperature",
        recentPattern: `${formatDurationParts(totals.outdoorMinutes || 0)} outdoor time. Weather: ${weatherText}`,
        meaning: "Temperature guidance depends on current weather and baby comfort signs.",
        recommendation: "Dress in layers and check chest or neck for overheating or chill.",
        confidence: Number.isFinite(temperature) ? "Medium" : "Low",
        flags: []
      },
      {
        section: "Growth / milestones",
        recentPattern: `${totals.growthStats || 0} growth stat logs, ${totals.babyGymEvents || 0} baby gym logs, ${metrics.milestones.trackedCount || 0} milestone progress records. ${milestoneText}`,
        meaning: "Milestone review uses doctor_guideline definitions and milestone_log progress/history.",
        recommendation: nextMilestone?.exercises?.length ? `Try: ${nextMilestone.exercises.join(", ")}.` : "Keep age-appropriate tummy time, play, and growth notes for pediatrician visits.",
        confidence,
        flags: []
      },
      {
        section: "Parent next steps",
        recentPattern: "Local rules reviewed the split app data before Llama.",
        meaning: "This overview should support parent decisions without diagnosing.",
        recommendation: parentNextSteps[2],
        confidence: "Medium",
        flags: []
      }
    ],
    parentNextSteps
  };
}

function buildLlamaOverviewInput(sources, metrics, ruleReview) {
  const ruleFlags = buildOverviewRuleFlags(metrics);
  const dataQuality = buildOverviewDataQuality(metrics);
  const approvedRecommendations = approvedOverviewRecommendations(sources);
  const isGptStrict = sources.overviewSettings.reviewMode === "gpt_strict";
  const feedCount72h = (metrics.totals?.breastFeeds || 0) + (metrics.totals?.bottleFeeds || 0);
  const latestWeight = metrics.growth?.latestWeight;
  const latestHeight = metrics.growth?.latestHeight;
  const growthWarnings = arrayValue(metrics.growth?.measurementWarnings);
  const latestWeightNeedsVerification = growthWarnings.some((warning) => warning.id === `growth_weight_check_${latestWeight?.date || "unknown"}`);
  const latestHeightNeedsVerification = growthWarnings.some((warning) => warning.id === `growth_height_check_${latestHeight?.date || "unknown"}`);
  return {
    schemaVersion: 1,
    babyProfile: {
      name: metrics.babyProfile.name || "Baby",
      birthday: metrics.babyProfile.birthday || "",
      ageDays: metrics.babyProfile.ageDays,
      ageWeeks: metrics.babyProfile.ageWeeks,
      timezone: sources.babyProfile?.timezone || "America/Los_Angeles"
    },
    reviewWindow: overviewReviewWindow(sources),
    recentState: sources.recentState,
    metrics: {
      feeding: {
        feedCount24h: null,
        feedCount72h,
        bottleCount72h: metrics.totals?.bottleFeeds ?? null,
        bottleOuncesTotal72h: metrics.totals?.bottleOunces ?? null,
        longestFeedGapHours: Number.isFinite(metrics.lastActivityMinutes?.feed) ? +(metrics.lastActivityMinutes.feed / 60).toFixed(1) : null,
        dataComplete: feedCount72h > 0
      },
      sleep: {
        completeSleepSessions24h: null,
        completeSleepSessions72h: metrics.totals?.sleepEvents ?? null,
        totalSleepMinutes24h: null,
        averageNapMinutes72h: metrics.totals?.sleepEvents ? Math.round((metrics.totals.sleepMinutes || 0) / Math.max(1, metrics.totals.sleepEvents / 2)) : null,
        unpairedSleepEvents: 0,
        dataComplete: Boolean(metrics.totals?.sleepEvents)
      },
      diapers: {
        wetCount24h: null,
        poopCount24h: null,
        wetCount72h: metrics.totals?.wetDiapers ?? null,
        poopCount72h: metrics.totals?.poops ?? null,
        lastDiaperAgeHours: Number.isFinite(metrics.lastActivityMinutes?.diaper) ? +(metrics.lastActivityMinutes.diaper / 60).toFixed(1) : null,
        stale: ruleFlags.some((flag) => flag.id === "diaper_data_stale"),
        stoolColorLatest: metrics.poopColorSummary?.latest || null,
        dataComplete: Boolean(metrics.totals?.wetDiapers || metrics.totals?.poops)
      },
      environment: {
        outdoorSessions72h: metrics.totals?.byType?.outdoor_time ?? null,
        outdoorMinutes72h: metrics.totals?.outdoorMinutes ?? null,
        nurseryTempMinF: sources.weather?.roomTemperatureMinF ?? null,
        nurseryTempMaxF: sources.weather?.roomTemperatureMaxF ?? null,
        nurseryHumidityAvg: sources.weather?.roomHumidityAvg ?? null,
        outdoorTemperatureF: sources.weather?.temperature ?? null,
        outdoorHumidity: sources.weather?.humidity ?? null,
        weatherDescription: sources.weather?.description || "",
        dataComplete: Number.isFinite(sources.weather?.temperature) || Number.isFinite(sources.weather?.roomTemperatureMinF)
      },
      growth: {
        latestWeightLb: latestWeightNeedsVerification ? null : (latestWeight?.weight || null),
        latestLengthIn: latestHeightNeedsVerification ? null : (latestHeight?.height || null),
        latestHeadCircumferenceCm: null,
        history: arrayValue(metrics.growth?.history),
        invalidMeasurements: growthWarnings,
        trendAvailable: arrayValue(metrics.growth?.history).length > 1
      },
      milestones: {
        confirmedCount: metrics.milestones?.states?.Confirmed || 0,
        practicingCount: metrics.milestones?.states?.Practicing || 0,
        maybeCount: metrics.milestones?.states?.Maybe || 0,
        notRecordedCount: metrics.milestones?.definitionsCount
          ? Math.max(0, metrics.milestones.definitionsCount - (metrics.milestones.trackedCount || 0))
          : null,
        nextRecordedMilestone: metrics.milestones?.next || null
      }
    },
    ruleFlags,
    recentLogs: arrayValue(metrics.recentLogs),
    approvedRecommendations: isGptStrict ? [] : approvedRecommendations,
    sourceReferences: overviewSourceReferences(sources, isGptStrict ? [] : approvedRecommendations),
    doctorGuidelineMarkdown: isGptStrict ? String(sources.doctorGuidelineMarkdown || "").slice(0, 24000) : "",
    trendSummary30d: sources.trendSummary30d || null,
    dataQuality,
    generationSettings: {
      reviewMode: sources.overviewSettings.reviewMode,
      careVoice: sources.overviewSettings.careVoice,
      maxOutputTokens: sources.overviewSettings.maxOutputTokens
    },
    reviewMeta: {
      inputHash: "",
      generatedAt: new Date().toISOString(),
      model: sources.overviewSettings.reviewMode === "gpt_strict"
        ? (sources.overviewSettings.gptModel || OPENAI_MODEL)
        : (sources.overviewSettings.llamaModel || LLAMA_MODEL)
    }
  };
}

function runLlamaOverviewReviewPrompt(llamaInput) {
  const careVoiceInstruction = llamaInput?.generationSettings?.careVoice === "pediatrician_genz_professional"
    ? "Use a cautious pediatrician-style voice: clinically grounded, warm, concise, and lightly Gen Z-professional. Casual is okay; slang must never reduce clarity or safety."
    : "Use a calm, practical, parent-friendly voice.";
  return `SYSTEM:
You are a cautious baby dashboard overview writer for parents.

Your job is to review structured baby activity logs, recent state, data quality notes, milestone progress, and the provided doctor guideline Markdown knowledgebase.

You are NOT a doctor.
You do NOT diagnose.
You do NOT invent medical causes.
You do NOT infer trouble unless the input contains a matching rule flag.
You may give practical parent tips only when they are supported by the JSON input or the doctor guideline Markdown.
You may cite only sourceReferences provided in the JSON input.

Important safety rules:
- Never say "baby is fine", "everything is normal", "guaranteed", or "no risk".
- Use "No urgent or doctor-call flags detected from available logs" only when priority is "ok".
- If priority is "call_doctor", the overall headline must mention a doctor-call flag.
- If priority is "urgent", the overall headline must mention an urgent flag.
- If data is missing, stale, invalid, or sparse, say that clearly.
- Missing data means unknown, not bad.
- Not recorded means unknown, not failed.
- Do not say baby is having trouble with sleep, feeding, diapers, outdoor time, milestones, or soothing unless the input has a specific rule flag supporting that.
- Do not recommend medication dosing.
- Do not give emergency advice unless a provided rule flag says to escalate.
- If no rule flag priority is "urgent", do not mention 911, emergency department, urgent care now, emergency signs, or seek medical care now.
- Do not recommend side/stomach sleeping.
- For sleep, only mention safe sleep as back sleep, firm flat surface, and no loose bedding if those approved recommendations are provided.
- For stool/poop color, use only the provided poop color category and action.
- For milestones, treat unrecorded items as "not recorded yet", not "not achieved".
- For Google Nest/environment values, treat room temperature as environment context only. It is not body temperature.
- Keep language calm, practical, and parent-friendly.
- The review should feel like a thoughtful pediatric dashboard note, not a list of app tasks.
- Read recentLogs and growth.history before writing tips; metrics alone are not enough.
- Read trendSummary30d for longer-term context, especially 30-day averages, variability, routine completion, and dated flags. Do not let older trends override current recentLogs and ruleFlags.
- Do not use growth.invalidMeasurements as proof of weight loss or poor growth; ask parents to verify the entry or discuss with pediatrician/lactation support.
- It is okay to suggest parent coaching from the knowledgebase, such as feeding support, nipple comfort, safe storage, tummy time, milestone-supporting exercises, or what to track next, when relevant.
- If baby appears to lose weight based on valid logged growth measurements, say this needs pediatrician/lactation discussion; do not diagnose the cause.

Emphasis markers:
- You may wrap a few important words as [[important:short phrase]].
- Use [[warning:short phrase]] for doctor-call or warning items.
- Use [[urgent:short phrase]] only for urgent/emergency rule flags.
- Do not overuse markers. Use at most 3 markers across the whole response.
- Never output HTML or Markdown emphasis.

Tone:
- ${careVoiceInstruction}
- Clear.
- Meaningful.
- Brief.
- Helpful.
- No scary wording unless a rule flag requires it.
- No fake confidence.
- No long medical lectures.

You must return valid JSON only.
Do not include markdown.
Do not include comments.
Do not include text outside JSON.

Required JSON output schema:
{
  "schemaVersion": 1,
  "reviewStatus": "ready",
  "overall": {
    "headline": string,
    "priority": "ok" | "watch" | "call_doctor" | "urgent" | "insufficient_data",
    "confidence": "high" | "medium" | "low",
    "oneLineSummary": string,
    "reviewText": string,
    "dataWindowLabel": string,
    "lastReviewedAt": string
  },
  "summaryBullets": [string],
  "cards": [
    {
      "id": "eat" | "sleep" | "hygiene_diaper" | "health" | "safety" | "exercise" | "play",
      "title": string,
      "priority": "ok" | "watch" | "call_doctor" | "urgent" | "insufficient_data",
      "confidence": "high" | "medium" | "low",
      "headline": string,
      "review": string,
      "detailBullets": [string],
      "citations": [
        {
          "sourceId": string,
          "title": string,
          "url": string
        }
      ]
    }
  ],
  "parentNextSteps": [string],
  "dataQualityNotes": [string],
  "reviewMeta": {
    "model": string,
    "inputHash": string,
    "generatedAt": string
  }
}

Card requirements:
- Include exactly 7 cards, in this order: eat, sleep, hygiene_diaper, exercise, play, safety, health.
- These cards render as: Feed, Sleep, Hygiene, Exercise, Play, Safety, Others.
- Each category card headline must be 5 to 20 words and include both what happened and what to do.
- Each category card review must be 1 to 2 sentences. Use a 3rd sentence only if the category truly needs it.
- Break the card review into 2 to 4 detailBullets. Each bullet should be short, concrete, and safe to show behind a Learn more button.
- overall.reviewText must be a concise 2 to 3 sentence parent summary.
- summaryBullets should contain 2 to 3 short bullets only.
- parentNextSteps should contain 2 to 4 practical parent actions, each 12 words or fewer.
- Match overall.headline to overall.priority. For "ok", use "No urgent or doctor-call flags detected from available logs." For "call_doctor", mention a doctor-call flag. For "urgent", mention an urgent flag.
- If data is too sparse, overall.priority should be "insufficient_data" or "watch", not "ok".
- If stale diaper data exists, say "Diaper data may be stale" instead of inventing a diaper problem.
- If recent notes say baby settles well, do not claim self-soothing trouble unless an explicit rule flag says otherwise.
- Add citations when a card uses source-backed guidance. Citation sourceId/title/url must match sourceReferences exactly.

USER:
Review this structured baby overview input and the included doctor guideline Markdown. Return the JSON output only.

INPUT_JSON:
${JSON.stringify(llamaInput, null, 2)}`;
}

async function runLlamaOverviewReview(llamaInput, input = {}) {
  const response = await postJson(LLAMA_ENDPOINT, {
    model: input.model || llamaInput.reviewMeta?.model || LLAMA_MODEL,
    prompt: runLlamaOverviewReviewPrompt(llamaInput),
    stream: false,
    format: "json",
    options: {
      temperature: 0.1,
      num_predict: Math.max(200, Math.min(1600, cleanNumber(llamaInput.generationSettings?.maxOutputTokens, 700)))
    }
  }, LLAMA_OVERVIEW_TIMEOUT_MS);
  const parsed = extractJsonObject(response.response || response.message?.content || "");
  if (!parsed) throw new Error("Llama did not return JSON overview");
  return parsed;
}

function extractOpenAIText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  const output = arrayValue(response.output);
  for (const item of output) {
    const content = arrayValue(item.content);
    for (const part of content) {
      if (typeof part.text === "string") return part.text;
    }
  }
  return "";
}

async function runGptBabyCriesRecommendation(prompt, input = {}) {
  if (!OPENAI_API_KEY) throw new Error("OpenAI API key is not configured.");
  const model = input.model || OPENAI_MODEL;
  const response = await postJson(OPENAI_ENDPOINT, {
    model,
    input: prompt,
    text: {
      format: { type: "json_object" }
    }
  }, OPENAI_OVERVIEW_TIMEOUT_MS, {
    Authorization: `Bearer ${OPENAI_API_KEY}`
  });
  const parsed = extractJsonObject(extractOpenAIText(response));
  if (!parsed) throw new Error("GPT did not return JSON recommendation");
  return parsed;
}

async function runGptOverviewReview(llamaInput, input = {}) {
  if (!OPENAI_API_KEY) throw new Error("OpenAI API key is not configured.");
  const model = input.model || llamaInput.reviewMeta?.model || OPENAI_MODEL;
  const response = await postJson(OPENAI_ENDPOINT, {
    model,
    input: runLlamaOverviewReviewPrompt(llamaInput),
    text: {
      format: { type: "json_object" }
    }
  }, OPENAI_OVERVIEW_TIMEOUT_MS, {
    Authorization: `Bearer ${OPENAI_API_KEY}`
  });
  const parsed = extractJsonObject(extractOpenAIText(response));
  if (!parsed) throw new Error("GPT did not return JSON overview");
  return parsed;
}

function validateOverviewReview(value, llamaInput) {
  const allowedPriorities = new Set(["ok", "watch", "call_doctor", "urgent", "insufficient_data"]);
  const allowedConfidence = new Set(["high", "medium", "low"]);
  const requiredCards = ["eat", "sleep", "hygiene_diaper", "exercise", "play", "safety", "health"];
  const allowedCards = new Set(requiredCards);
  const assertValid = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const cleanArray = (items, max, fallback = []) => arrayValue(items).map((item) => cleanText(String(item))).filter(Boolean).slice(0, max || undefined);
  const sourceReferencesById = new Map(arrayValue(llamaInput?.sourceReferences).map((source) => [source.id, source]));
  const splitSentences = (text) => cleanText(text).match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.map((item) => cleanText(item)).filter(Boolean) || [];
  const sentenceCount = (text) => splitSentences(text).length;
  const trimToSentences = (text, maxSentences, maxChars) => {
    const sentences = splitSentences(text);
    const trimmed = sentences.length > maxSentences ? sentences.slice(0, maxSentences).join(" ") : cleanText(text);
    return cleanText(trimmed).slice(0, maxChars);
  };
  const ruleFlags = arrayValue(llamaInput?.ruleFlags);
  const hasUrgentFlag = ruleFlags.some((flag) => flag.priority === "urgent");
  const ruleDomains = new Set(ruleFlags.map((flag) => flag.domain).filter(Boolean));
  const hasGrowthWatch = arrayValue(llamaInput?.dataQuality).some((item) => item.severity === "watch" && /growth|weight|height/i.test(item.message || item.id || ""));
  const cardDomains = {
    eat: ["feeding"],
    sleep: ["sleep"],
    hygiene_diaper: ["diapers"],
    exercise: ["milestones", "exercise"],
    play: ["milestones", "comfort"],
    safety: ["safety", "environment"],
    health: ["health", "growth"]
  };
  const normalizeCardPriority = (cardId, priority) => {
    if (!["call_doctor", "urgent"].includes(priority)) return priority;
    const domains = cardDomains[cardId] || [];
    const hasMatchingRule = domains.some((domain) => ruleDomains.has(domain));
    if (hasMatchingRule) return priority;
    if (cardId === "health" && hasGrowthWatch) return "watch";
    return "ok";
  };
  const unsupportedEmergencyPattern = /\b(call 911|emergency department|seek medical care now|urgent care now|emergency signs?)\b/i;
  const stripUnsupportedEmergencyAdvice = (text) => {
    const cleaned = cleanText(text);
    if (!cleaned || hasUrgentFlag) return cleaned;
    return splitSentences(cleaned)
      .filter((sentence) => !unsupportedEmergencyPattern.test(sentence))
      .join(" ");
  };
  const allowedMedicalText = [
    ...ruleFlags.map((flag) => `${flag.message || ""} ${arrayValue(flag.evidenceIds).join(" ")}`),
    ...arrayValue(llamaInput?.approvedRecommendations).map((item) => item.text || ""),
    ...arrayValue(llamaInput?.sourceReferences).map((source) => `${source.title || ""} ${arrayValue(source.keyPoints).join(" ")}`),
    String(llamaInput?.doctorGuidelineMarkdown || "")
  ].join(" ").toLowerCase();

  assertValid(value && typeof value === "object", "Overview review is not an object.");
  assertValid(value.schemaVersion === 1, "Overview schemaVersion is invalid.");
  assertValid(value.reviewStatus === "ready", "Overview reviewStatus is not ready.");
  assertValid(value.overall && typeof value.overall === "object", "Overview overall is missing.");
  assertValid(allowedPriorities.has(value.overall.priority), "Overview overall priority is invalid.");
  assertValid(allowedConfidence.has(value.overall.confidence), "Overview overall confidence is invalid.");
  ["headline", "oneLineSummary", "dataWindowLabel", "lastReviewedAt"].forEach((field) => {
    assertValid(cleanText(value.overall[field]), `Overview overall.${field} is missing.`);
  });
  const normalizedOverallReviewText = trimToSentences(value.overall.reviewText, 3, 520);
  assertValid(normalizedOverallReviewText, "Overview overall.reviewText is missing.");

  const cards = arrayValue(value.cards);
  assertValid(cards.length === requiredCards.length, "Overview must include exactly 7 cards.");
  requiredCards.forEach((id, index) => {
    assertValid(cards[index]?.id === id, `Overview card ${id} is missing or out of order.`);
  });

  const normalizedCards = cards.map((card) => {
    assertValid(allowedCards.has(card.id), `Overview card id is invalid: ${card.id || ""}`);
    assertValid(cleanText(card.title), `Overview card title is missing: ${card.id}`);
    assertValid(allowedPriorities.has(card.priority), `Overview card priority is invalid: ${card.id}`);
    assertValid(allowedConfidence.has(card.confidence), `Overview card confidence is invalid: ${card.id}`);
    const review = stripUnsupportedEmergencyAdvice(card.review || card.meaning);
    assertValid(review, `Overview card review is missing: ${card.id}`);
    const normalizedReview = trimToSentences(review, 3, 420);
    const rawHeadline = stripUnsupportedEmergencyAdvice(card.headline || card.summaryHeadline || card.title) || cleanText(card.title);
    const headlineWords = rawHeadline.split(/\s+/).filter(Boolean);
    const normalizedHeadline = headlineWords.length >= 5
      ? headlineWords.slice(0, 20).join(" ")
      : cleanText(`${rawHeadline || card.title}: ${splitSentences(normalizedReview)[0] || normalizedReview}`).split(/\s+/).filter(Boolean).slice(0, 20).join(" ");
    const detailBullets = cleanArray(card.detailBullets || card.bullets || card.reviewBullets, 4)
      .map((item) => stripUnsupportedEmergencyAdvice(item))
      .filter(Boolean)
      .map((item) => item.slice(0, 180));
    const normalizedDetailBullets = detailBullets.length
      ? detailBullets
      : splitOverviewBullets(normalizedReview);
    const citations = arrayValue(card.citations).map((citation) => {
      const sourceId = cleanText(citation?.sourceId || citation?.id);
      const source = sourceReferencesById.get(sourceId);
      assertValid(source && source.url, `Overview citation source is not approved: ${sourceId}`);
      return {
        sourceId,
        title: cleanText(source.title || citation?.title || sourceId).slice(0, 120),
        url: cleanText(source.url).slice(0, 300)
      };
    }).slice(0, 3);
    return {
      id: card.id,
      title: cleanText(card.title).slice(0, 80),
      priority: normalizeCardPriority(card.id, card.priority),
      confidence: card.confidence,
      headline: normalizedHeadline.slice(0, 160),
      review: normalizedReview,
      detailBullets: normalizedDetailBullets,
      citations
    };
  });

  const parentNextSteps = cleanArray(value.parentNextSteps, 4)
    .map((item) => stripUnsupportedEmergencyAdvice(item))
    .filter(Boolean);
  assertValid(parentNextSteps.length >= 1, "Overview parentNextSteps is missing.");
  assertValid(sentenceCount(parentNextSteps.join(" ")) <= 4, "Overview parentNextSteps is too long.");

  const normalized = {
    schemaVersion: 1,
    reviewStatus: "ready",
    overall: {
      headline: cleanText(value.overall.headline).slice(0, 120),
      priority: value.overall.priority,
      confidence: value.overall.confidence,
      oneLineSummary: (stripUnsupportedEmergencyAdvice(value.overall.oneLineSummary) || overviewOverallSummary(value.overall.priority)).slice(0, 220),
      reviewText: stripUnsupportedEmergencyAdvice(normalizedOverallReviewText) || overviewOverallSummary(value.overall.priority),
      dataWindowLabel: cleanText(value.overall.dataWindowLabel, llamaInput?.reviewWindow?.label || "Last 3 days").slice(0, 80),
      lastReviewedAt: cleanText(value.overall.lastReviewedAt, llamaInput?.reviewMeta?.generatedAt || new Date().toISOString())
    },
    summaryBullets: cleanArray(value.summaryBullets, 3).map((item) => stripUnsupportedEmergencyAdvice(item)).filter(Boolean).map((item) => item.slice(0, 160)),
    cards: normalizedCards,
    parentNextSteps: parentNextSteps.map((item) => item.split(/\s+/).filter(Boolean).slice(0, 12).join(" ").slice(0, 120)),
    dataQualityNotes: cleanArray(value.dataQualityNotes, 6).map((item) => item.slice(0, 180)),
    reviewMeta: {
      model: llamaInput?.reviewMeta?.model || LLAMA_MODEL,
      inputHash: llamaInput?.reviewMeta?.inputHash || "",
      generatedAt: llamaInput?.reviewMeta?.generatedAt || new Date().toISOString()
    }
  };

  const allText = JSON.stringify(normalized).toLowerCase();
  ["baby is fine", "everything is normal", "guaranteed", "definitely normal", "no risk"].forEach((phrase) => {
    assertValid(!allText.includes(phrase), `Overview contains forbidden phrase: ${phrase}`);
  });
  [
    {
      pattern: /(place|put|lay|sleep).{0,40}\bside\b/,
      allowed: [/\b(no|not|never|avoid).{0,40}\bside\b/, /\bside\/stomach\b/]
    },
    {
      pattern: /(place|put|lay|sleep).{0,40}\bstomach\b/,
      allowed: [/\b(no|not|never|avoid).{0,40}\bstomach\b/, /\bside\/stomach\b/]
    },
    {
      pattern: /(use|add|place|put|with).{0,30}loose blanket/,
      allowed: [/\b(no|not|never|avoid|without).{0,30}loose blanket/, /loose blanket.{0,30}\bout\b/]
    },
    {
      pattern: /(use|add|place|put|with).{0,30}loose bedding/,
      allowed: [/\b(no|not|never|avoid|without).{0,30}loose bedding/, /loose bedding.{0,30}\bout\b/]
    },
    {
      pattern: /(use|add|place|put|with).{0,30}\bpillow\b/,
      allowed: [/\b(no|not|never|avoid|without).{0,30}\bpillow\b/, /\bpillow\b.{0,30}\bout\b/]
    },
    { pattern: /medication dosing/, allowed: [] },
    { pattern: /\btylenol\b/, allowed: [] },
    { pattern: /\bibuprofen\b/, allowed: [] }
  ].forEach(({ pattern, allowed }) => {
    assertValid(!pattern.test(allText) || allowed.some((safePattern) => safePattern.test(allText)), "Overview contains unsafe advice.");
  });
  ["colic", "reflux", "dehydration", "infection", "fever", "failure to thrive", "developmental delay"].forEach((term) => {
    assertValid(!allText.includes(term) || allowedMedicalText.includes(term), `Overview includes unsupported medical term: ${term}`);
  });
  assertValid(
    !/\b(call 911|emergency department|seek medical care now|urgent care now)\b/.test(allText)
      || ruleFlags.some((flag) => flag.priority === "urgent"),
    "Overview gives emergency advice without an urgent rule flag."
  );
  [
    { domain: "sleep", pattern: /trouble (with )?sleep|sleep trouble|sleeping trouble/ },
    { domain: "feeding", pattern: /trouble (with )?feeding|feeding trouble/ },
    { domain: "diapers", pattern: /diaper problem|trouble (with )?diaper/ },
    { domain: "environment", pattern: /outdoor problem|trouble (with )?outdoor/ },
    { domain: "milestones", pattern: /milestone problem|milestone delay/ },
    { domain: "comfort", pattern: /self-soothing trouble|trouble soothing|having trouble soothing/ }
  ].forEach(({ domain, pattern }) => {
    assertValid(!pattern.test(allText) || ruleDomains.has(domain), `Overview infers trouble without a ${domain} rule flag.`);
  });
  assertValid(!/milestone[^.]{0,80}(failed|not achieved|delayed)/.test(allText), "Overview treats missing milestone data as failed milestone data.");

  normalized.overall.headline = overviewOverallHeadline(normalized.overall.priority);
  if (!normalized.overall.oneLineSummary || /no urgent flags/i.test(normalized.overall.oneLineSummary)) {
    normalized.overall.oneLineSummary = overviewOverallSummary(normalized.overall.priority);
  }
  if (ruleFlags.some((flag) => flag.priority === "insufficient_data") && normalized.overall.priority === "ok") {
    throw new Error("Overview uses ok priority despite insufficient data.");
  }

  return normalized;
}

function overviewInputHash(sources, metrics) {
  const guideline = sources.doctorGuideline || {};
  const milestoneDefinitions = arrayValue(guideline.milestoneGuide?.definitions);
  const hashSource = {
    reviewDays: metrics.reviewDays,
    babyProfile: metrics.babyProfile,
    recentState: sources.recentState,
    weather: sources.weather,
    activityConfig: sources.activityConfig?.eventCategories || {},
    doctorGuideline: {
      updatedAt: guideline.updatedAt || "",
      recommendationIds: arrayValue(guideline.recommendations).map((item) => item.id || item.summary || ""),
      trustedRuleIds: arrayValue(guideline.trustedRuleLibrary).map((item) => item.id || item.parentSummary || ""),
      trustedSourceIds: arrayValue(guideline.trustedSourceCatalog).map((item) => item.id || item.url || ""),
      markdownLength: String(sources.doctorGuidelineMarkdown || "").length,
      careGuideIds: Object.keys(objectMap(guideline.careGuides)),
      milestoneDefinitionIds: milestoneDefinitions.map((item) => item.id || item.name || "")
    },
    trendSummary30d: sources.trendSummary30d || null,
    poopColors: sources.poopColors.map((item) => ({
      id: item.id,
      category: item.category,
      action: item.parentAction
    })),
    totals: metrics.totals,
    lastActivityText: metrics.lastActivityText,
    poopColorSummary: metrics.poopColorSummary,
    milestones: metrics.milestones,
    recentLogs: metrics.recentLogs
  };
  return crypto.createHash("sha256").update(JSON.stringify(hashSource)).digest("hex").slice(0, 16);
}

function publishOverviewReviewAtomically(pendingReview, meta = {}) {
  const reviewUpdatedAt = cleanText(
    pendingReview.reviewMeta?.generatedAt || pendingReview.overall?.lastReviewedAt || pendingReview.updatedAt,
    meta.updatedAt || new Date().toISOString()
  );
  const publishedReview = {
    ...pendingReview,
    updatedAt: reviewUpdatedAt
  };
  return {
    status: "ready",
    review: publishedReview,
    publishedReview,
    pendingReview: null,
    source: meta.source || "rules",
    inputHash: meta.inputHash || "",
    llama: meta.llama || {},
    contextSummary: meta.contextSummary || {},
    reviewTrace: meta.reviewTrace || null,
    updatedAt: reviewUpdatedAt
  };
}

function overviewHistoryEntryId(payload) {
  return [
    payload.updatedAt || new Date().toISOString(),
    payload.source || "overview",
    payload.inputHash || ""
  ].join("-").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 96);
}

function cleanOverviewHistoryEntry(entry) {
  const source = cleanText(entry.source, "rules");
  const review = objectMap(entry.review || entry.publishedReview);
  if (!review.schemaVersion || review.reviewStatus !== "ready") return null;
  const updatedAt = cleanText(entry.updatedAt || review.updatedAt || review.overall?.lastReviewedAt, new Date().toISOString());
  const inputHash = cleanText(entry.inputHash || review.reviewMeta?.inputHash, "");
  return {
    id: cleanText(entry.id, overviewHistoryEntryId({ updatedAt, source, inputHash })),
    updatedAt,
    source,
    inputHash,
    model: cleanText(entry.model || review.reviewMeta?.model, ""),
    review,
    reviewTrace: objectMap(entry.reviewTrace)
  };
}

function overviewHistoryFromAppData(appData) {
  return arrayValue(appData.overview_history)
    .map(cleanOverviewHistoryEntry)
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, OVERVIEW_HISTORY_LIMIT);
}

function overviewHistorySummaries(entries) {
  return arrayValue(entries).map((entry) => ({
    id: entry.id,
    updatedAt: entry.updatedAt,
    source: entry.source,
    inputHash: entry.inputHash,
    model: entry.model,
    headline: entry.review?.overall?.headline || "",
    priority: entry.review?.overall?.priority || "insufficient_data",
    dataWindowLabel: entry.review?.overall?.dataWindowLabel || ""
  }));
}

function saveOverviewHistory(payload) {
  const entry = cleanOverviewHistoryEntry({
    id: overviewHistoryEntryId(payload),
    updatedAt: payload.updatedAt,
    source: payload.source,
    inputHash: payload.inputHash,
    model: payload.llama?.model,
    review: payload.publishedReview || payload.review,
    reviewTrace: payload.reviewTrace
  });
  if (!entry) return overviewHistoryFromAppData(loadAppData());

  const appData = loadAppData();
  const history = overviewHistoryFromAppData(appData)
    .filter((item) => item.id !== entry.id && !(item.inputHash === entry.inputHash && item.source === entry.source));
  appData.overview_history = [entry, ...history].slice(0, OVERVIEW_HISTORY_LIMIT);
  saveAppData(appData);
  return appData.overview_history;
}

function attachOverviewHistory(payload) {
  const history = saveOverviewHistory(payload);
  payload.overviewHistory = history;
  payload.overviewHistorySummaries = overviewHistorySummaries(history);
  return payload;
}

async function handleDashboardOverviewHistory(req, res) {
  sendJson(res, 200, {
    overviewHistory: overviewHistoryFromAppData(loadAppData()),
    limit: OVERVIEW_HISTORY_LIMIT
  });
}

async function handleDashboardOverview(req, res) {
  const traceStartedMs = Date.now();
  const reviewTrace = {
    startedAt: new Date(traceStartedMs).toISOString(),
    finishedAt: "",
    totalMs: 0,
    steps: []
  };
  const markStep = (name, startedMs, details = {}) => {
    reviewTrace.steps.push({
      name,
      ms: Date.now() - startedMs,
      details
    });
  };
  const finishTrace = (status, details = {}) => {
    reviewTrace.finishedAt = new Date().toISOString();
    reviewTrace.totalMs = Date.now() - traceStartedMs;
    reviewTrace.status = status;
    reviewTrace.details = details;
    return reviewTrace;
  };

  let stepStarted = Date.now();
  const input = await readBody(req);
  markStep("read_request", stepStarted, {
    requestedDays: input.days || null,
    requestedMode: input.overviewSettings?.reviewMode || null
  });

  stepStarted = Date.now();
  const sources = loadOverviewSources(input);
  markStep("load_overview_sources", stepStarted, {
    reviewDays: sources.reviewDays,
    reviewMode: sources.overviewSettings.reviewMode,
    careVoice: sources.overviewSettings.careVoice,
    babyLogs: sources.babyLog.length,
    guidelineMarkdownChars: String(sources.doctorGuidelineMarkdown || "").length,
    trendSummary30dLoaded: Boolean(sources.trendSummary30d && !sources.trendSummary30d.loadError),
    trendSummary30dRange: sources.trendSummary30d?.window
      ? `${sources.trendSummary30d.window.startDate || "?"} to ${sources.trendSummary30d.window.endDate || "?"}`
      : (sources.trendSummary30d?.range?.label || sources.trendSummary30d?.dateRange?.label || "")
  });

  stepStarted = Date.now();
  const metrics = buildOverviewMetrics(sources);
  markStep("build_overview_metrics", stepStarted, {
    windowLogs: metrics.totals?.logs || 0,
    recentLogs: arrayValue(metrics.recentLogs).length,
    growthHistory: arrayValue(metrics.growth?.history).length,
    invalidGrowthMeasurements: arrayValue(metrics.growth?.measurementWarnings).length
  });

  stepStarted = Date.now();
  const ruleReview = runOverviewRules(sources, metrics);
  markStep("run_overview_rules", stepStarted, {
    ruleCards: arrayValue(ruleReview.cards).length,
    localStatus: ruleReview.overallStatus || ""
  });

  stepStarted = Date.now();
  const llamaInput = buildLlamaOverviewInput(sources, metrics, ruleReview);
  markStep("build_model_input", stepStarted, {
    recentLogs: arrayValue(llamaInput.recentLogs).length,
    sourceReferences: arrayValue(llamaInput.sourceReferences).length,
    guidelineMarkdownChars: String(llamaInput.doctorGuidelineMarkdown || "").length,
    trendSummary30dChars: llamaInput.trendSummary30d ? JSON.stringify(llamaInput.trendSummary30d).length : 0,
    estimatedInputChars: JSON.stringify(llamaInput).length
  });

  stepStarted = Date.now();
  const inputHash = overviewInputHash(sources, metrics);
  markStep("compute_input_hash", stepStarted, { inputHash });

  const generatedAt = new Date().toISOString();
  const isGptReview = sources.overviewSettings.reviewMode === "gpt_strict";
  const reviewEndpoint = isGptReview ? OPENAI_ENDPOINT : LLAMA_ENDPOINT;
  const reviewModel = input.model || (isGptReview
    ? (sources.overviewSettings.gptModel || OPENAI_MODEL)
    : (sources.overviewSettings.llamaModel || LLAMA_MODEL));
  llamaInput.reviewMeta = {
    inputHash,
    generatedAt,
    model: reviewModel
  };
  if (sources.overviewSettings.reviewMode === "rules_only") {
    stepStarted = Date.now();
    const pendingReview = buildSafeOverviewFallback(llamaInput);
    markStep("generate_local_rules_review", stepStarted, { modelSkipped: true });
    stepStarted = Date.now();
    const payload = publishOverviewReviewAtomically(pendingReview, {
      source: "rules",
      inputHash,
      llama: {
        endpoint: LLAMA_ENDPOINT,
        model: llamaInput.reviewMeta.model,
        available: false,
        error: "Llama skipped by Overview settings."
      },
      contextSummary: {
        reviewWindow: llamaInput.reviewWindow,
        babyProfile: llamaInput.babyProfile,
        metrics: llamaInput.metrics,
        ruleFlags: llamaInput.ruleFlags,
        dataQuality: llamaInput.dataQuality,
        trendSummary30d: llamaInput.trendSummary30d,
        overviewSettings: sources.overviewSettings
      }
    });
    markStep("publish_review", stepStarted, { source: "rules" });
    payload.reviewTrace = finishTrace("ready", { source: "rules", model: llamaInput.reviewMeta.model });
    attachOverviewHistory(payload);
    sendJson(res, 200, payload);
    return;
  }

  try {
    if (sources.overviewSettings.reviewMode === "gpt_strict") {
      stepStarted = Date.now();
      markStep("check_openai_config", stepStarted, {
        openaiApiKeyConfigured: Boolean(OPENAI_API_KEY),
        endpoint: OPENAI_ENDPOINT,
        model: reviewModel
      });
    }
    stepStarted = Date.now();
    const rawReview = sources.overviewSettings.reviewMode === "gpt_strict"
      ? await runGptOverviewReview(llamaInput, input)
      : await runLlamaOverviewReview(llamaInput, input);
    markStep("run_model_review", stepStarted, {
      source: sources.overviewSettings.reviewMode === "gpt_strict" ? "gpt" : "llama",
      endpoint: reviewEndpoint,
      model: reviewModel
    });
    stepStarted = Date.now();
    const pendingReview = validateOverviewReview(rawReview, llamaInput);
    markStep("validate_model_review", stepStarted, {
      cards: arrayValue(pendingReview.cards).length,
      parentNextSteps: arrayValue(pendingReview.parentNextSteps).length
    });
    stepStarted = Date.now();
    const payload = publishOverviewReviewAtomically(pendingReview, {
      source: sources.overviewSettings.reviewMode === "gpt_strict" ? "gpt" : "llama",
      inputHash,
      llama: {
        endpoint: reviewEndpoint,
        model: reviewModel,
        available: true,
        error: ""
      },
      contextSummary: {
        reviewWindow: llamaInput.reviewWindow,
        babyProfile: llamaInput.babyProfile,
        metrics: llamaInput.metrics,
        ruleFlags: llamaInput.ruleFlags,
        dataQuality: llamaInput.dataQuality,
        trendSummary30d: llamaInput.trendSummary30d
      }
    });
    markStep("publish_review", stepStarted, { source: payload.source });
    payload.reviewTrace = finishTrace("ready", { source: sources.overviewSettings.reviewMode === "gpt_strict" ? "gpt" : "llama", model: reviewModel });
    attachOverviewHistory(payload);
    sendJson(res, 200, payload);
  } catch (error) {
    markStep("review_failed", stepStarted, {
      error: error.message || "Overview generation failed validation."
    });
    sendJson(res, 422, {
      status: "error",
      fallback: {
        headline: "Overview could not be refreshed.",
        oneLineSummary: "Showing the last completed review. Try Refresh again in a moment.",
        priority: "insufficient_data",
        confidence: "low"
      },
      source: "error",
      error: error.message || "Overview generation failed validation.",
      inputHash,
      llama: {
        endpoint: reviewEndpoint,
        model: reviewModel,
        available: false,
        error: error.message || "Overview generation failed validation."
      },
      reviewTrace: finishTrace("error", {
        source: sources.overviewSettings.reviewMode === "gpt_strict" ? "gpt" : "llama",
        model: reviewModel,
        error: error.message || "Overview generation failed validation."
      }),
      updatedAt: generatedAt
    });
  }
}

async function handleUpdateProfile(req, res) {
  const input = await readBody(req);
  const data = loadData();
  data.baby_profile = data.baby_profile || {};
  data.baby_profile.birthday = typeof input.birthday === "string" ? input.birthday : data.baby_profile.birthday || "";
  saveData(data);
  sendJson(res, 200, { profile: data.baby_profile });
}

async function handleUpdateSoundSettings(req, res) {
  const input = await readBody(req);
  const data = loadData();
  const current = data.sound_settings || {};
  data.sound_settings = {
    bathSoundEnabled: typeof input.bathSoundEnabled === "boolean" ? input.bathSoundEnabled : Boolean(current.bathSoundEnabled),
    tummySoundEnabled: typeof input.tummySoundEnabled === "boolean" ? input.tummySoundEnabled : Boolean(current.tummySoundEnabled)
  };
  saveData(data);
  sendJson(res, 200, { sound_settings: data.sound_settings });
}

async function handleUpdateUnitSettings(req, res) {
  const input = await readBody(req);
  const data = loadData();
  data.unit_settings = cleanUnitSettings({ ...objectMap(data.unit_settings), ...objectMap(input) });
  saveData(data);
  sendJson(res, 200, { unit_settings: data.unit_settings });
}

async function handleUpdateOverviewSettings(req, res) {
  const input = await readBody(req);
  const data = loadData();
  data.overview_settings = cleanOverviewSettings({ ...objectMap(data.overview_settings), ...objectMap(input) });
  saveData(data);
  sendJson(res, 200, { overview_settings: data.overview_settings });
}

async function handleUpdateChildProofProgress(req, res) {
  const input = objectMap(await readBody(req));
  const id = cleanText(input.id);
  if (!id) {
    sendJson(res, 400, { error: "Child proof item id is required." });
    return;
  }
  const data = loadData();
  data.child_proof_progress = objectMap(data.child_proof_progress);
  if (input.checked === true) {
    data.child_proof_progress[id] = {
      checked: true,
      updatedAt: new Date().toISOString()
    };
  } else {
    delete data.child_proof_progress[id];
  }
  saveData(data);
  sendJson(res, 200, { child_proof_progress: data.child_proof_progress });
}

async function handleUpdateDiaperBagProgress(req, res) {
  const input = objectMap(await readBody(req));
  const id = cleanText(input.id);
  if (!id) {
    sendJson(res, 400, { error: "Diaper bag item id is required." });
    return;
  }
  const data = loadData();
  data.diaper_bag_progress = objectMap(data.diaper_bag_progress);
  if (input.checked === true) {
    data.diaper_bag_progress[id] = {
      checked: true,
      updatedAt: new Date().toISOString()
    };
  } else {
    delete data.diaper_bag_progress[id];
  }
  saveData(data);
  sendJson(res, 200, { diaper_bag_progress: data.diaper_bag_progress });
}

async function handleUpdateScheduleLog(req, res, date) {
  const input = objectMap(await readBody(req));
  const cleanDate = String(date || input.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    sendJson(res, 400, { error: "Schedule log date must use YYYY-MM-DD." });
    return;
  }

  const logs = loadScheduleLogs();
  const existing = logs.find((log) => log.date === cleanDate) || {};
  const nextLog = {
    ...existing,
    date: cleanDate,
    templateId: typeof input.templateId === "string" ? input.templateId : existing.templateId || "",
    rows: Array.isArray(input.rows) ? input.rows : arrayValue(existing.rows),
    notes: typeof input.notes === "string" ? input.notes : existing.notes || "",
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const nextLogs = logs.filter((log) => log.date !== cleanDate);
  nextLogs.push(nextLog);
  saveScheduleLogs(nextLogs);
  if (cleanDate >= todayDateString()) updateScheduleTemplateRows(nextLog.templateId, nextLog.rows);
  sendJson(res, 200, { schedule_log: nextLog, schedule_logs: loadScheduleLogs() });
}

async function handleGenerateAllMetrics(req, res) {
  const result = saveAllMetrics();
  const { metrics, ...summary } = result;
  sendJson(res, 200, summary);
}

async function handleGenerateDailyMetrics(req, res) {
  const input = await readBody(req);
  const days = input.days === "all" ? "all" : Math.max(1, Math.min(10000, Math.round(cleanNumber(input.days, 7))));
  sendJson(res, 200, saveDailyMetrics(days));
}

async function handleGenerateTrendMetrics(req, res) {
  sendJson(res, 200, saveTrendMetrics());
}

async function handleUpdateMilestone(req, res, id) {
  const input = await readBody(req);
  const legacyStatuses = {
    Upcoming: "Not Yet",
    Achieved: "Confirmed",
    practicing: "Practicing",
    achieved: "Confirmed",
    "not-yet": "Not Yet",
    maybe: "Maybe",
    confirmed: "Confirmed"
  };
  const statuses = new Set(["Not Yet", "Maybe", "Practicing", "Confirmed"]);
  const nextState = statuses.has(input.state) ? input.state : (statuses.has(input.status) ? input.status : legacyStatuses[input.status]);
  if (!statuses.has(nextState)) {
    sendJson(res, 400, { error: "Invalid milestone status" });
    return;
  }

  const data = loadData();
  data.milestone_progress = objectMap(data.milestone_progress);
  data.milestone_progress[id] = {
    milestoneId: id,
    state: nextState,
    status: nextState,
    changedDate: typeof input.changedDate === "string" ? input.changedDate : new Date().toISOString(),
    achievedDate: typeof input.achievedDate === "string" ? input.achievedDate : null,
    confirmedAt: typeof input.confirmedAt === "string" ? input.confirmedAt : null,
    notes: typeof input.notes === "string" ? input.notes : data.milestone_progress[id]?.notes || ""
  };
  saveData(data);
  sendJson(res, 200, { milestone_progress: data.milestone_progress });
}

async function handleClearLogs(req, res) {
  const data = loadData();
  data.baby_log = [];
  data.milestone_progress = {};
  data.child_proof_progress = {};
  data.diaper_bag_progress = {};
  const recent = rebuildRecent(data);
  saveData(data);
  saveRecent(recent);
  sendJson(res, 200, {
    recent,
    todaySummary: summarizeToday(data),
    milestone_progress: data.milestone_progress,
    child_proof_progress: data.child_proof_progress,
    diaper_bag_progress: data.diaper_bag_progress
  });
}

function exportResponse(res, filePath) {
  sendFile(res, filePath, true);
}

function handleExport(req, res, endpoint) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const range = resolveRange(Object.fromEntries(url.searchParams));
  const data = loadData();
  const report = makeReport(data, range, endpoint === "pediatrician-report");

  if (endpoint === "json") return exportResponse(res, saveJson(data, range));
  if (endpoint === "csv") return exportResponse(res, saveCsv(report));
  if (endpoint === "xlsx") return exportResponse(res, saveXlsx(report));
  if (endpoint === "pdf") return exportResponse(res, savePdf(report));
  if (endpoint === "pediatrician-report") return exportResponse(res, savePdf(report, true));

  sendJson(res, 404, { error: "Unknown export endpoint" });
}

async function handleServerControl(req, res, url) {
  if (!isLocalRequest(req)) {
    sendJson(res, 403, { error: "Server control is only available from localhost." });
    return;
  }

  const targetMatch = url.pathname.match(/^\/api\/server-control\/([^/]+)\/(start|stop)$/);
  if (req.method === "GET" && url.pathname === "/api/server-control/status") {
    sendJson(res, 200, { servers: await getServerStatuses() });
    return;
  }

  if (!targetMatch || req.method !== "POST") {
    sendJson(res, 404, { error: "Unknown server-control endpoint" });
    return;
  }

  const target = findServerTarget(targetMatch[1]);
  const action = targetMatch[2];
  if (!target) {
    sendJson(res, 404, { error: "Unknown server target" });
    return;
  }

  const before = await serverStatusForPort(target.port);
  if (action === "start") {
    if (before.running) {
      sendJson(res, 200, { server: { ...target, ...before }, message: "Already running." });
      return;
    }

    const pid = startServerTarget(target);
    await new Promise((resolve) => setTimeout(resolve, 650));
    const after = await serverStatusForPort(target.port);
    sendJson(res, 200, { server: { ...target, ...after }, startedPid: pid });
    return;
  }

  if (!before.running || !before.pid) {
    sendJson(res, 200, { server: { ...target, ...before }, message: "Already stopped." });
    return;
  }

  const result = await stopServerPid(before.pid);
  if (result === "self") {
    sendJson(res, 200, { server: { ...target, running: false, pid: null }, message: "Stopping current server." });
    setTimeout(() => process.exit(0), 150);
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 650));
  const after = await serverStatusForPort(target.port);
  sendJson(res, 200, { server: { ...target, ...after } });
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const acceptsWebp = (req.headers.accept || "").includes("image/webp");
  if (acceptsWebp && [".png", ".jpg", ".jpeg"].includes(ext)) {
    const webpPath = filePath.replace(/\.(png|jpe?g)$/i, ".webp");
    if (fs.existsSync(webpPath)) {
      sendFile(res, webpPath, false, { Vary: "Accept" });
      return;
    }
  }

  sendFile(res, filePath);
}

async function handlePostLog(req, res) {
  const input = await readBody(req);
  const data = loadData();
  const recent = loadRecent();
  const log = buildLog(input);

  data.baby_log = Array.isArray(data.baby_log) ? data.baby_log : [];
  const existing = data.baby_log.find((item) => item.id === log.id);
  if (existing) {
    sendJson(res, 200, {
      log: existing,
      recent,
      todaySummary: summarizeToday(data)
    });
    return;
  }

  const conflict = validatePairedTransition(data.baby_log, log, undefined, {
    ignoreFutureNext: !input.date && !input.time
  });
  if (conflict) {
    sendJson(res, 409, { error: conflict });
    return;
  }
  data.baby_log.push(log);

  const nextRecent = updateRecent(recent, log);
  saveData(data);
  saveRecent(nextRecent);

  sendJson(res, 201, {
    log,
    recent: nextRecent,
    todaySummary: summarizeToday(data)
  });
}

async function handleUpdateLog(req, res, id) {
  const input = await readBody(req);
  const data = loadData();
  data.baby_log = Array.isArray(data.baby_log) ? data.baby_log : [];

  const index = data.baby_log.findIndex((log) => log.id === id);
  if (index === -1) {
    sendJson(res, 404, { error: "Log not found" });
    return;
  }

  const current = data.baby_log[index];
  const next = {
    ...current,
    date: input.date || current.date,
    time: input.time || current.time,
    notes: typeof input.notes === "string" ? input.notes : current.notes
  };

  if (current.type === "sleep" || current.type === "tummy_time" || current.type === "outdoor_time") {
    next.status = input.status || current.status;
  }

  if (current.type === "bath") {
    next.status = input.status || current.status;
  }

  if (current.type === "feeding") {
    next.side = input.side || current.side;
  }

  if (current.type === "bottle") {
    next.ounces = cleanNumber(input.ounces, current.ounces || 0);
    if (input.milkType) {
      next.milkType = cleanMilkType(input.milkType, current.milkType || "formula");
      next.notes = `${milkTypeLabel(next.milkType)} bottle feed`;
    }
  }

  if (current.type === "diaper") {
    if (input.kind === "pee" || input.kind === "poop") {
      next.pee = input.kind === "pee";
      next.poop = input.kind === "poop";
    }
    if (next.poop) {
      if (typeof input.poopColorId === "string") {
        next.poopColorId = cleanText(input.poopColorId);
        next.poopColor = next.poopColorId;
      }
      if (typeof input.consistency === "string") {
        next.consistency = cleanText(input.consistency);
        next.poopTexture = next.consistency;
      }
    } else {
      delete next.poopColorId;
      delete next.poopColor;
      delete next.consistency;
      delete next.poopTexture;
    }
  }

  if (current.type === "growth_stats") {
    next.stat = input.stat === "height" || current.stat === "height" ? "height" : "weight";
    if (next.stat === "weight") {
      next.weightUnit = ["oz", "lb", "g", "kg"].includes(input.weightUnit) ? input.weightUnit : current.weightUnit || "lb";
      next.weight = cleanNumber(input.weight, current.weight || 0);
      next.weightGrams = weightToGrams(next.weight, next.weightUnit);
      delete next.height;
      delete next.heightUnit;
      delete next.heightMm;
      next.notes = typeof input.notes === "string" ? input.notes : `Weight ${next.weight} ${next.weightUnit}`;
    } else {
      next.heightUnit = ["in", "ft", "cm", "mm"].includes(input.heightUnit) ? input.heightUnit : current.heightUnit || "in";
      next.height = cleanNumber(input.height, current.height || 0);
      next.heightMm = heightToMm(next.height, next.heightUnit);
      delete next.weight;
      delete next.weightUnit;
      delete next.weightGrams;
      next.notes = typeof input.notes === "string" ? input.notes : `Height ${next.height} ${next.heightUnit}`;
    }
  }

  const conflict = validatePairedTransition(data.baby_log, next, current.id);
  if (conflict) {
    sendJson(res, 409, { error: conflict });
    return;
  }

  data.baby_log[index] = next;
  const recent = rebuildRecent(data);
  saveData(data);
  saveRecent(recent);

  sendJson(res, 200, {
    log: next,
    recent,
    todaySummary: summarizeToday(data)
  });
}

async function handleDeleteLog(req, res, id) {
  const data = loadData();
  data.baby_log = Array.isArray(data.baby_log) ? data.baby_log : [];

  const nextLogs = data.baby_log.filter((log) => log.id !== id);
  if (nextLogs.length === data.baby_log.length) {
    sendJson(res, 404, { error: "Log not found" });
    return;
  }

  data.baby_log = nextLogs;
  const recent = rebuildRecent(data);
  saveData(data);
  saveRecent(recent);

  sendJson(res, 200, {
    deletedId: id,
    recent,
    todaySummary: summarizeToday(data)
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const match = url.pathname.match(/^\/api\/export\/(json|csv|xlsx|pdf|pediatrician-report)$/);

    if (url.pathname.startsWith("/api/server-control")) {
      await handleServerControl(req, res, url);
      return;
    }

    if (req.method === "GET" && match) {
      handleExport(req, res, match[1]);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/app-data") {
      sendJson(res, 200, { ...loadData(), recent_state: loadRecent() });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/logs") {
      const logs = loadData().baby_log || [];
      const days = url.searchParams.get("days");
      sendJson(res, 200, days ? recentNativeLogs(logs, days) : logs);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/poop-colors") {
      sendJson(res, 200, readJson(POOP_COLORS_PATH, []));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/doctor-guideline") {
      sendJson(res, 200, loadData().doctor_guideline || {});
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/schedule-templates") {
      sendJson(res, 200, { templates: loadScheduleTemplates() });
      return;
    }
    const scheduleTemplateResetMatch = url.pathname.match(/^\/api\/schedule-templates\/([^/]+)\/reset\/?$/);
    if (req.method === "POST" && scheduleTemplateResetMatch) {
      const template = resetScheduleTemplateRows(decodeURIComponent(scheduleTemplateResetMatch[1]));
      if (!template) {
        sendJson(res, 404, { error: "Doctor schedule template not found." });
        return;
      }
      sendJson(res, 200, { template, templates: loadScheduleTemplates() });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/schedule-logs") {
      sendJson(res, 200, { schedule_logs: loadScheduleLogs() });
      return;
    }

    const scheduleLogMatch = url.pathname.match(/^\/api\/schedule-logs\/(\d{4}-\d{2}-\d{2})\/?$/);
    if (scheduleLogMatch) {
      if (!["PUT", "POST", "PATCH"].includes(req.method)) {
        sendJson(res, 405, { error: `Use PUT, POST, or PATCH to update a schedule log. Received ${req.method}.` });
        return;
      }
      await handleUpdateScheduleLog(req, res, scheduleLogMatch[1]);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/logs") {
      await handlePostLog(req, res);
      return;
    }

    if (req.method === "DELETE" && url.pathname === "/api/logs") {
      await handleClearLogs(req, res);
      return;
    }

    const updateMatch = url.pathname.match(/^\/api\/logs\/([^/]+)\/?$/);
    if (updateMatch) {
      const id = decodeURIComponent(updateMatch[1]);
      if (req.method === "PUT") {
        await handleUpdateLog(req, res, id);
        return;
      }
      if (req.method === "DELETE") {
        await handleDeleteLog(req, res, id);
        return;
      }
      sendJson(res, 405, { error: `Use PUT or DELETE for a log. Received ${req.method}.` });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/recent") {
      sendJson(res, 200, loadRecent());
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/profile") {
      await handleUpdateProfile(req, res);
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/sound-settings") {
      await handleUpdateSoundSettings(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/unit-settings") {
      sendJson(res, 200, { unit_settings: cleanUnitSettings(loadData().unit_settings) });
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/unit-settings") {
      await handleUpdateUnitSettings(req, res);
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/overview-settings") {
      await handleUpdateOverviewSettings(req, res);
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/child-proof-progress") {
      await handleUpdateChildProofProgress(req, res);
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/diaper-bag-progress") {
      await handleUpdateDiaperBagProgress(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/analytics/all-metrics") {
      await handleGenerateAllMetrics(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/analytics/daily") {
      await handleGenerateDailyMetrics(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/analytics/trends") {
      await handleGenerateTrendMetrics(req, res);
      return;
    }

    const milestoneMatch = url.pathname.match(/^\/api\/milestones\/([^/]+)\/?$/);
    if (milestoneMatch) {
      if (!["PUT", "POST", "PATCH"].includes(req.method)) {
        sendJson(res, 405, { error: `Use PUT, POST, or PATCH to update a milestone. Received ${req.method}.` });
        return;
      }
      await handleUpdateMilestone(req, res, decodeURIComponent(milestoneMatch[1]));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/today-summary") {
      sendJson(res, 200, summarizeToday(loadData()));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/troubleshoot/baby-cries") {
      await handleBabyCriesTroubleshoot(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/dashboard-overview-history") {
      await handleDashboardOverviewHistory(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/dashboard-overview") {
      await handleDashboardOverview(req, res);
      return;
    }

    if (req.method === "GET") {
      serveStatic(req, res);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Phuong Nam Logbook running on port ${PORT}`);
  console.log(`Data mode: ${APP_DATA_MODE}`);
  console.log(`Data root: ${DATA_ROOT}`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Shared data directory: ${SHARED_DATA_DIR}`);
});
