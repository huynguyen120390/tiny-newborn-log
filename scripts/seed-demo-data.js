const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dataPath = path.join(root, "data", "appData.json");
const recentPath = path.join(root, "data", "recentInfo.json");
const backupPath = path.join(root, "data", `appData.backup-before-demo-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);

const startDate = new Date("2025-12-01T00:00:00-08:00");
const endDate = new Date("2026-05-31T00:00:00-07:00");
let seed = 20260531;
let logCounter = 0;

function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

function pick(items) {
  return items[Math.floor(random() * items.length)];
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function atMinutes(day, minutes) {
  const next = new Date(day);
  next.setHours(0, 0, 0, 0);
  return addMinutes(next, minutes);
}

function makeLog(date, type, fields = {}) {
  const id = `demo-${dateKey(date)}-${pad(++logCounter)}-${type}`;
  return {
    id,
    date: dateKey(date),
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    type,
    createdAt: date.toISOString(),
    ...fields
  };
}

function demoLogs() {
  const logs = [];
  for (let day = new Date(startDate); day <= endDate; day.setDate(day.getDate() + 1)) {
    const dayIndex = Math.round((day - startDate) / 86400000);
    const ageMonth = Math.floor(dayIndex / 30);
    const feedCount = Math.max(5, 9 - Math.floor(ageMonth / 2));
    const firstFeed = 5 * 60 + Math.floor(random() * 70);

    for (let i = 0; i < feedCount; i += 1) {
      const feedAt = atMinutes(day, firstFeed + i * Math.floor(150 + random() * 55));
      if (random() < 0.55) {
        const side = random() < 0.5 ? "left" : "right";
        logs.push(makeLog(feedAt, "feeding", { method: "breast", side, notes: `Started on ${side} side` }));
      } else {
        const ounces = Number((2.2 + ageMonth * 0.35 + random() * 1.4).toFixed(2));
        logs.push(makeLog(feedAt, "bottle", { ounces, notes: "Bottle feed" }));
      }

      if (random() < 0.72) {
        const peeAt = addMinutes(feedAt, 25 + Math.floor(random() * 115));
        logs.push(makeLog(peeAt, "diaper", { pee: true, poop: false, notes: "Wee diaper" }));
      }
      if (random() < Math.max(0.18, 0.44 - ageMonth * 0.04)) {
        const poopAt = addMinutes(feedAt, 40 + Math.floor(random() * 190));
        logs.push(makeLog(poopAt, "diaper", { pee: false, poop: true, notes: "Poo diaper" }));
      }
    }

    const sleepStarts = [
      0 * 60 + Math.floor(random() * 40),
      9 * 60 + Math.floor(random() * 45),
      13 * 60 + Math.floor(random() * 55),
      19 * 60 + Math.floor(random() * 70)
    ];
    sleepStarts.forEach((startMinute, index) => {
      const start = atMinutes(day, startMinute);
      const baseDuration = index === 0 ? 260 + ageMonth * 22 : index === 3 ? 290 + ageMonth * 28 : 55 + random() * 85;
      const end = addMinutes(start, Math.floor(baseDuration + random() * 35));
      logs.push(makeLog(start, "sleep", { status: "asleep", notes: "Baby fell asleep" }));
      logs.push(makeLog(end, "sleep", { status: "awake", notes: "Baby woke up" }));
    });

    const tummySessions = ageMonth < 1 ? 1 : ageMonth < 3 ? 2 : 3;
    for (let i = 0; i < tummySessions; i += 1) {
      const start = atMinutes(day, 10 * 60 + i * 160 + Math.floor(random() * 45));
      const minutes = 4 + ageMonth * 3 + Math.floor(random() * 8);
      logs.push(makeLog(start, "tummy_time", { status: "start", notes: "Tummy time started" }));
      logs.push(makeLog(addMinutes(start, minutes), "tummy_time", { status: "end", notes: "Tummy time ended" }));
    }

    if (random() < 0.42) {
      const bath = atMinutes(day, 17 * 60 + Math.floor(random() * 110));
      logs.push(makeLog(bath, "bath", { status: "start", notes: "Bath started" }));
      logs.push(makeLog(addMinutes(bath, 8 + Math.floor(random() * 12)), "bath", { status: "end", notes: "Bath ended" }));
    }

    if (random() < 0.72) {
      const gym = atMinutes(day, 15 * 60 + Math.floor(random() * 90));
      logs.push(makeLog(gym, "baby_gym", { notes: "Baby gym time" }));
    }
  }
  return logs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function latest(logs, test) {
  return [...logs].reverse().find(test)?.createdAt || null;
}

const current = fs.existsSync(dataPath) ? JSON.parse(fs.readFileSync(dataPath, "utf8").replace(/^\uFEFF/, "")) : {};
if (fs.existsSync(dataPath)) fs.copyFileSync(dataPath, backupPath);

const babyLog = demoLogs();
const appData = {
  ...current,
  baby_profile: {
    ...(current.baby_profile || {}),
    name: "Phuong Nam Cu Ti",
    birthday: "2025-12-01",
    timezone: "America/Los_Angeles"
  },
  milestones: [
    { id: "m1", date: "2026-01-15", title: "Turns toward parent voice", category: "Social" },
    { id: "m2", date: "2026-02-08", title: "First social smiles", category: "Social" },
    { id: "m3", date: "2026-03-12", title: "Longer tummy head lift", category: "Motor" },
    { id: "m4", date: "2026-04-21", title: "Reaches toward toy", category: "Motor" },
    { id: "m5", date: "2026-05-18", title: "Laughs during peekaboo", category: "Social" }
  ],
  foods: [
    { date: "2026-05-03", food: "Vitamin D drops", reaction: "none", notes: "Tolerated well" },
    { date: "2026-05-22", food: "Iron supplement", reaction: "none", notes: "No reaction observed" }
  ],
  baby_log: babyLog
};

const recent = {
  bottleOunces: latest(babyLog, (log) => log.type === "bottle") ? babyLog.filter((log) => log.type === "bottle").slice(-1)[0].ounces : 3,
  nextBreastSide: "left",
  lastActivityAt: latest(babyLog, () => true),
  lastFeedAt: latest(babyLog, (log) => log.type === "feeding" || log.type === "bottle"),
  lastSleepAt: latest(babyLog, (log) => log.type === "sleep"),
  lastDiaperAt: latest(babyLog, (log) => log.type === "diaper"),
  lastBathAt: latest(babyLog, (log) => log.type === "bath"),
  lastTummyTimeAt: latest(babyLog, (log) => log.type === "tummy_time"),
  lastBabyGymAt: latest(babyLog, (log) => log.type === "baby_gym"),
  notes: "Demo data seeded for app testing."
};

fs.writeFileSync(dataPath, JSON.stringify(appData, null, 2) + "\n");
fs.writeFileSync(recentPath, JSON.stringify(recent, null, 2) + "\n");
console.log(`Seeded ${babyLog.length} demo logs from ${dateKey(startDate)} to ${dateKey(endDate)}.`);
console.log(`Backup: ${backupPath}`);
