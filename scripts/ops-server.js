const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile, spawn } = require("child_process");

const ROOT_DIR = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "frontend");
const DATA_ROOT = process.env.DATA_ROOT ? path.resolve(process.env.DATA_ROOT) : path.join("C:", "codelab", "databases", "TinyNewbornLog");
const SHARED_DATA_DIR = path.join(DATA_ROOT, "shared");
const PORT = process.env.OPS_PORT || process.argv[2] || 3010;

const SERVER_TARGETS = [
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
  ".png": "image/png"
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath);
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    "Cache-Control": [".html", ".css", ".js"].includes(ext) ? "no-store, max-age=0" : "public, max-age=300"
  });
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

function isLocalRequest(req) {
  const address = req.socket.remoteAddress || "";
  return address === "::1" || address === "127.0.0.1" || address === "::ffff:127.0.0.1";
}

function targetById(id) {
  return SERVER_TARGETS.find((target) => target.id === id);
}

async function statusForPort(port) {
  const { stdout } = await runCommand("netstat.exe", ["-ano", "-p", "tcp"]);
  const match = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.match(/^TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)$/i))
    .find((parts) => parts && Number(parts[1]) === Number(port));

  return {
    running: Boolean(match),
    pid: match ? Number(match[2]) : null
  };
}

async function allStatuses() {
  const statuses = [];
  for (const target of SERVER_TARGETS) {
    statuses.push({ ...target, ...(await statusForPort(target.port)) });
  }
  return statuses;
}

function startTarget(target) {
  const out = fs.openSync(path.join(ROOT_DIR, `${target.id}-server.out.log`), "a");
  const err = fs.openSync(path.join(ROOT_DIR, `${target.id}-server.err.log`), "a");
  const dataDir = path.join(DATA_ROOT, target.mode);
  const child = spawn(process.execPath, [path.join(ROOT_DIR, "backend", "server.js"), String(target.port)], {
    cwd: ROOT_DIR,
    detached: true,
    stdio: ["ignore", out, err],
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

async function handleApi(req, res, url) {
  if (!isLocalRequest(req)) {
    sendJson(res, 403, { error: "Server control is only available from localhost." });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/server-control/status") {
    sendJson(res, 200, { servers: await allStatuses(), managerPort: Number(PORT) });
    return;
  }

  const match = url.pathname.match(/^\/api\/server-control\/([^/]+)\/(start|stop)$/);
  if (!match || req.method !== "POST") {
    sendJson(res, 404, { error: "Unknown server-control endpoint" });
    return;
  }

  const target = targetById(match[1]);
  const action = match[2];
  if (!target) {
    sendJson(res, 404, { error: "Unknown server target" });
    return;
  }

  const before = await statusForPort(target.port);
  if (action === "start") {
    if (!before.running) startTarget(target);
    await new Promise((resolve) => setTimeout(resolve, 800));
    sendJson(res, 200, { server: { ...target, ...(await statusForPort(target.port)) } });
    return;
  }

  if (before.pid) {
    await runCommand("taskkill.exe", ["/PID", String(before.pid), "/T", "/F"]);
  }
  await new Promise((resolve) => setTimeout(resolve, 800));
  sendJson(res, 200, { server: { ...target, ...(await statusForPort(target.port)) } });
}

function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/ops.html" : url.pathname;
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

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/server-control")) {
      await handleApi(req, res, url);
      return;
    }
    serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`TinyNewbornLog server control running on http://localhost:${PORT}`);
});
