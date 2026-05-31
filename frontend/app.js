const state = {
  logs: [],
  recent: {},
  summary: {},
  profile: {},
  activeTab: "log",
  visibleCards: [],
  historyFilters: {
    startDate: "",
    endDate: "",
    types: ["all"]
  },
  activeLogsCard: null,
  milestoneProgress: {},
  selectedMilestoneId: null,
  ticker: null,
  currentDate: todayString(),
  bathSoundEnabled: false,
  bathReminderSeconds: loadBathReminderSeconds(),
  lastBathAnnouncementStep: 0,
  tummySoundEnabled: false,
  tummyReminderSeconds: loadTummyReminderSeconds(),
  lastTummyAnnouncementStep: 0,
  reminderVoiceURI: loadReminderVoiceURI(),
  audioContext: null
};

const activities = [
  {
    title: "Sleep and Awake",
    key: "sleep",
    icon: "moon",
    helper: "Baby is awaking.",
    actions: [
      { label: "Asleep", icon: "asleep", payload: { type: "sleep", status: "asleep" } },
      { label: "Awake", icon: "awake", payload: { type: "sleep", status: "awake" } }
    ]
  },
  {
    title: "Boobie",
    key: "boobie",
    icon: "heart",
    helper: "Start side reminder updates after each feed.",
    actions: [
      { label: "Left", icon: "left", payload: { type: "feeding", method: "breast", side: "left" }, reminder: "Try right side next time." },
      { label: "Right", icon: "right", payload: { type: "feeding", method: "breast", side: "right" }, reminder: "Try left side next time." }
    ]
  },
  {
    title: "Bottle",
    key: "bottle",
    icon: "bottle",
    helper: "Slider starts from the last bottle amount.",
    actions: [
      { label: "Bottle amount", icon: "bottle", dialog: "bottle" }
    ]
  },
  {
    title: "Wee & Poo",
    key: "diaper",
    icon: "spark",
    helper: "Tiny toilet logs.",
    actions: [
      { label: "Wee", icon: "pee", payload: { type: "diaper", kind: "pee" } },
      { label: "Poo", icon: "poop", payload: { type: "diaper", kind: "poop" } }
    ]
  },
  {
    title: "Bath",
    key: "bath",
    icon: "spark",
    helper: "Start and stop splash time.",
    actions: [
      { label: "Start", icon: "bath", payload: { type: "bath", status: "start" } },
      { label: "Stop", icon: "bath", payload: { type: "bath", status: "end" } }
    ]
  },
  {
    title: "Tummy Time",
    key: "tummy",
    icon: "sun",
    helper: "Start and end practice sessions.",
    actions: [
      { label: "Start", icon: "tummy-start", payload: { type: "tummy_time", status: "start" } },
      { label: "End", icon: "tummy-end", payload: { type: "tummy_time", status: "end" } }
    ]
  },
  {
    title: "Baby Gym",
    key: "gym",
    icon: "star",
    helper: "Log a little play and tracking time.",
    actions: [
      { label: "Log gym time", icon: "gym", payload: { type: "baby_gym" } }
    ]
  }
];

const historyEventTypes = [
  { value: "all", label: "All" },
  { value: "sleep", label: "Sleep" },
  { value: "feeding", label: "Boobie" },
  { value: "bottle", label: "Bottle" },
  { value: "diaper", label: "Diaper" },
  { value: "bath", label: "Bath" },
  { value: "tummy_time", label: "Tummy" },
  { value: "baby_gym", label: "Gym" }
];

const milestoneDefinitions = [
  {
    id: "first-smile",
    level: 1,
    iconFile: "first-smile.png",
    name: "First Smile",
    ageStartWeeks: 6,
    ageEndWeeks: 12,
    ageLabel: "6–12 weeks",
    exercises: ["Face-to-face talking", "Exaggerated smiles", "Singing", "Eye contact during feeding", "Mimic baby's facial expressions"]
  },
  {
    id: "reaching-grabbing",
    level: 1,
    iconFile: "reaching-grabbing.png",
    name: "Reaching & Grabbing",
    ageStartWeeks: 13,
    ageEndWeeks: 22,
    ageLabel: "3–5 months",
    exercises: ["Dangling toys", "Soft rattles", "Play gym", "Bring toys to midline", "Hand-to-hand toy transfer practice"]
  },
  {
    id: "rolling-over",
    level: 1,
    iconFile: "rolling-over.png",
    name: "Rolling Over",
    ageStartWeeks: 17,
    ageEndWeeks: 26,
    ageLabel: "4–6 months",
    exercises: ["Daily tummy time", "Place toys slightly to the side", "Encourage reaching across the body", "Side-lying play"]
  },
  {
    id: "army-crawling",
    level: 1,
    iconFile: "army-crawling.png",
    name: "Army Crawling / Scooting",
    ageStartWeeks: 22,
    ageEndWeeks: 35,
    ageLabel: "5–8 months",
    exercises: ["Extended tummy time", "Place favorite toy just out of reach", "Mirror play", "Encourage weight shifting on forearms"]
  },
  {
    id: "sitting-up",
    level: 1,
    iconFile: "sitting-up.png",
    name: "Sitting Up",
    ageStartWeeks: 30,
    ageEndWeeks: 39,
    ageLabel: "7–9 months",
    exercises: ["Supported sitting", "Sit between parent's legs", "Place toys around baby to encourage balance", "Tripod sitting hands forward"]
  },
  {
    id: "crawling",
    level: 1,
    iconFile: "crawling.png",
    name: "Crawling",
    ageStartWeeks: 26,
    ageEndWeeks: 43,
    ageLabel: "6–10 months",
    exercises: ["Tunnel games", "Toy just out of reach", "Obstacle pillows", "Encourage hands-and-knees rocking"]
  },
  {
    id: "first-syllables",
    level: 1,
    iconFile: "first-syllables.png",
    name: 'First Syllables ("ba", "ma", "da")',
    ageStartWeeks: 39,
    ageEndWeeks: 48,
    ageLabel: "9–11 months",
    exercises: ["Narrate daily activities", "Read books", "Imitate sounds", "Sing songs", "Pause and wait for baby to respond"]
  },
  {
    id: "walking",
    level: 1,
    iconFile: "walking.png",
    name: "Walking",
    ageStartWeeks: 39,
    ageEndWeeks: 65,
    ageLabel: "9–15 months",
    exercises: ["Cruise along furniture", "Push toys", "Stand-and-reach games", "Squat-and-stand play", "Barefoot time indoors"]
  },
  { id: "tracks-faces", level: 2, iconFile: "tracks-faces.png", name: "Tracks faces", ageStartWeeks: 4, ageEndWeeks: 9, ageLabel: "1–2 months", exercises: [] },
  { id: "hands-to-mouth", level: 2, iconFile: "hands-to-mouth.png", name: "Hands to mouth", ageStartWeeks: 9, ageEndWeeks: 17, ageLabel: "2–4 months", exercises: [] },
  { id: "responds-to-name", level: 2, iconFile: "responds-to-name.png", name: "Responds to name", ageStartWeeks: 26, ageEndWeeks: 39, ageLabel: "6–9 months", exercises: [] },
  { id: "transfers-toy-hand-to-hand", level: 2, iconFile: "transfers-toy-hand-to-hand.png", name: "Transfers toy hand-to-hand", ageStartWeeks: 22, ageEndWeeks: 30, ageLabel: "5–7 months", exercises: [] },
  { id: "peekaboo-understanding", level: 2, iconFile: "peekaboo-understanding.png", name: "Peek-a-boo understanding", ageStartWeeks: 30, ageEndWeeks: 43, ageLabel: "7–10 months", exercises: [] },
  { id: "waves-bye-bye", level: 2, iconFile: "waves-bye-bye.png", name: "Waves bye-bye", ageStartWeeks: 35, ageEndWeeks: 52, ageLabel: "8–12 months", exercises: [] },
  { id: "claps-hands", level: 2, iconFile: "claps-hands.png", name: "Claps hands", ageStartWeeks: 35, ageEndWeeks: 52, ageLabel: "8–12 months", exercises: [] },
  { id: "finger-feeding", level: 2, iconFile: "finger-feeding.png", name: "Finger feeding", ageStartWeeks: 35, ageEndWeeks: 52, ageLabel: "8–12 months", exercises: [] },
  { id: "drinks-from-cup", level: 2, iconFile: "drinks-from-cup.png", name: "Drinks from cup with help", ageStartWeeks: 26, ageEndWeeks: 52, ageLabel: "6–12 months", exercises: [] },
  { id: "points-with-finger", level: 2, iconFile: "points-with-finger.png", name: "Points with finger", ageStartWeeks: 39, ageEndWeeks: 61, ageLabel: "9–14 months", exercises: [] },
  { id: "eats-solids", level: 2, iconFile: "eats-solids.png", name: "Eats solids", ageStartWeeks: 17, ageEndWeeks: null, ageLabel: "4+ months", exercises: [] }
];

const exerciseLibrary = [
  {
    id: "tummy-time",
    name: "Tummy Time",
    purpose: ["Strengthens baby's neck, shoulder, back, and core muscles", "Helps prepare for rolling, sitting, army crawling, and crawling"],
    timing: ["Start right after birth", "Continue until baby can sit up well"],
    recommendedAmount: ["Newborn: a few minutes, a couple times per day", "2 months old: 10–15 minute sessions, total about 1 hour per day", "3 months old: 10–15 minute sessions, total about 1.5 hours per day"],
    safety: ["Do not do right after feeding", "Always supervise", "Stop if baby is very upset"],
    methods: ["Traditional tummy time: place baby on stomach on a safe flat surface", "Pillow tummy time: place baby over a U-shaped pillow, rolled blanket, or towel", "Tummy-to-tummy: parent reclines and baby lies on parent's chest"],
    supportsMilestones: ["Rolling Over", "Army Crawling / Scooting", "Sitting Up", "Crawling"]
  },
  {
    id: "baby-sit-ups",
    name: "Baby Sit-ups",
    purpose: ["Helps build neck strength, core strength, and trunk control"],
    timing: [],
    recommendedAmount: [],
    safety: ["Only do this when baby has good head control", "Pull gently", "Never yank baby's arms", "Stop if baby looks uncomfortable"],
    methods: ["Baby lies on back", "Gently hold baby's hands or arms", "Slowly pull baby upward", "Slowly lower baby down", "Pause when almost at the bottom"],
    supportsMilestones: ["Sitting Up", "Crawling"]
  },
  {
    id: "baby-floor-gym",
    name: "Baby Floor Gym",
    purpose: ["Supports visual tracking, reaching, grabbing, and hand-eye coordination"],
    timing: [],
    recommendedAmount: [],
    safety: [],
    methods: ["Let baby look at dangling toys", "Encourage baby to reach for toys", "Encourage baby to kick hanging toys", "Practice hand-to-hand toy transfer later"],
    supportsMilestones: ["Reaching & Grabbing", "Tracks faces", "Hands to mouth", "Transfers toy hand-to-hand"]
  }
];

const milestoneStates = ["Not Yet", "Maybe", "Practicing", "Confirmed"];

const milestoneStateMessages = {
  "Not Yet": "Not started yet.",
  Maybe: "Parent may have seen this skill, but is not certain yet.",
  Practicing: "Baby can sometimes do this skill and is building consistency.",
  Confirmed: "Parent is confident baby consistently demonstrates this skill."
};

const legacyMilestoneStatus = {
  Upcoming: "Not Yet",
  Achieved: "Confirmed",
  practicing: "Practicing",
  achieved: "Confirmed",
  "not-yet": "Not Yet",
  maybe: "Maybe",
  confirmed: "Confirmed"
};

const milestoneBehaviorDescriptions = {
  "first-smile": ["Smiles in response to a familiar face or voice.", "Makes eye contact during warm interaction.", "Shows brighter facial expression during social play."],
  "reaching-grabbing": ["Brings hands toward toys at midline.", "Opens hands and bats at nearby objects.", "Begins to hold a soft toy briefly."],
  "rolling-over": ["Rolls from tummy to back or back to tummy.", "Reaches across the body.", "Uses body rotation intentionally."],
  "army-crawling": ["Pushes through forearms during tummy play.", "Shifts weight to reach for toys.", "Pulls or scoots the body forward on the floor."],
  "sitting-up": ["Sits with minimal support.", "Maintains balance while reaching for toys.", "Uses hands for support and begins to recover balance."],
  crawling: ["Gets onto hands and knees.", "Rocks forward and backward.", "Moves with alternating arms and legs or an emerging crawl pattern."],
  "first-syllables": ["Babbles repeated consonant sounds.", "Uses voice to get attention.", "Copies simple sounds or takes turns vocalizing."],
  walking: ["Pulls to stand and cruises along furniture.", "Stands briefly without support.", "Takes independent steps with improving balance."],
  "tracks-faces": ["Watches a caregiver's face at close range.", "Follows a face or high-contrast object briefly.", "Turns eyes or head toward gentle movement."],
  "hands-to-mouth": ["Brings hands toward mouth during calm awake time.", "Explores fingers by sucking or mouthing.", "Keeps hands more open and active at midline."],
  "responds-to-name": ["Looks toward caregiver when name is called.", "Pauses activity after hearing familiar voice.", "Shows recognition through eye contact, smile, or vocal response."],
  "transfers-toy-hand-to-hand": ["Moves a toy from one hand to the other.", "Uses both hands together at midline.", "Looks at and manipulates toys with growing control."],
  "peekaboo-understanding": ["Anticipates a hidden face or toy returning.", "Smiles, laughs, or looks for a covered object.", "Shows early understanding that people and objects still exist when hidden."],
  "waves-bye-bye": ["Copies a simple wave.", "Uses a hand gesture during greetings or goodbyes.", "Pairs gesture with eye contact or vocalizing."],
  "claps-hands": ["Brings hands together repeatedly.", "Copies clapping during songs or games.", "Uses clapping to show excitement."],
  "finger-feeding": ["Picks up safe soft foods with fingers.", "Brings food to mouth with improving accuracy.", "Uses raking grasp or early pincer grasp."],
  "drinks-from-cup": ["Accepts small sips from an open cup with help.", "Brings lips to cup edge.", "Swallows small amounts with caregiver support."],
  "points-with-finger": ["Extends index finger toward objects of interest.", "Points to request or share attention.", "Looks between caregiver and the object."],
  "eats-solids": ["Shows interest in food and opens mouth for spoon.", "Moves purees or soft solids in the mouth.", "Sits with appropriate support during feeding."]
};

const supportingMilestoneExercises = {
  "tracks-faces": ["Slow face tracking", "High-contrast card play", "Baby floor gym watching"],
  "hands-to-mouth": ["Midline hand play", "Gentle hand-to-mouth guidance", "Baby floor gym reaching"],
  "responds-to-name": ["Name games", "Call-and-pause play", "Face-to-face talking"],
  "transfers-toy-hand-to-hand": ["Offer toys at midline", "Hand-to-hand toy transfer practice", "Baby floor gym reaching"],
  "peekaboo-understanding": ["Peek-a-boo with cloth", "Hide-and-reveal toys", "Pause before revealing"],
  "waves-bye-bye": ["Goodbye routine", "Model waving slowly", "Take-turn gesture games"],
  "claps-hands": ["Pat-a-cake", "Song clapping", "Hand-over-hand clapping"],
  "finger-feeding": ["Safe soft finger foods", "Tray exploration", "Practice pincer grasp with soft pieces"],
  "drinks-from-cup": ["Tiny open-cup sips", "Model cup drinking", "Supported seated practice"],
  "points-with-finger": ["Point-and-name objects", "Book pointing", "Choice games"],
  "eats-solids": ["Supported seated meals", "Responsive spoon feeding", "Texture exploration when developmentally ready"]
};

state.visibleCards = loadVisibleCards();

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => activateTab(button.dataset.tab));
});

document.querySelector("[data-close-dialog]").addEventListener("click", () => {
  document.getElementById("bottle-dialog").close();
});

document.querySelector("[data-close-activity-logs]").addEventListener("click", () => {
  document.getElementById("activity-logs-dialog").close();
});

document.querySelector("[data-close-milestone]").addEventListener("click", () => {
  document.getElementById("milestone-dialog").close();
});

document.getElementById("milestone-dialog").addEventListener("click", (event) => {
  if (event.target.id === "milestone-dialog") event.target.close();
});

document.getElementById("bottle-slider").addEventListener("input", (event) => {
  document.getElementById("bottle-value").textContent = Number(event.target.value).toFixed(2).replace(/0$/, "");
});

document.getElementById("bottle-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const ounces = Number(document.getElementById("bottle-slider").value);
  document.getElementById("bottle-dialog").close();
  await createLog({ type: "bottle", ounces });
});

init().catch((error) => {
  const summary = document.getElementById("baby-summary");
  if (summary) summary.textContent = `Could not load profile: ${error.message}`;
  showToast(`Could not load app data: ${error.message}`);
});

async function init() {
  renderActivities();
  setupHistoryFilters();
  setupSettingsPanel();
  setupExportPanel("export-panel");
  setupSpeechVoices();
  updateClock();
  await refreshData();
}

async function refreshData() {
  const [appData, recent, summary] = await Promise.all([
    fetchJson("/api/app-data"),
    fetchJson("/api/recent"),
    fetchJson("/api/today-summary")
  ]);

  state.profile = appData.baby_profile || {};
  state.logs = appData.baby_log || [];
  state.recent = recent;
  state.summary = summary;
  state.bathSoundEnabled = Boolean(appData.sound_settings?.bathSoundEnabled);
  state.tummySoundEnabled = Boolean(appData.sound_settings?.tummySoundEnabled);
  state.milestoneProgress = appData.milestone_progress || (Array.isArray(appData.milestones) ? {} : appData.milestones || {});

  renderAll();
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    try {
      const payload = JSON.parse(text);
      throw new Error(payload.error || text);
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error(text);
      throw error;
    }
  }
  return response.json();
}

function activateTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll(".tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  document.querySelectorAll(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === tab));
}

function renderAll() {
  
  const birthday = state.profile.birthday || "";
  const age = formatBabyAge(birthday);
  document.getElementById("baby-summary").textContent = `${age}.`;
  renderTodaySummary();
  renderRecent();
  renderHistory();
  renderMilestones();
  renderSettings();
  renderActivityStats();
  updateActivityButtons();
  updateBottleDefaults();
  startTicker();
}

function renderActivities() {
  const visibleActivities = activities.filter((activity) => state.visibleCards.includes(activity.key));
  document.getElementById("activity-grid").innerHTML = visibleActivities.map((activity) => `
    <article class="activity-card" data-activity-card="${activity.key}" style="--card-image: url('${cardHeaderImage(activity.key)}')">
      <div class="card-top card-header">
        <div>
          <h3 data-card-title="${activity.key}">${activity.title}</h3>
          <p data-card-subtitle="${activity.key}">${activity.helper}</p>
        </div>
        ${activity.key === "sleep" ? `
          <div class="sleep-motion" aria-hidden="true">
            <span class="star-field"></span>
            <span class="star-field"></span>
            <span class="star-field"></span>
            <span class="cloud-field"></span>
            <span class="cloud-field"></span>
            <span class="cloud-field"></span>
          </div>
        ` : ""}
        <button class="card-more" type="button" data-more-card="${activity.key}" aria-label="Show today's ${activity.title} logs">
          <span></span><span></span><span></span>
        </button>
        ${["bath", "tummy"].includes(activity.key) ? `
          <button class="sound-toggle" type="button" data-${activity.key}-sound-toggle aria-label="${activity.title} sound is off">
            <span class="speaker-icon" aria-hidden="true"></span>
          </button>
        ` : ""}
      </div>
      <div>
          <div class="card-info" data-card-info="${activity.key}"></div>
          <div class="button-row">
            ${activity.actions.map((action) => `
              <button class="action-button" data-card="${activity.key}" data-action-label="${action.label}" data-action='${JSON.stringify(action)}'>
                <img src="/assets/activity/icon-${action.icon}.png" alt="" loading="lazy">
                <span>${action.label}</span>
              </button>
            `).join("")}
          </div>
      </div>
      
    </article>
  `).join("");

  document.querySelectorAll(".action-button").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = JSON.parse(button.dataset.action);
      if (action.dialog === "bottle") {
        openBottleDialog();
        return;
      }
      await createLog(action.payload, action.reminder);
    });
  });

  document.querySelectorAll(".card-more").forEach((button) => {
    button.addEventListener("click", () => openActivityLogs(button.dataset.moreCard));
  });

  document.querySelectorAll("[data-bath-sound-toggle]").forEach((button) => {
    button.addEventListener("click", toggleBathSound);
  });

  document.querySelectorAll("[data-tummy-sound-toggle]").forEach((button) => {
    button.addEventListener("click", toggleTummySound);
  });
}

function renderMilestones() {
  const next = nextExpectedMilestone();
  const nextCard = document.getElementById("next-milestone-card");
  if (nextCard) nextCard.innerHTML = renderNextMilestone(next);

  const major = document.getElementById("major-milestones");
  if (major) major.innerHTML = milestoneRecords(1).map((milestone, index, list) => renderMilestoneCard(milestone, next?.id, index, list.length)).join("");

  const supporting = document.getElementById("supporting-milestones");
  if (supporting) supporting.innerHTML = milestoneRecords(2).map((milestone, index, list) => renderMilestoneCard(milestone, next?.id, index, list.length)).join("");

  const exerciseContainer = document.getElementById("exercise-library");
  if (exerciseContainer) exerciseContainer.innerHTML = exerciseLibrary.map(renderExerciseCard).join("");

  document.querySelectorAll("[data-milestone-id]").forEach((button) => {
    button.addEventListener("click", () => openMilestoneDialog(button.dataset.milestoneId));
  });
  document.querySelectorAll("[data-exercise-card]").forEach((card) => {
    card.addEventListener("click", () => card.classList.remove("spotlight"));
  });
}

function milestoneRecords(level) {
  return milestoneDefinitions
    .filter((milestone) => milestone.level === level)
    .sort((a, b) => a.ageStartWeeks - b.ageStartWeeks)
    .map(mergeMilestoneProgress);
}

function mergeMilestoneProgress(milestone) {
  const progress = state.milestoneProgress[milestone.id] || {};
  const status = normalizeMilestoneStatus(progress.state || progress.status || defaultMilestoneStatus(milestone));
  return {
    ...milestone,
    state: status,
    status,
    achievedDate: progress.achievedDate || null,
    confirmedAt: progress.confirmedAt || null,
    changedDate: progress.changedDate || progress.confirmedAt || progress.achievedDate || null,
    notes: progress.notes || ""
  };
}

function defaultMilestoneStatus(milestone) {
  return "Not Yet";
}

function renderMilestoneCard(milestone, nextId, index = 0, count = 1) {
  const isNext = milestone.id === nextId;
  const isFirst = index === 0;
  const isLast = index === count - 1;
  return `
    <button class="milestone-card ${statusClass(milestone.status)} ${isNext ? "next" : ""} ${isFirst ? "first" : ""} ${isLast ? "last" : ""}" type="button" data-milestone-id="${escapeAttr(milestone.id)}" aria-label="${escapeAttr(`${milestone.name}, ${displayAgeLabel(milestone)}, ${milestone.status}`)}">
      <span class="milestone-icon-wrap">
        <img src="${milestoneIconPath(milestone)}" alt="">
        ${milestone.status === "Confirmed" ? `<span class="milestone-check" aria-hidden="true">&#10003;</span>` : ""}
      </span>
      <span class="milestone-card-copy">
        <strong>${escapeHtml(milestone.name)}</strong>
        <small>${escapeHtml(displayAgeLabel(milestone))}</small>
        <span class="status-pill ${statusClass(milestone.status)}">${escapeHtml(milestone.status)}</span>
      </span>
    </button>
  `;
}

function renderNextMilestone(milestone) {
  if (!milestone) {
    return `<div><h3>Next Expected Milestone</h3><p>All listed milestones are achieved.</p></div>`;
  }

  const recommendations = recommendedExercisesForMilestone(milestone);
  return `
    <button class="next-milestone-button" type="button" data-milestone-id="${escapeAttr(milestone.id)}">
      <img src="${milestoneIconPath(milestone)}" alt="">
      <span>
        <small>Next Expected Milestone</small>
        <strong>${escapeHtml(milestone.name)}</strong>
        <em>${escapeHtml(displayAgeLabel(milestone))}</em>
        <span>${recommendations.length ? escapeHtml(recommendations.map((exercise) => exercise.name).join(", ")) : "Practice through everyday play."}</span>
      </span>
    </button>
  `;
}

function renderExerciseCard(exercise) {
  return `
    <article class="exercise-card" id="exercise-${escapeAttr(exercise.id)}" data-exercise-card="${escapeAttr(exercise.id)}" tabindex="-1">
      <h4>${escapeHtml(exercise.name)}</h4>
      ${renderExerciseGroup("Purpose", exercise.purpose)}
      ${renderExerciseGroup("Timing", exercise.timing)}
      ${renderExerciseGroup("Recommended amount", exercise.recommendedAmount)}
      ${renderExerciseGroup("Safety", exercise.safety)}
      ${renderExerciseGroup("Methods", exercise.methods)}
      ${renderExerciseGroup("Supports milestones", exercise.supportsMilestones)}
    </article>
  `;
}

function renderExerciseGroup(label, items) {
  if (!items.length) return "";
  return `
    <div>
      <strong>${escapeHtml(label)}</strong>
      <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
  `;
}

function nextExpectedMilestone() {
  return milestoneDefinitions.map(mergeMilestoneProgress).find((milestone) => milestone.status !== "Confirmed") || null;
}

function openMilestoneDialog(id) {
  const definition = milestoneDefinitions.find((item) => item.id === id);
  if (!definition) return;
  const milestone = mergeMilestoneProgress(definition);

  state.selectedMilestoneId = id;
  const dialog = document.getElementById("milestone-dialog");
  document.getElementById("milestone-dialog-content").innerHTML = renderMilestoneDialog(milestone);
  dialog.querySelectorAll("[data-milestone-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      updateMilestoneStatus(milestone.id, button.dataset.milestoneAction, dialog.querySelector("[data-milestone-notes]")?.value || "");
    });
  });
  dialog.querySelectorAll("[data-exercise-open]").forEach((button) => {
    button.addEventListener("click", () => openExerciseEntry(button.dataset.exerciseOpen));
  });
  if (!dialog.open) dialog.showModal();
}

function renderMilestoneDialog(milestone) {
  const recommendations = recommendedExercisesForMilestone(milestone);
  const behavior = milestoneBehaviorDescriptions[milestone.id] || [];
  const exercises = milestoneExercises(milestone);
  return `
    <div class="milestone-dialog-hero">
      <img src="${milestoneIconPath(milestone)}" alt="">
      <div>
        <span class="status-pill ${statusClass(milestone.status)}">${escapeHtml(milestone.status)}</span>
        <h3>${escapeHtml(milestone.name)}</h3>
        <p>Level ${milestone.level} &bull; ${escapeHtml(displayAgeLabel(milestone))}</p>
      </div>
    </div>
    <div class="milestone-dialog-body">
      <div>
        <strong>Milestone Information</strong>
        <p>${escapeHtml(milestoneStateMessages[milestone.status] || "")}</p>
      </div>
      ${behavior.length ? renderExerciseGroup("Baby Behavior Description", behavior) : ""}
      ${exercises.length ? renderExerciseGroup("Exercises", exercises) : ""}
      ${recommendations.length ? renderExerciseLinks("Exercise Library", recommendations) : ""}
      ${milestone.changedDate ? `<p class="achieved-note">Last changed on ${escapeHtml(formatDisplayDate(milestone.changedDate))}</p>` : ""}
      <label class="milestone-notes">
        <strong>Notes</strong>
        <textarea data-milestone-notes rows="3" placeholder="Optional parent notes">${escapeHtml(milestone.notes)}</textarea>
      </label>
    </div>
    <div class="modal-actions milestone-actions">
      ${milestoneStates.map((stateName) => `<button class="${stateName === milestone.status ? "primary" : "ghost"}" type="button" data-milestone-action="${escapeAttr(stateName)}">${escapeHtml(stateName)}</button>`).join("")}
    </div>
  `;
}

async function updateMilestoneStatus(id, action, notes = "") {
  const now = new Date().toISOString();
  const stateName = normalizeMilestoneStatus(action);
  const payload = {
    milestoneId: id,
    state: stateName,
    status: stateName,
    changedDate: now,
    achievedDate: stateName === "Confirmed" ? todayString() : null,
    confirmedAt: stateName === "Confirmed" ? now : null,
    notes
  };

  try {
    const result = await fetchJson(`/api/milestones/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    state.milestoneProgress = result.milestone_progress || result.milestones || {};
    document.getElementById("milestone-dialog").close();
    renderMilestones();
    showReaction(payload.status === "Confirmed" ? "Milestone confirmed" : "Milestone saved", milestoneName(id));
  } catch (error) {
    showToast(`Could not save milestone: ${error.message}`);
  }
}

function recommendedExercisesForMilestone(milestone) {
  return exerciseLibrary
    .filter((exercise) => exercise.supportsMilestones.includes(milestone.name))
    .slice(0, 4);
}

function milestoneExercises(milestone) {
  return (milestone.exercises.length ? milestone.exercises : supportingMilestoneExercises[milestone.id] || []).slice(0, 5);
}

function renderExerciseLinks(label, exercises) {
  return `
    <div>
      <strong>${escapeHtml(label)}</strong>
      <div class="exercise-link-list">
        ${exercises.map((exercise) => `<button type="button" data-exercise-open="${escapeAttr(exercise.id)}">${escapeHtml(exercise.name)}</button>`).join("")}
      </div>
    </div>
  `;
}

function openExerciseEntry(id) {
  const dialog = document.getElementById("milestone-dialog");
  if (dialog.open) dialog.close();
  const card = document.getElementById(`exercise-${id}`);
  if (!card) return;
  card.classList.add("spotlight");
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.focus({ preventScroll: true });
}

function normalizeMilestoneStatus(status) {
  if (milestoneStates.includes(status)) return status;
  return legacyMilestoneStatus[status] || "Not Yet";
}

function babyAgeWeeks() {
  const birthday = state.profile.birthday;
  if (!birthday) return NaN;
  const birth = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return NaN;
  return Math.floor((Date.now() - birth.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function displayAgeLabel(milestone) {
  return String(milestone.ageLabel || "").replaceAll("â€“", "-").replaceAll("–", "-");
}

function formatDisplayDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function milestoneIconPath(milestone) {
  return `/icons/milestones/${milestone.iconFile}?v=20260530-astronaut`;
}

function milestoneName(id) {
  return milestoneDefinitions.find((milestone) => milestone.id === id)?.name || "Milestone";
}

function statusClass(status) {
  return normalizeMilestoneStatus(status).toLowerCase().replace(/\s+/g, "-");
}

function openActivityLogs(cardKey) {
  state.activeLogsCard = cardKey;
  const activity = activities.find((item) => item.key === cardKey);
  const dialog = document.getElementById("activity-logs-dialog");
  const list = document.getElementById("activity-logs-list");
  document.getElementById("activity-logs-title").textContent = `${activity?.title || "Activity"} today`;

  const logs = logsForActivityCard(cardKey)
    .filter((log) => log.date === todayString())
    .sort((a, b) => logTime(b) - logTime(a));

  list.innerHTML = logs.length ? logs.map((log) => `
    ${renderActivityLogRow(log, cardKey)}
  `).join("") : `<p class="empty-state">No logs today.</p>`;

  list.querySelectorAll("[data-edit-log]").forEach((button) => {
    button.addEventListener("click", () => startActivityLogEdit(button.dataset.editLog, cardKey));
  });
  list.querySelectorAll("[data-delete-log]").forEach((button) => {
    button.addEventListener("click", () => deleteLog(button.dataset.deleteLog, cardKey));
  });

  if (!dialog.open) dialog.showModal();
}

function cardHeaderImage(key) {
  const versions = {
    boobie: "20260530-boobie-baby"
  };
  return `/assets/activity/header-${key}.png${versions[key] ? `?v=${versions[key]}` : ""}`;
}

function renderActivityLogRow(log, cardKey) {
  return `
    <div class="activity-log-row" data-log-row="${escapeAttr(log.id)}">
      <img class="activity-log-icon" src="${activityIconForLog(log, cardKey)}" alt="">
      <div class="activity-log-body">
        <span>${formatLogClock(log)}</span>
        <strong>${escapeHtml(labelForLog(log))}</strong>
        ${log.notes ? `<small>${escapeHtml(log.notes)}</small>` : ""}
      </div>
      ${renderLogMenu(log, cardKey)}
    </div>
  `;
}

function renderLogMenu(log, cardKey = "") {
  const editAttr = cardKey
    ? `data-edit-log="${escapeAttr(log.id)}" data-card-key="${escapeAttr(cardKey)}"`
    : `data-history-edit="${escapeAttr(log.id)}"`;
  const cardAttr = cardKey ? ` data-card-key="${escapeAttr(cardKey)}"` : "";
  return `
    <details class="log-row-menu">
      <summary aria-label="Log actions">...</summary>
      <div class="log-row-menu-panel">
        <button type="button" ${editAttr}>Edit</button>
        <button class="danger-menu-button" type="button" data-delete-log="${escapeAttr(log.id)}"${cardAttr}>
          <span aria-hidden="true">&#128465;</span>
          Delete
        </button>
      </div>
    </details>
  `;
}

function startActivityLogEdit(logId, cardKey) {
  const log = state.logs.find((item) => item.id === logId);
  const row = Array.from(document.querySelectorAll("[data-log-row]")).find((item) => item.dataset.logRow === logId);
  if (!log || !row) return;

  row.innerHTML = `
    <img class="activity-log-icon" src="${activityIconForLog(log, cardKey)}" alt="">
    <form class="activity-log-edit-form" data-log-edit-form="${escapeAttr(log.id)}">
      <label>
        Time
        <input name="time" type="time" value="${escapeAttr(log.time || "")}">
      </label>
      <label class="activity-log-notes-field">
        Notes
        <input name="notes" type="text" value="${escapeAttr(log.notes || "")}">
      </label>
      <div class="activity-log-edit-actions">
        <button class="primary" type="submit">Done</button>
      </div>
      <p class="activity-log-edit-status" aria-live="polite"></p>
    </form>
  `;

  row.querySelector("form").addEventListener("submit", (event) => saveActivityLogEdit(event, log, cardKey));
  row.querySelector("[type='submit']").addEventListener("click", (event) => {
    event.preventDefault();
    saveActivityLogEdit(event, log, cardKey);
  });
}

async function saveActivityLogEdit(event, log, cardKey) {
  event.preventDefault();
  event.stopPropagation();
  const form = event.currentTarget.closest("form") || event.currentTarget.form;
  const status = form.querySelector(".activity-log-edit-status");
  const data = Object.fromEntries(new FormData(form).entries());
  const conflict = transitionConflict({ ...log, ...data }, log.id);
  if (conflict) {
    status.textContent = conflict;
    return;
  }
  status.textContent = "Saving...";

  try {
    const result = await fetchJson(`/api/logs/${encodeURIComponent(log.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ time: data.time, notes: data.notes })
    });

    const index = state.logs.findIndex((item) => item.id === result.log.id);
    if (index !== -1) state.logs[index] = result.log;
    state.recent = result.recent;
    state.summary = result.todaySummary;
    renderAll();
    openActivityLogs(cardKey);
    showReaction("Log updated", labelForLog(result.log));
  } catch (error) {
    status.textContent = `Save failed: ${error.message}`;
  }
}

function activityIconForLog(log, cardKey) {
  const icons = {
    sleep: log.status === "awake" ? "awake" : "asleep",
    feeding: log.side === "right" ? "right" : "left",
    bottle: "bottle",
    diaper: log.poop ? "poop" : "pee",
    bath: "bath",
    tummy_time: log.status === "end" ? "tummy-end" : "tummy-start",
    baby_gym: "gym"
  };
  const fallbackByCard = {
    boobie: "left",
    gym: "gym",
    tummy: "tummy-start"
  };
  return `/assets/activity/icon-${icons[log.type] || fallbackByCard[cardKey] || "success"}.png`;
}

function logsForActivityCard(cardKey) {
  const filters = {
    sleep: (log) => log.type === "sleep",
    boobie: (log) => log.type === "feeding" && log.method === "breast",
    bottle: (log) => log.type === "bottle",
    diaper: (log) => log.type === "diaper",
    bath: (log) => log.type === "bath",
    tummy: (log) => log.type === "tummy_time",
    gym: (log) => log.type === "baby_gym"
  };
  const matches = filters[cardKey] || (() => false);
  return state.logs.filter(matches);
}

function setupHistoryFilters() {
  const form = document.getElementById("history-filters");
  const typeContainer = document.getElementById("history-type-filters");
  if (!form || !typeContainer) return;

  typeContainer.innerHTML = historyEventTypes.map((type) => `
    <label>
      <input type="checkbox" value="${escapeAttr(type.value)}" ${type.value === "all" ? "checked" : ""}>
      ${escapeHtml(type.label)}
    </label>
  `).join("");

  document.getElementById("history-start-date").addEventListener("change", updateHistoryFilters);
  document.getElementById("history-end-date").addEventListener("change", updateHistoryFilters);
  typeContainer.addEventListener("change", updateHistoryFilters);
}

function updateHistoryFilters(event) {
  const typeContainer = document.getElementById("history-type-filters");
  const boxes = Array.from(typeContainer.querySelectorAll("input[type='checkbox']"));
  const allBox = boxes.find((box) => box.value === "all");
  let selected = boxes.filter((box) => box.checked).map((box) => box.value);

  if (event?.target?.value === "all" && event.target.checked) {
    boxes.forEach((box) => {
      box.checked = box.value === "all";
    });
    selected = ["all"];
  } else if (event?.target?.value !== "all") {
    if (allBox) allBox.checked = false;
    selected = boxes.filter((box) => box.checked && box.value !== "all").map((box) => box.value);
    if (!selected.length && allBox) {
      allBox.checked = true;
      selected = ["all"];
    }
  }

  state.historyFilters = {
    startDate: document.getElementById("history-start-date")?.value || "",
    endDate: document.getElementById("history-end-date")?.value || "",
    types: selected.includes("all") ? ["all"] : selected
  };
  renderHistory();
}

function setupSettingsPanel() {
  document.getElementById("profile-form").addEventListener("submit", saveProfile);
  document.getElementById("bath-reminder-form").addEventListener("submit", saveBathReminder);
  document.getElementById("tummy-reminder-form").addEventListener("submit", saveTummyReminder);
  document.getElementById("reminder-voice-select").addEventListener("change", saveReminderVoice);
  document.getElementById("test-reminder-voice").addEventListener("click", testReminderVoice);
  document.getElementById("clear-data-button").addEventListener("click", clearData);
}

function renderSettings() {
  const birthdayInput = document.getElementById("birthday-input");
  if (birthdayInput && document.activeElement !== birthdayInput) birthdayInput.value = state.profile.birthday || "";

  const reminderInput = document.getElementById("bath-reminder-seconds");
  if (reminderInput && document.activeElement !== reminderInput) reminderInput.value = state.bathReminderSeconds;

  const tummyReminderInput = document.getElementById("tummy-reminder-seconds");
  if (tummyReminderInput && document.activeElement !== tummyReminderInput) tummyReminderInput.value = state.tummyReminderSeconds;

  renderVoiceOptions();

  const container = document.getElementById("category-settings");
  if (!container) return;

  container.innerHTML = activities.map((activity) => `
    <label class="category-toggle">
      <input type="checkbox" value="${activity.key}" ${state.visibleCards.includes(activity.key) ? "checked" : ""}>
      <span>${activity.title}</span>
    </label>
  `).join("");

  container.querySelectorAll("input").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const selected = Array.from(container.querySelectorAll("input:checked")).map((input) => input.value);
      state.visibleCards = selected.length ? selected : activities.map((activity) => activity.key);
      saveVisibleCards();
      renderActivities();
      renderActivityStats();
      updateActivityButtons();
      renderSettings();
      showSettingsStatus("Category cards updated.");
    });
  });
}

function renderVoiceOptions() {
  const select = document.getElementById("reminder-voice-select");
  if (!select || document.activeElement === select) return;

  const voices = loadSpeechVoices();
  const current = state.reminderVoiceURI;
  select.innerHTML = `
    <option value="">Device default</option>
    ${voices.map((voice) => `
      <option value="${escapeAttr(voice.voiceURI)}">${escapeHtml(formatVoiceLabel(voice))}</option>
    `).join("")}
  `;
  select.value = voices.some((voice) => voice.voiceURI === current) ? current : "";
}

function saveReminderVoice(event) {
  state.reminderVoiceURI = event.target.value;
  saveReminderVoiceURI();
  showSettingsStatus(state.reminderVoiceURI ? "Reminder voice saved for this device." : "Reminder voice set to device default.");
}

function testReminderVoice() {
  prepareReminderSound("Two minutes");
}

function saveBathReminder(event) {
  event.preventDefault();
  const input = document.getElementById("bath-reminder-seconds");
  const seconds = Math.round(Number(input.value));
  if (!Number.isFinite(seconds) || seconds < 5) {
    showSettingsStatus("Bath reminder must be at least 5 seconds.");
    return;
  }

  state.bathReminderSeconds = Math.min(3600, seconds);
  state.lastBathAnnouncementStep = 0;
  saveBathReminderSeconds();
  renderAll();
  showSettingsStatus(`Bath reminder saved: every ${formatReminderPeriod(state.bathReminderSeconds)}.`);
  showReaction("Bath reminder saved", `Every ${formatReminderPeriod(state.bathReminderSeconds)}`);
}

function saveTummyReminder(event) {
  event.preventDefault();
  const input = document.getElementById("tummy-reminder-seconds");
  const seconds = Math.round(Number(input.value));
  if (!Number.isFinite(seconds) || seconds < 5) {
    showSettingsStatus("Tummy reminder must be at least 5 seconds.");
    return;
  }

  state.tummyReminderSeconds = Math.min(3600, seconds);
  state.lastTummyAnnouncementStep = 0;
  saveTummyReminderSeconds();
  renderAll();
  showSettingsStatus(`Tummy reminder saved: every ${formatReminderPeriod(state.tummyReminderSeconds)}.`);
  showReaction("Tummy reminder saved", `Every ${formatReminderPeriod(state.tummyReminderSeconds)}`);
}

async function saveProfile(event) {
  event.preventDefault();
  const birthday = document.getElementById("birthday-input").value;
  showSettingsStatus("Saving birthday...");

  try {
    const result = await fetchJson("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birthday })
    });
    state.profile = result.profile || {};
    renderAll();
    showSettingsStatus("Birthday saved.");
    showReaction("Profile saved", birthday || "Birthday cleared");
  } catch (error) {
    showSettingsStatus(`Save failed: ${error.message}`);
  }
}

async function clearData() {
  if (!confirm("Clear all logs and milestones? This resets cards, history, today totals, milestone progress, and recent info.")) return;
  showSettingsStatus("Clearing data...");

  try {
    const result = await fetchJson("/api/logs", { method: "DELETE" });
    state.logs = [];
    state.recent = result.recent || {};
    state.summary = result.todaySummary || {};
    state.milestoneProgress = result.milestone_progress || {};
    renderAll();
    showSettingsStatus("All logs and milestones cleared.");
    showReaction("Data cleared", "Logs and milestones reset.");
  } catch (error) {
    showSettingsStatus(`Clear failed: ${error.message}`);
  }
}

async function deleteLog(logId, cardKey = "") {
  const log = state.logs.find((item) => item.id === logId);
  if (!log) return;
  if (!confirm(`Delete this log?\n\n${labelForLog(log)} at ${formatLogClock(log)}`)) return;

  try {
    const result = await fetchJson(`/api/logs/${encodeURIComponent(logId)}`, { method: "DELETE" });
    state.logs = state.logs.filter((item) => item.id !== logId);
    state.recent = result.recent || state.recent;
    state.summary = result.todaySummary || state.summary;
    renderAll();
    if (cardKey) openActivityLogs(cardKey);
    showReaction("Log deleted", labelForLog(log));
  } catch (error) {
    showToast(`Delete failed: ${error.message}`);
  }
}

function showSettingsStatus(message) {
  const element = document.getElementById("settings-status");
  if (element) element.textContent = message;
}

function loadVisibleCards() {
  try {
    const saved = JSON.parse(storageGet("visibleCards") || "[]");
    if (Array.isArray(saved) && saved.length) {
      const validKeys = new Set(activities.map((activity) => activity.key));
      const filtered = saved.filter((key) => validKeys.has(key));
      if (filtered.length) return filtered;
    }
  } catch {
    return activities.map((activity) => activity.key);
  }
  return activities.map((activity) => activity.key);
}

function saveVisibleCards() {
  storageSet("visibleCards", JSON.stringify(state.visibleCards));
}

function loadBathReminderSeconds() {
  const saved = Number(storageGet("bathReminderSeconds"));
  return Number.isFinite(saved) && saved >= 5 ? Math.min(3600, Math.round(saved)) : 120;
}

function saveBathReminderSeconds() {
  storageSet("bathReminderSeconds", String(state.bathReminderSeconds));
}

function loadTummyReminderSeconds() {
  const saved = Number(storageGet("tummyReminderSeconds"));
  return Number.isFinite(saved) && saved >= 5 ? Math.min(3600, Math.round(saved)) : 120;
}

function saveTummyReminderSeconds() {
  storageSet("tummyReminderSeconds", String(state.tummyReminderSeconds));
}

function loadReminderVoiceURI() {
  return storageGet("reminderVoiceURI") || "";
}

function saveReminderVoiceURI() {
  if (state.reminderVoiceURI) {
    storageSet("reminderVoiceURI", state.reminderVoiceURI);
  } else {
    storageRemove("reminderVoiceURI");
  }
}

function storageGet(key) {
  try {
    return window.localStorage?.getItem(key) || "";
  } catch {
    return "";
  }
}

function storageSet(key, value) {
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    return false;
  }
  return true;
}

function storageRemove(key) {
  try {
    window.localStorage?.removeItem(key);
  } catch {
    return false;
  }
  return true;
}

async function createLog(payload, reminder) {
  try {
    const conflict = transitionConflict(payload);
    if (conflict) {
      showToast(conflict);
      return;
    }

    const result = await fetchJson("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    state.logs.push(result.log);
    state.recent = result.recent;
    state.summary = result.todaySummary;
    renderAll();
    showReaction("Yay, logged!", reminder || labelForLog(result.log));
  } catch (error) {
    showToast(`Could not log activity: ${error.message}`);
  }
}

function openBottleDialog() {
  updateBottleDefaults();
  document.getElementById("bottle-dialog").showModal();
}

function updateBottleDefaults() {
  const slider = document.getElementById("bottle-slider");
  const amount = Math.min(8, Math.max(0, Number(state.recent.bottleOunces || 3)));
  slider.value = amount;
  document.getElementById("bottle-value").textContent = amount.toFixed(2).replace(/0$/, "");
}

function startTicker() {
  if (state.ticker) return;
  state.ticker = setInterval(async () => {
    updateClock();
    if (state.currentDate !== todayString()) {
      state.currentDate = todayString();
      await refreshData();
      return;
    }
    renderActivityStats();
    updateActivityButtons();
    announceBathProgress();
    announceTummyProgress();
  }, 1000);
}

function updateClock() {
  const clock = document.getElementById("current-clock");
  if (!clock) return;
  const now = new Date();
  clock.dateTime = now.toISOString();
  clock.textContent = now.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  });
}

function renderActivityStats() {
  const stats = getActivityStats();
  updateSleepHeader();
  Object.entries(stats).forEach(([key, stat]) => {
    const element = document.querySelector(`[data-card-info="${key}"]`);
    if (!element) return;
    element.innerHTML = `
      ${stat.html || `
        <span>${stat.label}</span>
        <strong>${stat.value}</strong>
        <small>${stat.helper}</small>
      `}
    `;
  });
}

function updateSleepHeader() {
  const card = document.querySelector('[data-activity-card="sleep"]');
  const subtitle = document.querySelector('[data-card-subtitle="sleep"]');
  if (!card || !subtitle) return;

  const sleep = getCurrentState("sleep");
  const isSleeping = sleep.status === "asleep";
  card.style.setProperty("--card-image", `url('/assets/activity/header-sleep-${isSleeping ? "asleep" : "awake"}.png')`);
  card.classList.toggle("sleeping-header", isSleeping);
  card.classList.toggle("awake-header", !isSleeping);
  subtitle.textContent = isSleeping ? "Baby is sleeping." : "Baby is awaking.";
}

function updateActivityButtons() {
  const sleep = getCurrentState("sleep");
  const tummy = getCurrentState("tummy_time");
  const bath = getCurrentState("bath");

  document.querySelectorAll(".action-button").forEach((button) => {
    const card = button.dataset.card;
    const label = button.dataset.actionLabel;
    const shouldDisable =
      (card === "sleep" && ((sleep.status === "asleep" && label === "Asleep") || (sleep.status === "awake" && label === "Awake"))) ||
      (card === "tummy" && ((tummy.status === "start" && label === "Start") || (tummy.status === "end" && label === "End"))) ||
      (card === "bath" && ((bath.status === "start" && label === "Start") || (bath.status === "end" && label === "Stop")));

    button.disabled = shouldDisable;
    button.setAttribute("aria-disabled", shouldDisable ? "true" : "false");
  });

  document.querySelectorAll("[data-bath-sound-toggle]").forEach((button) => {
    button.classList.toggle("sound-on", state.bathSoundEnabled);
    button.setAttribute("aria-label", `Bath sound is ${state.bathSoundEnabled ? "on" : "off"}`);
    button.setAttribute("aria-pressed", state.bathSoundEnabled ? "true" : "false");
  });

  document.querySelectorAll("[data-tummy-sound-toggle]").forEach((button) => {
    button.classList.toggle("sound-on", state.tummySoundEnabled);
    button.setAttribute("aria-label", `Tummy Time sound is ${state.tummySoundEnabled ? "on" : "off"}`);
    button.setAttribute("aria-pressed", state.tummySoundEnabled ? "true" : "false");
  });
}

function getActivityStats() {
  const sleep = getCurrentState("sleep");
  const tummy = getCurrentState("tummy_time");
  const bath = getCurrentState("bath");
  const todaySummary = summarizeLogsToday();
  const sleepLabel = sleep.status === "asleep" ? "Asleep" : "Awake";
  const tummyLabel = tummy.status === "start" ? "Started" : "Ended";
  const bathLabel = bath.status === "start" ? "Bathing" : "Stopped";

  return {
    sleep: {
      label: `${sleepLabel} ${formatDuration(elapsedTodaySince(sleep.log))}${formatSince(sleep.log)}`,
      value: formatTotalDuration(totalToday("sleep", "asleep", "awake")),
      helper: "Total sleep today"
    },
    boobie: {
      label: "Breast feeds",
      value: todaySummary.breastFeeds,
      helper: `<small>➡️ Next side with good latch (breast should not be too full): ${state.recent.nextBreastSide || "left"}</small>
              <br>
              <small> 
               <small>🌙 Empty breasts before sleep</small>`
    },
    bottle: {
      label: "Bottle total",
      value: `${todaySummary.bottleOunces} oz`,
      helper: `Last time ${formatSinceTime(lastLogOfType("bottle"))}`
    },
    diaper: {
      html: `
        <div class="hygiene-list">
          <span><img src="/assets/activity/icon-pee.png" alt="">${todaySummary.wetDiapers} wee</span>
          <span><img src="/assets/activity/icon-poop.png" alt="">${todaySummary.poops} poo</span>
        </div>
      `
    },
    bath: {
      label: `${bathLabel} ${formatDuration(elapsedTodaySince(bath.log))}${formatSince(bath.log)}`,
      value: formatTotalDuration(totalToday("bath", "start", "end")),
      helper: `Sound ${state.bathSoundEnabled ? "on" : "off"} - every ${formatReminderPeriod(state.bathReminderSeconds)}`
    },
    tummy: {
      label: `${tummyLabel} ${formatDuration(elapsedTodaySince(tummy.log))}${formatSince(tummy.log)}`,
      value: formatTotalDuration(totalToday("tummy_time", "start", "end")),
      helper: `Sound ${state.tummySoundEnabled ? "on" : "off"} - every ${formatReminderPeriod(state.tummyReminderSeconds)}`
    },
    gym: {
      label: "Baby gym",
      value: todaySummary.babyGymEvents,
      helper: "Play sessions today"
    }
  };
}

function summarizeLogsToday() {
  const logs = todayLogs();
  const count = (predicate) => logs.filter(predicate).length;
  const sum = (predicate, field) => logs.filter(predicate).reduce((total, log) => total + Number(log[field] || 0), 0);

  return {
    breastFeeds: count((log) => log.type === "feeding" && log.method === "breast"),
    bottleOunces: +sum((log) => log.type === "bottle", "ounces").toFixed(1),
    wetDiapers: count((log) => log.type === "diaper" && log.pee),
    poops: count((log) => log.type === "diaper" && log.poop),
    baths: count((log) => log.type === "bath" && (log.status === "start" || !log.status)),
    babyGymEvents: count((log) => log.type === "baby_gym")
  };
}

function getCurrentState(type) {
  const now = Date.now();
  const events = state.logs
    .filter((log) => log.type === type && log.status)
    .filter((log) => logTime(log) <= now)
    .sort((a, b) => logTime(b) - logTime(a));
  const log = events[0] || null;
  const fallback = type === "sleep" ? "awake" : "end";
  return { status: log?.status || fallback, log };
}

function pairedConfig(type) {
  const configs = {
    sleep: { start: "asleep", end: "awake", startLabel: "asleep", endLabel: "awake" },
    tummy_time: { start: "start", end: "end", startLabel: "started", endLabel: "ended" },
    bath: { start: "start", end: "end", startLabel: "started", endLabel: "stopped" }
  };
  return configs[type] || null;
}

function transitionConflict(input, excludeId) {
  const config = pairedConfig(input.type);
  if (!config || !input.status) return "";

  const eventTime = input.date && input.time
    ? logTime({ date: input.date, time: input.time })
    : Date.now();
  if (eventTime > Date.now() + 30 * 1000) return "Time cannot be in the future.";

  const activeBefore = isActiveAt(input.type, eventTime, excludeId);
  const isStart = input.status === config.start;
  const isEnd = input.status === config.end;

  if (isStart && activeBefore) return `Already ${config.startLabel}. Stop first to avoid overlapping time.`;
  if (isEnd && !activeBefore) return `Already ${config.endLabel}. Start first before stopping.`;

  const next = nextTimedStatus(input.type, eventTime, excludeId);
  if (next && isStart && next.status === config.start) return `This would overlap with another ${config.startLabel} time.`;
  if (next && isEnd && next.status === config.end) return `This would create two stop events in a row.`;
  return "";
}

function isActiveAt(type, atTime, excludeId) {
  const config = pairedConfig(type);
  let active = false;
  state.logs
    .filter((log) => log.id !== excludeId && log.type === type && log.status && logTime(log) < atTime)
    .sort((a, b) => logTime(a) - logTime(b))
    .forEach((log) => {
      if (log.status === config.start) active = true;
      if (log.status === config.end) active = false;
    });
  return active;
}

function nextTimedStatus(type, atTime, excludeId) {
  return state.logs
    .filter((log) => log.id !== excludeId && log.type === type && log.status && logTime(log) > atTime)
    .sort((a, b) => logTime(a) - logTime(b))[0] || null;
}

function lastLogOfType(type) {
  return state.logs
    .filter((log) => log.type === type)
    .sort((a, b) => logTime(b) - logTime(a))[0] || null;
}

async function toggleBathSound() {
  state.bathSoundEnabled = !state.bathSoundEnabled;
  state.lastBathAnnouncementStep = 0;
  if (state.bathSoundEnabled) prepareReminderSound("Bath sound on");
  if (!state.bathSoundEnabled) stopReminderSound();
  updateActivityButtons();
  renderActivityStats();
  showReaction(state.bathSoundEnabled ? "Bath sound on" : "Bath sound off", `Every ${formatReminderPeriod(state.bathReminderSeconds)}`);
  await saveSoundSettings();
}

async function toggleTummySound() {
  state.tummySoundEnabled = !state.tummySoundEnabled;
  state.lastTummyAnnouncementStep = 0;
  if (state.tummySoundEnabled) prepareReminderSound("Tummy sound on");
  if (!state.tummySoundEnabled) stopReminderSound();
  updateActivityButtons();
  renderActivityStats();
  showReaction(state.tummySoundEnabled ? "Tummy sound on" : "Tummy sound off", `Every ${formatReminderPeriod(state.tummyReminderSeconds)}`);
  await saveSoundSettings();
}

async function saveSoundSettings() {
  try {
    const result = await fetchJson("/api/sound-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bathSoundEnabled: state.bathSoundEnabled,
        tummySoundEnabled: state.tummySoundEnabled
      })
    });
    state.bathSoundEnabled = Boolean(result.sound_settings?.bathSoundEnabled);
    state.tummySoundEnabled = Boolean(result.sound_settings?.tummySoundEnabled);
    updateActivityButtons();
    renderActivityStats();
  } catch (error) {
    showToast(`Could not save sound setting: ${error.message}`);
  }
}

function prepareReminderSound(message) {
  loadSpeechVoices();
  unlockReminderAudio();
  speakReminder(message);
}

function setupSpeechVoices() {
  loadSpeechVoices();
  if (!("speechSynthesis" in window) || !("onvoiceschanged" in window.speechSynthesis)) return;
  window.speechSynthesis.onvoiceschanged = () => {
    renderVoiceOptions();
  };
}

function loadSpeechVoices() {
  if (!("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices();
}

function formatVoiceLabel(voice) {
  const parts = [voice.name];
  if (voice.lang) parts.push(voice.lang);
  if (voice.localService === false) parts.push("online");
  return parts.join(" - ");
}

function unlockReminderAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  if (!state.audioContext) state.audioContext = new AudioContextClass();
  if (state.audioContext.state === "suspended") state.audioContext.resume();
}

function stopReminderSound() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

function speakReminder(message) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    playReminderChime();
    return;
  }

  let started = false;
  const utterance = new SpeechSynthesisUtterance(message);
  const voice = pickReminderVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || "en-US";
  utterance.pitch = 1.18;
  utterance.rate = 0.92;
  utterance.volume = 1;
  utterance.onstart = () => {
    started = true;
  };
  utterance.onerror = () => {
    if (!started) playReminderChime();
  };

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  setTimeout(() => {
    if (!started && !window.speechSynthesis.speaking) playReminderChime();
  }, 900);
}

function pickReminderVoice() {
  const voices = loadSpeechVoices();
  const selected = voices.find((voice) => voice.voiceURI === state.reminderVoiceURI);
  if (selected) return selected;

  return (
    voices.find((voice) => /samantha/i.test(`${voice.name} ${voice.voiceURI}`)) ||
    voices.find((voice) => isGoogleUSEnglishVoice(voice)) ||
    voices.find((voice) => /ava|allison|susan|karen|moira|tessa|zira|jenny|aria|female|girl/i.test(`${voice.name} ${voice.voiceURI}`)) ||
    voices.find((voice) => /^en(-|_)/i.test(voice.lang)) ||
    voices[0] ||
    null
  );
}

function isGoogleUSEnglishVoice(voice) {
  const label = `${voice.name} ${voice.voiceURI} ${voice.lang}`.toLowerCase();
  const isGoogle = label.includes("google");
  const isUSEnglish = label.includes("us english") || /^en(-|_)us$/i.test(voice.lang || "");
  return isGoogle && isUSEnglish;
}

function playReminderChime() {
  unlockReminderAudio();
  const audioContext = state.audioContext;
  if (!audioContext) return;

  const now = audioContext.currentTime;
  [660, 880].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = now + index * 0.14;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.2);
  });
}

function announceBathProgress() {
  if (!state.bathSoundEnabled) return;

  const bath = getCurrentState("bath");
  if (bath.status !== "start" || !bath.log) {
    state.lastBathAnnouncementStep = 0;
    return;
  }

  const seconds = Math.floor(elapsedSince(bath.log) / 1000);
  const step = Math.floor(seconds / state.bathReminderSeconds);
  if (step < 1 || step === state.lastBathAnnouncementStep) return;

  state.lastBathAnnouncementStep = step;
  const elapsedSeconds = step * state.bathReminderSeconds;
  speakReminder(formatSpokenReminder(elapsedSeconds));
}

function announceTummyProgress() {
  if (!state.tummySoundEnabled) return;

  const tummy = getCurrentState("tummy_time");
  if (tummy.status !== "start" || !tummy.log) {
    state.lastTummyAnnouncementStep = 0;
    return;
  }

  const seconds = Math.floor(elapsedSince(tummy.log) / 1000);
  const step = Math.floor(seconds / state.tummyReminderSeconds);
  if (step < 1 || step === state.lastTummyAnnouncementStep) return;

  state.lastTummyAnnouncementStep = step;
  const elapsedSeconds = step * state.tummyReminderSeconds;
  speakReminder(formatSpokenReminder(elapsedSeconds));
}

function formatSpokenReminder(seconds) {
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${numberWords(minutes)} ${minutes === 1 ? "minute" : "minutes"}`;
  }
  return `${numberWords(seconds)} ${seconds === 1 ? "second" : "seconds"}`;
}

function formatReminderPeriod(seconds) {
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }
  return `${seconds} seconds`;
}

function numberWords(value) {
  if (value >= 1000) return String(value);
  const words = {
    0: "zero", 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine",
    10: "ten", 11: "eleven", 12: "twelve", 13: "thirteen", 14: "fourteen", 15: "fifteen", 16: "sixteen",
    17: "seventeen", 18: "eighteen", 19: "nineteen", 20: "twenty", 30: "thirty", 40: "forty", 50: "fifty",
    60: "sixty", 70: "seventy", 80: "eighty", 90: "ninety"
  };
  if (words[value]) return words[value];
  if (value < 100) return `${words[Math.floor(value / 10) * 10]} ${words[value % 10]}`;
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  return `${words[hundreds]} hundred${remainder ? ` ${numberWords(remainder)}` : ""}`;
}

function totalToday(type, startStatus, endStatus) {
  const { start: dayStart, end: dayEnd } = todayBounds();
  const now = Date.now();
  const clipEnd = Math.min(dayEnd, now);
  let totalMs = 0;
  let activeStart = null;

  state.logs
    .filter((log) => log.type === type)
    .filter((log) => logTime(log) <= clipEnd)
    .sort((a, b) => logTime(a) - logTime(b))
    .forEach((log) => {
      if (log.date === todayString() && Number(log.minutes)) totalMs += Number(log.minutes) * 60 * 1000;
      if (log.status === startStatus && !activeStart) activeStart = logTime(log);
      if (log.status === endStatus && activeStart) {
        totalMs += clippedDuration(activeStart, logTime(log), dayStart, clipEnd);
        activeStart = null;
      }
    });

  if (activeStart) totalMs += clippedDuration(activeStart, clipEnd, dayStart, clipEnd);
  return totalMs;
}

function elapsedSince(log) {
  if (!log) return 0;
  return Math.max(0, Date.now() - logTime(log));
}

function elapsedTodaySince(log) {
  if (!log) return 0;
  const { start: dayStart } = todayBounds();
  return Math.max(0, Date.now() - Math.max(logTime(log), dayStart));
}

function todayBounds() {
  const startDate = new Date(`${todayString()}T00:00:00`);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);
  return { start: startDate.getTime(), end: endDate.getTime() };
}

function clippedDuration(start, end, clipStart, clipEnd) {
  return Math.max(0, Math.min(end, clipEnd) - Math.max(start, clipStart));
}

function todayLogs() {
  const today = todayString();
  return state.logs.filter((log) => log.date === today);
}

function formatBabyAge(birthday) {
  if (!birthday) return "";

  const birthDate = new Date(`${birthday}T00:00:00`);
  const today = new Date(`${todayString()}T00:00:00`);

  if (!Number.isFinite(birthDate.getTime()) || birthDate > today) return "";

  let months =
    (today.getFullYear() - birthDate.getFullYear()) * 12 +
    (today.getMonth() - birthDate.getMonth());

  const monthAnchor = new Date(birthDate);
  monthAnchor.setMonth(birthDate.getMonth() + months);

  if (monthAnchor > today) {
    months -= 1;
    monthAnchor.setMonth(birthDate.getMonth() + months);
  }

  const daysAfterMonths = Math.floor((today - monthAnchor) / 86400000);
  const weeks = Math.floor(daysAfterMonths / 7);
  const days = daysAfterMonths % 7;

  const part = (value, unit) => value ? `${value} ${unit}${value === 1 ? "" : "s"}` : "";

  if (months < 1) {
    const totalDays = Math.floor((today - birthDate) / 86400000);
    const babyWeeks = Math.floor(totalDays / 7);
    const babyDays = totalDays % 7;
    return [part(babyWeeks, "week"), part(babyDays, "day")].filter(Boolean).join(" ") || "0 days old";
  }

  return [
    part(months, "month"),
    part(weeks, "week"),
    part(days, "day")
  ].filter(Boolean).join(" ") + " old";
}

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function logTime(log) {
  const [hour = "00", minute = "00"] = String(log.time || "00:00").split(":");
  const local = new Date(`${log.date || todayString()}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00`);
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

function formatDuration(value) {
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function formatTotalDuration(value) {
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")} hrs ${String(minutes).padStart(2, "0")}min ${String(seconds).padStart(2, "0")}sec`;
}

function formatSince(log) {
  if (!log) return "";
  const date = new Date(logTime(log));
  if (Number.isNaN(date.getTime())) return "";

  const dayLabel = date.toDateString() === new Date().toDateString() ? "today" : "yesterday";
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return ` since ${time} ${dayLabel}`;
}

function formatSinceTime(log) {
  if (!log) return "not logged yet";
  const date = new Date(logTime(log));
  if (Number.isNaN(date.getTime())) return "not logged yet";
  const dayLabel = date.toDateString() === new Date().toDateString() ? "today" : "yesterday";
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${time} ${dayLabel}`;
}

function formatLogClock(log) {
  const date = new Date(logTime(log));
  if (Number.isNaN(date.getTime())) return log.time || "--:--";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function renderTodaySummary() {
  const container = document.getElementById("today-metrics");
  if (!container) return;

  const cards = [
    ["Logs", state.summary.totalLogs || 0, "All activities"],
    ["Breast", state.summary.breastFeeds || 0, "Feeds"],
    ["Bottle", `${state.summary.bottleOunces || 0} oz`, "Today total"],
    ["Wee", state.summary.wetDiapers || 0, "Wee diapers"],
    ["Poo", state.summary.poops || 0, "Poo diapers"],
    ["Sleep", state.summary.sleepEvents || 0, "Sleep events"],
    ["Bath", state.summary.baths || 0, "Baths"],
    ["Tummy", state.summary.tummyTimeEvents || 0, "Start/end taps"]
  ];

  container.innerHTML = cards.map(([label, value, helper]) => `
    <article class="metric">
      <p>${label}</p>
      <strong>${value}</strong>
      <p>${helper}</p>
    </article>
  `).join("");
}

function renderRecent() {
  const container = document.getElementById("recent-list");
  if (!container) return;

  const rows = [
    ["Next breast side", state.recent.nextBreastSide || "left"],
    ["Last bottle", formatSinceTime(lastLogOfType("bottle"))],
    ["Last feed", formatWhen(state.recent.lastFeedAt)],
    ["Last sleep", formatWhen(state.recent.lastSleepAt)],
    ["Last diaper", formatWhen(state.recent.lastDiaperAt)],
    ["Last activity", formatWhen(state.recent.lastActivityAt)]
  ];

  container.innerHTML = rows.map(([label, value]) => `
    <div class="recent-row">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");
}

function renderHistory() {
  const list = document.getElementById("history-list");
  const logs = filteredHistoryLogs();
  list.innerHTML = logs.length ? logs.map((log) => `
    ${renderHistoryLogRow(log)}
  `).join("") : `<p class="empty-state">No logs match these filters.</p>`;

  list.querySelectorAll("[data-history-edit]").forEach((button) => {
    button.addEventListener("click", () => startHistoryEdit(button.dataset.historyEdit));
  });
  list.querySelectorAll("[data-delete-log]").forEach((button) => {
    button.addEventListener("click", () => deleteLog(button.dataset.deleteLog));
  });
}

function filteredHistoryLogs() {
  const filters = state.historyFilters || {};
  const types = filters.types || ["all"];
  return state.logs
    .filter((log) => {
      if (filters.startDate && log.date < filters.startDate) return false;
      if (filters.endDate && log.date > filters.endDate) return false;
      if (!types.includes("all") && !types.includes(log.type)) return false;
      return true;
    })
    .sort((a, b) => logTime(b) - logTime(a))
    .slice(0, 80);
}

function renderHistoryLogRow(log) {
  return `
    <div class="list-item history-log-row" data-history-row="${escapeAttr(log.id)}">
      <img class="history-log-icon" src="${activityIconForLog(log)}" alt="">
      <div>
        <span>Date</span>
        <strong>${escapeHtml(formatDisplayDate(log.date || ""))}</strong>
      </div>
      <div>
        <span>Time</span>
        <strong>${escapeHtml(formatLogClock(log))}</strong>
      </div>
      <div class="history-log-main">
        <span>${escapeHtml(log.type || "Log")}</span>
        <strong>${escapeHtml(labelForLog(log))}</strong>
        ${log.notes ? `<small>${escapeHtml(log.notes)}</small>` : ""}
      </div>
      ${renderLogMenu(log)}
    </div>
  `;
}

function startHistoryEdit(logId) {
  const log = state.logs.find((item) => item.id === logId);
  const row = Array.from(document.querySelectorAll("[data-history-row]")).find((item) => item.dataset.historyRow === logId);
  if (!log || !row) return;

  row.outerHTML = `
    <form class="list-item history-editor" data-log-id="${escapeAttr(log.id)}">
      <label>
        Date
        <input name="date" type="date" value="${escapeAttr(log.date || "")}">
      </label>
      <label>
        Time
        <input name="time" type="time" value="${escapeAttr(log.time || "")}">
      </label>
      ${renderCorrectionField(log)}
      <label class="history-notes">
        Notes
        <input name="notes" type="text" value="${escapeAttr(log.notes || "")}">
      </label>
      <button class="primary history-save" type="submit">Save</button>
      <button class="ghost history-cancel" type="button" data-history-cancel="${escapeAttr(log.id)}">Cancel</button>
      <p class="history-status" aria-live="polite">${escapeHtml(labelForLog(log))}</p>
    </form>
  `;

  const form = Array.from(document.querySelectorAll(".history-editor")).find((item) => item.dataset.logId === logId);
  form.addEventListener("submit", saveHistoryCorrection);
  form.querySelector("[data-history-cancel]").addEventListener("click", renderHistory);
}

function renderCorrectionField(log) {
  if (log.type === "sleep") {
    return `
      <label>
        Status
        <select name="status">
          <option value="asleep"${log.status === "asleep" ? " selected" : ""}>Asleep</option>
          <option value="awake"${log.status === "awake" ? " selected" : ""}>Awake</option>
        </select>
      </label>
    `;
  }

  if (log.type === "tummy_time") {
    return `
      <label>
        Status
        <select name="status">
          <option value="start"${log.status === "start" ? " selected" : ""}>Start</option>
          <option value="end"${log.status === "end" ? " selected" : ""}>End</option>
        </select>
      </label>
    `;
  }

  if (log.type === "bath") {
    return `
      <label>
        Status
        <select name="status">
          <option value="start"${log.status === "start" || !log.status ? " selected" : ""}>Start</option>
          <option value="end"${log.status === "end" ? " selected" : ""}>Stop</option>
        </select>
      </label>
    `;
  }

  if (log.type === "feeding") {
    return `
      <label>
        Side
        <select name="side">
          <option value="left"${log.side === "left" ? " selected" : ""}>Left</option>
          <option value="right"${log.side === "right" ? " selected" : ""}>Right</option>
        </select>
      </label>
    `;
  }

  if (log.type === "bottle") {
    return `
      <label>
        Ounces
        <input name="ounces" type="number" min="0" max="8" step="0.25" value="${escapeAttr(log.ounces || 0)}">
      </label>
    `;
  }

  if (log.type === "diaper") {
    const kind = log.poop ? "poop" : "pee";
    return `
      <label>
        Kind
        <select name="kind">
          <option value="pee"${kind === "pee" ? " selected" : ""}>Wee</option>
          <option value="poop"${kind === "poop" ? " selected" : ""}>Poo</option>
        </select>
      </label>
    `;
  }

  return `
    <label>
      Type
      <input name="typeLabel" type="text" value="${escapeAttr(labelForLog(log))}" disabled>
    </label>
  `;
}

async function saveHistoryCorrection(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector(".history-status");
  const data = Object.fromEntries(new FormData(form).entries());
  const current = state.logs.find((log) => log.id === form.dataset.logId);
  const conflict = current ? transitionConflict({ ...current, ...data }, current.id) : "";
  if (conflict) {
    status.textContent = conflict;
    return;
  }
  status.textContent = "Saving...";

  try {
    const result = await fetchJson(`/api/logs/${encodeURIComponent(form.dataset.logId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const index = state.logs.findIndex((log) => log.id === result.log.id);
    if (index !== -1) state.logs[index] = result.log;
    state.recent = result.recent;
    state.summary = result.todaySummary;
    renderAll();
    showReaction("Saved correction", labelForLog(result.log));
  } catch (error) {
    status.textContent = `Save failed: ${error.message}`;
  }
}

function labelForLog(log) {
  if (log.type === "feeding") return `Boobie, ${log.side || "unknown"} side`;
  if (log.type === "bottle") return `Bottle, ${log.ounces} oz`;
  if (log.type === "diaper") return log.poop ? "Poo diaper" : "Wee diaper";
  if (log.type === "sleep") return `Sleep: ${log.status || "logged"}`;
  if (log.type === "tummy_time") return `Tummy time: ${log.status || "logged"}`;
  if (log.type === "baby_gym") return "Baby gym time";
  if (log.type === "bath") return `Bath: ${log.status === "end" ? "stop" : "start"}`;
  return (log.type || "activity").replaceAll("_", " ");
}

function formatWhen(value) {
  if (!value) return "Not logged yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("visible"), 2400);
}

function showReaction(title, message) {
  const reaction = document.getElementById("reaction");
  document.getElementById("reaction-title").textContent = title;
  document.getElementById("reaction-message").textContent = message;
  reaction.classList.remove("visible");
  clearTimeout(showReaction.timer);
  requestAnimationFrame(() => reaction.classList.add("visible"));
  reaction.setAttribute("aria-hidden", "false");
  showReaction.timer = setTimeout(() => {
    reaction.classList.remove("visible");
    reaction.setAttribute("aria-hidden", "true");
  }, 1700);
}

function setupExportPanel(containerId) {
  const container = document.getElementById(containerId);
  const template = document.getElementById("export-controls-template");
  container.appendChild(template.content.cloneNode(true));
  const form = container.querySelector("form:last-child");
  const start = form.elements.startDate;
  const end = form.elements.endDate;
  const today = new Date().toISOString().slice(0, 10);
  start.value = addDays(today, -6);
  end.value = today;

  form.elements.rangeType.addEventListener("change", () => {
    const range = form.elements.rangeType.value;
    if (range === "daily") start.value = end.value;
    if (range === "weekly" || range === "last7") start.value = addDays(end.value, -6);
    if (range === "last30") start.value = addDays(end.value, -29);
    if (range === "monthly") start.value = `${end.value.slice(0, 7)}-01`;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = form.querySelector(".export-status");
    status.textContent = "Generating export...";

    const reportType = form.elements.reportType.value;
    const endpoint = reportType === "pediatrician-report" ? "pediatrician-report" : reportType;
    const rangeType = ["last7", "last30"].includes(form.elements.rangeType.value) ? "custom" : form.elements.rangeType.value;
    const params = new URLSearchParams({
      startDate: start.value,
      endDate: end.value,
      rangeType,
      includeCharts: form.elements.includeCharts.checked ? "true" : "false"
    });

    try {
      const response = await fetch(`/api/export/${endpoint}?${params}`);
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const fileName = match ? match[1] : `export.${endpoint}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      status.textContent = `Downloaded ${fileName}. Server copy saved in backend/exports/.`;
    } catch (error) {
      status.textContent = `Export failed: ${error.message}`;
    }
  });
}

function addDays(date, days) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
