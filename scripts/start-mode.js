const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = path.join(__dirname, "..");
const defaultDataRoot = path.join("C:", "codelab", "databases", "TinyNewbornLog");
const dataRoot = process.env.DATA_ROOT ? path.resolve(process.env.DATA_ROOT) : defaultDataRoot;
const mode = normalizeMode(process.argv[2]);
const defaultPorts = { prod: "3002", dev: "3003", staging: "3004" };
const port = process.argv[3] || defaultPorts[mode] || "3002";

function usage() {
  console.log("Usage:");
  console.log("  node scripts/start-mode.js dev 3003");
  console.log("  node scripts/start-mode.js staging 3004");
  console.log("  node scripts/start-mode.js prod 3002");
}

function normalizeMode(name) {
  if (name === "demo") return "dev";
  if (name === "real") return "prod";
  return name;
}

function cleanName(name) {
  if (!/^[a-z0-9_-]+$/i.test(name || "")) {
    throw new Error("Mode name may only contain letters, numbers, underscores, and hyphens.");
  }
  return name;
}

try {
  const modeName = cleanName(mode);
  const dataDir = path.join(dataRoot, modeName);
  const sharedDataDir = path.join(dataRoot, "shared");
  if (!fs.existsSync(dataDir)) {
    throw new Error(`Data mode "${modeName}" does not exist at ${dataDir}`);
  }
  if (!fs.existsSync(sharedDataDir)) {
    throw new Error(`Shared data directory does not exist at ${sharedDataDir}`);
  }

  console.log(`Starting ${modeName} data mode on http://localhost:${port}`);
  console.log(`Data root: ${dataRoot}`);

  const child = spawn(process.execPath, [path.join(root, "backend", "server.js"), port], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      APP_DATA_MODE: modeName,
      DATA_ROOT: dataRoot,
      DATA_DIR: dataDir,
      SHARED_DATA_DIR: sharedDataDir,
      PORT: port
    }
  });

  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code || 0);
  });
} catch (error) {
  console.error(error.message);
  usage();
  process.exit(1);
}
