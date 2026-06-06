const fs = require("fs");
const path = require("path");

const defaultDataRoot = path.join("C:", "codelab", "databases", "TinyNewbornLog");
const dataRoot = process.env.DATA_ROOT ? path.resolve(process.env.DATA_ROOT) : defaultDataRoot;
const sourceDir = process.env.STAGING_SOURCE_DIR ? path.resolve(process.env.STAGING_SOURCE_DIR) : path.join(dataRoot, "prod");
const stagingDir = process.env.STAGING_DIR ? path.resolve(process.env.STAGING_DIR) : path.join(dataRoot, "staging");
const backupDir = path.join(dataRoot, "backups");

const files = [
  "app_data.json",
  "baby_log.json",
  "milestone_log.json",
  "appData.json",
  "recentInfo.json"
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function backupExistingStaging() {
  if (!fs.existsSync(stagingDir)) return null;
  const backupPath = path.join(backupDir, `staging-before-refresh-${stamp()}`);
  ensureDir(backupPath);
  for (const file of files) {
    const source = path.join(stagingDir, file);
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, path.join(backupPath, file));
    }
  }
  return backupPath;
}

function isPrivateTextKey(key) {
  return /(^|_)(note|notes|comment|comments|description|details|private)(_|$)/i.test(key);
}

function isContactKey(key) {
  return /(email|phone|address|street|zip|postal)/i.test(key);
}

function sanitize(value, trail = []) {
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitize(item, trail.concat(String(index))));
  }

  if (!value || typeof value !== "object") return value;

  const next = {};
  for (const [key, child] of Object.entries(value)) {
    const lowerKey = key.toLowerCase();
    const nextTrail = trail.concat(key);
    const pathKey = nextTrail.join(".");

    if (pathKey === "baby_profile.name") {
      next[key] = "Staging Baby";
    } else if (pathKey === "babyProfile.name") {
      next[key] = "Staging Baby";
    } else if (isContactKey(lowerKey)) {
      next[key] = typeof child === "string" && child ? `staging-${lowerKey}` : child;
    } else if (isPrivateTextKey(lowerKey)) {
      next[key] = typeof child === "string" && child.trim() ? "Staging note redacted from real data." : child;
    } else {
      next[key] = sanitize(child, nextTrail);
    }
  }
  return next;
}

function createStagingData() {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source data directory does not exist: ${sourceDir}`);
  }

  ensureDir(stagingDir);
  ensureDir(backupDir);
  const backupPath = backupExistingStaging();

  for (const file of files) {
    const source = path.join(sourceDir, file);
    if (!fs.existsSync(source)) continue;
    writeJson(path.join(stagingDir, file), sanitize(readJson(source)));
  }

  writeJson(path.join(stagingDir, "_staging_metadata.json"), {
    generatedAt: new Date().toISOString(),
    source: sourceDir,
    policy: "Production-like data with baby/profile names, notes, comments, descriptions, details, and contact fields sanitized.",
    backupPath
  });

  console.log(`Staging data refreshed at ${stagingDir}`);
  if (backupPath) console.log(`Previous staging data backed up at ${backupPath}`);
}

try {
  createStagingData();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
