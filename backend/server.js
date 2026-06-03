const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  loadData,
  makeReport,
  resolveRange,
  saveCsv,
  saveJson,
  savePdf,
  saveXlsx
} = require("./exportService");

const PORT = process.argv[2] || process.env.PORT || 3002;
const PUBLIC_DIR = path.join(__dirname, "..", "frontend");
const DATA_PATH = path.join(__dirname, "..", "data", "appData.json");
const RECENT_PATH = path.join(__dirname, "..", "data", "recentInfo.json");
const POOP_COLORS_PATH = path.join(__dirname, "..", "data", "poop-colors.json");
const FEEDING_CARE_PATH = path.join(PUBLIC_DIR, "data", "care", "feeding-cheatsheet.json");
const SLEEP_CARE_PATH = path.join(PUBLIC_DIR, "data", "care", "sleep-card-info.json");
const LLAMA_ENDPOINT = process.env.LLAMA_ENDPOINT || "http://localhost:11434/api/generate";
const LLAMA_MODEL = process.env.LLAMA_MODEL || "llama3.2";
const LLAMA_TIMEOUT_MS = cleanNumber(process.env.LLAMA_TIMEOUT_MS, 30000);
const BABY_CRIES_REVIEW_DAYS = 30;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".pdf": "application/pdf",
  ".csv": "text/csv; charset=utf-8",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

const EVENT_CATEGORY_CONFIG = {
  sleep: { kind: "period", start: "asleep", end: "awake", startLabel: "asleep", endLabel: "awake" },
  tummy_time: { kind: "period", start: "start", end: "end", startLabel: "started", endLabel: "ended" },
  outdoor_time: { kind: "period", start: "start", end: "end", startLabel: "started", endLabel: "ended" },
  bath: { kind: "period", start: "start", end: "end", startLabel: "started", endLabel: "stopped" },
  feeding: { kind: "quick" },
  bottle: { kind: "quick" },
  diaper: { kind: "quick" },
  growth_stats: { kind: "quick" },
  baby_gym: { kind: "quick" }
};

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function objectMap(value) {
  return value && !Array.isArray(value) && typeof value === "object" ? value : {};
}

function loadRecent() {
  const data = readJson(DATA_PATH, {});
  return readJson(RECENT_PATH, {
    bottleOunces: 2.5,
    nextBreastSide: "left",
    lastActivityAt: null,
    lastFeedAt: data.recent_state?.last_feed || null,
    lastSleepAt: data.recent_state?.last_sleep || null,
    lastDiaperAt: data.recent_state?.last_diaper || null,
    notes: data.recent_state?.notes || ""
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function postJson(targetUrl, payload, timeoutMs = 7000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const client = parsed.protocol === "https:" ? require("https") : require("http");
    const body = JSON.stringify(payload);
    const request = client.request({
      method: "POST",
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: `${parsed.pathname}${parsed.search}`,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
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
          reject(new Error(`Llama returned ${response.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(responseBody));
        } catch {
          reject(new Error("Llama response was not valid JSON"));
        }
      });
    });

    request.on("timeout", () => request.destroy(new Error("Llama request timed out")));
    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

function sendFile(res, filePath, download = false) {
  const ext = path.extname(filePath);
  const headers = { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" };
  if (download) headers["Content-Disposition"] = `attachment; filename="${path.basename(filePath)}"`;
  if ([".html", ".css", ".js"].includes(ext)) {
    headers["Cache-Control"] = "no-store, max-age=0";
  }
  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
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
  const base = {
    id: makeId(),
    date: input.date || stamp.date,
    time: input.time || stamp.time,
    type: input.type,
    timestamp: stamp.iso,
    createdAt: stamp.iso
  };

  if (input.type === "sleep") {
    return { ...base, status: input.status, notes: input.status === "asleep" ? "Baby fell asleep" : "Baby woke up" };
  }

  if (input.type === "feeding" && input.method === "breast") {
    return { ...base, method: "breast", side: input.side, notes: `Started on ${input.side} side` };
  }

  if (input.type === "bottle") {
    return { ...base, ounces: cleanNumber(input.ounces, 0), notes: "Bottle feed" };
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
  }

  return recent;
}

function rebuildRecent(data) {
  const recent = {
    bottleOunces: 2.5,
    nextBreastSide: "left",
    lastActivityAt: null,
    lastFeedAt: null,
    lastSleepAt: null,
    lastDiaperAt: null,
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

function compactLog(log) {
  const copy = {
    type: log.type,
    date: log.date,
    time: log.time,
    status: log.status || undefined,
    method: log.method || undefined,
    side: log.side || undefined,
    ounces: log.ounces || undefined,
    pee: log.pee || undefined,
    poop: log.poop || undefined,
    poopColorId: log.poopColorId || log.poopColor || undefined,
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

function buildBabyCriesContext(input = {}) {
  const data = readJson(DATA_PATH, {});
  const logs = Array.isArray(data.baby_log) ? data.baby_log : [];
  const feedingCare = readJson(FEEDING_CARE_PATH, {});
  const sleepCare = readJson(SLEEP_CARE_PATH, {});
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
  let llamaError = "";

  try {
    const response = await postJson(LLAMA_ENDPOINT, {
      model: input.model || LLAMA_MODEL,
      prompt,
      stream: false,
      format: "json",
      options: { temperature: 0.2 }
    }, LLAMA_TIMEOUT_MS);
    const parsed = extractJsonObject(response.response || response.message?.content || "");
    if (!parsed) throw new Error("Llama did not return JSON recommendation");
    recommendation = validateBabyCriesRecommendation(parsed);
    recommendation.inspections = fallback.inspections;
    source = "llama";
  } catch (error) {
    llamaError = error.message;
    recommendation = validateBabyCriesRecommendation(fallback);
  }

  sendJson(res, 200, {
    recommendation,
    source,
    prompt,
    llama: {
      endpoint: LLAMA_ENDPOINT,
      model: input.model || LLAMA_MODEL,
      available: source === "llama",
      error: source === "llama" ? "" : (llamaError || "Llama unavailable; fallback used.")
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

async function handleUpdateProfile(req, res) {
  const input = await readBody(req);
  const data = readJson(DATA_PATH, {});
  data.baby_profile = data.baby_profile || {};
  data.baby_profile.birthday = typeof input.birthday === "string" ? input.birthday : data.baby_profile.birthday || "";
  writeJson(DATA_PATH, data);
  sendJson(res, 200, { profile: data.baby_profile });
}

async function handleUpdateSoundSettings(req, res) {
  const input = await readBody(req);
  const data = readJson(DATA_PATH, {});
  const current = data.sound_settings || {};
  data.sound_settings = {
    bathSoundEnabled: typeof input.bathSoundEnabled === "boolean" ? input.bathSoundEnabled : Boolean(current.bathSoundEnabled),
    tummySoundEnabled: typeof input.tummySoundEnabled === "boolean" ? input.tummySoundEnabled : Boolean(current.tummySoundEnabled)
  };
  writeJson(DATA_PATH, data);
  sendJson(res, 200, { sound_settings: data.sound_settings });
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

  const data = readJson(DATA_PATH, {});
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
  writeJson(DATA_PATH, data);
  sendJson(res, 200, { milestone_progress: data.milestone_progress });
}

async function handleClearLogs(req, res) {
  const data = readJson(DATA_PATH, {});
  data.baby_log = [];
  data.milestone_progress = {};
  const recent = rebuildRecent(data);
  writeJson(DATA_PATH, data);
  writeJson(RECENT_PATH, recent);
  sendJson(res, 200, {
    recent,
    todaySummary: summarizeToday(data),
    milestone_progress: data.milestone_progress
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

  sendFile(res, filePath);
}

async function handlePostLog(req, res) {
  const input = await readBody(req);
  const data = readJson(DATA_PATH, {});
  const recent = loadRecent();
  const log = buildLog(input);

  data.baby_log = Array.isArray(data.baby_log) ? data.baby_log : [];
  const conflict = validatePairedTransition(data.baby_log, log, undefined, {
    ignoreFutureNext: !input.date && !input.time
  });
  if (conflict) {
    sendJson(res, 409, { error: conflict });
    return;
  }
  data.baby_log.push(log);

  const nextRecent = updateRecent(recent, log);
  writeJson(DATA_PATH, data);
  writeJson(RECENT_PATH, nextRecent);

  sendJson(res, 201, {
    log,
    recent: nextRecent,
    todaySummary: summarizeToday(data)
  });
}

async function handleUpdateLog(req, res, id) {
  const input = await readBody(req);
  const data = readJson(DATA_PATH, {});
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
  writeJson(DATA_PATH, data);
  writeJson(RECENT_PATH, recent);

  sendJson(res, 200, {
    log: next,
    recent,
    todaySummary: summarizeToday(data)
  });
}

async function handleDeleteLog(req, res, id) {
  const data = readJson(DATA_PATH, {});
  data.baby_log = Array.isArray(data.baby_log) ? data.baby_log : [];

  const nextLogs = data.baby_log.filter((log) => log.id !== id);
  if (nextLogs.length === data.baby_log.length) {
    sendJson(res, 404, { error: "Log not found" });
    return;
  }

  data.baby_log = nextLogs;
  const recent = rebuildRecent(data);
  writeJson(DATA_PATH, data);
  writeJson(RECENT_PATH, recent);

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

    if (req.method === "GET" && match) {
      handleExport(req, res, match[1]);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/app-data") {
      sendJson(res, 200, { ...loadData(), recent_state: loadRecent() });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/logs") {
      sendJson(res, 200, loadData().baby_log || []);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/poop-colors") {
      sendJson(res, 200, readJson(POOP_COLORS_PATH, []));
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
});
