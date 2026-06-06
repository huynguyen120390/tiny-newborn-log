const fs = require("fs");
const path = require("path");
const { loadData } = require("./dataStore");

const EXPORT_DIR = path.join(__dirname, "exports");

function poopColorId(log) {
  return log.poopColorId || log.poopColor || "";
}

const WARNING_RULES = [
  { test: (log) => ["red", "red-blood"].includes(poopColorId(log)), label: "Red poop" },
  { test: (log, ctx) => ["black", "dark-brown-black"].includes(poopColorId(log)) && ctx.ageDays + 1 > 3, label: "Black poop after day 3" },
  { test: (log) => ["white", "gray", "grey", "white-pale-gray"].includes(poopColorId(log)), label: "White/gray poop" },
  { test: (log) => /watery|diarrhea/i.test(log.poopTexture || ""), label: "Watery diarrhea" },
  { test: (log) => /hard|pellet/i.test(log.poopTexture || ""), label: "Hard pellets" },
  { test: (log) => /mucus/i.test(log.poopTexture || log.notes || ""), label: "Mucus in stool" },
  { test: (log) => /allerg|rash|reaction|hives|swelling/i.test(log.reaction || log.notes || ""), label: "Allergy or reaction event" }
];

function ensureExportDir() {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date + "T00:00:00Z");
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function startOfMonth(date) {
  return `${date.slice(0, 7)}-01`;
}

function resolveRange(query = {}) {
  const rangeType = query.rangeType || "weekly";
  const endDate = query.endDate || todayIso();
  let startDate = query.startDate;

  if (!startDate) {
    if (rangeType === "daily") startDate = endDate;
    else if (rangeType === "monthly") startDate = startOfMonth(endDate);
    else startDate = addDays(endDate, -6);
  }

  return {
    startDate,
    endDate,
    rangeType,
    includeCharts: query.includeCharts !== "false"
  };
}

function daysInRange(startDate, endDate) {
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  return Math.max(1, Math.floor((end - start) / 86400000) + 1);
}

function filterLogs(logs, range) {
  return logs.filter((log) => log.date >= range.startDate && log.date <= range.endDate);
}

function ageText(birthday, onDate) {
  const start = new Date(birthday + "T00:00:00Z");
  const end = new Date(onDate + "T00:00:00Z");
  const days = Math.max(0, Math.floor((end - start) / 86400000));
  if (days < 31) return `${days} days`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ${days % 30} days`;
}

function sum(logs, field) {
  return logs.reduce((total, log) => total + Number(log[field] || 0), 0);
}

function logTime(log) {
  const [hour = "00", minute = "00"] = String(log.time || "00:00").split(":");
  const local = new Date(`${log.date || todayIso()}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00`);
  if (Number.isFinite(local.getTime())) return local.getTime();
  const created = log.createdAt ? new Date(log.createdAt).getTime() : NaN;
  return Number.isFinite(created) ? created : 0;
}

function periodMinutes(logs, type, startStatus, endStatus) {
  let pending = null;
  let total = sum(logs.filter((log) => log.type === type && !log.status), "minutes");
  logs
    .filter((log) => log.type === type && log.status)
    .sort((a, b) => logTime(a) - logTime(b))
    .forEach((log) => {
      if (log.status === startStatus) {
        pending = log;
        return;
      }
      if (log.status === endStatus && pending) {
        total += Math.max(0, Math.round((logTime(log) - logTime(pending)) / 60000));
        pending = null;
      }
    });
  return total;
}

function count(logs, predicate) {
  return logs.filter(predicate).length;
}

function groupCount(logs, field) {
  return logs.reduce((acc, log) => {
    const value = log[field] || "unspecified";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function getWarnings(logs, profile) {
  return logs.flatMap((log) => {
    const ctx = { ageDays: daysInRange(profile.birthday, log.date) - 1 };
    return WARNING_RULES.filter((rule) => rule.test(log, ctx)).map((rule) => ({
      date: log.date,
      time: log.time || "",
      type: rule.label,
      details: log.notes || log.poopTexture || log.poopColor || log.reaction || ""
    }));
  });
}

function makeReport(data, range, pediatrician = false) {
  const logs = filterLogs(data.baby_log, range);
  const dayCount = daysInRange(range.startDate, range.endDate);
  const sleep = logs.filter((log) => log.type === "sleep");
  const feeding = logs.filter((log) => log.type === "feeding");
  const bottles = logs.filter((log) => log.type === "bottle");
  const diapers = logs.filter((log) => log.type === "diaper");
  const poopLogs = diapers.filter((log) => log.poop);
  const warnings = getWarnings(logs, data.baby_profile);
  const milestones = data.milestones.filter((item) => item.date >= range.startDate && item.date <= range.endDate);
  const nutrition = logs.filter((log) => log.type === "nutrition");
  const growth = logs.filter((log) => log.type === "growth");
  const parentNotes = logs.filter((log) => log.type === "parent_note");

  const summary = {
    totalLogs: logs.length,
    sleepHours: +(periodMinutes(logs, "sleep", "asleep", "awake") / 60).toFixed(1),
    feedingCount: feeding.length,
    bottleOz: +sum(bottles, "ounces").toFixed(1),
    wetDiapers: count(diapers, (log) => log.pee),
    poops: poopLogs.length,
    tummyMinutes: periodMinutes(logs, "tummy_time", "start", "end"),
    babyGymMinutes: sum(logs.filter((log) => log.type === "baby_gym"), "minutes"),
    outdoorMinutes: periodMinutes(logs, "outdoor_time", "start", "end"),
    readingMinutes: sum(logs.filter((log) => log.type === "reading"), "minutes"),
    musicMinutes: sum(logs.filter((log) => log.type === "music"), "minutes"),
    screenVideoMinutes: sum(logs.filter((log) => log.type === "screen_video"), "minutes")
  };

  const averages = {
    feedingPerDay: +(summary.feedingCount / dayCount).toFixed(2),
    bottleOzPerDay: +(summary.bottleOz / dayCount).toFixed(2),
    wetDiapersPerDay: +(summary.wetDiapers / dayCount).toFixed(2),
    poopPerDay: +(summary.poops / dayCount).toFixed(2),
    sleepHoursPerDay: +(summary.sleepHours / dayCount).toFixed(2),
    tummyMinutesPerDay: +(summary.tummyMinutes / dayCount).toFixed(2)
  };

  return {
    title: pediatrician ? "Pediatrician Report" : "Export Report",
    profile: data.baby_profile,
    range,
    ageDuringPeriod: `${ageText(data.baby_profile.birthday, range.startDate)} to ${ageText(data.baby_profile.birthday, range.endDate)}`,
    generatedAt: new Date().toISOString(),
    logs,
    summary,
    averages,
    poopColorDistribution: groupCount(poopLogs, "poopColor"),
    goals: data.goals,
    scheduleAlignment: data.schedule_templates.map((template) => ({
      name: template.name,
      alignmentScore: template.alignmentScore
    })),
    milestones,
    nutrition,
    growth,
    parentNotes,
    warnings,
    chartTables: {
      activityMinutes: {
        tummy_time: summary.tummyMinutes,
        baby_gym: summary.babyGymMinutes,
        outdoor_time: summary.outdoorMinutes,
        reading: summary.readingMinutes,
        music: summary.musicMinutes,
        screen_video: summary.screenVideoMinutes
      },
      poopColorDistribution: groupCount(poopLogs, "poopColor")
    }
  };
}

function flattenLog(log) {
  return {
    id: log.id || "",
    date: log.date || "",
    time: log.time || "",
    type: log.type || "",
    method: log.method || "",
    minutes: log.minutes || "",
    ounces: log.ounces || "",
    milkType: log.milkType || "",
    pee: log.pee === undefined ? "" : log.pee,
    poop: log.poop === undefined ? "" : log.poop,
    poopColor: log.poopColor || "",
    poopTexture: log.poopTexture || "",
    food: log.food || "",
    reaction: log.reaction || "",
    title: log.title || "",
    category: log.category || "",
    weightOz: log.weightOz || "",
    lengthIn: log.lengthIn || "",
    headCircumferenceIn: log.headCircumferenceIn || "",
    notes: log.notes || ""
  };
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}

function saveJson(data, range) {
  ensureExportDir();
  const filePath = path.join(EXPORT_DIR, fileName("json", range, "json"));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return filePath;
}

function saveCsv(report) {
  ensureExportDir();
  const filePath = path.join(EXPORT_DIR, fileName("logs", report.range, "csv"));
  fs.writeFileSync(filePath, toCsv(report.logs.map(flattenLog)));
  return filePath;
}

function pdfEscape(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdf(lines) {
  const objects = [];
  const pages = [];
  const chunks = [];
  for (let i = 0; i < lines.length; i += 42) chunks.push(lines.slice(i, i + 42));

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");

  chunks.forEach((chunk, index) => {
    const pageObject = 3 + index * 2;
    const contentObject = pageObject + 1;
    pages.push(`${pageObject} 0 R`);
    objects[pageObject - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> /Contents ${contentObject} 0 R >>`;
    const contentLines = ["BT", "/F1 10 Tf", "50 742 Td"];
    chunk.forEach((line, lineIndex) => {
      const font = lineIndex === 0 && index === 0 ? "/F2 16 Tf" : "/F1 10 Tf";
      contentLines.push(font, `(${pdfEscape(line)}) Tj`, "0 -16 Td");
    });
    contentLines.push("ET");
    const stream = contentLines.join("\n");
    objects[contentObject - 1] = `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`;
  });

  objects[1] = `<< /Type /Pages /Kids [${pages.join(" ")}] /Count ${pages.length} >>`;

  const parts = ["%PDF-1.4\n"];
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets.push(Buffer.byteLength(parts.join("")));
    parts.push(`${index + 1} 0 obj\n${obj}\nendobj\n`);
  });
  const xrefOffset = Buffer.byteLength(parts.join(""));
  parts.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  offsets.slice(1).forEach((offset) => parts.push(`${String(offset).padStart(10, "0")} 00000 n \n`));
  parts.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return Buffer.from(parts.join(""), "utf8");
}

function reportLines(report, pediatrician = false) {
  const lines = [
    report.title,
    `Baby: ${report.profile.name}`,
    `Birthday: ${report.profile.birthday}`,
    `Age during period: ${report.ageDuringPeriod}`,
    `Report range: ${report.range.startDate} to ${report.range.endDate}`,
    `Generated: ${report.generatedAt}`,
    "",
    "Summary",
    `Total logs: ${report.summary.totalLogs}`,
    `Sleep: ${report.summary.sleepHours} hours`,
    `Feedings: ${report.summary.feedingCount}`,
    `Bottle: ${report.summary.bottleOz} oz`,
    `Wet diapers: ${report.summary.wetDiapers}`,
    `Poops: ${report.summary.poops}`,
    `Tummy time: ${report.summary.tummyMinutes} minutes`,
    `Baby gym: ${report.summary.babyGymMinutes} minutes`,
    `Outdoor time: ${report.summary.outdoorMinutes} minutes`,
    `Reading: ${report.summary.readingMinutes} minutes`,
    `Music: ${report.summary.musicMinutes} minutes`,
    `Screen/video exposure: ${report.summary.screenVideoMinutes} minutes`,
    "",
    "Poop Color Distribution",
    ...objectLines(report.poopColorDistribution),
    "",
    "Goal Achievement Percentages",
    ...report.goals.map((goal) => `${goal.name}: ${goal.achievedPercent}% (${goal.target} ${goal.unit})`),
    "",
    "Schedule Alignment",
    ...report.scheduleAlignment.map((item) => `${item.name}: ${item.alignmentScore}%`),
    "",
    "Milestones Achieved",
    ...(report.milestones.length ? report.milestones.map((item) => `${item.date}: ${item.title} (${item.category})`) : ["None in this period"]),
    "",
    "Warning Events",
    ...(report.warnings.length ? report.warnings.map((item) => `${item.date} ${item.time}: ${item.type} - ${item.details}`) : ["None found"])
  ];

  if (report.range.includeCharts) {
    lines.push("", "Dashboard Chart Data Tables", "Activity Minutes", ...objectLines(report.chartTables.activityMinutes));
    lines.push("TODO: replace chart data tables with captured chart images in a later prototype.");
  }

  if (pediatrician) {
    lines.push(
      "",
      "Doctor Visit Averages",
      `Feeding average per day: ${report.averages.feedingPerDay}`,
      `Bottle oz average per day: ${report.averages.bottleOzPerDay}`,
      `Wet diaper average per day: ${report.averages.wetDiapersPerDay}`,
      `Poop average per day: ${report.averages.poopPerDay}`,
      `Sleep average per day: ${report.averages.sleepHoursPerDay} hours`,
      `Tummy time average per day: ${report.averages.tummyMinutesPerDay} minutes`,
      "",
      "Growth Entries",
      ...(report.growth.length ? report.growth.map((log) => `${log.date}: ${log.weightOz || "?"} oz, ${log.lengthIn || "?"} in, head ${log.headCircumferenceIn || "?"} in`) : ["None available"]),
      "",
      "Nutrition / Solid Foods Introduced",
      ...(report.nutrition.length ? report.nutrition.map((log) => `${log.date}: ${log.food || "Entry"} - reaction: ${log.reaction || "unknown"}`) : ["None available"]),
      "",
      "Parent Notes",
      ...(report.parentNotes.length ? report.parentNotes.map((log) => `${log.date}: ${log.notes}`) : ["None"])
    );
  }

  return lines;
}

function objectLines(obj) {
  const entries = Object.entries(obj);
  return entries.length ? entries.map(([key, value]) => `${key}: ${value}`) : ["None"];
}

function savePdf(report, pediatrician = false) {
  ensureExportDir();
  const prefix = pediatrician ? "pediatrician-report" : "report";
  const filePath = path.join(EXPORT_DIR, fileName(prefix, report.range, "pdf"));
  fs.writeFileSync(filePath, buildPdf(reportLines(report, pediatrician)));
  return filePath;
}

function xmlEscape(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function colName(index) {
  let name = "";
  let n = index + 1;
  while (n) {
    const mod = (n - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    n = Math.floor((n - mod) / 26);
  }
  return name;
}

function sheetXml(rows) {
  const xmlRows = rows.map((row, rIndex) => {
    const cells = row.map((value, cIndex) => {
      const ref = `${colName(cIndex)}${rIndex + 1}`;
      if (typeof value === "number") return `<c r="${ref}"><v>${value}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rIndex + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${xmlRows}</sheetData></worksheet>`;
}

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function zipStore(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  files.forEach((file) => {
    const name = Buffer.from(file.name);
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  });
  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

function saveXlsx(report) {
  ensureExportDir();
  const sheets = [
    ["Summary", [
      ["Metric", "Value"],
      ["Baby", report.profile.name],
      ["Birthday", report.profile.birthday],
      ["Range", `${report.range.startDate} to ${report.range.endDate}`],
      ["Age during period", report.ageDuringPeriod],
      ...Object.entries(report.summary)
    ]],
    ["All Logs", [Object.keys(flattenLog({})), ...report.logs.map((log) => Object.values(flattenLog(log)))]],
    ["Sleep", logsRows(report.logs.filter((log) => log.type === "sleep"))],
    ["Feeding", logsRows(report.logs.filter((log) => ["feeding", "bottle"].includes(log.type)))],
    ["Diapers", logsRows(report.logs.filter((log) => log.type === "diaper"))],
    ["Poop Details", logsRows(report.logs.filter((log) => log.type === "diaper" && log.poop))],
    ["Nutrition", logsRows(report.nutrition)],
    ["Goals", [["Name", "Target", "Unit", "Achieved Percent"], ...report.goals.map((goal) => [goal.name, goal.target, goal.unit, goal.achievedPercent])]],
    ["Schedule Alignment", [["Template", "Score"], ...report.scheduleAlignment.map((item) => [item.name, item.alignmentScore])]],
    ["Milestones", [["Date", "Title", "Category"], ...report.milestones.map((item) => [item.date, item.title, item.category])]],
    ["Warning Events", [["Date", "Time", "Type", "Details"], ...report.warnings.map((item) => [item.date, item.time, item.type, item.details])]]
  ];

  const workbookSheets = sheets.map(([name], index) => `<sheet name="${xmlEscape(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  const workbookRels = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  const overrides = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  const files = [
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}</Relationships>` },
    ...sheets.map(([, rows], index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, data: sheetXml(rows) }))
  ];

  const filePath = path.join(EXPORT_DIR, fileName("workbook", report.range, "xlsx"));
  fs.writeFileSync(filePath, zipStore(files));
  return filePath;
}

function logsRows(logs) {
  return [Object.keys(flattenLog({})), ...logs.map((log) => Object.values(flattenLog(log)))];
}

function fileName(prefix, range, ext) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}-${range.rangeType}-${range.startDate}-to-${range.endDate}-${stamp}.${ext}`;
}

module.exports = {
  EXPORT_DIR,
  loadData,
  makeReport,
  resolveRange,
  saveCsv,
  saveJson,
  savePdf,
  saveXlsx
};
