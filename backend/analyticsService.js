const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.join(__dirname, "..");
const DEFAULT_DATA_ROOT = path.join("C:", "codelab", "databases", "TinyNewbornLog");
const DATA_ROOT = process.env.DATA_ROOT ? path.resolve(process.env.DATA_ROOT) : DEFAULT_DATA_ROOT;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(DATA_ROOT, "prod");
const SHARED_DATA_DIR = process.env.SHARED_DATA_DIR ? path.resolve(process.env.SHARED_DATA_DIR) : path.join(DATA_ROOT, "shared");
const ANALYTICS_DIR = path.join(DATA_DIR, "analytics");
const DAILY_ANALYTICS_DIR = path.join(ANALYTICS_DIR, "daily");
const TRENDS_ANALYTICS_DIR = path.join(ANALYTICS_DIR, "trends");
const MONTHLY_TRENDS_DIR = path.join(TRENDS_ANALYTICS_DIR, "monthly");
const ALL_METRICS_PATH = path.join(ANALYTICS_DIR, "all-metrics.json");

function cleanNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function round(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function countBy(items, keyFor) {
  return items.reduce((acc, item) => {
    const key = keyFor(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function sum(items, valueFor) {
  return items.reduce((total, item) => total + cleanNumber(valueFor(item), 0), 0);
}

function logTime(log) {
  const created = new Date(log.createdAt || log.timestamp || "");
  if (Number.isFinite(created.getTime())) return created.getTime();
  const [hour = "00", minute = "00"] = String(log.time || "00:00").split(":");
  const fallback = new Date(`${log.date || "1970-01-01"}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00`);
  return Number.isFinite(fallback.getTime()) ? fallback.getTime() : 0;
}

function clockMinutesFromMs(ms) {
  const date = new Date(ms);
  return date.getHours() * 60 + date.getMinutes();
}

function clockLabelFromMinutes(value) {
  if (!Number.isFinite(value)) return null;
  const minutes = Math.max(0, Math.min(1439, Math.round(value)));
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function hourLabelFromMs(ms) {
  return `${String(new Date(ms).getHours()).padStart(2, "0")}:00`;
}

function dayPartFromMs(ms) {
  const hour = new Date(ms).getHours();
  if (hour < 6) return "overnight";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function topEntries(counts, limit = 3) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function minutesBetween(startMs, endMs) {
  return Math.max(0, Math.round((endMs - startMs) / 60000));
}

function dayDiff(startDate, endDate) {
  return Math.round((new Date(`${endDate}T00:00:00`) - new Date(`${startDate}T00:00:00`)) / 86400000);
}

function weightToGrams(log) {
  if (Number.isFinite(Number(log.weightGrams))) return Number(log.weightGrams);
  if (!Number.isFinite(Number(log.weight))) return null;
  const factors = { oz: 28.349523125, lb: 453.59237, g: 1, kg: 1000 };
  return Number(log.weight) * (factors[log.weightUnit || "lb"] || factors.lb);
}

function heightToMm(log) {
  if (Number.isFinite(Number(log.heightMm))) return Number(log.heightMm);
  if (!Number.isFinite(Number(log.height))) return null;
  const factors = { in: 25.4, ft: 304.8, cm: 10, mm: 1 };
  return Number(log.height) * (factors[log.heightUnit || "in"] || factors.in);
}

function pairPeriods(logs, type, startStatus, endStatus) {
  const items = logs.filter((log) => log.type === type).sort((a, b) => logTime(a) - logTime(b));
  const sessions = [];
  const unpaired = [];
  let open = null;

  items.forEach((log) => {
    if (log.status === startStatus) {
      if (open) unpaired.push(open);
      open = log;
      return;
    }
    if (log.status !== endStatus) return;
    if (open && logTime(log) > logTime(open)) {
      sessions.push({
        type,
        startAt: new Date(logTime(open)).toISOString(),
        endAt: new Date(logTime(log)).toISOString(),
        startDate: open.date || null,
        endDate: log.date || null,
        minutes: minutesBetween(logTime(open), logTime(log))
      });
      open = null;
    } else {
      unpaired.push(log);
    }
  });

  if (open) unpaired.push(open);
  return { eventCount: items.length, sessions, unpairedCount: unpaired.length };
}

function durationStats(period) {
  const values = period.sessions.map((session) => session.minutes);
  return {
    eventCount: period.eventCount,
    sessionCount: values.length,
    totalMinutes: values.reduce((total, value) => total + value, 0),
    averageMinutes: round(average(values), 1),
    longestMinutes: values.length ? Math.max(...values) : null,
    shortestMinutes: values.length ? Math.min(...values) : null,
    firstStartAt: period.sessions[0]?.startAt || null,
    lastEndAt: period.sessions[period.sessions.length - 1]?.endAt || null,
    unpairedEvents: period.unpairedCount
  };
}

function classifySleep(startMs, endMs) {
  let daytimeMs = 0;
  const cursor = new Date(startMs);
  cursor.setHours(0, 0, 0, 0);
  while (cursor.getTime() < endMs) {
    const dayStart = new Date(cursor);
    dayStart.setHours(9, 0, 0, 0);
    const dayEnd = new Date(cursor);
    dayEnd.setHours(18, 0, 0, 0);
    daytimeMs += Math.max(0, Math.min(endMs, dayEnd.getTime()) - Math.max(startMs, dayStart.getTime()));
    cursor.setDate(cursor.getDate() + 1);
  }
  const totalMs = endMs - startMs;
  const nighttimeMs = Math.max(0, totalMs - daytimeMs);
  return {
    period: daytimeMs > nighttimeMs ? "daytime" : "nighttime",
    daytimeMinutes: Math.round(daytimeMs / 60000),
    nighttimeMinutes: Math.round(nighttimeMs / 60000)
  };
}

function percentVs(value, baseline) {
  return baseline && Number.isFinite(baseline) ? round(((value - baseline) / baseline) * 100, 1) : null;
}

function standardDeviation(values) {
  if (!values.length) return null;
  const mean = average(values);
  const variance = values.reduce((total, value) => total + ((value - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function descriptiveStats(values, digits = 2) {
  const cleanValues = values.filter((value) => Number.isFinite(value));
  return {
    count: cleanValues.length,
    average: round(average(cleanValues), digits),
    std: round(standardDeviation(cleanValues), digits),
    min: cleanValues.length ? round(Math.min(...cleanValues), digits) : null,
    max: cleanValues.length ? round(Math.max(...cleanValues), digits) : null,
    total: round(cleanValues.reduce((total, value) => total + value, 0), digits)
  };
}

function balanceStats(leftValues, rightValues) {
  const days = Math.max(leftValues.length, rightValues.length);
  const diffValues = Array.from({ length: days }, (_, index) => cleanNumber(leftValues[index], 0) - cleanNumber(rightValues[index], 0));
  const leftTotal = leftValues.reduce((total, value) => total + cleanNumber(value, 0), 0);
  const rightTotal = rightValues.reduce((total, value) => total + cleanNumber(value, 0), 0);
  const total = leftTotal + rightTotal;
  return {
    left: descriptiveStats(leftValues, 2),
    right: descriptiveStats(rightValues, 2),
    leftTotal,
    rightTotal,
    leftPercent: total ? round((leftTotal / total) * 100, 1) : null,
    rightPercent: total ? round((rightTotal / total) * 100, 1) : null,
    leftMinusRight: descriptiveStats(diffValues, 2)
  };
}

function buildContext() {
  const logs = readJson(path.join(DATA_DIR, "baby_log.json"), []).sort((a, b) => logTime(a) - logTime(b));
  const appData = readJson(path.join(DATA_DIR, "app_data.json"), {});
  const activityConfig = readJson(path.join(SHARED_DATA_DIR, "activity_config.json"), { eventCategories: {} });
  const poopColors = readJson(path.join(SHARED_DATA_DIR, "poop-colors.json"), []);
  const milestoneData = readJson(path.join(DATA_DIR, "milestone_log.json"), {});
  return { logs, appData, activityConfig, poopColors, milestoneData };
}

function localDayEndMs(date) {
  return new Date(`${date}T23:59:59`).getTime();
}

function buildDailyMetric(date, context) {
  const { logs, appData, activityConfig, poopColors, milestoneData } = context;
  const profile = appData.baby_profile || {};
  const dayLogs = logs.filter((log) => log.date === date).sort((a, b) => logTime(a) - logTime(b));
  const periodConfigs = Object.entries(activityConfig.eventCategories || {}).filter(([, config]) => config.kind === "period");
  const dayPeriods = Object.fromEntries(periodConfigs.map(([type, config]) => [type, pairPeriods(dayLogs, type, config.start, config.end)]));
  const sleepSessions = (dayPeriods.sleep?.sessions || []).map((session) => {
    const startMs = new Date(session.startAt).getTime();
    const endMs = new Date(session.endAt).getTime();
    return { ...session, ...classifySleep(startMs, endMs) };
  });
  const feeds = dayLogs.filter((log) => log.type === "feeding" || log.type === "bottle");
  const breastFeeds = dayLogs.filter((log) => log.type === "feeding");
  const bottleFeeds = dayLogs.filter((log) => log.type === "bottle");
  const feedGaps = feeds.slice(1).map((log, index) => minutesBetween(logTime(feeds[index]), logTime(log))).filter((value) => value >= 0);
  const diapers = dayLogs.filter((log) => log.type === "diaper");
  const poops = diapers.filter((log) => log.poop);
  const poopColorMap = new Map(poopColors.map((item) => [item.id, item]));
  const poopColorCounts = countBy(poops, (log) => log.poopColor || log.poopColorId || log.color || "unspecified");
  const dayEnd = localDayEndMs(date);
  const allFeedsBeforeEnd = logs.filter((log) => (log.type === "feeding" || log.type === "bottle") && logTime(log) <= dayEnd);
  const allPoopsBeforeEnd = logs.filter((log) => log.type === "diaper" && log.poop && logTime(log) <= dayEnd);
  const growthLogs = logs.filter((log) => log.type === "growth_stats" && logTime(log) <= dayEnd);
  const dayGrowthLogs = dayLogs.filter((log) => log.type === "growth_stats");
  const weightLogs = growthLogs.map((log) => ({ log, grams: weightToGrams(log) })).filter((item) => Number.isFinite(item.grams));
  const latestWeight = weightLogs[weightLogs.length - 1] || null;
  const previousWeight = weightLogs[weightLogs.length - 2] || null;
  const weightChange = latestWeight && previousWeight ? latestWeight.grams - previousWeight.grams : null;
  const weightDays = latestWeight && previousWeight ? Math.max(1, (logTime(latestWeight.log) - logTime(previousWeight.log)) / 86400000) : null;
  const dayMilestoneProgress = Object.values(milestoneData.milestone_progress || {}).filter((item) => {
    const changedDate = String(item.changedDate || item.confirmedAt || "").slice(0, 10);
    const achievedDate = item.achievedDate || "";
    return changedDate === date || achievedDate === date;
  });

  const colors = Object.fromEntries(Object.entries(poopColorCounts).map(([id, count]) => {
    const color = poopColorMap.get(id);
    return [id, { count, tag: color?.category || null }];
  }));
  const flags = Object.entries(poopColorCounts).flatMap(([id, count]) => {
    const color = poopColorMap.get(id);
    if (!color?.category || color.category === "normal") return [];
    return [{ date, domain: "diapers", priority: color.category === "call" ? "call_doctor" : color.category, id: `poop_color_${id}`, count }];
  });
  const unpaired = Object.fromEntries(Object.entries(dayPeriods).map(([type, period]) => [type, period.unpairedCount]).filter(([, count]) => count > 0));
  const routineLogs = dayLogs.filter((log) => log.type === "routine");
  const routineCounts = countBy(routineLogs, (log) => log.routine || "unspecified");
  const missing = [
    feeds.length ? "" : "feed",
    sleepSessions.length ? "" : "completed_sleep",
    diapers.some((log) => log.pee) ? "" : "wet_diaper",
    poops.length ? "" : "poop",
    (dayPeriods.tummy_time?.sessions || []).length ? "" : "tummy_time",
    dayGrowthLogs.length ? "" : "growth_today"
  ].filter(Boolean);

  return {
    schemaVersion: 1,
    fieldGuide: {
      minutes: "All time fields ending in Minutes are minutes.",
      flags: "Local deterministic rule hits for this date; trend files keep flag dates."
    },
    date,
    ageDays: profile.birthday ? dayDiff(profile.birthday, date) : null,
    logCount: dayLogs.length,
    eventTypeCounts: countBy(dayLogs, (log) => log.type || "unknown"),
    feeding: {
      feedCount: feeds.length,
      breastFeedCount: breastFeeds.length,
      bottleFeedCount: bottleFeeds.length,
      bottleOunces: round(sum(bottleFeeds, (log) => log.ounces), 2),
      averageBottleOunces: round(average(bottleFeeds.map((log) => Number(log.ounces)).filter((value) => Number.isFinite(value))), 2),
      averageFeedGapMinutes: round(average(feedGaps), 1),
      longestFeedGapMinutes: feedGaps.length ? Math.max(...feedGaps) : null,
      minutesSinceLastFeedAtDayEnd: allFeedsBeforeEnd.length ? minutesBetween(logTime(allFeedsBeforeEnd[allFeedsBeforeEnd.length - 1]), dayEnd) : null,
      breastSideCounts: countBy(breastFeeds, (log) => log.side || "unspecified")
    },
    sleep: {
      totalSleepMinutes: sleepSessions.reduce((total, session) => total + session.minutes, 0),
      daySleepMinutes: sleepSessions.reduce((total, session) => total + session.daytimeMinutes, 0),
      nightSleepMinutes: sleepSessions.reduce((total, session) => total + session.nighttimeMinutes, 0),
      sleepSessionCount: sleepSessions.length,
      longestSleepStretchMinutes: sleepSessions.length ? Math.max(...sleepSessions.map((session) => session.minutes)) : null,
      averageSleepSessionMinutes: round(average(sleepSessions.map((session) => session.minutes)), 1),
      nightWakeups: dayLogs.filter((log) => {
        if (log.type !== "sleep" || log.status !== "awake") return false;
        const hour = new Date(logTime(log)).getHours();
        return hour >= 18 || hour < 9;
      }).length,
      unpairedSleepEvents: dayPeriods.sleep?.unpairedCount || 0
    },
    diapers: {
      diaperCount: diapers.length,
      wetDiaperCount: diapers.filter((log) => log.pee).length,
      poopCount: poops.length,
      mixedDiaperCount: diapers.filter((log) => log.pee && log.poop).length,
      hoursSinceLastPoopAtDayEnd: allPoopsBeforeEnd.length ? round((dayEnd - logTime(allPoopsBeforeEnd[allPoopsBeforeEnd.length - 1])) / 3600000, 1) : null,
      latestPoopColor: poops.length ? (poops[poops.length - 1].poopColor || poops[poops.length - 1].poopColorId || null) : null,
      poopColors: colors
    },
    activities: {
      tummyTimeMinutes: (dayPeriods.tummy_time?.sessions || []).reduce((total, session) => total + session.minutes, 0),
      outdoorTimeMinutes: (dayPeriods.outdoor_time?.sessions || []).reduce((total, session) => total + session.minutes, 0),
      bathCount: dayPeriods.bath?.sessions.length || 0,
      bathMinutes: (dayPeriods.bath?.sessions || []).reduce((total, session) => total + session.minutes, 0),
      babyGymCount: dayLogs.filter((log) => log.type === "baby_gym").length,
      readingMinutes: null,
      unpairedEvents: unpaired
    },
    growth: {
      growthLogCount: dayGrowthLogs.length,
      weightLoggedToday: dayGrowthLogs.some((log) => Number.isFinite(weightToGrams(log))),
      latestWeightGrams: latestWeight ? round(latestWeight.grams, 1) : null,
      previousWeightGrams: previousWeight ? round(previousWeight.grams, 1) : null,
      weightChangeGrams: round(weightChange, 1),
      weightGainGramsPerDay: weightChange != null && weightDays ? round(weightChange / weightDays, 1) : null
    },
    routines: {
      totalCount: routineLogs.length,
      morningCount: routineCounts.morning || 0,
      naptimeCount: routineCounts.naptime || 0,
      bedtimeCount: routineCounts.bedtime || 0,
      otherCount: Object.entries(routineCounts).filter(([key]) => !["morning", "naptime", "bedtime"].includes(key)).reduce((total, [, count]) => total + count, 0)
    },
    environment: { temperatureF: null },
    flags,
    milestones: {
      progressCount: dayMilestoneProgress.length,
      statusCounts: countBy(dayMilestoneProgress, (item) => item.status || item.state || "unspecified")
    },
    dataCompleteness: {
      hasFeed: feeds.length > 0,
      hasCompletedSleep: sleepSessions.length > 0,
      hasWetDiaper: diapers.some((log) => log.pee),
      hasPoop: poops.length > 0,
      hasTummyTime: (dayPeriods.tummy_time?.sessions || []).length > 0,
      hasGrowthToday: dayGrowthLogs.length > 0,
      missing
    }
  };
}

function saveDailyMetrics(days = "7") {
  const context = buildContext();
  const dates = [...new Set(context.logs.map((log) => log.date).filter(Boolean))].sort();
  const selectedDates = days === "all" ? dates : dates.slice(-Math.max(1, Math.round(cleanNumber(days, 7))));
  fs.mkdirSync(DAILY_ANALYTICS_DIR, { recursive: true });
  const files = selectedDates.map((date) => {
    const filePath = path.join(DAILY_ANALYTICS_DIR, `${date}.json`);
    writeJson(filePath, buildDailyMetric(date, context));
    return path.relative(ROOT_DIR, filePath).replace(/\\/g, "/");
  });
  return {
    filesWritten: files.length,
    days: days === "all" ? "all" : Math.max(1, Math.round(cleanNumber(days, 7))),
    firstDate: selectedDates[0] || null,
    lastDate: selectedDates[selectedDates.length - 1] || null,
    outputDir: path.relative(ROOT_DIR, DAILY_ANALYTICS_DIR).replace(/\\/g, "/"),
    files
  };
}

function monthKey(date) {
  return String(date || "").slice(0, 7);
}

function previousDate(date, days) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() - days);
  return value.toISOString().slice(0, 10);
}

function dateRange(startDate, endDate) {
  const dates = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function emptyDailyMetric(date, context) {
  const profile = context.appData.baby_profile || {};
  return {
    schemaVersion: 1,
    date,
    ageDays: profile.birthday ? dayDiff(profile.birthday, date) : null,
    logCount: 0,
    eventTypeCounts: {},
    feeding: {
      feedCount: 0,
      breastFeedCount: 0,
      bottleFeedCount: 0,
      bottleOunces: 0,
      averageBottleOunces: null,
      averageFeedGapMinutes: null,
      longestFeedGapMinutes: null,
      minutesSinceLastFeedAtDayEnd: null,
      breastSideCounts: {}
    },
    sleep: {
      totalSleepMinutes: 0,
      daySleepMinutes: 0,
      nightSleepMinutes: 0,
      sleepSessionCount: 0,
      longestSleepStretchMinutes: null,
      averageSleepSessionMinutes: null,
      nightWakeups: 0,
      unpairedSleepEvents: 0
    },
    diapers: {
      diaperCount: 0,
      wetDiaperCount: 0,
      poopCount: 0,
      mixedDiaperCount: 0,
      hoursSinceLastPoopAtDayEnd: null,
      latestPoopColor: null,
      poopColors: {}
    },
    activities: {
      tummyTimeMinutes: 0,
      outdoorTimeMinutes: 0,
      bathCount: 0,
      bathMinutes: 0,
      babyGymCount: 0,
      readingMinutes: null,
      unpairedEvents: {}
    },
    growth: {
      growthLogCount: 0,
      weightLoggedToday: false,
      latestWeightGrams: null,
      previousWeightGrams: null,
      weightChangeGrams: null,
      weightGainGramsPerDay: null
    },
    routines: {
      totalCount: 0,
      morningCount: 0,
      naptimeCount: 0,
      bedtimeCount: 0,
      otherCount: 0
    },
    environment: { temperatureF: null },
    flags: [],
    milestones: { progressCount: 0, statusCounts: {} },
    dataCompleteness: {
      hasFeed: false,
      hasCompletedSleep: false,
      hasWetDiaper: false,
      hasPoop: false,
      hasTummyTime: false,
      hasGrowthToday: false,
      missing: ["feed", "completed_sleep", "wet_diaper", "poop", "tummy_time", "growth_today"]
    }
  };
}

function trendFromDailyMetrics({ id, kind, label, startDate, endDate, dailyMetrics, comparisonDailyMetrics = [] }) {
  const dayCount = dailyMetrics.length;
  const total = (path) => dailyMetrics.reduce((sumValue, day) => {
    const value = path.split(".").reduce((current, key) => current?.[key], day);
    return sumValue + cleanNumber(value, 0);
  }, 0);
  const compareTotal = (path) => comparisonDailyMetrics.reduce((sumValue, day) => {
    const value = path.split(".").reduce((current, key) => current?.[key], day);
    return sumValue + cleanNumber(value, 0);
  }, 0);
  const perDay = (value) => dayCount ? round(value / dayCount, 2) : null;
  const percentChange = (path) => {
    const current = total(path);
    const previous = compareTotal(path);
    return percentVs(current, previous);
  };
  const feedCount = total("feeding.feedCount");
  const bottleCount = total("feeding.bottleFeedCount");
  const bottleOunces = total("feeding.totalBottleIntakeOz");
  const sleepMinutes = total("sleep.totalSleepMinutes");
  const sleepSessions = total("sleep.sleepSessionCount");
  const tummyMinutes = total("activities.tummyTimeTotalMinutes");
  const outdoorMinutes = total("activities.outdoorTimeTotalMinutes");
  const bathMinutes = total("activities.bathTotalMinutes");
  const flags = dailyMetrics.flatMap((day) => day.localRuleFlags || []);
  const leftBreastFeeds = dailyMetrics.map((day) => cleanNumber(day.feeding?.breastSideCounts?.left, 0));
  const rightBreastFeeds = dailyMetrics.map((day) => cleanNumber(day.feeding?.breastSideCounts?.right, 0));

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    id,
    kind,
    label,
    window: { startDate, endDate, dayCount },
    totals: {
      logCount: total("logCount"),
      feedCount,
      breastFeedCount: total("feeding.breastFeedCount"),
      bottleFeedCount: bottleCount,
      bottleOunces: round(bottleOunces, 2),
      sleepMinutes,
      daySleepMinutes: total("sleep.daySleepMinutes"),
      nightSleepMinutes: total("sleep.nightSleepMinutes"),
      sleepSessionCount: sleepSessions,
      wetDiaperCount: total("diapers.wetDiaperCount"),
      poopCount: total("diapers.poopCount"),
      diaperCount: total("diapers.diaperCount"),
      tummyTimeMinutes: tummyMinutes,
      outdoorTimeMinutes: outdoorMinutes,
      bathCount: total("activities.bathCount"),
      bathMinutes,
      babyGymCount: total("activities.babyGymCount"),
      milestoneProgressCount: total("milestones.progressCount")
    },
    averagesPerDay: {
      feeds: perDay(feedCount),
      bottleOunces: perDay(bottleOunces),
      sleepMinutes: perDay(sleepMinutes),
      wetDiapers: perDay(total("diapers.wetDiaperCount")),
      poops: perDay(total("diapers.poopCount")),
      tummyTimeMinutes: perDay(tummyMinutes),
      outdoorTimeMinutes: perDay(outdoorMinutes),
      bathMinutes: perDay(bathMinutes)
    },
    averagesPerEvent: {
      bottleOunces: bottleCount ? round(bottleOunces / bottleCount, 2) : null,
      sleepSessionMinutes: sleepSessions ? round(sleepMinutes / sleepSessions, 1) : null
    },
    periodStats: {
      sleepMinutes: {
        total: descriptiveStats(dailyMetrics.map((day) => cleanNumber(day.sleep?.totalSleepMinutes, 0)), 2),
        day: descriptiveStats(dailyMetrics.map((day) => cleanNumber(day.sleep?.daySleepMinutes, 0)), 2),
        night: descriptiveStats(dailyMetrics.map((day) => cleanNumber(day.sleep?.nightSleepMinutes, 0)), 2),
        sessions: descriptiveStats(dailyMetrics.map((day) => cleanNumber(day.sleep?.sleepSessionCount, 0)), 2),
        longestStretch: descriptiveStats(dailyMetrics.map((day) => cleanNumber(day.sleep?.longestSleepStretchMinutes, 0)), 2)
      },
      feeding: {
        feeds: descriptiveStats(dailyMetrics.map((day) => cleanNumber(day.feeding?.feedCount, 0)), 2),
        breastFeeds: descriptiveStats(dailyMetrics.map((day) => cleanNumber(day.feeding?.breastFeedCount, 0)), 2),
        bottleFeeds: descriptiveStats(dailyMetrics.map((day) => cleanNumber(day.feeding?.bottleFeedCount, 0)), 2),
        bottleOunces: descriptiveStats(dailyMetrics.map((day) => cleanNumber(day.feeding?.totalBottleIntakeOz, 0)), 2),
        averageFeedIntervalMinutes: descriptiveStats(dailyMetrics.map((day) => day.feeding?.averageFeedIntervalMinutes).filter((value) => Number.isFinite(value)), 2),
        breastSideBalance: balanceStats(leftBreastFeeds, rightBreastFeeds)
      },
      diapers: {
        wetDiapers: descriptiveStats(dailyMetrics.map((day) => cleanNumber(day.diapers?.wetDiaperCount, 0)), 2),
        poops: descriptiveStats(dailyMetrics.map((day) => cleanNumber(day.diapers?.poopCount, 0)), 2)
      },
      activities: {
        tummyTimeMinutes: descriptiveStats(dailyMetrics.map((day) => cleanNumber(day.activities?.tummyTimeTotalMinutes, 0)), 2),
        outdoorTimeMinutes: descriptiveStats(dailyMetrics.map((day) => cleanNumber(day.activities?.outdoorTimeTotalMinutes, 0)), 2),
        bathCount: descriptiveStats(dailyMetrics.map((day) => cleanNumber(day.activities?.bathCount, 0)), 2),
        bathMinutes: descriptiveStats(dailyMetrics.map((day) => cleanNumber(day.activities?.bathTotalMinutes, 0)), 2)
      }
    },
    latestKnown: {
      latestPoopColor: [...dailyMetrics].reverse().find((day) => day.diapers?.latestPoopColor)?.diapers.latestPoopColor || null,
      latestWeightGrams: [...dailyMetrics].reverse().find((day) => Number.isFinite(day.growth?.latestWeightGrams))?.growth.latestWeightGrams || null
    },
    localRuleFlags: Object.values(flags.reduce((acc, flag) => {
      acc[flag.id] = acc[flag.id] || { ...flag, count: 0 };
      acc[flag.id].count += cleanNumber(flag.count, 1);
      return acc;
    }, {})),
    dataCompleteness: {
      daysWithLogs: dailyMetrics.filter((day) => day.logCount > 0).length,
      daysWithFeed: dailyMetrics.filter((day) => day.dataCompleteness?.hasFeed).length,
      daysWithCompletedSleep: dailyMetrics.filter((day) => day.dataCompleteness?.hasCompletedSleep).length,
      daysWithWetDiaper: dailyMetrics.filter((day) => day.dataCompleteness?.hasWetDiaper).length,
      daysWithPoop: dailyMetrics.filter((day) => day.dataCompleteness?.hasPoop).length,
      daysWithTummyTime: dailyMetrics.filter((day) => day.dataCompleteness?.hasTummyTime).length,
      daysWithGrowth: dailyMetrics.filter((day) => day.dataCompleteness?.hasGrowthToday).length
    },
    comparison: comparisonDailyMetrics.length ? {
      baselineWindow: {
        startDate: comparisonDailyMetrics[0].date,
        endDate: comparisonDailyMetrics[comparisonDailyMetrics.length - 1].date,
        dayCount: comparisonDailyMetrics.length
      },
      percentChange: {
        feedCount: percentChange("feeding.feedCount"),
        bottleOunces: percentChange("feeding.totalBottleIntakeOz"),
        sleepMinutes: percentChange("sleep.totalSleepMinutes"),
        wetDiaperCount: percentChange("diapers.wetDiaperCount"),
        poopCount: percentChange("diapers.poopCount"),
        tummyTimeMinutes: percentChange("activities.tummyTimeTotalMinutes"),
        outdoorTimeMinutes: percentChange("activities.outdoorTimeTotalMinutes"),
        bathMinutes: percentChange("activities.bathTotalMinutes")
      }
    } : null,
    dailySeries: dailyMetrics.map((day) => ({
      date: day.date,
      logCount: day.logCount,
      feedCount: day.feeding.feedCount,
      bottleOunces: day.feeding.totalBottleIntakeOz,
      sleepMinutes: day.sleep.totalSleepMinutes,
      wetDiapers: day.diapers.wetDiaperCount,
      poops: day.diapers.poopCount,
      tummyTimeMinutes: day.activities.tummyTimeTotalMinutes,
      outdoorTimeMinutes: day.activities.outdoorTimeTotalMinutes,
      bathMinutes: day.activities.bathTotalMinutes
    }))
  };
}

function compactStats(values, digits = 2) {
  const stats = descriptiveStats(values, digits);
  return {
    count: stats.count,
    average: stats.average,
    stdDev: stats.std,
    min: stats.min,
    max: stats.max,
    total: stats.total
  };
}

function compactTrendFromDailyMetrics({ id, kind, startDate, endDate, dailyMetrics, comparisonDailyMetrics = [] }) {
  const days = dailyMetrics.length;
  const values = (read) => dailyMetrics.map((day) => cleanNumber(read(day), 0));
  const total = (read) => values(read).reduce((sumValue, value) => sumValue + value, 0);
  const comparisonTotal = (read) => comparisonDailyMetrics.reduce((sumValue, day) => sumValue + cleanNumber(read(day), 0), 0);
  const change = (read) => percentVs(total(read), comparisonTotal(read));
  const leftValues = values((day) => day.feeding?.breastSideCounts?.left);
  const rightValues = values((day) => day.feeding?.breastSideCounts?.right);
  const leftTotal = total((day) => day.feeding?.breastSideCounts?.left);
  const rightTotal = total((day) => day.feeding?.breastSideCounts?.right);
  const breastTotal = leftTotal + rightTotal;
  const flags = dailyMetrics.flatMap((day) => day.flags || []);
  return {
    schemaVersion: 1,
    fieldGuide: {
      stdDev: "Standard deviation across daily values in this trend window.",
      perDayStats: "Averages include zero-value calendar days in the window.",
      flags: "Every local rule flag that happened during the window, with its date.",
      routines: "Routine fields count completed routine buttons from the Log tab: morning, naptime, bedtime."
    },
    id,
    kind,
    window: { startDate, endDate, dayCount: days },
    feeding: {
      feedCountPerDay: compactStats(values((day) => day.feeding?.feedCount)),
      breastFeedCountPerDay: compactStats(values((day) => day.feeding?.breastFeedCount)),
      bottleFeedCountPerDay: compactStats(values((day) => day.feeding?.bottleFeedCount)),
      bottleOuncesPerDay: compactStats(values((day) => day.feeding?.bottleOunces)),
      averageBottleOunces: round(total((day) => day.feeding?.bottleOunces) / Math.max(1, total((day) => day.feeding?.bottleFeedCount)), 2),
      averageFeedGapMinutes: compactStats(dailyMetrics.map((day) => day.feeding?.averageFeedGapMinutes).filter((value) => Number.isFinite(value))),
      breastSide: {
        left: compactStats(leftValues),
        right: compactStats(rightValues),
        leftPercent: breastTotal ? round((leftTotal / breastTotal) * 100, 1) : null,
        rightPercent: breastTotal ? round((rightTotal / breastTotal) * 100, 1) : null,
        leftMinusRight: compactStats(leftValues.map((value, index) => value - rightValues[index]))
      }
    },
    sleep: {
      totalSleepMinutesPerDay: compactStats(values((day) => day.sleep?.totalSleepMinutes)),
      daySleepMinutesPerDay: compactStats(values((day) => day.sleep?.daySleepMinutes)),
      nightSleepMinutesPerDay: compactStats(values((day) => day.sleep?.nightSleepMinutes)),
      sleepSessionCountPerDay: compactStats(values((day) => day.sleep?.sleepSessionCount)),
      longestSleepStretchMinutes: compactStats(values((day) => day.sleep?.longestSleepStretchMinutes)),
      sleepSessionMinutes: compactStats(dailyMetrics.map((day) => day.sleep?.averageSleepSessionMinutes).filter((value) => Number.isFinite(value))),
      nightWakeupsPerDay: compactStats(values((day) => day.sleep?.nightWakeups))
    },
    diapers: {
      wetDiapersPerDay: compactStats(values((day) => day.diapers?.wetDiaperCount)),
      poopsPerDay: compactStats(values((day) => day.diapers?.poopCount)),
      latestPoopColor: [...dailyMetrics].reverse().find((day) => day.diapers?.latestPoopColor)?.diapers.latestPoopColor || null
    },
    activities: {
      tummyTimeMinutesPerDay: compactStats(values((day) => day.activities?.tummyTimeMinutes)),
      outdoorTimeMinutesPerDay: compactStats(values((day) => day.activities?.outdoorTimeMinutes)),
      bathCountPerDay: compactStats(values((day) => day.activities?.bathCount)),
      bathMinutesPerDay: compactStats(values((day) => day.activities?.bathMinutes)),
      babyGymCountPerDay: compactStats(values((day) => day.activities?.babyGymCount))
    },
    growth: {
      latestWeightGrams: [...dailyMetrics].reverse().find((day) => Number.isFinite(day.growth?.latestWeightGrams))?.growth.latestWeightGrams || null,
      weightChangeGrams: [...dailyMetrics].reverse().find((day) => Number.isFinite(day.growth?.weightChangeGrams))?.growth.weightChangeGrams || null,
      weightGainGramsPerDay: [...dailyMetrics].reverse().find((day) => Number.isFinite(day.growth?.weightGainGramsPerDay))?.growth.weightGainGramsPerDay || null,
      daysWithGrowth: dailyMetrics.filter((day) => day.dataCompleteness?.hasGrowthToday).length
    },
    routines: {
      totalPerDay: compactStats(values((day) => day.routines?.totalCount)),
      morningPerDay: compactStats(values((day) => day.routines?.morningCount)),
      naptimePerDay: compactStats(values((day) => day.routines?.naptimeCount)),
      bedtimePerDay: compactStats(values((day) => day.routines?.bedtimeCount)),
      daysWithAnyRoutine: dailyMetrics.filter((day) => cleanNumber(day.routines?.totalCount, 0) > 0).length,
      daysWithMorningRoutine: dailyMetrics.filter((day) => cleanNumber(day.routines?.morningCount, 0) > 0).length,
      daysWithNaptimeRoutine: dailyMetrics.filter((day) => cleanNumber(day.routines?.naptimeCount, 0) > 0).length,
      daysWithBedtimeRoutine: dailyMetrics.filter((day) => cleanNumber(day.routines?.bedtimeCount, 0) > 0).length
    },
    flags: Object.values(flags.reduce((acc, flag) => {
      const domain = flag.domain || "unknown";
      const priority = flag.priority || "watch";
      const flagId = flag.id || "unknown";
      const date = flag.date || "";
      const key = `${date}|${domain}|${priority}|${flagId}`;
      acc[key] = acc[key] || { date, domain, priority, id: flagId, count: 0 };
      acc[key].count += cleanNumber(flag.count, 1);
      return acc;
    }, {})),
    dataCompleteness: {
      daysWithLogs: dailyMetrics.filter((day) => day.logCount > 0).length,
      daysWithFeed: dailyMetrics.filter((day) => day.dataCompleteness?.hasFeed).length,
      daysWithCompletedSleep: dailyMetrics.filter((day) => day.dataCompleteness?.hasCompletedSleep).length,
      daysWithWetDiaper: dailyMetrics.filter((day) => day.dataCompleteness?.hasWetDiaper).length,
      daysWithPoop: dailyMetrics.filter((day) => day.dataCompleteness?.hasPoop).length,
      daysWithTummyTime: dailyMetrics.filter((day) => day.dataCompleteness?.hasTummyTime).length,
      daysWithGrowth: dailyMetrics.filter((day) => day.dataCompleteness?.hasGrowthToday).length
    },
    vsPrevious: comparisonDailyMetrics.length ? {
      feedCountPercent: change((day) => day.feeding?.feedCount),
      bottleOuncesPercent: change((day) => day.feeding?.bottleOunces),
      sleepMinutesPercent: change((day) => day.sleep?.totalSleepMinutes),
      wetDiaperPercent: change((day) => day.diapers?.wetDiaperCount),
      poopPercent: change((day) => day.diapers?.poopCount),
      tummyTimePercent: change((day) => day.activities?.tummyTimeMinutes),
      outdoorTimePercent: change((day) => day.activities?.outdoorTimeMinutes),
      bathMinutesPercent: change((day) => day.activities?.bathMinutes)
    } : null
  };
}

function saveTrendMetrics() {
  const context = buildContext();
  const logDates = [...new Set(context.logs.map((log) => log.date).filter(Boolean))].sort();
  const latestDate = logDates[logDates.length - 1] || new Date().toISOString().slice(0, 10);
  const latestMonth = monthKey(latestDate);
  const dailyByDate = new Map(logDates.map((date) => [date, buildDailyMetric(date, context)]));
  const metricForDate = (date) => dailyByDate.get(date) || emptyDailyMetric(date, context);
  const files = [];

  fs.mkdirSync(TRENDS_ANALYTICS_DIR, { recursive: true });
  fs.mkdirSync(MONTHLY_TRENDS_DIR, { recursive: true });

  [7, 14, 30].forEach((days) => {
    const startDate = previousDate(latestDate, days - 1);
    const currentDates = dateRange(startDate, latestDate);
    const previousEnd = previousDate(startDate, 1);
    const previousStart = previousDate(previousEnd, days - 1);
    const trend = compactTrendFromDailyMetrics({
      id: `recent-${days}d`,
      kind: "recent",
      startDate,
      endDate: latestDate,
      dailyMetrics: currentDates.map(metricForDate),
      comparisonDailyMetrics: dateRange(previousStart, previousEnd).map(metricForDate)
    });
    const filePath = path.join(TRENDS_ANALYTICS_DIR, `recent-${days}d.json`);
    writeJson(filePath, trend);
    files.push(path.relative(ROOT_DIR, filePath).replace(/\\/g, "/"));
  });

  const months = [...new Set(logDates.map(monthKey))].filter((month) => month && month < latestMonth).sort();
  months.forEach((month) => {
    const [year, monthNumber] = month.split("-").map((value) => Number(value));
    const startDate = `${month}-01`;
    const lastDay = new Date(year, monthNumber, 0).getDate();
    const endDate = `${month}-${String(lastDay).padStart(2, "0")}`;
    const trend = compactTrendFromDailyMetrics({
      id: month,
      kind: "month",
      startDate,
      endDate,
      dailyMetrics: dateRange(startDate, endDate).map(metricForDate)
    });
    const filePath = path.join(MONTHLY_TRENDS_DIR, `${month}.json`);
    writeJson(filePath, trend);
    files.push(path.relative(ROOT_DIR, filePath).replace(/\\/g, "/"));
  });

  return {
    filesWritten: files.length,
    recentFilesWritten: 3,
    monthlyFilesWritten: months.length,
    latestDate,
    latestMonth,
    outputDir: path.relative(ROOT_DIR, TRENDS_ANALYTICS_DIR).replace(/\\/g, "/"),
    files
  };
}

function buildAllMetrics() {
  const { logs, appData, activityConfig, poopColors, milestoneData } = buildContext();
  const profile = appData.baby_profile || {};
  const dates = [...new Set(logs.map((log) => log.date).filter(Boolean))].sort();
  const firstDate = dates[0] || null;
  const lastDate = dates[dates.length - 1] || null;
  const lastLogTime = logs.length ? logTime(logs[logs.length - 1]) : Date.now();
  const periodConfigs = Object.entries(activityConfig.eventCategories || {}).filter(([, config]) => config.kind === "period");
  const periods = Object.fromEntries(periodConfigs.map(([type, config]) => [type, pairPeriods(logs, type, config.start, config.end)]));

  const feeds = logs.filter((log) => log.type === "feeding" || log.type === "bottle");
  const breastFeeds = logs.filter((log) => log.type === "feeding");
  const bottleFeeds = logs.filter((log) => log.type === "bottle");
  const feedGaps = feeds.slice(1).map((log, index) => minutesBetween(logTime(feeds[index]), logTime(log))).filter((value) => value >= 0);
  const diapers = logs.filter((log) => log.type === "diaper");
  const poops = diapers.filter((log) => log.poop);
  const poopColorMap = new Map(poopColors.map((item) => [item.id, item]));
  const poopColorCounts = countBy(poops, (log) => log.poopColor || log.poopColorId || log.color || "unspecified");
  const poopColorTags = Object.fromEntries(Object.entries(poopColorCounts).map(([id, count]) => {
    const config = poopColorMap.get(id);
    return [id, { count, category: config?.category || null, action: config?.parentAction || null }];
  }));

  const sleepSessions = (periods.sleep?.sessions || []).map((session) => {
    const startMs = new Date(session.startAt).getTime();
    const endMs = new Date(session.endAt).getTime();
    return { ...session, ...classifySleep(startMs, endMs) };
  });
  const awakeWindows = [];
  logs.forEach((log, index) => {
    if (log.type !== "sleep" || log.status !== "awake") return;
    const nextSleep = logs.slice(index + 1).find((item) => item.type === "sleep" && item.status === "asleep");
    if (nextSleep) awakeWindows.push(minutesBetween(logTime(log), logTime(nextSleep)));
  });

  const growthLogs = logs.filter((log) => log.type === "growth_stats");
  const weightLogs = growthLogs.map((log) => ({ log, grams: weightToGrams(log) })).filter((item) => Number.isFinite(item.grams));
  const heightLogs = growthLogs.map((log) => ({ log, mm: heightToMm(log) })).filter((item) => Number.isFinite(item.mm));
  const latestWeight = weightLogs[weightLogs.length - 1] || null;
  const previousWeight = weightLogs[weightLogs.length - 2] || null;
  const weightChange = latestWeight && previousWeight ? latestWeight.grams - previousWeight.grams : null;
  const weightDays = latestWeight && previousWeight ? Math.max(1, (logTime(latestWeight.log) - logTime(previousWeight.log)) / 86400000) : null;
  const latestHeight = heightLogs[heightLogs.length - 1] || null;

  const dailySeries = dates.map((date) => {
    const dayLogs = logs.filter((log) => log.date === date);
    const dayPeriods = Object.fromEntries(periodConfigs.map(([type, config]) => [type, pairPeriods(dayLogs, type, config.start, config.end)]));
    return {
      date,
      logCount: dayLogs.length,
      feedCount: dayLogs.filter((log) => log.type === "feeding" || log.type === "bottle").length,
      breastFeedCount: dayLogs.filter((log) => log.type === "feeding").length,
      bottleFeedCount: dayLogs.filter((log) => log.type === "bottle").length,
      bottleOunces: round(sum(dayLogs.filter((log) => log.type === "bottle"), (log) => log.ounces), 2),
      sleepMinutes: (dayPeriods.sleep?.sessions || []).reduce((total, session) => total + session.minutes, 0),
      wetDiapers: dayLogs.filter((log) => log.type === "diaper" && log.pee).length,
      poops: dayLogs.filter((log) => log.type === "diaper" && log.poop).length,
      tummyTimeMinutes: (dayPeriods.tummy_time?.sessions || []).reduce((total, session) => total + session.minutes, 0),
      outdoorMinutes: (dayPeriods.outdoor_time?.sessions || []).reduce((total, session) => total + session.minutes, 0),
      bathMinutes: (dayPeriods.bath?.sessions || []).reduce((total, session) => total + session.minutes, 0)
    };
  });
  const previous7 = dailySeries.slice(Math.max(0, dailySeries.length - 8), -1);
  const baseline = (key) => round(average(previous7.map((row) => row[key]).filter((value) => Number.isFinite(value))), 2);
  const latestDay = dailySeries[dailySeries.length - 1] || null;

  const localRuleFlags = [];
  Object.entries(poopColorTags).forEach(([id, item]) => {
    if (item.category && item.category !== "normal") {
      localRuleFlags.push({
        id: `poop_color_${id}`,
        domain: "diapers",
        priority: item.category === "call" ? "call_doctor" : item.category,
        source: "poop-colors.json",
        count: item.count
      });
    }
  });

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceFiles: ["data/baby_log.json", "data/app_data.json", "data/activity_config.json", "data/poop-colors.json", "data/milestone_log.json"],
    baby: {
      name: profile.name || "",
      birthday: profile.birthday || "",
      timezone: profile.timezone || "America/Los_Angeles",
      ageDaysAtLastLog: profile.birthday && lastDate ? dayDiff(profile.birthday, lastDate) : null
    },
    logCoverage: {
      firstDate,
      lastDate,
      dayCount: firstDate && lastDate ? dayDiff(firstDate, lastDate) + 1 : 0,
      totalLogs: logs.length,
      byType: countBy(logs, (log) => log.type || "unknown")
    },
    feeding: {
      feedCount: feeds.length,
      breastFeedCount: breastFeeds.length,
      bottleFeedCount: bottleFeeds.length,
      totalBottleIntakeOz: round(sum(bottleFeeds, (log) => log.ounces), 2),
      averageBottleSizeOz: round(average(bottleFeeds.map((log) => Number(log.ounces)).filter((value) => Number.isFinite(value))), 2),
      averageFeedIntervalMinutes: round(average(feedGaps), 1),
      longestFeedIntervalMinutes: feedGaps.length ? Math.max(...feedGaps) : null,
      timeSinceLastFeedMinutesAtLastLog: feeds.length ? minutesBetween(logTime(feeds[feeds.length - 1]), lastLogTime) : null,
      breastSideCounts: countBy(breastFeeds, (log) => log.side || "unspecified")
    },
    sleep: {
      totalSleepMinutes: sleepSessions.reduce((total, session) => total + session.minutes, 0),
      daySleepMinutes: sleepSessions.reduce((total, session) => total + session.daytimeMinutes, 0),
      nightSleepMinutes: sleepSessions.reduce((total, session) => total + session.nighttimeMinutes, 0),
      sleepSessionCount: sleepSessions.length,
      longestSleepStretchMinutes: sleepSessions.length ? Math.max(...sleepSessions.map((session) => session.minutes)) : null,
      averageSleepSessionMinutes: round(average(sleepSessions.map((session) => session.minutes)), 1),
      averageAwakeWindowMinutes: round(average(awakeWindows), 1),
      nightWakeupCount: logs.filter((log) => {
        if (log.type !== "sleep" || log.status !== "awake") return false;
        const hour = new Date(logTime(log)).getHours();
        return hour >= 18 || hour < 9;
      }).length,
      unpairedSleepEvents: periods.sleep?.unpairedCount || 0
    },
    diapers: {
      diaperCount: diapers.length,
      wetDiaperCount: diapers.filter((log) => log.pee).length,
      poopCount: poops.length,
      mixedDiaperCount: diapers.filter((log) => log.pee && log.poop).length,
      hoursSinceLastPoopAtLastLog: poops.length ? round((lastLogTime - logTime(poops[poops.length - 1])) / 3600000, 1) : null,
      latestPoopColor: poops.length ? (poops[poops.length - 1].poopColor || poops[poops.length - 1].poopColorId || null) : null,
      poopColors: poopColorTags
    },
    activities: {
      sleep: durationStats(periods.sleep || { eventCount: 0, sessions: [], unpairedCount: 0 }),
      tummyTime: durationStats(periods.tummy_time || { eventCount: 0, sessions: [], unpairedCount: 0 }),
      outdoorTime: durationStats(periods.outdoor_time || { eventCount: 0, sessions: [], unpairedCount: 0 }),
      bath: { ...durationStats(periods.bath || { eventCount: 0, sessions: [], unpairedCount: 0 }), bathCount: periods.bath?.sessions.length || 0 },
      babyGymCount: logs.filter((log) => log.type === "baby_gym").length,
      readingTimeTotalMinutes: null
    },
    growth: {
      growthStatsCount: growthLogs.length,
      latestWeightGrams: latestWeight ? round(latestWeight.grams, 1) : null,
      previousWeightGrams: previousWeight ? round(previousWeight.grams, 1) : null,
      weightChangeFromPreviousMeasurementGrams: round(weightChange, 1),
      weightGainRateGramsPerDay: weightChange != null && weightDays ? round(weightChange / weightDays, 1) : null,
      latestHeightMm: latestHeight ? round(latestHeight.mm, 1) : null
    },
    environment: {
      temperatureF: null,
      note: "No structured temperature logs are present in baby_log.json."
    },
    latestDayVsPrevious7DayAverage: latestDay ? {
      date: latestDay.date,
      feedCountPercent: percentVs(latestDay.feedCount, baseline("feedCount")),
      sleepMinutesPercent: percentVs(latestDay.sleepMinutes, baseline("sleepMinutes")),
      wetDiaperPercent: percentVs(latestDay.wetDiapers, baseline("wetDiapers")),
      poopPercent: percentVs(latestDay.poops, baseline("poops")),
      tummyTimePercent: percentVs(latestDay.tummyTimeMinutes, baseline("tummyTimeMinutes")),
      bathMinutesPercent: percentVs(latestDay.bathMinutes, baseline("bathMinutes"))
    } : null,
    localRuleFlags,
    milestones: {
      historyCount: Array.isArray(milestoneData.milestone_history) ? milestoneData.milestone_history.length : 0,
      progressCount: Object.keys(milestoneData.milestone_progress || {}).length,
      progressByStatus: countBy(Object.values(milestoneData.milestone_progress || {}), (item) => item.status || item.state || "unspecified")
    },
    dataCompleteness: {
      totalLogDays: dates.length,
      daysWithFeed: dailySeries.filter((row) => row.feedCount > 0).length,
      daysWithCompletedSleep: dailySeries.filter((row) => row.sleepMinutes > 0).length,
      daysWithWetDiaper: dailySeries.filter((row) => row.wetDiapers > 0).length,
      daysWithPoop: dailySeries.filter((row) => row.poops > 0).length,
      daysWithTummyTime: dailySeries.filter((row) => row.tummyTimeMinutes > 0).length,
      daysWithOutdoorTime: dailySeries.filter((row) => row.outdoorMinutes > 0).length,
      daysWithBath: dailySeries.filter((row) => row.bathMinutes > 0).length,
      unpairedEvents: Object.fromEntries(Object.entries(periods).map(([type, period]) => [type, period.unpairedCount]).filter(([, count]) => count > 0))
    },
    dailySeriesPreview: dailySeries.slice(-7)
  };
}

function saveAllMetrics() {
  const metrics = buildAllMetrics();
  writeJson(ALL_METRICS_PATH, metrics);
  return {
    filePath: path.relative(ROOT_DIR, ALL_METRICS_PATH).replace(/\\/g, "/"),
    generatedAt: metrics.generatedAt,
    totalLogs: metrics.logCoverage.totalLogs,
    firstDate: metrics.logCoverage.firstDate,
    lastDate: metrics.logCoverage.lastDate,
    metrics
  };
}

module.exports = {
  buildAllMetrics,
  saveDailyMetrics,
  saveTrendMetrics,
  saveAllMetrics
};
