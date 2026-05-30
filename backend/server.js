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

const PORT = process.argv[2] || process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "..", "frontend");
const DATA_PATH = path.join(__dirname, "..", "data", "appData.json");
const RECENT_PATH = path.join(__dirname, "..", "data", "recentInfo.json");

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

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
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

function pairedConfig(type) {
  const configs = {
    sleep: { start: "asleep", end: "awake", startLabel: "asleep", endLabel: "awake" },
    tummy_time: { start: "start", end: "end", startLabel: "started", endLabel: "ended" },
    bath: { start: "start", end: "end", startLabel: "started", endLabel: "stopped" }
  };
  return configs[type] || null;
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

function validatePairedTransition(logs, candidate, excludeId) {
  const config = pairedConfig(candidate.type);
  if (!config || !candidate.status) return "";

  const atTime = logTime(candidate);
  const activeBefore = isActiveAt(logs, candidate.type, atTime, excludeId);
  const isStart = candidate.status === config.start;
  const isEnd = candidate.status === config.end;

  if (isStart && activeBefore) return `Already ${config.startLabel}. Stop first to avoid overlapping time.`;
  if (isEnd && !activeBefore) return `Already ${config.endLabel}. Start first before stopping.`;

  const next = nextTimedStatus(logs, candidate.type, atTime, excludeId);
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
    return {
      ...base,
      pee: input.kind === "pee",
      poop: input.kind === "poop",
      notes: input.kind === "poop" ? "Poo diaper" : "Wee diaper"
    };
  }

  if (input.type === "bath") {
    return { ...base, status: input.status || "start", notes: input.status === "end" ? "Bath ended" : "Bath started" };
  }

  if (input.type === "tummy_time") {
    return { ...base, status: input.status, notes: input.status === "start" ? "Tummy time started" : "Tummy time ended" };
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
  if (log.type === "baby_gym") recent.lastBabyGymAt = log.createdAt;

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
    babyGymEvents: count((log) => log.type === "baby_gym")
  };
}

async function handleUpdateProfile(req, res) {
  const input = await readBody(req);
  const data = readJson(DATA_PATH, {});
  data.baby_profile = data.baby_profile || {};
  data.baby_profile.birthday = typeof input.birthday === "string" ? input.birthday : data.baby_profile.birthday || "";
  writeJson(DATA_PATH, data);
  sendJson(res, 200, { profile: data.baby_profile });
}

async function handleClearLogs(req, res) {
  const data = readJson(DATA_PATH, {});
  data.baby_log = [];
  const recent = rebuildRecent(data);
  writeJson(DATA_PATH, data);
  writeJson(RECENT_PATH, recent);
  sendJson(res, 200, {
    recent,
    todaySummary: summarizeToday(data)
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
  const conflict = validatePairedTransition(data.baby_log, log);
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

  if (current.type === "sleep" || current.type === "tummy_time") {
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
      if (req.method !== "PUT") {
        sendJson(res, 405, { error: `Use PUT to update a log. Received ${req.method}.` });
        return;
      }
      await handleUpdateLog(req, res, decodeURIComponent(updateMatch[1]));
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

    if (req.method === "GET" && url.pathname === "/api/today-summary") {
      sendJson(res, 200, summarizeToday(loadData()));
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
