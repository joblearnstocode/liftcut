// LiftCut PWA (offline-first shell, on-device-only data)
// Focus update: Exercise Detail polish (auto-save, rest timer, next-exercise prompt, finish quote)

const LS_KEY = "liftcut_state_v3";

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

const QUOTES = [
  { by: "Marcus Aurelius", text: "You have power over your mind — not outside events. Realize this, and you will find strength." },
  { by: "Seneca", text: "Luck is what happens when preparation meets opportunity." },
  { by: "Epictetus", text: "No man is free who is not master of himself." },
  { by: "Aristotle", text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit." },
  { by: "Nietzsche", text: "That which does not kill us makes us stronger." }
];

function ex(id,name,sets,reps,rest,unit,scale){ return {id,name,sets,reps,rest,unit,scale}; }

function defaultState(){
  return {
    settings: {
      benchW: 50,
      benchR: 12,
      mult: { squatMult:0.85, deadliftMult:0.95, rdlMult:0.75, hipThrustMult:0.90, ohpMult:0.45, rowMult:0.70 }
    },
    progression: { completedSessions: 0, nextIndex: 0 },
    active: null,
    history: [],
    timer: { running:false, remainingSec:0, label:"" } // simple in-app timer state
  };
}

function load(){
  try {
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // ensure timer exists
    if(!parsed.timer) parsed.timer = { running:false, remainingSec:0, label:"" };
    return parsed;
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

function fmtKg(x){
  if(x==null || !isFinite(x)) return "—";
  return Number(x).toFixed(1);
}
function fmtMin(sec){
  const m = Math.round(sec/60);
  return `${m}m`;
}
function fmtClock(sec){
  const m = Math.floor(sec/60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2,"0")}`;
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

// modal
let modalOverlay = null;

let st = load();
let currentExercise = null;

// ---------- Navigation ----------
function setActiveTab(which){
  [tabToday, tabWorkout, tabHistory, tabSettings].forEach(t => t.classList.remove("active"));
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
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 1600);
}

function showModal({title, text, primaryText, primary, secondaryText, secondary}){
  closeModal();

  modalOverlay = document.createElement("div");
  modalOverlay.className = "modalOverlay";
  modalOverlay.innerHTML = `
    <div class="modal">
      <div class="modalTitle">${title}</div>
      <div class="modalText">${text}</div>
      <div class="modalActions">
        <button class="btn ghost" id="mSecondary">${secondaryText}</button>
        <button class="btn" id="mPrimary">${primaryText}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modalOverlay);

  modalOverlay.querySelector("#mPrimary").onclick = () => { closeModal(); primary?.(); };
  modalOverlay.querySelector("#mSecondary").onclick = () => { closeModal(); secondary?.(); };

  modalOverlay.onclick = (e) => {
    if(e.target === modalOverlay) closeModal();
  };
}

function closeModal(){
  if(modalOverlay){
    modalOverlay.remove();
    modalOverlay = null;
  }
}

// ---------- Timer ----------
let timerInterval = null;

function startRestTimer(seconds, label){
  st.timer.running = true;
  st.timer.remainingSec = Math.max(0, Math.round(seconds));
  st.timer.label = label || "Rest";
  save(st);
  renderTimerPill();
}

function stopRestTimer(){
  st.timer.running = false;
  st.timer.remainingSec = 0;
  st.timer.label = "";
  save(st);
  renderTimerPill();
}

function tickTimer(){
  if(!st.timer.running) return;
  if(st.timer.remainingSec <= 0){
    st.timer.running = false;
    save(st);
    renderTimerPill();
    toast("Rest complete");
    return;
  }
  st.timer.remainingSec -= 1;
  save(st);
  renderTimerPill();
}

function ensureTimerLoop(){
  if(timerInterval) return;
  timerInterval = setInterval(tickTimer, 1000);
}

// We display the timer in the Rest pill on the detail page (and keep it updated when visible)
function renderTimerPill(){
  // If on detail, show countdown
  if(!currentExercise){
    // not on detail; don't force UI, but keep state
    return;
  }
  const base = `Rest ${fmtMin(currentExercise.rest)}`;
  if(st.timer.running){
    restPill.textContent = `${base} • ${fmtClock(st.timer.remainingSec)}`;
    return;
  }
  restPill.textContent = base;
}

// ---------- Core render ----------
function render(){
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

  exercisePreview.innerHTML = "";
  const exs = Program.template[next.key];
  exs.forEach(exercise => {
    const w = plannedWeight(exercise, week, st);
    exercisePreview.appendChild(previewCard(exercise, w, week));
  });

  tabWorkout.disabled = !st.active;
  tabWorkout.style.opacity = st.active ? "1" : "0.5";
  tabWorkout.style.pointerEvents = st.active ? "auto" : "none";

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
    sets: {}
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

  exs.forEach((ex, exIdx) => {
    const item = document.createElement("div");
    item.className = "item";

    const arr = st.active.sets[ex.id] || [];
    const logged = arr.filter(s => s.completed).length;
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

    item.onclick = () => openDetail(ex, exIdx);
    workoutList.appendChild(item);
  });
}

function openDetail(ex, exIdx){
  if(!st.active) return;

  ensureTimerLoop();

  currentExercise = ex;
  currentExercise.__index = exIdx; // for next-exercise navigation

  const wPlan = plannedWeight(ex, st.active.week, st);

  if(!st.active.sets[ex.id]){
    st.active.sets[ex.id] = Array.from({length: ex.sets}, (_,i)=>({
      setIndex: i+1,
      usedPlanned: wPlan != null,
      planned: wPlan,
      weight: wPlan != null ? fmtKg(wPlan) : "",
      reps: "",
      rpe: "8.0",
      completed: false
    }));
  } else {
    st.active.sets[ex.id].forEach(s => { s.planned = wPlan; });
  }

  detailTitle.textContent = ex.name;

  const planText = (wPlan==null) ? "RPE-based" : `Plan ${fmtKg(wPlan)} ${ex.unit}`;
  detailMeta.textContent = `${ex.sets} sets • ${ex.reps} • Rest ${fmtMin(ex.rest)}`;

  // Plan pill with status dot (on if plan available)
  planPill.innerHTML = `<span class="dot ${wPlan!=null ? "on":""}"></span><span>${planText}</span>`;

  renderTimerPill(); // uses currentExercise

  renderSetRows(ex, wPlan);

  // Show detail pane
  setActiveTab("workout");
  paneWorkout.classList.add("hidden");
  paneDetail.classList.remove("hidden");
  tabWorkout.classList.add("active");
  [tabToday, tabHistory, tabSettings].forEach(t => t.classList.remove("active"));
}

function renderSetRows(ex, wPlan){
  const arr = st.active.sets[ex.id];
  setsEl.innerHTML = "";

  const help = document.createElement("div");
  help.className = "helper";
  help.textContent = (wPlan==null)
    ? "RPE-based lifts: enter a controlled working weight for the rep range."
    : "Auto-save is on. Complete a set by entering reps (and weight if manual). Rest timer starts automatically.";
  setsEl.appendChild(help);

  arr.forEach((s, idx) => {
    const planAvailable = (wPlan != null);
    const usePlan = planAvailable ? !!s.usedPlanned : false;

    if(planAvailable && usePlan){
      s.weight = fmtKg(wPlan);
    }

    const row = document.createElement("div");
    row.className = "setrow";

    row.innerHTML = `
      <div class="label">
        <div>Set ${s.setIndex}</div>
        <div class="savedDot ${s.completed ? "on":""}" title="Completed"></div>
      </div>

      <div>
        <div class="toggle">
          ${planAvailable ? `
            <input type="checkbox" data-i="${idx}" data-k="usedPlanned" ${usePlan ? "checked":""}/>
            <span>${usePlan ? "Plan" : "Manual"}</span>
          ` : `<span>Manual</span>`}
        </div>
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

  // quick rest controls (uses Jeremy rest time)
  const kb = document.createElement("div");
  kb.className = "kbRow";
  kb.innerHTML = `
    <button class="quickBtn" id="qRest">Start Rest (${fmtMin(ex.rest)})</button>
    <button class="quickBtn" id="q90">+90s</button>
    <button class="quickBtn" id="qStop">Stop</button>
  `;
  setsEl.appendChild(kb);

  el("qRest").onclick = () => startRestTimer(ex.rest, ex.name);
  el("q90").onclick = () => {
    if(st.timer.running){
      startRestTimer(st.timer.remainingSec + 90, st.timer.label);
      toast("+90s");
    } else {
      startRestTimer(90, "Rest");
    }
  };
  el("qStop").onclick = () => stopRestTimer();

  // Auto-save changes
  setsEl.querySelectorAll("input").forEach(inp => {
    inp.oninput = () => handleAutoSaveChange(ex, wPlan, inp);
    inp.onchange = () => handleAutoSaveChange(ex, wPlan, inp);
  });
}

function handleAutoSaveChange(ex, wPlan, inp){
  const idx = Number(inp.dataset.i);
  const k = inp.dataset.k;
  const arr = st.active.sets[ex.id];
  const s = arr[idx];

  if(k === "usedPlanned"){
    s.usedPlanned = inp.checked;
    if(inp.checked && wPlan != null){
      s.weight = fmtKg(wPlan);
    }
    // changing mode might affect completion
    s.completed = computeCompleted(s, wPlan);
    save(st);
    renderSetRows(ex, wPlan);
    return;
  }

  s[k] = inp.value;

  // Normalize certain inputs lightly (without being intrusive)
  if(k === "reps"){
    const r = normalizeInt(s.reps);
    s.reps = (r==null) ? "" : String(r);
  }
  if(k === "rpe"){
    const v = normalizeNum(s.rpe);
    s.rpe = (v==null) ? (s.rpe ?? "8.0") : (Math.round(v*10)/10).toFixed(1);
  }
  if(k === "weight"){
    // allow partial input; normalize on completion only
  }

  const wasCompleted = s.completed;
  s.completed = computeCompleted(s, wPlan);

  // If a set transitions to completed, start rest timer automatically
  if(!wasCompleted && s.completed){
    // normalize weight at completion time
    if(wPlan != null && s.usedPlanned){
      s.weight = fmtKg(wPlan);
    } else {
      const w = normalizeNum(s.weight);
      s.weight = (w==null) ? "" : fmtKg(w);
    }
    save(st);
    startRestTimer(ex.rest, ex.name);
    toast(`Set ${s.setIndex} saved`);

    // If exercise complete, prompt Next
    const allDone = arr.every(x => x.completed);
    if(allDone){
      promptNextExercise(ex);
    } else {
      // jump focus to next reps field (fast)
      focusNextReps(idx + 1);
    }

    renderSetRows(ex, wPlan);
    return;
  }

  save(st);
}

function computeCompleted(s, wPlan){
  // Completion rule: reps must be present; and if manual, weight must be present.
  const repsOk = normalizeInt(s.reps) != null && normalizeInt(s.reps) > 0;
  if(!repsOk) return false;

  if(wPlan != null && s.usedPlanned){
    return true;
  }
  const w = normalizeNum(s.weight);
  return (w != null && w > 0);
}

function focusNextReps(nextSetIndexZeroBased){
  // finds the next reps input and focuses it
  const inputs = setsEl.querySelectorAll('input[data-k="reps"]');
  if(!inputs || inputs.length === 0) return;
  if(nextSetIndexZeroBased >= inputs.length) return;
  const next = inputs[nextSetIndexZeroBased];
  if(next && typeof next.focus === "function") next.focus();
}

function promptNextExercise(ex){
  if(!st.active) return;
  const exs = Program.template[st.active.key];
  const currentIdx = ex.__index ?? 0;

  // find next exercise (wrap if at end)
  const nextIdx = Math.min(exs.length - 1, currentIdx + 1);
  const isLast = (currentIdx >= exs.length - 1);

  if(isLast){
    showModal({
      title: "Exercise complete",
      text: "That was the last exercise for today. You can finish the workout when ready.",
      primaryText: "Finish Workout",
      primary: () => finishBtn.click(),
      secondaryText: "Stay Here",
      secondary: () => {}
    });
    return;
  }

  const nextEx = exs[nextIdx];
  showModal({
    title: "Exercise complete",
    text: `Move to next: ${nextEx.name}?`,
    primaryText: "Next Exercise",
    primary: () => openDetail(nextEx, nextIdx),
    secondaryText: "Stay",
    secondary: () => {}
  });
}

backBtn.onclick = () => {
  paneDetail.classList.add("hidden");
  paneWorkout.classList.remove("hidden");
  currentExercise = null;
  renderWorkout();
  setActiveTab("workout");
};

doneBtn.onclick = () => {
  paneDetail.classList.add("hidden");
  paneWorkout.classList.remove("hidden");
  currentExercise = null;
  renderWorkout();
  setActiveTab("workout");
};

saveAllBtn.onclick = () => {
  if(!st.active || !currentExercise) return;
  const ex = currentExercise;
  const wPlan = plannedWeight(ex, st.active.week, st);
  const arr = st.active.sets[ex.id];

  // Mark any set as completed if it qualifies (no forcing)
  arr.forEach(s => {
    s.completed = computeCompleted(s, wPlan);
    if(s.completed){
      if(wPlan != null && s.usedPlanned){
        s.weight = fmtKg(wPlan);
      } else {
        const w = normalizeNum(s.weight);
        s.weight = (w==null) ? "" : fmtKg(w);
      }
      const r = normalizeInt(s.reps);
      s.reps = (r==null) ? "" : String(r);
      const rpe = normalizeNum(s.rpe);
      s.rpe = (rpe==null) ? "8.0" : (Math.round(rpe*10)/10).toFixed(1);
    }
  });

  save(st);
  toast("Saved");
  renderSetRows(ex, wPlan);

  if(arr.every(x => x.completed)){
    promptNextExercise(ex);
  }
};

finishBtn.onclick = () => {
  if(!st.active) return;

  // finalize: compute completion states & normalize
  const exs = Program.template[st.active.key];
  exs.forEach(ex => {
    const wPlan = plannedWeight(ex, st.active.week, st);
    const arr = st.active.sets[ex.id] || [];
    arr.forEach(s => {
      s.completed = computeCompleted(s, wPlan);
      if(s.completed){
        if(wPlan != null && s.usedPlanned){
          s.weight = fmtKg(wPlan);
        } else {
          const w = normalizeNum(s.weight);
          s.weight = (w==null) ? "" : fmtKg(w);
        }
        const r = normalizeInt(s.reps);
        s.reps = (r==null) ? "" : String(r);
        const rpe = normalizeNum(s.rpe);
        s.rpe = (rpe==null) ? "8.0" : (Math.round(rpe*10)/10).toFixed(1);
      }
    });
  });

  // store in history
  const finishedAt = Date.now();
  st.history.push({
    sessionId: st.active.sessionId,
    week: st.active.week,
    key: st.active.key,
    name: st.active.name,
    suggested: st.active.suggested,
    startedAt: st.active.startedAt,
    finishedAt,
    sets: st.active.sets
  });

  // advance progression
  st.active = null;
  st.progression.completedSessions += 1;
  st.progression.nextIndex = (st.progression.nextIndex + 1) % Program.cycle.length;

  // stop timer
  stopRestTimer();

  save(st);

  // show end message with quote
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  showModal({
    title: "Workout complete",
    text: `Nice work. ${q.text} — ${q.by}`,
    primaryText: "Back to Today",
    primary: () => {
      currentExercise = null;
      render();
      renderHistory();
      setActiveTab("today");
    },
    secondaryText: "View History",
    secondary: () => {
      currentExercise = null;
      renderHistory();
      setActiveTab("history");
    }
  });
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
    const totalSets = Object.values(sess.sets || {}).reduce((acc, arr)=> acc + (arr?.filter(s=>s.completed).length || 0), 0);

    div.innerHTML = `
      <div class="topline">
        <div class="name">${sess.name}</div>
        <div class="badge">Week ${sess.week}</div>
      </div>
      <div class="meta">${when} • Completed sets: ${totalSets}</div>
    `;
    div.onclick = () => toast(`${sess.name} • Week ${sess.week} • ${totalSets} sets completed`);
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

if(st.active){
  renderWorkout();
  setActiveTab("workout");
} else {
  setActiveTab("today");
}
