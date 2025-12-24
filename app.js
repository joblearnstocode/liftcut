// LiftCut PWA (offline-first shell, on-device-only data)
// No permissions. No third-party scripts. No network calls for data.

const LS_KEY = "liftcut_state_v2";

const Program = {
  deloadWeeks: new Set([6, 12]),
  weekIntensity: [0.60,0.60,0.62,0.62,0.65,0.55, 0.62,0.65,0.68,0.68,0.70,0.60, 0.68,0.70,0.72,0.72,0.75,0.77],
  cycle: [
    { name:"Upper A", suggested:"Mon", key:"UA" },
    { name:"Lower A", suggested:"Tue", key:"LA" },
    { name:"Upper B (Push)", suggested:"Thu", key:"UB" },
    { name:"Upper C (Pull)", suggested:"Fri" , key:"UC" },
    { name:"Lower B", suggested:"Sat", key:"LB" }
  ],
  template: {
    UA: [
      ex("bench","Barbell Bench Press",3,"8–10",180,"kg",{type:"benchBase", pct:1.0}),
      ex("row","Bent-Over Barbell Row",3,"8–10",180,"kg",{type:"benchMult", mult:"rowMult"}),
      ex("ohp","Overhead Press (Barbell)",3,"8–10",180,"kg",{type:"benchMult", mult:"ohpMult"}),
      ex("latpd","Lat Pulldown / Assist",3,"8–10",150,"stack",{type:"rpe"}),
      ex("hc","Hammer Curl (DB)",2,"10–12",90,"kg/hand",{type:"rpe"}),
      ex("tpd","Triceps Pushdown (Cable)",2,"10–12",90,"stack",{type:"rpe"})
    ],
    LA: [
      ex("squat","Back Squat",3,"8–10",210,"kg",{type:"benchMult", mult:"squatMult"}),
      ex("rdl","Romanian Deadlift",3,"8–12",180,"kg",{type:"benchMult", mult:"rdlMult"}),
      ex("lp","Leg Press",3,"10–12",150,"machine",{type:"rpe"}),
      ex("lunge","Walking Lunge (DB)",2,"12 steps/leg",120,"kg/hand",{type:"rpe"}),
      ex("calf","Standing Calf Raise",3,"12–15",90,"machine",{type:"rpe"})
    ],
    UB: [
      ex("incdb","Incline DB Press",3,"8–12",150,"kg/hand",{type:"rpe"}),
      ex("fly","Seated Cable Fly (High-to-Low)",3,"10–15",120,"stack",{type:"rpe"}),
      ex("latraise","Lateral Raise (DB)",3,"12–15",90,"kg/hand",{type:"rpe"}),
      ex("toh","Overhead Triceps Extension (Cable)",3,"10–12",120,"stack",{type:"rpe"}),
      ex("facepull","Face Pull (optional)",2,"12–15",90,"stack",{type:"rpe"})
    ],
    UC: [
      ex("deadlift","Deadlift (Conventional/Trap)",3,"6–8",240,"kg",{type:"benchMult", mult:"deadliftMult"}),
      ex("pull","Pull-ups / Lat Pulldown",3,"6–10",150,"stack/added",{type:"rpe"}),
      ex("csrow","Chest-Supported Row",3,"10",150,"kg",{type:"rpe"}),
      ex("latrow","45° Cable Lat Row",2,"12",120,"stack",{type:"rpe"}),
      ex("reardelt","Rear Delt Cable Fly (45°)",2,"12–15",90,"stack",{type:"rpe"}),
      ex("curl","Incline DB Curl",3,"8–12",90,"kg/hand",{type:"rpe"})
    ],
    LB: [
      ex("hipthrust","Hip Thrust",3,"8–12",180,"kg",{type:"benchMult", mult:"hipThrustMult"}),
      ex("bulg","Bulgarian Split Squat (DB)",2,"10/leg",120,"kg/hand",{type:"rpe"}),
      ex("legcurl","Seated Leg Curl",3,"10–15",120,"stack",{type:"rpe"}),
      ex("legext","Leg Extension",3,"12–15",90,"stack",{type:"rpe"}),
      ex("calf2","Seated Calf Raise",3,"12–15",90,"machine",{type:"rpe"})
    ]
  }
};

function ex(id,name,sets,reps,rest,unit,scale){ return {id,name,sets,reps,rest,unit,scale}; }

function defaultState(){
  return {
    settings: {
      benchW: 50,
      benchR: 12,
      mult: { squatMult:0.85, deadliftMult:0.95, rdlMult:0.75, hipThrustMult:0.90, ohpMult:0.45, rowMult:0.70 }
    },
    progression: { completedSessions: 0, nextIndex: 0 },
    active: null,   // {sessionId, week, key, name, suggested, startedAt, sets:{} }
    history: []     // array of sessions with sets
  };
}

function load(){
  try {
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return defaultState();
    return JSON.parse(raw);
  } catch {
    return defaultState();
  }
}
function save(st){ localStorage.setItem(LS_KEY, JSON.stringify(st)); }

// helpers
function bench1rm(w,r){ return w*(1 + (r/30)); }
function weekFromCompleted(n){ return Math.min(18, Math.max(1, Math.floor(n/5)+1)); }
function isDeload(week){ return Program.deloadWeeks.has(week); }

function plannedWeight(ex, week, st){
  const intensity = Program.weekIntensity[week-1];
  const b1 = bench1rm(st.settings.benchW, st.settings.benchR);
  if(ex.scale.type==="rpe") return null;
  if(ex.scale.type==="benchBase") return b1*intensity*(ex.scale.pct||1);
  if(ex.scale.type==="benchMult"){
    const m = st.settings.mult[ex.scale.mult] ?? 1;
    return b1*intensity*m;
  }
  return null;
}

// formatters
function fmtKg(x){
  if(x==null || !isFinite(x)) return "—";
  return Number(x).toFixed(1);
}
function fmtMin(sec){
  const m = Math.round(sec/60);
  return `${m}m`;
}
function fmtDate(ts){
  const d = new Date(ts);
  const day = d.toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric" });
  const time = d.toLocaleTimeString(undefined, { hour:"numeric", minute:"2-digit" });
  return `${day} • ${time}`;
}
function normalizeNum(s){
  if(typeof s !== "string") s = String(s ?? "");
  const v = parseFloat(s.replace(",", "."));
  return isFinite(v) ? v : null;
}
function normalizeInt(s){
  if(typeof s !== "string") s = String(s ?? "");
  const v = parseInt(s, 10);
  return isFinite(v) ? v : null;
}

// UI refs
const subhead = el("subhead");

// tabs
const tabToday = el("tabToday");
const tabWorkout = el("tabWorkout");
const tabHistory = el("tabHistory");
const tabSettings = el("tabSettings");

// panes
const paneToday = el("paneToday");
const paneWorkout = el("paneWorkout");
const paneDetail = el("paneDetail");
const paneHistory = el("paneHistory");
const paneSettings = el("paneSettings");

// Today
const sessionNameEl = el("sessionName");
const sessionMetaEl = el("sessionMeta");
const startBtn = el("startBtn");
const exercisePreview = el("exercisePreview");

// Workout
const workoutTitle = el("workoutTitle");
const workoutSubtitle = el("workoutSubtitle");
const workoutList = el("workoutList");
const finishBtn = el("finishBtn");

// Detail
const detailTitle = el("detailTitle");
const detailMeta = el("detailMeta");
const planPill = el("planPill");
const restPill = el("restPill");
const backBtn = el("backBtn");
const setsEl = el("sets");
const saveAllBtn = el("saveAllBtn");
const doneBtn = el("doneBtn");

// History
const historyList = el("historyList");
const exportBtn = el("exportBtn");
const exportOut = el("exportOut");

// Settings
const benchW = el("benchW");
const benchR = el("benchR");
const bench1rmEl = el("bench1rm");
const saveSettingsBtn = el("saveSettingsBtn");

// toast
const toastEl = el("toast");
let toastTimer = null;

let st = load();
let currentExercise = null; // exercise object currently opened in detail

// Navigation
function setActiveTab(which){
  // tab classes
  [tabToday, tabWorkout, tabHistory, tabSettings].forEach(t => t.classList.remove("active"));

  // panes
  [paneToday, paneWorkout, paneDetail, paneHistory, paneSettings].forEach(p => p.classList.add("hidden"));

  if(which==="today"){
    tabToday.classList.add("active");
    paneToday.classList.remove("hidden");
  } else if(which==="workout"){
    tabWorkout.classList.add("active");
    paneWorkout.classList.remove("hidden");
  } else if(which==="history"){
    tabHistory.classList.add("active");
    paneHistory.classList.remove("hidden");
  } else if(which==="settings"){
    tabSettings.classList.add("active");
    paneSettings.classList.remove("hidden");
  }
}

tabToday.onclick = () => { render(); setActiveTab("today"); };
tabWorkout.onclick = () => { renderWorkout(); setActiveTab(st.active ? "workout" : "today"); };
tabHistory.onclick = () => { renderHistory(); setActiveTab("history"); };
tabSettings.onclick = () => { renderSettings(); setActiveTab("settings"); };

function toast(msg){
  if(toastTimer) clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 1700);
}

function render(){
  // compute next session + week
  const week = weekFromCompleted(st.progression.completedSessions);
  const next = Program.cycle[st.progression.nextIndex % Program.cycle.length];
  const deload = isDeload(week);

  const b1 = bench1rm(st.settings.benchW, st.settings.benchR);

  subhead.textContent =
    `Week ${week} of 18 • Next: ${next.name} (Suggested ${next.suggested})` +
    (deload ? " • Deload" : "");

  sessionNameEl.textContent = next.name;
  sessionMetaEl.textContent =
    `Suggested ${next.suggested} • Bench 1RM est ${b1.toFixed(1)} kg` +
    (deload ? " • Keep effort lower" : "");

  // show Today preview
  exercisePreview.innerHTML = "";
  const exs = Program.template[next.key];

  exs.forEach(exercise => {
    const w = plannedWeight(exercise, week, st);
    exercisePreview.appendChild(previewCard(exercise, w, week));
  });

  // If active session exists, Workout tab should be usable
  tabWorkout.disabled = !st.active;
  tabWorkout.style.opacity = st.active ? "1" : "0.5";
  tabWorkout.style.pointerEvents = st.active ? "auto" : "none";

  // Keep Start button state sensible
  startBtn.textContent = st.active ? "Resume" : "Start";
}

function previewCard(ex, w, week){
  const div = document.createElement("div");
  div.className = "item";
  const planText = (w==null) ? "RPE-based" : `Plan ${fmtKg(w)} ${ex.unit}`;
  div.innerHTML = `
    <div class="topline">
      <div class="name">${ex.name}</div>
      <div class="badge">${planText}</div>
    </div>
    <div class="meta">${ex.sets} sets • ${ex.reps} • Rest ${fmtMin(ex.rest)} ${isDeload(week) ? "• Deload: stay shy of failure" : ""}</div>
  `;
  return div;
}

function ensureActive(){
  if(st.active) return;
  const week = weekFromCompleted(st.progression.completedSessions);
  const next = Program.cycle[st.progression.nextIndex % Program.cycle.length];
  st.active = {
    sessionId: crypto.randomUUID(),
    week,
    key: next.key,
    name: next.name,
    suggested: next.suggested,
    startedAt: Date.now(),
    sets: {} // exerciseId -> array of set rows
  };
  save(st);
}

startBtn.onclick = () => {
  ensureActive();
  renderWorkout();
  setActiveTab("workout");
};

function renderWorkout(){
  if(!st.active){
    toast("No active session. Start from Today.");
    setActiveTab("today");
    return;
  }

  workoutTitle.textContent = `${st.active.name} • Week ${st.active.week}`;
  workoutSubtitle.textContent = `Suggested ${st.active.suggested} • ${isDeload(st.active.week) ? "Deload week" : "RPE 7–8"} • Tap an exercise`;

  workoutList.innerHTML = "";
  const exs = Program.template[st.active.key];

  exs.forEach(ex => {
    const item = document.createElement("div");
    item.className = "item";

    const logged = (st.active.sets[ex.id]?.filter(s => s.saved).length || 0);
    const w = plannedWeight(ex, st.active.week, st);
    const planText = (w==null) ? "RPE-based" : `Plan ${fmtKg(w)} ${ex.unit}`;

    item.innerHTML = `
      <div class="topline">
        <div class="name">${ex.name}</div>
        <div class="right">
          <div class="badge">${planText}</div>
          <div class="badge">${logged}/${ex.sets}</div>
        </div>
      </div>
      <div class="meta">${ex.sets} sets • ${ex.reps} • Rest ${fmtMin(ex.rest)}</div>
    `;

    item.onclick = () => openDetail(ex);
    workoutList.appendChild(item);
  });
}

function openDetail(ex){
  if(!st.active) return;

  currentExercise = ex;

  // Ensure set array exists
  const wPlan = plannedWeight(ex, st.active.week, st);
  if(!st.active.sets[ex.id]){
    st.active.sets[ex.id] = Array.from({length: ex.sets}, (_,i)=>({
      setIndex: i+1,
      usedPlanned: wPlan != null,
      planned: wPlan,
      weight: wPlan != null ? fmtKg(wPlan) : "",
      reps: "",
      rpe: "8.0",
      saved: false
    }));
  } else {
    // update planned snapshot for display (do not overwrite manual weights)
    st.active.sets[ex.id].forEach(s => { s.planned = wPlan; });
  }

  // Header info
  detailTitle.textContent = ex.name;
  const planText = (wPlan==null) ? "RPE-based" : `Plan ${fmtKg(wPlan)} ${ex.unit}`;
  detailMeta.textContent = `${ex.sets} sets • ${ex.reps} • Rest ${fmtMin(ex.rest)}`;
  planPill.textContent = planText;
  restPill.textContent = `Rest ${fmtMin(ex.rest)}`;

  // Render sets
  renderSetRows(ex, wPlan);

  // Show detail pane
  setActiveTab("workout"); // keep workout tab highlighted
  paneWorkout.classList.add("hidden");
  paneDetail.classList.remove("hidden");
  tabWorkout.classList.add("active");
  [tabToday, tabHistory, tabSettings].forEach(t => t.classList.remove("active"));
}

function renderSetRows(ex, wPlan){
  const arr = st.active.sets[ex.id];

  setsEl.innerHTML = "";

  // helper note
  const help = document.createElement("div");
  help.className = "helper";
  help.textContent = (wPlan==null)
    ? "RPE-based lifts: enter a sensible working weight you can control for the rep range."
    : "Use plan for consistency. Switch to manual if equipment or readiness requires an adjustment.";
  setsEl.appendChild(help);

  arr.forEach((s, idx) => {
    const row = document.createElement("div");
    row.className = "setrow";

    const planAvailable = (wPlan != null);
    const usePlan = planAvailable ? !!s.usedPlanned : false;

    // if using plan, enforce weight field to plan
    if(planAvailable && usePlan){
      s.weight = fmtKg(wPlan);
    }

    row.innerHTML = `
      <div class="label">Set ${s.setIndex}</div>

      <div>
        ${planAvailable ? `
          <div class="toggle">
            <input type="checkbox" data-i="${idx}" data-k="usedPlanned" ${usePlan ? "checked":""}/>
            <span>${usePlan ? "Using plan" : "Manual"}</span>
          </div>
        ` : `<div class="toggle"><span>Manual</span></div>`}
        <input
          ${planAvailable && usePlan ? "disabled":""}
          inputmode="decimal"
          placeholder="Weight"
          value="${s.weight ?? ""}"
          data-i="${idx}"
          data-k="weight"
        />
      </div>

      <div>
        <div class="toggle"><span>Reps</span></div>
        <input
          inputmode="numeric"
          placeholder="Reps"
          value="${s.reps ?? ""}"
          data-i="${idx}"
          data-k="reps"
        />
      </div>

      <div>
        <div class="toggle"><span>RPE</span></div>
        <input
          inputmode="decimal"
          placeholder="8.0"
          value="${s.rpe ?? "8.0"}"
          data-i="${idx}"
          data-k="rpe"
        />
      </div>
    `;

    setsEl.appendChild(row);
  });

  // Change handling (single delegated pass)
  setsEl.querySelectorAll("input").forEach(inp => {
    inp.onchange = () => {
      const i = Number(inp.dataset.i);
      const k = inp.dataset.k;
      const set = arr[i];

      if(k === "usedPlanned"){
        set.usedPlanned = inp.checked;
        if(inp.checked && wPlan != null){
          set.weight = fmtKg(wPlan);
        }
        set.saved = false;
        save(st);
        renderSetRows(ex, wPlan);
        return;
      }

      set[k] = inp.value;
      set.saved = false;
      save(st);
    };
  });
}

function saveSet(ex, idx){
  const wPlan = plannedWeight(ex, st.active.week, st);
  const arr = st.active.sets[ex.id];
  const s = arr[idx];

  // normalize fields
  if(wPlan != null && s.usedPlanned){
    s.weight = fmtKg(wPlan);
  } else {
    const w = normalizeNum(s.weight);
    s.weight = (w==null) ? "" : fmtKg(w);
  }

  const reps = normalizeInt(s.reps);
  s.reps = (reps==null) ? "" : String(reps);

  const rpe = normalizeNum(s.rpe);
  s.rpe = (rpe==null) ? "8.0" : (Math.round(rpe*10)/10).toFixed(1);

  // mark saved only if there is at least reps or weight input
  const hasAny = (String(s.weight).trim() !== "") || (String(s.reps).trim() !== "");
  s.saved = hasAny;

  save(st);
}

function saveAll(ex){
  const arr = st.active.sets[ex.id];
  for(let i=0;i<arr.length;i++){
    saveSet(ex, i);
  }
  toast("Saved");
}

backBtn.onclick = () => {
  paneDetail.classList.add("hidden");
  paneWorkout.classList.remove("hidden");
  renderWorkout();
  setActiveTab("workout");
};

doneBtn.onclick = () => {
  // return to workout list
  paneDetail.classList.add("hidden");
  paneWorkout.classList.remove("hidden");
  renderWorkout();
  setActiveTab("workout");
};

saveAllBtn.onclick = () => {
  if(!st.active || !currentExercise) return;
  saveAll(currentExercise);
  // re-render to show updated + normalized
  openDetail(currentExercise);
};

finishBtn.onclick = () => {
  if(!st.active) return;

  // Save all sets for all exercises before finishing (reduces “oops I forgot to save”)
  const exs = Program.template[st.active.key];
  exs.forEach(ex => {
    if(st.active.sets[ex.id]){
      st.active.sets[ex.id].forEach((_, idx) => saveSet(ex, idx));
    }
  });

  // Push to history
  st.history.push({
    sessionId: st.active.sessionId,
    week: st.active.week,
    key: st.active.key,
    name: st.active.name,
    suggested: st.active.suggested,
    startedAt: st.active.startedAt,
    finishedAt: Date.now(),
    sets: st.active.sets
  });

  // clear active
  st.active = null;

  // advance progression
  st.progression.completedSessions += 1;
  st.progression.nextIndex = (st.progression.nextIndex + 1) % Program.cycle.length;

  save(st);

  toast("Session saved");
  render();
  renderHistory();
  setActiveTab("today");
};

function renderHistory(){
  historyList.innerHTML = "";

  if(!st.history || st.history.length === 0){
    const empty = document.createElement("div");
    empty.className = "item";
    empty.innerHTML = `<div class="name">No sessions yet</div><div class="meta">Complete a workout to see it here.</div>`;
    historyList.appendChild(empty);
    exportOut.classList.add("hidden");
    return;
  }

  const items = [...st.history].slice().reverse().slice(0, 30);
  items.forEach(sess => {
    const div = document.createElement("div");
    div.className = "item";

    const when = fmtDate(sess.finishedAt || sess.startedAt);
    const totalSets = Object.values(sess.sets || {}).reduce((acc, arr)=> acc + (arr?.filter(s=>s.saved).length || 0), 0);

    div.innerHTML = `
      <div class="topline">
        <div class="name">${sess.name}</div>
        <div class="badge">Week ${sess.week}</div>
      </div>
      <div class="meta">${when} • Logged sets: ${totalSets}</div>
    `;

    // Tap shows a quick summary toast (minimal)
    div.onclick = () => toast(`${sess.name} • Week ${sess.week} • ${totalSets} sets logged`);
    historyList.appendChild(div);
  });

  exportOut.classList.add("hidden");
}

function renderSettings(){
  benchW.value = st.settings.benchW;
  benchR.value = st.settings.benchR;

  const b1 = bench1rm(st.settings.benchW, st.settings.benchR);
  bench1rmEl.textContent = `Bench 1RM est: ${b1.toFixed(1)} kg`;
}

saveSettingsBtn.onclick = () => {
  const w = normalizeNum(String(benchW.value));
  const r = normalizeInt(String(benchR.value));
  if(w==null || w <= 0 || r==null || r <= 0){
    toast("Enter valid bench weight & reps");
    return;
  }
  st.settings.benchW = w;
  st.settings.benchR = r;
  save(st);
  render();
  renderSettings();
  toast("Saved");
};

exportBtn.onclick = () => {
  exportOut.classList.toggle("hidden");
  if(!exportOut.classList.contains("hidden")){
    exportOut.textContent = JSON.stringify(st, null, 2);
  }
};

function el(id){ return document.getElementById(id); }

// INIT
render();
renderSettings();
renderHistory();

// On load, choose the correct default pane:
// If you have an active workout, open Workout; else Today.
if(st.active){
  renderWorkout();
  setActiveTab("workout");
} else {
  setActiveTab("today");
}
