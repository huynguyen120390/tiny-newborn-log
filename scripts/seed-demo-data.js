const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dataDir = path.join(root, "data");
const appDataPath = path.join(dataDir, "app_data.json");
const babyLogPath = path.join(dataDir, "baby_log.json");
const milestoneLogPath = path.join(dataDir, "milestone_log.json");
const legacyDataPath = path.join(dataDir, "appData.json");
const legacyRecentPath = path.join(dataDir, "recentInfo.json");
const backupStamp = new Date().toISOString().replace(/[:.]/g, "-");

let seed = 20260606;
let logCounter = 0;

function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

function pick(items) {
  return items[Math.floor(random() * items.length)];
}

function chance(value) {
  return random() < value;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function backup(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const parsed = path.parse(filePath);
  const backupPath = path.join(parsed.dir, `${parsed.name}.backup-before-demo-${backupStamp}${parsed.ext}`);
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function localDate(year, month, day) {
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function parseBirthday(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return localDate(2025, 12, 1);
  return localDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function addDays(date, days) {
  return localDate(date.getFullYear(), date.getMonth() + 1, date.getDate() + days);
}

function atMinutes(day, minutes) {
  const next = new Date(day);
  next.setHours(0, 0, 0, 0);
  return addMinutes(next, minutes);
}

function makeLog(date, type, fields = {}) {
  const id = `sim-${dateKey(date)}-${pad(++logCounter)}-${type}`;
  const createdAt = date.toISOString();
  return {
    id,
    date: dateKey(date),
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    type,
    timestamp: createdAt,
    createdAt,
    ...fields
  };
}

function weightForAge(ageDays) {
  const base = 7.45;
  const gain = Math.min(ageDays, 190) * 0.043;
  const wobble = Math.sin(ageDays / 11) * 0.12 + (random() - 0.5) * 0.08;
  return Number((base + gain + wobble).toFixed(2));
}

function heightForAge(ageDays) {
  const base = 20.1;
  const gain = Math.min(ageDays, 190) * 0.022;
  const wobble = Math.sin(ageDays / 17) * 0.08 + (random() - 0.5) * 0.06;
  return Number((base + gain + wobble).toFixed(2));
}

function simulationLogs(startDate, endDate, cutoff) {
  const logs = [];
  const normalPoopColors = ["mustard-yellow", "yellow", "green", "tan", "brown"];
  const normalPoopTextures = ["seedy", "soft", "loose", "pasty"];
  const healthNotes = [
    "A little gassy but settled after burping.",
    "Fussy stretch in the evening, then calmed with cuddles.",
    "Short nap day; feeding and diapers stayed normal.",
    "Mild spit-up after bottle, no other concern noted.",
    "Wanted extra soothing before sleep.",
    "Cheerful wake window with normal energy."
  ];

  for (let day = new Date(startDate); day <= endDate; day = addDays(day, 1)) {
    const ageDays = Math.round((day - startDate) / 86400000);
    const ageMonth = Math.floor(ageDays / 30);
    const growthPhase = Math.min(ageMonth, 6);
    const fussyDay = ageDays > 7 && chance(0.16);
    const sleepyDay = ageDays > 14 && chance(0.12);
    const clusterFeedDay = ageDays < 120 && chance(0.13);
    const feedCount = Math.max(5, 9 - Math.floor(growthPhase / 2) + (clusterFeedDay ? 1 : 0));
    const firstFeed = 4 * 60 + 45 + Math.floor(random() * 80);

    for (let i = 0; i < feedCount; i += 1) {
      const interval = Math.floor(135 + growthPhase * 12 + random() * 45);
      const feedAt = atMinutes(day, firstFeed + i * interval + Math.floor((random() - 0.5) * 24));
      const bottleDay = ageDays > 5 && chance(0.42 + growthPhase * 0.04);

      if (bottleDay) {
        const milkType = chance(ageDays < 60 ? 0.62 : 0.48) ? "breast_milk" : "formula";
        const ounces = Number((2.1 + growthPhase * 0.32 + random() * 1.15 + (clusterFeedDay ? -0.25 : 0)).toFixed(2));
        const note = chance(0.12) ? pick(["Small spit-up after bottle.", "Paused for burp halfway.", "Took bottle slowly but finished."]) : `${milkType === "breast_milk" ? "Breast Milk" : "Formula"} bottle feed`;
        logs.push(makeLog(feedAt, "bottle", { ounces: Math.max(1.6, ounces), milkType, notes: note }));
      } else {
        const side = chance(0.5) ? "left" : "right";
        logs.push(makeLog(feedAt, "feeding", { method: "breast", side, notes: `Started on ${side} side` }));
      }

      if (chance(0.76)) {
        const peeAt = addMinutes(feedAt, 20 + Math.floor(random() * 105));
        logs.push(makeLog(peeAt, "diaper", { pee: true, poop: false, notes: "Wee diaper" }));
      }

      const poopChance = Math.max(0.2, 0.58 - growthPhase * 0.06);
      if (chance(poopChance)) {
        const poopAt = addMinutes(feedAt, 35 + Math.floor(random() * 170));
        const poopColorId = ageDays <= 2 ? "dark-brown-black" : pick(normalPoopColors);
        const consistency = ageDays <= 2 ? "sticky" : pick(normalPoopTextures);
        logs.push(makeLog(poopAt, "diaper", {
          pee: false,
          poop: true,
          poopColorId,
          poopColor: poopColorId,
          consistency,
          poopTexture: consistency,
          notes: `${poopColorId.replace(/-/g, " ")} poo diaper`
        }));
      }
    }

    const nightSleep = sleepyDay ? 340 + growthPhase * 26 : 260 + growthPhase * 28;
    const sleepBlocks = [
      [0 * 60 + Math.floor(random() * 35), nightSleep],
      [8 * 60 + 35 + Math.floor(random() * 55), 45 + random() * 75],
      [12 * 60 + 40 + Math.floor(random() * 60), 55 + random() * 95],
      [16 * 60 + 30 + Math.floor(random() * 70), 35 + random() * 65],
      [20 * 60 + Math.floor(random() * 60), 120 + growthPhase * 18 + random() * 85]
    ];

    sleepBlocks.forEach(([startMinute, duration]) => {
      const adjusted = Math.max(22, Math.floor(duration + (fussyDay ? -18 : 0)));
      const start = atMinutes(day, startMinute);
      logs.push(makeLog(start, "sleep", { status: "asleep", notes: "Baby fell asleep" }));
      logs.push(makeLog(addMinutes(start, adjusted), "sleep", { status: "awake", notes: "Baby woke up" }));
    });

    const tummySessions = ageDays < 10 ? 1 : ageDays < 60 ? 2 : 3;
    for (let i = 0; i < tummySessions; i += 1) {
      const start = atMinutes(day, 10 * 60 + i * 155 + Math.floor(random() * 45));
      const minutes = Math.max(3, Math.floor(4 + growthPhase * 3.5 + random() * 8 + (fussyDay ? -2 : 0)));
      logs.push(makeLog(start, "tummy_time", { status: "start", notes: "Tummy time started" }));
      logs.push(makeLog(addMinutes(start, minutes), "tummy_time", { status: "end", notes: "Tummy time ended" }));
    }

    if (chance(0.5)) {
      const outdoor = atMinutes(day, 14 * 60 + Math.floor(random() * 150));
      const minutes = 12 + Math.floor(random() * 34);
      logs.push(makeLog(outdoor, "outdoor_time", { status: "start", notes: "Outdoor time started" }));
      logs.push(makeLog(addMinutes(outdoor, minutes), "outdoor_time", { status: "end", notes: "Outdoor time ended" }));
    }

    if (chance(0.38)) {
      const bath = atMinutes(day, 17 * 60 + Math.floor(random() * 110));
      logs.push(makeLog(bath, "bath", { status: "start", notes: "Bath started" }));
      logs.push(makeLog(addMinutes(bath, 7 + Math.floor(random() * 12)), "bath", { status: "end", notes: "Bath ended" }));
    }

    if (chance(0.7)) {
      const gym = atMinutes(day, 15 * 60 + Math.floor(random() * 100));
      logs.push(makeLog(gym, "baby_gym", { notes: fussyDay ? "Gentle baby gym; shorter session today." : "Baby gym time" }));
    }

    if (chance(0.62)) {
      const routine = atMinutes(day, 19 * 60 + 15 + Math.floor(random() * 75));
      logs.push(makeLog(routine, "routine", {
        routine: "bedtime",
        notes: fussyDay ? pick(healthNotes) : "Bedtime routine done"
      }));
    }

    if (ageDays % 7 === 0 || dateKey(day) === dateKey(endDate)) {
      const weightAt = atMinutes(day, 9 * 60 + Math.floor(random() * 50));
      const heightAt = addMinutes(weightAt, 8);
      const weight = weightForAge(ageDays);
      const height = heightForAge(ageDays);
      logs.push(makeLog(weightAt, "growth_stats", {
        stat: "weight",
        weight,
        weightUnit: "lb",
        weightGrams: Math.round(weight * 453.59237),
        notes: `Weight ${weight} lb`
      }));
      logs.push(makeLog(heightAt, "growth_stats", {
        stat: "height",
        height,
        heightUnit: "in",
        heightMm: Math.round(height * 25.4),
        notes: `Height ${height} in`
      }));
    }
  }

  return logs
    .filter((log) => new Date(log.createdAt) <= cutoff)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function latest(logs, test) {
  return [...logs].reverse().find(test)?.createdAt || null;
}

function latestLog(logs, test) {
  return [...logs].reverse().find(test) || null;
}

const appData = readJson(appDataPath, {});
const birthday = parseBirthday(appData.baby_profile?.birthday);
const now = new Date();
const today = new Date(now);
today.setHours(0, 0, 0, 0);

const backups = [appDataPath, babyLogPath, milestoneLogPath, legacyDataPath, legacyRecentPath]
  .map(backup)
  .filter(Boolean);

const babyLog = simulationLogs(birthday, today, now);
const latestBottle = latestLog(babyLog, (log) => log.type === "bottle");
const latestBreastMilkBottle = latestLog(babyLog, (log) => log.type === "bottle" && log.milkType === "breast_milk");
const latestFormulaBottle = latestLog(babyLog, (log) => log.type === "bottle" && log.milkType === "formula");

const nextAppData = {
  ...appData,
  baby_profile: {
    ...(appData.baby_profile || {}),
    name: appData.baby_profile?.name || "Phuong Nam Cu Ti",
    birthday: dateKey(birthday),
    timezone: appData.baby_profile?.timezone || "America/Los_Angeles"
  },
  recent_state: {
    ...(appData.recent_state || {}),
    bottleOunces: latestBottle?.ounces || 2.5,
    formulaBottleOunces: latestFormulaBottle?.ounces || latestBottle?.ounces || 2.5,
    breastMilkBottleOunces: latestBreastMilkBottle?.ounces || latestBottle?.ounces || 2.5,
    lastBottleMilkType: latestBottle?.milkType || "breast_milk",
    nextBreastSide: "right",
    lastActivityAt: latest(babyLog, () => true),
    lastFeedAt: latest(babyLog, (log) => log.type === "feeding" || log.type === "bottle"),
    lastSleepAt: latest(babyLog, (log) => log.type === "sleep"),
    lastDiaperAt: latest(babyLog, (log) => log.type === "diaper"),
    lastRoutineAt: latest(babyLog, (log) => log.type === "routine"),
    lastOutdoorTimeAt: latest(babyLog, (log) => log.type === "outdoor_time"),
    lastGrowthStatsAt: latest(babyLog, (log) => log.type === "growth_stats"),
    lastTummyTimeAt: latest(babyLog, (log) => log.type === "tummy_time"),
    lastBathAt: latest(babyLog, (log) => log.type === "bath"),
    lastBabyGymAt: latest(babyLog, (log) => log.type === "baby_gym"),
    notes: "Simulation data: healthy baby pattern with normal ups and downs like fussy evenings, short naps, gassy feeds, and occasional spit-up."
  },
  foods: [
    { date: "2026-05-03", food: "Vitamin D drops", reaction: "none", notes: "Tolerated well" },
    { date: "2026-05-22", food: "Iron supplement", reaction: "none", notes: "No reaction observed" }
  ]
};

const milestoneLog = {
  milestone_history: [
    { id: "m1", date: "2026-01-15", title: "Turns toward parent voice", category: "Social" },
    { id: "m2", date: "2026-02-08", title: "First social smiles", category: "Social" },
    { id: "m3", date: "2026-03-12", title: "Longer tummy head lift", category: "Motor" },
    { id: "m4", date: "2026-04-21", title: "Reaches toward toy", category: "Motor" },
    { id: "m5", date: "2026-05-18", title: "Laughs during peekaboo", category: "Social" }
  ],
  milestone_progress: {
    "first-smile": {
      milestoneId: "first-smile",
      state: "Confirmed",
      status: "Confirmed",
      changedDate: "2026-02-08T18:30:00.000Z",
      achievedDate: "2026-02-08",
      confirmedAt: "2026-02-08T18:30:00.000Z",
      notes: "Social smiles showing up consistently."
    },
    "rolling-over": {
      milestoneId: "rolling-over",
      state: "Practicing",
      status: "Practicing",
      changedDate: "2026-06-03T18:45:00.000Z",
      achievedDate: null,
      confirmedAt: null,
      notes: "Rolling practice during play, not fully confirmed yet."
    }
  }
};

writeJson(appDataPath, nextAppData);
writeJson(babyLogPath, babyLog);
writeJson(milestoneLogPath, milestoneLog);

writeJson(legacyDataPath, {
  ...readJson(legacyDataPath, {}),
  baby_profile: nextAppData.baby_profile,
  recent_state: nextAppData.recent_state,
  milestones: milestoneLog.milestone_history,
  milestone_progress: milestoneLog.milestone_progress,
  foods: nextAppData.foods,
  baby_log: babyLog
});
writeJson(legacyRecentPath, nextAppData.recent_state);

console.log(`Cleared active logs and seeded ${babyLog.length} simulation logs from ${dateKey(birthday)} to ${dateKey(today)}.`);
console.log(`Backups created: ${backups.length ? backups.join(", ") : "none"}`);
