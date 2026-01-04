/* LiftCut — app.js (FULL, REPLACEABLE)
   Fix included:
   - Prevent “Next exercise” prompt from firing twice for the same exercise (the skip bug)
   - Works even if commit logic runs twice due to Safari/blur/Enter behaviors
   Current features retained:
   - No RPE
   - Suggested kg weights for ALL exercises derived from Bench 1RM estimate
   - Editable history + safe deletion
   - Self-healing storage + fail-safe History tab
   - Set completion + rest timer starts ONLY on reps commit (Enter/Done or reps blur)
*/

const LS_KEY = "liftcut_state_v5_history_accordion";

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
      ex("bench", "Barbell Bench Press", 3, "8–10", 180, "kg", { type: "benchBase" }),
      ex("row", "Bent-Over Barbell Row", 3, "8–10", 180, "kg", { type: "benchMult", mult: "rowMult" }),
      ex("ohp", "Overhead Press (Barbell)", 3, "8–10", 180, "kg", { type: "benchMult", mult: "ohpMult" }),
      ex("latpd", "Lat Pulldown / Assist", 3, "8–10", 150, "kg", { type: "benchMult", mult: "latpdMult" }),
      ex("hc", "Hammer Curl (DB)", 2, "10–12", 90, "kg/hand", { type: "benchMult", mult: "hcMult", perHand: true }),
      ex("tpd", "Triceps Pushdown (Cable)", 2, "10–12", 90, "kg", { type: "benchMult", mult: "tpdMult" }),
    ],
    LA: [
      ex("squat", "Back Squat", 3, "8–10", 210, "kg", { type: "benchMult", mult: "squatMult" }),
      ex("rdl", "Romanian Deadlift", 3, "8–12", 180, "kg", { type: "benchMult", mult: "rdlMult" }),
      ex("lp", "Leg Press", 3, "10–12", 150, "kg", { type: "benchMult", mult: "lpMult" }),
      ex("lunge", "Walking Lunge (DB)", 2, "12 steps/leg", 120, "kg/hand", { type: "benchMult", mult: "lungeMult", perHand: true }),
      ex("calf", "Standing Calf Raise", 3, "12–15", 90, "kg", { type: "benchMult", mult: "calfMult" }),
    ],
    UB: [
      ex("incdb", "Incline DB Press", 3, "8–12", 150, "kg/hand", { type: "benchMult", mult: "incdbMult", perHand: true }),
      ex("fly", "Seated Cable Fly (High-to-Low)", 3, "10–15", 120, "kg", { type: "benchMult", mult: "flyMult" }),
      ex("latraise", "Lateral Raise (DB)", 3, "12–15", 90, "kg/hand", { type: "benchMult", mult: "latraiseMult", perHand: true }),
      ex("toh", "Overhead Triceps Extension (Cable)", 3, "10–12", 120, "kg", { type: "benchMult", mult: "tohMult" }),
      ex("facepull", "Face Pull (optional)", 2, "12–15", 90, "kg", { type: "benchMult", mult: "facepullMult" }),
    ],
    UC: [
      ex("deadlift", "Deadlift (Conventional/Trap)", 3, "6–8", 240, "kg", { type: "benchMult", mult: "deadliftMult" }),
      ex("pull", "Pull-ups / Lat Pulldown", 3, "6–10", 150, "kg", { type: "benchMult", mult: "pullMult" }),
      ex("csrow", "Chest-Supported Row", 3, "10", 150, "kg", { type: "benchMult", mult: "csrowMult" }),
      ex("latrow", "45° Cable Lat Row", 2, "12", 120, "kg", { type: "benchMult", mult: "latrowMult" }),
      ex("reardelt", "Rear Delt Cable Fly (45°)", 2, "12–15", 90, "kg", { type: "benchMult", mult: "reardeltMult" }),
      ex("curl", "Incline DB Curl", 3, "8–12", 90, "kg/hand", { type: "benchMult", mult: "curlMult", perHand: true }),
    ],
    LB: [
      ex("hipthrust", "Hip Thrust", 3, "8–12", 180, "kg", { type: "benchMult", mult: "hipThrustMult" }),
      ex("bulg", "Bulgarian Split Squat (DB)", 2, "10/leg", 120, "kg/hand", { type: "benchMult", mult: "bulgMult", perHand: true }),
      ex("legcurl", "Seated Leg Curl", 3, "10–15", 120, "kg", { type: "benchMult", mult: "legcurlMult" }),
      ex("legext", "Leg Extension", 3, "12–15", 90, "kg", { type: "benchMult", mult: "legextMult" }),
      ex("calf2", "Seated Calf Raise", 3, "12–15", 90, "kg", { type: "benchMult", mult: "calf2Mult" }),
    ],
  },
};

function ex(id, name, sets, reps, rest, unit, scale) {
  return { id, name, sets, reps, rest, unit, scale };
}

/* ---------------- State ---------------- */
function defaultState() {
  return {
    settings: {
      benchW: 50,
      benchR: 12,
      mult: {
        squatMult: 0.85,
        deadliftMult: 0.95,
        rdlMult: 0.75,
        hipThrustMult: 0.90,
        ohpMult: 0.45,
        rowMult: 0.70,

        latpdMult: 0.55,
        tpdMult: 0.45,
        hcMult: 0.22,
        lpMult: 1.35,
        lungeMult: 0.20,
        calfMult: 0.95,

        incdbMult: 0.22,
        flyMult: 0.35,
        latraiseMult: 0.10,
        tohMult: 0.40,
        facepullMult: 0.35,

        pullMult: 0.55,
        csrowMult: 0.60,
        latrowMult: 0.45,
        reardeltMult: 0.22,
        curlMult: 0.18,

        bulgMult: 0.18,
        legcurlMult: 0.55,
        legextMult: 0.45,
        calf2Mult: 0.85,
      },
    },
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
      localStorage.removeItem(LS_KEY);
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
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 1500);
}

/* ---------------- Helpers ---------------- */
function bench1rmCalc(w, r) { return w * (1 + r / 30); }
function baseWorkWeight() { return bench1rmCalc(st.settings.benchW, st.settings.benchR) * 0.60; }
function plannedWeight(exercise) {
  const base = baseWorkWeight();
  if (exercise.scale.type === "benchBase") return base;
  if (exercise.scale.type === "benchMult") return base * (st.settings.mult[exercise.scale.mult] ?? 1);
  return base * 0.40;
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
function normalizeNum(v) {
  const n = parseFloat(String(v).replace(",", "."));
  return isFinite(n) ? n : null;
}
function normalizeInt(v) {
  const n = parseInt(String(v), 10);
  return isFinite(n) ? n : null;
}
function msDays(days) { return days * 24 * 60 * 60 * 1000; }

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
      } else save(st);
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
  promptedExerciseIds = new Set(); // reset guard for new workout
  save(st);
}

startBtn.onclick = () => {
  ensureActive();
  renderWorkout();
  setActiveTab("workout");
};

/* ---------------- Today ---------------- */
function render() {
  const next = Program.cycle[st.progression.nextIndex % Program.cycle.length];
  const b1 = bench1rmCalc(st.settings.benchW, st.settings.benchR);

  subhead.textContent = `Next: ${next.name} (Suggested ${next.suggested})`;
  sessionNameEl.textContent = next.name;
  sessionMetaEl.textContent = `Bench 1RM est ${b1.toFixed(1)} kg`;

  exercisePreview.innerHTML = "";
  (Program.template[next.key] || []).forEach((exercise) => {
    const w = plannedWeight(exercise);
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
    const w = plannedWeight(exercise);
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
  const wPlan = plannedWeight(exercise);

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
  planPill.textContent = `Plan ${fmtKg(wPlan)} ${exercise.unit}`;
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

/* ---------------- Sets UI + commit logic ---------------- */
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
      s.weight = wN == null ? "" : fmtKg(wN);
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
    s.weight = wN == null ? "" : fmtKg(wN);

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

    // IMPORTANT FIX: prompt only once per exercise completion
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

/* ---------------- History ---------------- */
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

  if (k === "completed") sess.sets[exId][si].completed = !!inp.checked;
  else sess.sets[exId][si][k] = inp.value;

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
  if (!st.history?.length) { toast("No history to delete"); return; }

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
  benchW.value = st.settings.benchW;
  benchR.value = st.settings.benchR;
  bench1rmEl.textContent = `Bench 1RM est: ${bench1rmCalc(st.settings.benchW, st.settings.benchR).toFixed(1)} kg`;
}
saveSettingsBtn.onclick = () => {
  const w = normalizeNum(benchW.value);
  const r = normalizeInt(benchR.value);
  if (w == null || w <= 0 || r == null || r <= 0) { toast("Enter valid bench"); return; }
  st.settings.benchW = w;
  st.settings.benchR = r;
  save(st);
  render();
  renderSettings();
  toast("Saved");
};

/* ---------------- Storage (self-healing) ---------------- */
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);

    const ok =
      parsed &&
      typeof parsed === "object" &&
      parsed.settings && typeof parsed.settings === "object" &&
      parsed.progression && typeof parsed.progression === "object" &&
      Array.isArray(parsed.history);

    if (!ok) {
      localStorage.removeItem(LS_KEY);
      return defaultState();
    }

    const def = defaultState();

    if (!parsed.settings.mult) parsed.settings.mult = def.settings.mult;
    parsed.settings.mult = { ...def.settings.mult, ...parsed.settings.mult };

    if (typeof parsed.settings.benchW !== "number") parsed.settings.benchW = def.settings.benchW;
    if (typeof parsed.settings.benchR !== "number") parsed.settings.benchR = def.settings.benchR;

    if (typeof parsed.progression.completedSessions !== "number") parsed.progression.completedSessions = 0;
    if (typeof parsed.progression.nextIndex !== "number") parsed.progression.nextIndex = 0;

    if (!parsed.timer) parsed.timer = def.timer;
    if (typeof parsed.timer.running !== "boolean") parsed.timer.running = false;
    if (typeof parsed.timer.endAt !== "number") parsed.timer.endAt = 0;
    if (typeof parsed.timer.lastShownDone !== "boolean") parsed.timer.lastShownDone = false;
    if (typeof parsed.timer.label !== "string") parsed.timer.label = "";

    parsed.history = parsed.history.filter((s) => s && typeof s === "object" && s.sets && typeof s.sets === "object");

    return parsed;
  } catch (e) {
    localStorage.removeItem(LS_KEY);
    return defaultState();
  }
}
function save(s) { localStorage.setItem(LS_KEY, JSON.stringify(s)); }

function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node;
}

/* ---------------- Init ---------------- */
ensureTimer();
render();
renderSettings();
renderHistory();
setActiveTab("today");
