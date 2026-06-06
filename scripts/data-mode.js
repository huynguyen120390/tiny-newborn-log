const fs = require("fs");
const path = require("path");

const defaultDataRoot = path.join("C:", "codelab", "databases", "TinyNewbornLog");
const dataRoot = process.env.DATA_ROOT ? path.resolve(process.env.DATA_ROOT) : defaultDataRoot;
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(dataRoot, "prod");
const modesDir = dataRoot;
const files = [
  "app_data.json",
  "baby_log.json",
  "milestone_log.json",
  "appData.json",
  "recentInfo.json"
];

function usage() {
  console.log("Usage:");
  console.log("  node scripts/data-mode.js list");
  console.log("  node scripts/data-mode.js snapshot <name>");
  console.log("  node scripts/data-mode.js use <name>");
  console.log("");
  console.log("Examples:");
  console.log("  node scripts/data-mode.js use dev");
  console.log("  node scripts/data-mode.js use prod");
  console.log("");
  console.log(`Data root: ${dataRoot}`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function cleanName(name) {
  if (name === "demo") return "dev";
  if (name === "real") return "prod";
  if (!/^[a-z0-9_-]+$/i.test(name || "")) {
    throw new Error("Mode name may only contain letters, numbers, underscores, and hyphens.");
  }
  return name;
}

function copyExisting(fromDir, toDir) {
  ensureDir(toDir);
  files.forEach((file) => {
    const from = path.join(fromDir, file);
    if (fs.existsSync(from)) {
      fs.copyFileSync(from, path.join(toDir, file));
    }
  });
}

function requireCompleteMode(name) {
  const modeDir = path.join(modesDir, name);
  const missing = files.filter((file) => !fs.existsSync(path.join(modeDir, file)));
  if (missing.length) {
    throw new Error(`Mode "${name}" is missing: ${missing.join(", ")}`);
  }
  return modeDir;
}

function listModes() {
  ensureDir(modesDir);
  const modes = fs.readdirSync(modesDir, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .filter((item) => files.every((file) => fs.existsSync(path.join(modesDir, item.name, file))))
    .map((item) => item.name)
    .sort();
  console.log(modes.length ? modes.join("\n") : "No data modes saved yet.");
}

function snapshot(name) {
  const modeName = cleanName(name);
  const modeDir = path.join(modesDir, modeName);
  copyExisting(dataDir, modeDir);
  console.log(`Saved current data as mode "${modeName}".`);
}

function useMode(name) {
  const modeName = cleanName(name);
  const modeDir = requireCompleteMode(modeName);
  const backupName = `autosave-before-${modeName}-${stamp()}`;
  copyExisting(dataDir, path.join(modesDir, backupName));
  copyExisting(modeDir, dataDir);
  console.log(`Switched to data mode "${modeName}".`);
  console.log(`Previous active data saved as "${backupName}".`);
}

const [command, name] = process.argv.slice(2);

try {
  if (command === "list") listModes();
  else if (command === "snapshot" && name) snapshot(name);
  else if (command === "use" && name) useMode(name);
  else usage();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
