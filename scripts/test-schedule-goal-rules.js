"use strict";

const testDate = "2026-06-08";
const now = new Date(`${testDate}T12:00:00`).getTime();
const state = {
  selectedScheduleDate: testDate,
  logs: []
};

const eventCategoryConfig = {
  sleep: { start: "asleep", end: "awake" },
  bath: { start: "start", end: "end" },
  tummy_time: { start: "start", end: "end" },
  outdoor_time: { start: "start", end: "end" }
};

const tests = [];

function test(name, run) {
  tests.push({ name, run });
}

function assertEqual(actual, expected, message = "") {
  if (actual !== expected) {
    throw new Error(`${message} expected ${expected}, got ${actual}`.trim());
  }
}

function assertClose(actual, expected, tolerance, message = "") {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message} expected ${expected}, got ${actual}`.trim());
  }
}

function withLogs(logs, run) {
  state.logs = logs;
  run();
}

function log(type, time, extra = {}) {
  return { type, date: testDate, time, ...extra };
}

function row(activity, timeOfDay, extra = {}) {
  return { activity, timeOfDay, plannedDuration: "0:30", ...extra };
}

function scheduleGoalState(scheduleRow) {
  const range = scheduleTimeRange(scheduleRow.timeOfDay);
  if (!range) return { state: "not-yet", label: "Time not reached yet" };
  const start = scheduleMinutesToMs(range.start);
  if (now < start) return { state: "not-yet", label: "Time not reached yet" };

  const kind = scheduleActivityKind(scheduleRow);
  if (kind === "feeding") return scheduleFeedingGoalState(scheduleRow);
  if (kind === "sleep") return scheduleDurationGoalState(scheduleRow, ["sleep"]);
  if (kind === "bath") return scheduleDurationGoalState(scheduleRow, ["bath"]);
  if (kind === "play") {
    const playGoal = String(scheduleRow.playGoal || "").toLowerCase();
    if (playGoal.includes("tummy")) return scheduleDurationGoalState(scheduleRow, ["tummy_time"]);
    if (playGoal.includes("outdoor")) return scheduleDurationGoalState(scheduleRow, ["outdoor_time"]);
    if (playGoal.includes("gym")) return scheduleAnyLogGoalState(scheduleRow, ["baby_gym"]);
    return scheduleAnyLogGoalState(scheduleRow, ["tummy_time", "baby_gym", "outdoor_time", "routine"]);
  }

  return scheduleAnyLogGoalState(scheduleRow, []);
}

function scheduleActivityKind(scheduleRow) {
  const text = String(scheduleRow.activity || "").toLowerCase();
  if (text.includes("feed")) return "feeding";
  if (text.includes("nap") || text.includes("sleep")) return "sleep";
  if (text.includes("play")) return "play";
  if (text.includes("bath")) return "bath";
  return "other";
}

function scheduleFeedingGoalState(scheduleRow) {
  const breastFeed = scheduleLogsInGoalWindow(scheduleRow, (entry) => entry.type === "feeding").length > 0;
  if (breastFeed) return { state: "complete", label: "Completed: breastfeeding logged nearby" };

  const goalOz = scheduleFeedGoalOz(scheduleRow);
  const actualOz = scheduleFeedingActualOunces(scheduleRow);
  const lower = goalOz * 0.9;
  const upper = goalOz * 1.1;
  if (actualOz >= lower && actualOz <= upper) {
    return { state: "complete", label: `Completed: ${actualOz} of ${goalOz}` };
  }
  return { state: "incomplete", label: `Not complete: ${actualOz} of ${goalOz}` };
}

function scheduleFeedingActualOunces(scheduleRow) {
  return scheduleLogsInGoalWindow(scheduleRow, (entry) => entry.type === "bottle")
    .reduce((sum, entry) => sum + numberValue(entry.ounces, 0), 0);
}

function scheduleDurationGoalState(scheduleRow, types) {
  const goalMinutes = scheduleDurationGoalMinutes(scheduleRow);
  if (!goalMinutes) return scheduleAnyLogGoalState(scheduleRow, types);
  const actualMs = types.reduce((sum, type) => sum + schedulePeriodDurationMs(scheduleRow, type), 0);
  const actualMinutes = actualMs / 60000;
  const lower = goalMinutes * 0.9;
  const upper = goalMinutes * 1.1;
  if (actualMinutes >= lower && actualMinutes <= upper) {
    return { state: "complete", label: `Completed: ${actualMinutes} of ${goalMinutes}` };
  }
  return { state: "incomplete", label: `Not complete: ${actualMinutes} of ${goalMinutes}` };
}

function scheduleAnyLogGoalState(scheduleRow, types) {
  const logs = types.length ? scheduleLogsInGoalWindow(scheduleRow, (entry) => types.includes(entry.type)) : [];
  return logs.length
    ? { state: "complete", label: "Completed: activity logged nearby" }
    : { state: "incomplete", label: "Not complete: no nearby activity log" };
}

function scheduleGoalWindow(scheduleRow) {
  const range = scheduleTimeRange(scheduleRow.timeOfDay);
  if (!range) return null;
  return {
    start: scheduleMinutesToMs(range.start) - 10 * 60 * 1000,
    end: scheduleMinutesToMs(range.end) + 10 * 60 * 1000
  };
}

function scheduleLogsInGoalWindow(scheduleRow, predicate) {
  const windowRange = scheduleGoalWindow(scheduleRow);
  if (!windowRange) return [];
  return (state.logs || [])
    .filter(predicate)
    .filter((entry) => {
      const time = logTime(entry);
      return Number.isFinite(time) && time >= windowRange.start && time <= windowRange.end;
    });
}

function scheduleDurationGoalMinutes(scheduleRow) {
  const text = String(scheduleRow.sleepGoal || scheduleRow.plannedDuration || "").trim();
  const colon = text.match(/^(\d{1,2}):(\d{2})$/);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
  const compact = text.match(/^(?:(\d+)\s*hrs?)?\s*(?:(\d+)\s*min)?$/i);
  if (compact && (compact[1] || compact[2])) return Number(compact[1] || 0) * 60 + Number(compact[2] || 0);
  return 0;
}

function schedulePeriodDurationMs(scheduleRow, type) {
  const config = eventCategoryConfig[type];
  const startStatus = config?.start || "asleep";
  const endStatus = config?.end || "awake";
  const windowRange = scheduleGoalWindow(scheduleRow);
  if (!windowRange) return 0;
  let activeStart = null;
  let total = 0;
  (state.logs || [])
    .filter((entry) => entry.type === type && entry.status)
    .sort((a, b) => logTime(a) - logTime(b))
    .forEach((entry) => {
      if (entry.status === startStatus) activeStart = logTime(entry);
      if (entry.status === endStatus && activeStart) {
        total += clippedDuration(activeStart, logTime(entry), windowRange.start, windowRange.end);
        activeStart = null;
      }
    });
  if (activeStart) total += clippedDuration(activeStart, now, windowRange.start, windowRange.end);
  return total;
}

function scheduleFeedGoalOz(scheduleRow) {
  const raw = Number(scheduleRow.feedGoalOz || scheduleRow.feedGoal);
  return Number.isFinite(raw) ? Math.max(1, Math.min(8, Math.round(raw))) : 3;
}

function scheduleTimeRange(value) {
  const parts = String(value || "").split("-");
  const inferredMeridiem = scheduleMeridiem(parts[1]) || scheduleMeridiem(parts[0]);
  const start = timeToMinutes(parts[0], inferredMeridiem);
  if (!Number.isFinite(start)) return null;
  const endMinutes = timeToMinutes(parts[1], inferredMeridiem);
  const end = Number.isFinite(endMinutes) ? endMinutes : start + 30;
  return { start, end: end < start ? end + 24 * 60 : end };
}

function scheduleMeridiem(value) {
  const match = String(value || "").match(/\b(AM|PM)\b/i);
  return match ? match[1].toUpperCase() : "";
}

function timeToMinutes(value, fallbackMeridiem = "") {
  const match = String(value || "").trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return NaN;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = (match[3] || fallbackMeridiem || "").toUpperCase();
  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function scheduleMinutesToMs(minutes, date = state.selectedScheduleDate) {
  const base = new Date(`${date}T00:00:00`).getTime();
  return base + minutes * 60 * 1000;
}

function logTime(entry) {
  const [hour = "00", minute = "00"] = String(entry.time || "00:00").split(":");
  return new Date(`${entry.date || testDate}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00`).getTime();
}

function clippedDuration(start, end, clipStart, clipEnd) {
  return Math.max(0, Math.min(end, clipEnd) - Math.max(start, clipStart));
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

test("future slot is gray/not-yet before scheduled start", () => {
  withLogs([], () => {
    assertEqual(scheduleGoalState(row("Feeding", "1:00-1:30 PM", { feedGoalOz: 2 })).state, "not-yet");
  });
});

test("feeding complete at exact bottle goal", () => {
  withLogs([log("bottle", "10:10", { ounces: 2 })], () => {
    assertEqual(scheduleGoalState(row("Feeding", "10:00-10:30 AM", { feedGoalOz: 2 })).state, "complete");
  });
});

test("feeding complete at lower 10 percent bottle bound", () => {
  withLogs([log("bottle", "10:10", { ounces: 1.8 })], () => {
    assertEqual(scheduleGoalState(row("Feeding", "10:00-10:30 AM", { feedGoalOz: 2 })).state, "complete");
  });
});

test("feeding complete at upper 10 percent bottle bound", () => {
  withLogs([log("bottle", "10:10", { ounces: 2.2 })], () => {
    assertEqual(scheduleGoalState(row("Feeding", "10:00-10:30 AM", { feedGoalOz: 2 })).state, "complete");
  });
});

test("feeding incomplete below lower bottle bound", () => {
  withLogs([log("bottle", "10:10", { ounces: 1.79 })], () => {
    assertEqual(scheduleGoalState(row("Feeding", "10:00-10:30 AM", { feedGoalOz: 2 })).state, "incomplete");
  });
});

test("feeding incomplete above upper bottle bound", () => {
  withLogs([log("bottle", "10:10", { ounces: 2.21 })], () => {
    assertEqual(scheduleGoalState(row("Feeding", "10:00-10:30 AM", { feedGoalOz: 2 })).state, "incomplete");
  });
});

test("feeding counts bottle exactly 10 minutes before start", () => {
  withLogs([log("bottle", "09:50", { ounces: 2 })], () => {
    assertEqual(scheduleGoalState(row("Feeding", "10:00-10:30 AM", { feedGoalOz: 2 })).state, "complete");
  });
});

test("feeding ignores bottle 11 minutes before start", () => {
  withLogs([log("bottle", "09:49", { ounces: 2 })], () => {
    assertEqual(scheduleGoalState(row("Feeding", "10:00-10:30 AM", { feedGoalOz: 2 })).state, "incomplete");
  });
});

test("feeding counts bottle exactly 10 minutes after end", () => {
  withLogs([log("bottle", "10:40", { ounces: 2 })], () => {
    assertEqual(scheduleGoalState(row("Feeding", "10:00-10:30 AM", { feedGoalOz: 2 })).state, "complete");
  });
});

test("feeding ignores bottle 11 minutes after end", () => {
  withLogs([log("bottle", "10:41", { ounces: 2 })], () => {
    assertEqual(scheduleGoalState(row("Feeding", "10:00-10:30 AM", { feedGoalOz: 2 })).state, "incomplete");
  });
});

test("breastfeeding nearby completes feeding even without ounces", () => {
  withLogs([log("feeding", "10:12")], () => {
    assertEqual(scheduleGoalState(row("Feeding", "10:00-10:30 AM", { feedGoalOz: 3 })).state, "complete");
  });
});

test("sleep complete at lower 10 percent duration bound", () => {
  withLogs([log("sleep", "08:00", { status: "asleep" }), log("sleep", "09:48", { status: "awake" })], () => {
    assertEqual(scheduleGoalState(row("1st Nap", "08:00-10:00 AM", { sleepGoal: "2hrs" })).state, "complete");
  });
});

test("sleep complete at upper 10 percent duration bound", () => {
  withLogs([log("sleep", "07:50", { status: "asleep" }), log("sleep", "10:02", { status: "awake" })], () => {
    assertEqual(scheduleGoalState(row("1st Nap", "08:00-10:00 AM", { sleepGoal: "2hrs" })).state, "complete");
  });
});

test("sleep incomplete below lower duration bound", () => {
  withLogs([log("sleep", "08:00", { status: "asleep" }), log("sleep", "09:47", { status: "awake" })], () => {
    assertEqual(scheduleGoalState(row("1st Nap", "08:00-10:00 AM", { sleepGoal: "2hrs" })).state, "incomplete");
  });
});

test("sleep incomplete above upper duration bound", () => {
  withLogs([log("sleep", "07:50", { status: "asleep" }), log("sleep", "10:03", { status: "awake" })], () => {
    assertEqual(scheduleGoalState(row("1st Nap", "08:00-10:00 AM", { sleepGoal: "2hrs" })).state, "incomplete");
  });
});

test("sleep duration is clipped to the expanded schedule window", () => {
  withLogs([log("sleep", "07:30", { status: "asleep" }), log("sleep", "10:30", { status: "awake" })], () => {
    const actualMinutes = schedulePeriodDurationMs(row("1st Nap", "08:00-10:00 AM", { sleepGoal: "2hrs" }), "sleep") / 60000;
    assertClose(actualMinutes, 140, 0.001, "clipped sleep minutes");
    assertEqual(scheduleGoalState(row("1st Nap", "08:00-10:00 AM", { sleepGoal: "2hrs" })).state, "incomplete");
  });
});

test("bath complete when duration is within goal", () => {
  withLogs([log("bath", "10:00", { status: "start" }), log("bath", "10:15", { status: "end" })], () => {
    assertEqual(scheduleGoalState(row("Bath Time", "10:00-10:15 AM", { plannedDuration: "0:15" })).state, "complete");
  });
});

test("tummy time completes play goal with duration rule", () => {
  withLogs([log("tummy_time", "10:00", { status: "start" }), log("tummy_time", "10:30", { status: "end" })], () => {
    assertEqual(scheduleGoalState(row("Play Time", "10:00-10:30 AM", { playGoal: "Tummy time", plannedDuration: "0:30" })).state, "complete");
  });
});

test("baby gym completes baby gym play goal by nearby log", () => {
  withLogs([log("baby_gym", "10:12")], () => {
    assertEqual(scheduleGoalState(row("Play Time", "10:00-10:30 AM", { playGoal: "Baby gym", plannedDuration: "0:30" })).state, "complete");
  });
});

test("free play completes with any nearby activity log", () => {
  withLogs([log("routine", "10:12")], () => {
    assertEqual(scheduleGoalState(row("Play Time", "10:00-10:30 AM", { playGoal: "Free play", plannedDuration: "0:30" })).state, "complete");
  });
});

let passed = 0;
const failures = [];

for (const item of tests) {
  try {
    item.run();
    passed += 1;
    console.log(`PASS ${item.name}`);
  } catch (error) {
    failures.push({ name: item.name, error });
    console.log(`FAIL ${item.name}`);
    console.log(`  ${error.message}`);
  }
}

console.log("");
console.log(`Schedule goal rule tests: ${passed}/${tests.length} passed`);

if (failures.length) {
  process.exitCode = 1;
}
