/* LiftCut — app.js (FULL, REPLACEABLE) — v6
   What’s new in this version (per your request):
   1) First-time onboarding: user inputs (sex, height, bodyweight, bench set weight+reps, bar weight)
      → compute bench e1RM + baseline coefficients.
   2) Exercise-specific increment steps:
      - Barbells: 2.5 kg (default)
      - Leg press: 5 kg
      - Cables/machines: 2.5 kg (default)
      - Dumbbells: 2 kg/hand
      Steps are stored per exercise and can be changed later.
   3) Weight progression engine (strict rule):
      - Increase weight ONLY if ALL working sets hit the TOP of the rep range.
      - Keep weight otherwise (focus on reps).
      - If multiple sets miss the bottom of the range, decrease by one step.
   4) Suggested weight bubbles remain auto-filled but always editable.
   5) Keeps your existing timer + history editing + safe deletion.
   6) Fix retained: prevents “Next exercise” prompt double-firing (skip bug).

   Notes:
   - Machine variability is real. Onboarding seeds are a starting estimate only.
     After the first logged session, suggestions are driven primarily by your own history.
*/

const LS_KEYS = ["liftcut_state_v6", "liftcut_state_v5_history_accordion"];

/* ---------------- Program ---------------- */
const Program = {
  cycle: [
    { name: "Upper A", suggested: "Mon", key: "UA" },
    { name: "Lower A", suggested: "Tue", key: "LA" },
    { name: "Upper B (Push)", suggested: "Thu", key: "UB" },
    { name: "Upper C (Pull)", suggested: "Fri", key: "UC" },
    { name: "Lower B", suggested: "Sat", key: "LB" },
  ],
  template: {
    UA: [
      ex("bench", "Barbell Bench Press", 3, "8–10", 180, "kg"),
      ex("row", "Bent-Over Barbell Row", 3, "8–10", 180, "kg"),
      ex("ohp", "Overhead Press (Barbell)", 3, "8–10", 180, "kg"),
      ex("latpd", "Lat Pulldown / Assist", 3, "8–10", 150, "kg"),
      ex("hc", "Hammer Curl (DB)", 2, "10–12", 90, "kg/hand"),
      ex("tpd", "Triceps Pushdown (Cable)", 2, "10–12", 90, "kg"),
    ],
    LA: [
      ex("squat", "Back Squat", 3, "8–10", 210, "kg"),
      ex("rdl", "Romanian Deadlift", 3, "8–12", 180, "kg"),
      ex("lp", "Leg Press", 3, "10–12", 150, "kg"),
      ex("lunge", "Walking Lunge (DB)", 2, "12 steps/leg", 120, "kg/hand"),
      ex("calf", "Standing Calf Raise", 3, "12–15", 90, "kg"),
    ],
    UB: [
      ex("incdb", "Incline DB Press", 3, "8–12", 150, "kg/hand"),
      ex("fly", "Seated Cable Fly (High-to-Low)", 3, "10–15", 120, "kg"),
      ex("latraise", "Lateral Raise (DB)", 3, "12–15", 90, "kg/hand"),
      ex("toh", "Overhead Triceps Extension (Cable)", 3, "10–12", 120, "kg"),
      ex("facepull", "Face Pull (optional)", 2, "12–15", 90, "kg"),
    ],
    UC: [
      ex("deadlift", "Deadlift (Conventional/Trap)", 3, "6–8", 240, "kg"),
      ex("pull", "Pull-ups / Lat Pulldown", 3, "6–10", 150, "kg"),
      ex("csrow", "Chest-Supported Row", 3, "10", 150, "kg"),
      ex("latrow", "45° Cable Lat Row", 2, "12", 120, "kg"),
      ex("reardelt", "Rear Delt Cable Fly (45°)", 2, "12–15", 90, "kg"),
      ex("curl", "Incline DB Curl", 3, "8–12", 90, "kg/hand"),
    ],
    LB: [
      ex("hipthrust", "Hip Thrust", 3, "8–12", 180, "kg"),
      ex("bulg", "Bulgarian Split Squat (DB)", 2, "10/leg", 120, "kg/hand"),
      ex("legcurl", "Seated Leg Curl", 3, "10–15", 120, "kg"),
      ex("legext", "Leg Extension", 3, "12–15", 90, "kg"),
      ex("calf2", "Seated Calf Raise", 3, "12–15", 90, "kg"),
    ],
  },
};

function ex(id, name, sets, reps, rest, unit) {
  return { id, name, sets, reps, rest, unit };
}

/* ---------------- Defaults: steps + seed ratios ----------------
   Seed ratios are relative to BENCH e1RM (rough starting points).
   After you have history for an exercise, the app uses YOUR logged performance.
*/
const DEFAULT_STEP_KG = {
  // Barbells / big compounds
  bench: 2.5, row: 2.5, ohp: 2.5, squat: 2.5, rdl: 2.5, deadlift: 2.5, hipthrust: 2.5,
  // Machines/cables
  latpd: 2.5, tpd: 2.5, fly: 2.5, toh: 2.5, facepull: 2.5, pull: 2.5, csrow: 2.5, latrow: 2.5, reardelt: 2.5,
  legcurl: 2.5, legext: 2.5, calf: 2.5, calf2: 2.5,
  // Special: leg press often 5kg jumps
  lp: 5,
  // Dumbbells (per hand)
  hc: 2, incdb: 2, latraise: 2, curl: 2, lunge: 2, bulg: 2,
};

const SEED_RATIO_TO_BENCH_1RM = {
  // upper
  bench: 0.70,
  row: 0.65,
  ohp: 0.45,
  latpd: 0.55,
  tpd: 0.45,
  fly: 0.35,
  toh: 0.40,
  facepull: 0.35,
  reardelt: 0.22,
  csrow: 0.60,
  latrow: 0.45,
  pull: 0.55,

  // dumbbells (per hand)
  hc: 0.22,
  incdb: 0.22,
  latraise: 0.10,
  curl: 0.18,

  // lower (bench-to-lower is crude; seeds are conservative)
  squat: 0.85,
  rdl: 0.75,
  deadlift: 0.95,
  hipthrust: 0.90,
  lp: 2.00,       // often ends up near 1.5–2.5× bench e1RM depending on machine; good “first guess”
  lunge: 0.20,    // per hand
  bulg: 0.18,     // per hand
  legcurl: 0.55,
  legext: 0.45,
  calf: 0.95,
  calf2: 0.85,
};

/* ---------------- State ---------------- */
function defaultState() {
  return {
    profile: {
      onboarded: false,
      sex: "male",
      heightCm: 173,
      bodyWeightKg: 71.8,
      bodyFatPct: 15,
      barKg: 20,
      benchSetWeightKg: 50, // total bar + plates
      benchSetReps: 12,
      benchE1RM: null,
      coeffRSI: null,
      coeffASI: null,
      coeffLeanIndex: null,
    },
    steps: { ...DEFAULT_STEP_KG }, // per exercise id step size
    progression: { completedSessions: 0, nextIndex: 0 },
    active: null,
    history: [],
    timer: { running: false, endAt: 0, lastShownDone: false, label: "" },
  };
}

let st = load();

// History editing
let editingSessionId = null;
const editSnapshot = new Map();

// Guard to prevent double “next exercise” prompt
let promptedExerciseIds = new Set();

// UI refs
const subhead = el("subhead");
const tabToday = el("tabToday");
const tabWorkout = el("tabWorkout");
const tabHistory = el("tabHistory");
const tabSettings = el("tabSettings");

const paneToday = el("paneToday");
const paneWorkout = el("paneWorkout");
const paneDetail = el("paneDetail");
const paneHistory = el("paneHistory");
const paneSettings = el("paneSettings");

const sessionNameEl = el("sessionName");
const sessionMetaEl = el("sessionMeta");
const startBtn = el("startBtn");
const exercisePreview = el("exercisePreview");

const workoutTitle = el("workoutTitle");
const workoutSubtitle = el("workoutSubtitle");
const workoutList = el("workoutList");
const finishBtn = el("finishBtn");

const detailTitle = el("detailTitle");
const detailMeta = el("detailMeta");
const planPill = el("planPill");
const restPill = el("restPill");
const backBtn = el("backBtn");
const setsEl = el("sets");
const saveAllBtn = el("saveAllBtn");
const doneBtn = el("doneBtn");

const historyList = el("historyList");
const exportBtn = el("exportBtn");
const exportOut = el("exportOut");

// Existing settings fields in your HTML are bench-based; we keep them working,
// but onboarding becomes the primary source of truth.
const benchW = el("benchW");
const benchR = el("benchR");
const bench1rmEl = el("bench1rm");
const saveSettingsBtn = el("saveSettingsBtn");

const toastEl = el("toast");
let toastTimer = null;

let currentExercise = null; // { ex, index }
let timerInterval = null;

/* ---------------- Tabs ---------------- */
function setActiveTab(which) {
  [tabToday, tabWorkout, tabHistory, tabSettings].forEach((t) => t.classList.remove("active"));
  [paneToday, paneWorkout, paneDetail, paneHistory, paneSettings].forEach((p) => p.classList.add("hidden"));

  if (which === "today") { tabToday.classList.add("active"); paneToday.classList.remove("hidden"); }
  if (which === "workout") { tabWorkout.classList.add("active"); paneWorkout.classList.remove("hidden"); }
  if (which === "detail") { tabWorkout.classList.add("active"); paneDetail.classList.remove("hidden"); }
  if (which === "history") { tabHistory.classList.add("active"); paneHistory.classList.remove("hidden"); }
  if (which === "settings") { tabSettings.classList.add("active"); paneSettings.classList.remove("hidden"); }
}

tabToday.onclick = () => { render(); setActiveTab("today"); };

tabWorkout.onclick = () => {
  if (st.active) { renderWorkout(); setActiveTab("workout"); }
  else { setActiveTab("today"); }
};

tabHistory.onclick = () => {
  try {
    renderHistory();
    setActiveTab("history");
  } catch (e) {
    st.history = [];
    save(st);
    try {
      renderHistory();
      setActiveTab("history");
      toast("History reset (old data incompatible)");
    } catch (_) {
      // hard reset
      localStorage.removeItem(LS_KEYS[0]);
      st = defaultState();
      save(st);
      render();
      renderHistory();
      setActiveTab("history");
      toast("App reset");
    }
  }
};

tabSettings.onclick = () => { renderSettings(); setActiveTab("settings"); };

function toast(msg) {
  if (toastTimer) clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 1600);
}

/* ---------------- Math helpers ---------------- */
function bench1rmEpley(w, reps) { return w * (1 + reps / 30); } // e1RM
function allometricIndex(oneRM, bw) { return oneRM / Math.pow(bw, 0.67); }

function parseRepRange(repStr) {
  const s = String(repStr || "").toLowerCase();

  // Examples:
  // "8–10", "10-12", "12", "12 steps/leg", "10/leg"
  const nums = s.match(/\d+/g);
  if (!nums || nums.length === 0) return { min: null, max: null };

  // If string contains "steps" or "/leg", treat as fixed target
  if (s.includes("steps") || s.includes("/leg")) {
    const v = parseInt(nums[0], 10);
    return { min: v, max: v };
  }

  const n1 = parseInt(nums[0], 10);
  const n2 = nums.length >= 2 ? parseInt(nums[1], 10) : n1;
  return { min: n1, max: n2 };
}

function normalizeNum(v) {
  const n = parseFloat(String(v).replace(",", "."));
  return isFinite(n) ? n : null;
}
function normalizeInt(v) {
  const n = parseInt(String(v), 10);
  return isFinite(n) ? n : null;
}
function roundToStep(value, step) {
  if (!isFinite(value) || !isFinite(step) || step <= 0) return value;
  return Math.round(value / step) * step;
}
function fmtKg(x) { return x == null || !isFinite(x) ? "—" : Number(x).toFixed(1); }
function fmtMin(sec) { return `${Math.round(sec / 60)}m`; }
function fmtClock(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
function fmtDate(ts) {
  const d = new Date(ts);
  const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} • ${time}`;
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) =>
    ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === `"` ? "&quot;" : "&#39;"
  );
}
function deepCopy(obj) { return JSON.parse(JSON.stringify(obj)); }
function msDays(days) { return days * 24 * 60 * 60 * 1000; }

/* ---------------- Benchmark / coefficient ---------------- */
function recomputeBenchmark() {
  const p = st.profile;
  const bw = normalizeNum(p.bodyWeightKg);
  const w = normalizeNum(p.benchSetWeightKg);
  const r = normalizeInt(p.benchSetReps);

  if (bw && w && r) {
    const e1 = bench1rmEpley(w, r);
    p.benchE1RM = Number(e1.toFixed(2));
    p.coeffRSI = Number((e1 / bw).toFixed(3));
    p.coeffASI = Number(allometricIndex(e1, bw).toFixed(3));

    if (p.bodyFatPct != null && isFinite(p.bodyFatPct)) {
      const bf = Math.max(0, Math.min(60, Number(p.bodyFatPct)));
      const lean = bw * (1 - bf / 100);
      p.coeffLeanIndex = Number((e1 / lean).toFixed(3));
    } else {
      p.coeffLeanIndex = null;
    }
  } else {
    p.benchE1RM = null;
    p.coeffRSI = null;
    p.coeffASI = null;
    p.coeffLeanIndex = null;
  }
}

/* ---------------- Suggested weight engine ---------------- */
function stepForExercise(exId) {
  return st.steps?.[exId] ?? 2.5;
}

function getLastPerformance(exId) {
  // Find most recent session that has this exercise id
  for (let i = st.history.length - 1; i >= 0; i--) {
    const sess = st.history[i];
    const arr = sess?.sets?.[exId];
    if (!arr || !Array.isArray(arr) || arr.length === 0) continue;

    // Collect completed sets with numeric weight+reps
    const completed = arr.filter(s => s?.completed);
    const weights = completed
      .map(s => normalizeNum(s.weight))
      .filter(v => v != null && v > 0);

    const reps = completed
      .map(s => normalizeInt(s.reps))
      .filter(v => v != null && v > 0);

    if (weights.length === 0 || reps.length === 0) continue;

    // Use median-ish weight from completed sets (robust to edits)
    const wSorted = weights.slice().sort((a,b)=>a-b);
    const medianW = wSorted[Math.floor(wSorted.length / 2)];

    return {
      lastWeight: medianW,
      repsBySet: completed.map(s => normalizeInt(s.reps)).filter(v => v != null && v > 0),
      completedCount: completed.length,
      totalSetsRecorded: arr.length,
      sessionId: sess.id,
    };
  }
  return null;
}

function seedWeight(exercise) {
  recomputeBenchmark();
  const e1 = st.profile.benchE1RM;
  const ratio = SEED_RATIO_TO_BENCH_1RM[exercise.id] ?? 0.5;
  const raw = (e1 && isFinite(e1)) ? e1 * ratio : 0;

  const step = stepForExercise(exercise.id);
  if (!raw || raw <= 0) {
    // emergency fallback: small sensible defaults
    const fallback = exercise.unit.includes("hand") ? 10 : 20;
    return roundToStep(fallback, step);
  }
  return roundToStep(raw, step);
}

function suggestNextWeight(exercise) {
  const perf = getLastPerformance(exercise.id);
  const step = stepForExercise(exercise.id);
  const rr = parseRepRange(exercise.reps);

  // If no history yet: seed from onboarding benchmark
  if (!perf) return seedWeight(exercise);

  // If we cannot parse rep range, keep last weight stable
  if (rr.min == null || rr.max == null) return roundToStep(perf.lastWeight, step);

  // Strict rule: increase only if ALL working sets hit top of range.
  // We define "working sets" as the sets you marked completed.
  // We also require at least the programmed number of sets to be completed to count as "all sets".
  const requiredSets = exercise.sets;
  const doneSets = perf.completedCount;

  const repsBySet = perf.repsBySet.slice(0, requiredSets);
  const allTop = doneSets >= requiredSets && repsBySet.length >= requiredSets && repsBySet.every(r => r >= rr.max);

  // If multiple sets miss the bottom, decrease by one step.
  const belowMinCount = repsBySet.filter(r => r < rr.min).length;
  const manyBelowMin = belowMinCount >= Math.ceil(requiredSets / 2);

  let next = perf.lastWeight;

  if (allTop) next = perf.lastWeight + step;
  else if (manyBelowMin) next = Math.max(step, perf.lastWeight - step);
  else next = perf.lastWeight; // stay and build reps

  return roundToStep(next, step);
}

/* ---------------- Timer ---------------- */
function remainingSeconds() {
  if (!st.timer?.running) return 0;
  const diff = st.timer.endAt - Date.now();
  return Math.max(0, Math.ceil(diff / 1000));
}
function ensureTimer() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    if (!st.timer?.running) return;
    const rem = remainingSeconds();
    renderRestPill();
    if (rem <= 0) {
      st.timer.running = false;
      st.timer.endAt = 0;
      if (!st.timer.lastShownDone) {
        st.timer.lastShownDone = true;
        save(st);
        toast("Rest complete");
      } else {
        save(st);
      }
      renderRestPill();
    } else {
      st.timer.lastShownDone = false;
      save(st);
    }
  }, 500);
}
function startRest(seconds, label) {
  ensureTimer();
  const secs = Math.max(0, Math.round(seconds));
  st.timer.running = true;
  st.timer.endAt = Date.now() + secs * 1000;
  st.timer.label = label || "";
  st.timer.lastShownDone = false;
  save(st);
  renderRestPill();
}
function renderRestPill() {
  if (!currentExercise) { restPill.textContent = "Rest —"; return; }
  const base = `Rest ${fmtMin(currentExercise.ex.rest)}`;
  restPill.textContent = st.timer?.running ? `${base} • ${fmtClock(remainingSeconds())}` : base;
}

/* ---------------- Session ---------------- */
function ensureActive() {
  if (st.active) return;
  const next = Program.cycle[st.progression.nextIndex % Program.cycle.length];
  st.active = {
    id: crypto.randomUUID(),
    key: next.key,
    name: next.name,
    suggested: next.suggested,
    startedAt: Date.now(),
    sets: {},
  };
  promptedExerciseIds = new Set();
  save(st);
}

startBtn.onclick = () => {
  ensureActive();
  renderWorkout();
  setActiveTab("workout");
};

/* ---------------- Today render ---------------- */
function render() {
  const next = Program.cycle[st.progression.nextIndex % Program.cycle.length];
  recomputeBenchmark();

  const e1 = st.profile.benchE1RM;
  const meta = e1 ? `Bench e1RM ${Number(e1).toFixed(1)} kg • RSI ${st.profile.coeffRSI ?? "—"}` : `Set up benchmark in Settings`;

  subhead.textContent = `Next: ${next.name} (Suggested ${next.suggested})`;
  sessionNameEl.textContent = next.name;
  sessionMetaEl.textContent = meta;

  exercisePreview.innerHTML = "";
  (Program.template[next.key] || []).forEach((exercise) => {
    const w = suggestNextWeight(exercise);
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="topline">
        <div class="name">${esc(exercise.name)}</div>
        <div class="pill">Plan ${fmtKg(w)} ${esc(exercise.unit)}</div>
      </div>
      <div class="meta">${exercise.sets} sets • ${esc(exercise.reps)} • Rest ${fmtMin(exercise.rest)}</div>
    `;
    exercisePreview.appendChild(div);
  });

  tabWorkout.style.opacity = st.active ? "1" : "0.5";
}

/* ---------------- Workout list ---------------- */
function renderWorkout() {
  workoutList.innerHTML = "";
  workoutTitle.textContent = st.active ? st.active.name : "Workout";
  workoutSubtitle.textContent = st.active ? `Suggested ${st.active.suggested}` : "—";
  if (!st.active) return;

  const exs = Program.template[st.active.key] || [];
  exs.forEach((exercise, i) => {
    const div = document.createElement("div");
    div.className = "item";
    const w = suggestNextWeight(exercise);
    const done = (st.active.sets[exercise.id] || []).filter((s) => s.completed).length;

    div.innerHTML = `
      <div class="topline">
        <div class="name">${esc(exercise.name)}</div>
        <div class="pill">${fmtKg(w)} ${esc(exercise.unit)}</div>
      </div>
      <div class="meta">${done}/${exercise.sets} sets • ${esc(exercise.reps)} • Rest ${fmtMin(exercise.rest)}</div>
    `;
    div.onclick = () => openDetail(exercise, i);
    workoutList.appendChild(div);
  });
}

/* ---------------- Detail ---------------- */
function openDetail(exercise, index) {
  currentExercise = { ex: exercise, index };
  const wPlan = suggestNextWeight(exercise);

  if (!st.active.sets[exercise.id]) {
    st.active.sets[exercise.id] = Array.from({ length: exercise.sets }, (_, i) => ({
      setIndex: i + 1,
      weight: fmtKg(wPlan),
      reps: "",
      completed: false,
    }));
    save(st);
  }

  detailTitle.textContent = exercise.name;
  detailMeta.textContent = `${exercise.sets} sets • ${exercise.reps}`;

  const step = stepForExercise(exercise.id);
  planPill.textContent = `Plan ${fmtKg(wPlan)} ${exercise.unit} • step ${step}${exercise.unit.includes("hand") ? "/hand" : ""}`;

  renderRestPill();
  renderSets(exercise);
  setActiveTab("detail");
}

function computeCompleted(set) {
  const reps = normalizeInt(set.reps);
  const w = normalizeNum(set.weight);
  return reps != null && reps > 0 && w != null && w > 0;
}

function isExerciseComplete(exercise) {
  const arr = st.active?.sets?.[exercise.id] || [];
  return arr.length === exercise.sets && arr.filter((s) => s.completed).length === exercise.sets;
}

function getExerciseList() {
  return st.active ? Program.template[st.active.key] || [] : [];
}

function nextIncompleteIndex(fromIndex) {
  const exs = getExerciseList();
  for (let j = fromIndex + 1; j < exs.length; j++) if (!isExerciseComplete(exs[j])) return j;
  for (let j = 0; j < exs.length; j++) if (!isExerciseComplete(exs[j])) return j;
  return -1;
}

function promptAfterExerciseComplete(idx) {
  const exs = getExerciseList();
  const nextIdx = nextIncompleteIndex(idx);

  if (nextIdx === -1) {
    toast("All exercises complete");
    renderWorkout();
    setActiveTab("workout");
    return;
  }

  const nextName = exs[nextIdx].name;
  const ok = confirm(`Exercise complete.\n\nNext: ${nextName}\n\nOK = Next, Cancel = Workout list.`);
  if (ok) openDetail(exs[nextIdx], nextIdx);
  else { renderWorkout(); setActiveTab("workout"); }
}

/* ---------------- Sets UI + commit logic ----------------
   - Completion + timer start ONLY on reps commit (blur or Enter/Done)
   - Weight blur formats weight only
*/
function renderSets(exercise) {
  setsEl.innerHTML = "";
  const arr = st.active.sets[exercise.id];

  arr.forEach((s, idx) => {
    const row = document.createElement("div");
    row.className = "setrow";
    row.innerHTML = `
      <div class="label">
        <div>Set ${s.setIndex}</div>
        <div class="doneDot ${s.completed ? "on" : ""}"></div>
      </div>
      <input class="wIn" inputmode="decimal" placeholder="Weight (kg)" value="${esc(s.weight || "")}" data-i="${idx}" data-k="weight" />
      <input class="rIn" inputmode="numeric" placeholder="Reps" value="${esc(s.reps || "")}" data-i="${idx}" data-k="reps" />
    `;
    setsEl.appendChild(row);
  });

  // While typing: store raw text only
  [...setsEl.querySelectorAll("input")].forEach((inp) => {
    inp.oninput = () => {
      const i = Number(inp.dataset.i);
      const k = inp.dataset.k;
      st.active.sets[exercise.id][i][k] = inp.value;
      save(st);
    };
  });

  // Weight blur: format weight only
  setsEl.querySelectorAll("input.wIn").forEach((inp) => {
    inp.onblur = () => {
      const i = Number(inp.dataset.i);
      const s = st.active.sets[exercise.id][i];

      const wN = normalizeNum(s.weight);
      if (wN == null) s.weight = "";
      else {
        const step = stepForExercise(exercise.id);
        const rounded = roundToStep(wN, step);
        s.weight = fmtKg(rounded);
      }

      save(st);
      renderSets(exercise);
    };
    inp.onkeydown = (e) => {
      if (e.key === "Enter") {
        const i = Number(inp.dataset.i);
        const repsInp = setsEl.querySelector(`input.rIn[data-i="${i}"]`);
        if (repsInp) repsInp.focus();
      }
    };
  });

  function commitSet(i) {
    const s = st.active.sets[exercise.id][i];

    const repsN = normalizeInt(s.reps);
    s.reps = repsN == null ? "" : String(repsN);

    const wN = normalizeNum(s.weight);
    if (wN == null) s.weight = "";
    else {
      const step = stepForExercise(exercise.id);
      s.weight = fmtKg(roundToStep(wN, step));
    }

    const was = !!s.completed;
    s.completed = computeCompleted(s);

    // If exercise becomes incomplete (editing), allow future prompt again
    if (!isExerciseComplete(exercise)) {
      promptedExerciseIds.delete(exercise.id);
    }

    save(st);
    renderWorkout();

    if (!was && s.completed) {
      startRest(exercise.rest, exercise.name);
      toast(`Set ${s.setIndex} complete`);
    }

    renderSets(exercise);

    // prompt only once per exercise completion
    if (currentExercise && isExerciseComplete(exercise) && !promptedExerciseIds.has(exercise.id)) {
      promptedExerciseIds.add(exercise.id);
      promptAfterExerciseComplete(currentExercise.index);
    }
  }

  // Reps commit: blur OR Enter triggers commit
  setsEl.querySelectorAll("input.rIn").forEach((inp) => {
    inp.onblur = () => { commitSet(Number(inp.dataset.i)); };
    inp.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        inp.blur(); // triggers commit via blur
      }
    };
  });
}

backBtn.onclick = () => { renderWorkout(); setActiveTab("workout"); };
doneBtn.onclick = () => { renderWorkout(); setActiveTab("workout"); };
saveAllBtn.onclick = () => { save(st); toast("Saved"); };

/* ---------------- Finish workout ---------------- */
finishBtn.onclick = () => {
  if (!st.active) return;

  st.history.push({
    id: st.active.id,
    key: st.active.key,
    name: st.active.name,
    week: Math.floor(st.progression.completedSessions / 5) + 1,
    startedAt: st.active.startedAt,
    finishedAt: Date.now(),
    sets: st.active.sets,
  });

  st.active = null;
  st.progression.completedSessions += 1;
  st.progression.nextIndex = (st.progression.nextIndex + 1) % Program.cycle.length;
  st.timer = { running: false, endAt: 0, lastShownDone: false, label: "" };
  promptedExerciseIds = new Set();

  save(st);
  render();
  renderHistory();
  setActiveTab("today");
  toast("Workout saved");
};

/* ---------------- History: edit + safe delete ---------------- */
function guessKeyFromName(name) {
  const n = String(name || "").toLowerCase();
  if (n.includes("upper a")) return "UA";
  if (n.includes("lower a")) return "LA";
  if (n.includes("upper b")) return "UB";
  if (n.includes("upper c")) return "UC";
  if (n.includes("lower b")) return "LB";
  return "UA";
}

function getExerciseNameById(sessionKey, exId) {
  const arr = Program.template[sessionKey] || [];
  const found = arr.find((x) => x.id === exId);
  return found ? found.name : exId;
}

function countCompletedSets(setsArr) {
  return (setsArr || []).filter((s) => s && s.completed).length;
}

function buildSetLine(s) {
  const w = (s?.weight ?? "").toString().trim();
  const r = (s?.reps ?? "").toString().trim();
  const pieces = [];
  if (w) pieces.push(`${w}kg`);
  if (r) pieces.push(`${r} reps`);
  pieces.push(s?.completed ? "Done" : "Not done");
  return pieces.join(" • ");
}

function applyHistoryEdit(inp) {
  const sid = inp.dataset.sid;
  const exId = inp.dataset.ex;
  const si = Number(inp.dataset.si);
  const k = inp.dataset.k;

  const idx = st.history.findIndex((x) => x.id === sid);
  if (idx === -1) return;

  const sess = st.history[idx];
  if (!sess.sets || !sess.sets[exId] || !sess.sets[exId][si]) return;

  if (k === "completed") {
    sess.sets[exId][si].completed = !!inp.checked;
  } else {
    sess.sets[exId][si][k] = inp.value;
  }
  save(st);
}

function deleteSingleSession(sessionId) {
  const idx = st.history.findIndex((x) => x.id === sessionId);
  if (idx === -1) return;

  const sess = st.history[idx];
  const name = sess?.name ? ` (${sess.name})` : "";
  const ok = confirm(`Delete this session${name}? This cannot be undone.`);
  if (!ok) return;

  if (editingSessionId === sessionId) {
    editingSessionId = null;
    editSnapshot.delete(sessionId);
  }

  st.history.splice(idx, 1);
  save(st);
  renderHistory();
  toast("Session deleted");
}

function deleteHistoryByRange(mode) {
  if (!st.history?.length) {
    toast("No history to delete");
    return;
  }

  if (mode === "all") {
    const ok = confirm("Delete ALL history? This cannot be undone.");
    if (!ok) return;

    const reset = confirm(
      "Also reset your program back to Upper A / Week 1?\n\nOK = Yes, reset\nCancel = No, keep current program position"
    );

    st.history = [];

    if (reset) {
      st.progression = { completedSessions: 0, nextIndex: 0 };
      st.active = null;
      st.timer = { running: false, endAt: 0, lastShownDone: false, label: "" };
    }

    editingSessionId = null;
    editSnapshot.clear();

    save(st);
    render();
    renderWorkout();
    renderHistory();
    setActiveTab("today");
    toast(reset ? "History deleted + program reset" : "History deleted");
    return;
  }

  const now = Date.now();
  const cutoff = now - (mode === "7d" ? msDays(7) : msDays(30));
  const label = mode === "7d" ? "the last 7 days" : "the last 30 days";
  const ok = confirm(`Delete sessions from ${label}? This cannot be undone.`);
  if (!ok) return;

  st.history = st.history.filter((sess) => {
    const t = sess.finishedAt || sess.startedAt || 0;
    return t < cutoff;
  });

  if (editingSessionId && !st.history.some((s) => s.id === editingSessionId)) {
    editingSessionId = null;
  }

  save(st);
  renderHistory();
  toast("History deleted");
}

function renderHistory() {
  exportOut.classList.add("hidden");
  historyList.innerHTML = "";

  const global = document.createElement("div");
  global.className = "card";
  global.innerHTML = `
    <div class="row">
      <div>
        <div class="h">Manage History</div>
        <div class="s">Delete logs safely with confirmation.</div>
      </div>
      <div class="pill subtle">${st.history.length} sessions</div>
    </div>
    <div class="histActions">
      <button class="histBtn warn" type="button" id="del7">Delete last 7 days</button>
      <button class="histBtn warn" type="button" id="del30">Delete last 30 days</button>
      <button class="histBtn danger" type="button" id="delAll">Delete all</button>
    </div>
  `;
  historyList.appendChild(global);

  global.querySelector("#del7").onclick = () => deleteHistoryByRange("7d");
  global.querySelector("#del30").onclick = () => deleteHistoryByRange("30d");
  global.querySelector("#delAll").onclick = () => deleteHistoryByRange("all");

  if (!st.history.length) {
    const d = document.createElement("div");
    d.className = "item";
    d.innerHTML = `<div class="name">No sessions yet</div><div class="meta">Finish a workout to save it here.</div>`;
    historyList.appendChild(d);
    return;
  }

  const sessions = [...st.history].slice().reverse();

  sessions.forEach((sess) => {
    const sessKey = sess.key || guessKeyFromName(sess.name);
    const setsDone = Object.values(sess.sets || {}).reduce((a, arr) => a + countCompletedSets(arr), 0);
    const isEditing = editingSessionId === sess.id;

    const details = document.createElement("details");
    details.className = "histDetails";

    const summary = document.createElement("summary");
    summary.className = "histSummary";
    summary.innerHTML = `
      <div class="histHead">
        <div>
          <div class="histTitle">${esc(sess.name || "Session")}</div>
          <div class="histMeta">${esc(fmtDate(sess.finishedAt || sess.startedAt || Date.now()))} • Completed sets: ${setsDone}</div>
        </div>
        <div class="pill">Week ${esc(sess.week ?? "—")}</div>
      </div>
    `;
    details.appendChild(summary);

    const body = document.createElement("div");
    body.className = "histBody";

    const bar = document.createElement("div");
    bar.className = "histBar";

    if (!isEditing) {
      const editBtn = document.createElement("button");
      editBtn.className = "histBtn";
      editBtn.type = "button";
      editBtn.textContent = "Edit";
      editBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        editingSessionId = sess.id;
        editSnapshot.set(sess.id, deepCopy(sess));
        renderHistory();
      };
      bar.appendChild(editBtn);

      const delBtn = document.createElement("button");
      delBtn.className = "histBtn danger";
      delBtn.type = "button";
      delBtn.textContent = "Delete session";
      delBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteSingleSession(sess.id);
      };
      bar.appendChild(delBtn);

      const hint = document.createElement("div");
      hint.className = "s";
      hint.textContent = "Edit or delete this session.";
      bar.appendChild(hint);
    } else {
      const saveBtn = document.createElement("button");
      saveBtn.className = "histBtn primary";
      saveBtn.type = "button";
      saveBtn.textContent = "Save";
      saveBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        save(st);
        editingSessionId = null;
        editSnapshot.delete(sess.id);
        renderHistory();
        toast("History updated");
      };

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "histBtn danger";
      cancelBtn.type = "button";
      cancelBtn.textContent = "Cancel";
      cancelBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const snap = editSnapshot.get(sess.id);
        if (snap) {
          const idx = st.history.findIndex((x) => x.id === sess.id);
          if (idx !== -1) st.history[idx] = snap;
          save(st);
        }
        editingSessionId = null;
        editSnapshot.delete(sess.id);
        renderHistory();
        toast("Reverted");
      };

      bar.appendChild(saveBtn);
      bar.appendChild(cancelBtn);
    }

    body.appendChild(bar);

    const exIds = Object.keys(sess.sets || {});
    if (!exIds.length) {
      body.insertAdjacentHTML("beforeend", `<div class="s">No exercise data saved for this session.</div>`);
    } else {
      const order = (Program.template[sessKey] || []).map((x) => x.id);
      const sorted = exIds.slice().sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });

      sorted.forEach((exId) => {
        const setsArr = sess.sets[exId] || [];
        const done = countCompletedSets(setsArr);
        const planned = setsArr.length || "—";
        const exName = getExerciseNameById(sessKey, exId);

        const exBlock = document.createElement("div");
        exBlock.className = "histExercise";
        exBlock.innerHTML = `
          <div class="histExName">${esc(exName)}</div>
          <div class="histExSub">${done}/${planned} sets completed</div>
        `;

        const setsWrap = document.createElement("div");
        setsWrap.className = "histSets";

        setsArr.forEach((s, si) => {
          if (!isEditing) {
            const row = document.createElement("div");
            row.className = "histSetRow";
            row.innerHTML = `
              <div class="l">Set ${esc(s?.setIndex ?? "")}</div>
              <div class="r">${esc(buildSetLine(s))}</div>
            `;
            setsWrap.appendChild(row);
            return;
          }

          const er = document.createElement("div");
          er.className = "histEditRow";
          er.innerHTML = `
            <div class="lbl">Set ${esc(s?.setIndex ?? "")}</div>
            <input inputmode="decimal" placeholder="kg" value="${esc(s?.weight ?? "")}" data-sid="${esc(sess.id)}" data-ex="${esc(exId)}" data-si="${si}" data-k="weight" />
            <input inputmode="numeric" placeholder="reps" value="${esc(s?.reps ?? "")}" data-sid="${esc(sess.id)}" data-ex="${esc(exId)}" data-si="${si}" data-k="reps" />
            <input type="checkbox" ${s?.completed ? "checked" : ""} data-sid="${esc(sess.id)}" data-ex="${esc(exId)}" data-si="${si}" data-k="completed" />
          `;
          setsWrap.appendChild(er);
        });

        exBlock.appendChild(setsWrap);
        body.appendChild(exBlock);
      });
    }

    details.appendChild(body);
    historyList.appendChild(details);

    if (isEditing) {
      details.open = true;
      details.querySelectorAll("input").forEach((inp) => {
        inp.oninput = () => applyHistoryEdit(inp);
        inp.onchange = () => applyHistoryEdit(inp);
        inp.onkeydown = (e) => { if (e.key === "Enter") inp.blur(); };
      });
    }
  });
}

exportBtn.onclick = () => {
  exportOut.classList.toggle("hidden");
  if (!exportOut.classList.contains("hidden")) exportOut.textContent = JSON.stringify(st, null, 2);
};

/* ---------------- Settings ---------------- */
function renderSettings() {
  // Keep legacy bench fields populated for convenience
  benchW.value = st.profile.benchSetWeightKg ?? 50;
  benchR.value = st.profile.benchSetReps ?? 12;

  recomputeBenchmark();
  const e1 = st.profile.benchE1RM;
  bench1rmEl.textContent = e1
    ? `Bench e1RM: ${Number(e1).toFixed(1)} kg • RSI ${st.profile.coeffRSI ?? "—"}`
    : `Bench e1RM: —`;

  // Show onboarding hint
  if (!st.profile.onboarded) toast("Open Settings to set your benchmark");
}

saveSettingsBtn.onclick = () => {
  // Treat settings update as updating the benchmark set
  const w = normalizeNum(benchW.value);
  const r = normalizeInt(benchR.value);
  if (w == null || w <= 0 || r == null || r <= 0) { toast("Enter valid bench set"); return; }

  st.profile.benchSetWeightKg = w;
  st.profile.benchSetReps = r;

  // If user never onboarded, assume basic defaults but mark onboarded
  if (!st.profile.onboarded) {
    st.profile.onboarded = true;
  }

  recomputeBenchmark();
  save(st);
  render();
  renderSettings();
  toast("Benchmark saved");
};

/* ---------------- Onboarding overlay (injected) ---------------- */
function showOnboardingIfNeeded() {
  if (st.profile.onboarded) return;

  const overlayId = "lc_onboarding";
  if (document.getElementById(overlayId)) return;

  const p = st.profile;

  const html = `
  <div id="${overlayId}" style="
    position:fixed; inset:0; z-index:9999;
    background:rgba(0,0,0,0.72); display:flex; align-items:flex-end; justify-content:center;
    padding:16px;">
    <div style="
      width:min(520px,100%);
      background:#12161C; border:1px solid #202734; border-radius:18px;
      padding:16px; color:#E8EEF8; font-family:-apple-system,system-ui,Segoe UI,Roboto;">
      <div style="font-weight:700; font-size:18px;">Quick setup</div>
      <div style="margin-top:6px; color:#A7B2C3; font-size:13px; line-height:1.35;">
        Enter your baseline so the app can estimate starting weights and track your progress.
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:12px;">
        ${fieldSelect("Sex", "lc_sex", ["male","female"], p.sex)}
        ${fieldNumber("Height (cm)", "lc_h", p.heightCm)}
        ${fieldNumber("Bodyweight (kg)", "lc_bw", p.bodyWeightKg)}
        ${fieldNumber("Body fat % (optional)", "lc_bf", p.bodyFatPct)}
        ${fieldSelect("Bar weight (kg)", "lc_bar", ["15","20"], String(p.barKg))}
        ${fieldNumber("Bench set weight (kg)", "lc_benchW", p.benchSetWeightKg)}
        ${fieldNumber("Bench set reps", "lc_benchR", p.benchSetReps)}
      </div>

      <div style="margin-top:12px; padding:10px; border:1px solid #202734; border-radius:14px; background:#0F1318;">
        <div style="font-size:13px; color:#A7B2C3;">This can be updated later in Settings.</div>
      </div>

      <div style="display:flex; gap:10px; margin-top:12px;">
        <button id="lc_save" style="
          flex:1; background:#6EE7B7; border:0; border-radius:14px;
          padding:10px 14px; font-weight:700; cursor:pointer;">Save</button>
        <button id="lc_skip" style="
          background:transparent; color:#E8EEF8; border:1px solid #202734;
          border-radius:14px; padding:10px 14px; font-weight:700; cursor:pointer;">Skip</button>
      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML("beforeend", html);

  const overlay = document.getElementById(overlayId);
  const saveBtn = document.getElementById("lc_save");
  const skipBtn = document.getElementById("lc_skip");

  skipBtn.onclick = () => {
    overlay.remove();
    toast("Setup skipped (you can do it in Settings)");
  };

  saveBtn.onclick = () => {
    const sex = val("lc_sex", "male");
    const h = normalizeNum(val("lc_h", p.heightCm));
    const bw = normalizeNum(val("lc_bw", p.bodyWeightKg));
    const bf = normalizeNum(val("lc_bf", p.bodyFatPct));
    const bar = normalizeNum(val("lc_bar", p.barKg));
    const bwSet = normalizeNum(val("lc_benchW", p.benchSetWeightKg));
    const br = normalizeInt(val("lc_benchR", p.benchSetReps));

    if (!bw || !bwSet || !br) { toast("Please enter bodyweight + bench set"); return; }

    st.profile.sex = sex;
    st.profile.heightCm = h ?? st.profile.heightCm;
    st.profile.bodyWeightKg = bw;
    st.profile.bodyFatPct = isFinite(bf) ? bf : null;
    st.profile.barKg = bar ?? st.profile.barKg;
    st.profile.benchSetWeightKg = bwSet;
    st.profile.benchSetReps = br;

    st.profile.onboarded = true;
    recomputeBenchmark();

    // Keep legacy settings UI fields in sync
    benchW.value = st.profile.benchSetWeightKg;
    benchR.value = st.profile.benchSetReps;

    save(st);
    overlay.remove();
    render();
    renderSettings();
    toast("Setup saved");
  };

  function fieldNumber(label, id, v) {
    return `
      <div>
        <div style="font-size:12px; color:#A7B2C3; margin-bottom:4px;">${esc(label)}</div>
        <input id="${id}" inputmode="decimal" value="${esc(v ?? "")}" style="
          width:100%; padding:12px; border-radius:14px; border:1px solid #202734;
          background:#0F1318; color:#E8EEF8; font-size:16px;">
      </div>`;
  }
  function fieldSelect(label, id, options, selected) {
    const opts = options.map(o => `<option value="${esc(o)}" ${String(o)===String(selected)?"selected":""}>${esc(o)}</option>`).join("");
    return `
      <div>
        <div style="font-size:12px; color:#A7B2C3; margin-bottom:4px;">${esc(label)}</div>
        <select id="${id}" style="
          width:100%; padding:12px; border-radius:14px; border:1px solid #202734;
          background:#0F1318; color:#E8EEF8; font-size:16px;">
          ${opts}
        </select>
      </div>`;
  }
  function val(id, fallback) {
    const el = document.getElementById(id);
    return el ? el.value : fallback;
  }
}

/* ---------------- Storage (self-healing + migration) ---------------- */
function load() {
  for (const key of LS_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") continue;

      // Migrate older schema into v6 shape
      const def = defaultState();

      // If old v5: it had settings.benchW/benchR. Convert into profile fields.
      if (!parsed.profile) {
        parsed.profile = { ...def.profile };
        if (parsed.settings?.benchW != null) parsed.profile.benchSetWeightKg = parsed.settings.benchW;
        if (parsed.settings?.benchR != null) parsed.profile.benchSetReps = parsed.settings.benchR;
        parsed.profile.onboarded = true;
      }

      if (!parsed.steps) parsed.steps = { ...def.steps };
      parsed.steps = { ...def.steps, ...parsed.steps };

      if (!parsed.progression) parsed.progression = def.progression;
      if (typeof parsed.progression.completedSessions !== "number") parsed.progression.completedSessions = 0;
      if (typeof parsed.progression.nextIndex !== "number") parsed.progression.nextIndex = 0;

      if (!Array.isArray(parsed.history)) parsed.history = [];
      if (!parsed.timer) parsed.timer = def.timer;

      // Clean timer
      if (typeof parsed.timer.running !== "boolean") parsed.timer.running = false;
      if (typeof parsed.timer.endAt !== "number") parsed.timer.endAt = 0;
      if (typeof parsed.timer.lastShownDone !== "boolean") parsed.timer.lastShownDone = false;
      if (typeof parsed.timer.label !== "string") parsed.timer.label = "";

      // Normalize profile numbers
      parsed.profile.bodyWeightKg = normalizeNum(parsed.profile.bodyWeightKg) ?? def.profile.bodyWeightKg;
      parsed.profile.heightCm = normalizeNum(parsed.profile.heightCm) ?? def.profile.heightCm;
      parsed.profile.bodyFatPct = parsed.profile.bodyFatPct == null ? null : normalizeNum(parsed.profile.bodyFatPct);
      parsed.profile.barKg = normalizeNum(parsed.profile.barKg) ?? def.profile.barKg;
      parsed.profile.benchSetWeightKg = normalizeNum(parsed.profile.benchSetWeightKg) ?? def.profile.benchSetWeightKg;
      parsed.profile.benchSetReps = normalizeInt(parsed.profile.benchSetReps) ?? def.profile.benchSetReps;

      // Keep history objects only if they have sets
      parsed.history = parsed.history.filter((s) => s && typeof s === "object" && s.sets && typeof s.sets === "object");

      // Save into v6 key for forward stability
      localStorage.setItem(LS_KEYS[0], JSON.stringify(parsed));

      return parsed;
    } catch (_) {
      // keep scanning keys
    }
  }

  // If none present, return defaults
  const d = defaultState();
  localStorage.setItem(LS_KEYS[0], JSON.stringify(d));
  return d;
}

function save(s) {
  localStorage.setItem(LS_KEYS[0], JSON.stringify(s));
}

function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node;
}

/* ---------------- Init ---------------- */
ensureTimer();
showOnboardingIfNeeded();
recomputeBenchmark();
render();
renderSettings();
renderHistory();
setActiveTab("today");
