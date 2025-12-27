const LS_KEY = "liftcut_state_v3_prompt_timer_dot";

const Program = {
  cycle: [
    { name:"Upper A", suggested:"Mon", key:"UA" },
    { name:"Lower A", suggested:"Tue", key:"LA" },
    { name:"Upper B (Push)", suggested:"Thu", key:"UB" },
    { name:"Upper C (Pull)", suggested:"Fri" , key:"UC" },
    { name:"Lower B", suggested:"Sat", key:"LB" }
  ],
  template: {
    UA: [
      ex("bench","Barbell Bench Press",3,"8–10",180,"kg",{type:"benchBase"}),
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
    active: null,
    history: [],
    timer: { running:false, remaining:0, label:"" }
  };
}

let st = load();

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

// ---------- Tabs ----------
function setActiveTab(which){
  [tabToday, tabWorkout, tabHistory, tabSettings].forEach(t => t.classList.remove("active"));
  [paneToday, paneWorkout, paneDetail, paneHistory, paneSettings].forEach(p => p.classList.add("hidden"));

  if(which==="today"){ tabToday.classList.add("active"); paneToday.classList.remove("hidden"); }
  if(which==="workout"){ tabWorkout.classList.add("active"); paneWorkout.classList.remove("hidden"); }
  if(which==="detail"){ tabWorkout.classList.add("active"); paneDetail.classList.remove("hidden"); }
  if(which==="history"){ tabHistory.classList.add("active"); paneHistory.classList.remove("hidden"); }
  if(which==="settings"){ tabSettings.classList.add("active"); paneSettings.classList.remove("hidden"); }
}

tabToday.onclick = () => { render(); setActiveTab("today"); };
tabWorkout.onclick = () => { if(st.active){ renderWorkout(); setActiveTab("workout"); } else { setActiveTab("today"); } };
tabHistory.onclick = () => { renderHistory(); setActiveTab("history"); };
tabSettings.onclick = () => { renderSettings(); setActiveTab("settings"); };

function toast(msg){
  if(toastTimer) clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 1500);
}

// ---------- Math / planning ----------
function bench1rm(w,r){ return w*(1 + (r/30)); }

function plannedWeight(ex){
  const b1 = bench1rm(st.settings.benchW, st.settings.benchR);
  if(ex.scale.type==="rpe") return null;
  if(ex.scale.type==="benchBase") return b1*0.60;
  if(ex.scale.type==="benchMult"){
    const m = st.settings.mult[ex.scale.mult] ?? 1;
    return b1*0.60*m;
  }
  return null;
}

function fmtKg(x){ return (x==null || !isFinite(x)) ? "—" : Number(x).toFixed(1); }
function fmtMin(sec){ return `${Math.round(sec/60)}m`; }
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
function normalizeNum(v){
  const n = parseFloat(String(v).replace(",", "."));
  return isFinite(n) ? n : null;
}
function normalizeInt(v){
  const n = parseInt(String(v), 10);
  return isFinite(n) ? n : null;
}

// ---------- Timer ----------
function ensureTimer(){
  if(timerInterval) return;
  timerInterval = setInterval(() => {
    if(!st.timer.running) return;
    if(st.timer.remaining <= 0){
      st.timer.running = false;
      st.timer.remaining = 0;
      save(st);
      renderRestPill();
      toast("Rest complete");
      return;
    }
    st.timer.remaining -= 1;
    save(st);
    renderRestPill();
  }, 1000);
}

function startRest(seconds, label){
  ensureTimer();
  st.timer.running = true;
  st.timer.remaining = Math.max(0, Math.round(seconds));
  st.timer.label = label || "";
  save(st);
  renderRestPill();
}

function renderRestPill(){
  if(!currentExercise){
    restPill.textContent = "Rest —";
    return;
  }
  const base = `Rest ${fmtMin(currentExercise.ex.rest)}`;
  if(st.timer.running){
    restPill.textContent = `${base} • ${fmtClock(st.timer.remaining)}`;
  } else {
    restPill.textContent = base;
  }
}

// ---------- Session ----------
function ensureActive(){
  if(st.active) return;
  const next = Program.cycle[st.progression.nextIndex % Program.cycle.length];
  st.active = {
    id: crypto.randomUUID(),
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

// ---------- Rendering ----------
function render(){
  const next = Program.cycle[st.progression.nextIndex % Program.cycle.length];
  const b1 = bench1rm(st.settings.benchW, st.settings.benchR);

  subhead.textContent = `Next: ${next.name} (Suggested ${next.suggested})`;
  sessionNameEl.textContent = next.name;
  sessionMetaEl.textContent = `Bench 1RM est ${b1.toFixed(1)} kg`;

  exercisePreview.innerHTML = "";
  Program.template[next.key].forEach(ex => {
    const w = plannedWeight(ex);
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="topline">
        <div class="name">${ex.name}</div>
        <div class="pill">${w==null ? "RPE-based" : `Plan ${fmtKg(w)} ${ex.unit}`}</div>
      </div>
      <div class="meta">${ex.sets} sets • ${ex.reps} • Rest ${fmtMin(ex.rest)}</div>
    `;
    exercisePreview.appendChild(div);
  });

  tabWorkout.style.opacity = st.active ? "1" : "0.5";
}

function renderWorkout(){
  workoutList.innerHTML = "";
  workoutTitle.textContent = st.active ? st.active.name : "Workout";
  workoutSubtitle.textContent = st.active ? `Suggested ${st.active.suggested}` : "—";
  if(!st.active) return;

  const exs = Program.template[st.active.key];
  exs.forEach((ex, i) => {
    const div = document.createElement("div");
    div.className = "item";
    const w = plannedWeight(ex);
    const done = (st.active.sets[ex.id] || []).filter(s=>s.completed).length;
    div.innerHTML = `
      <div class="topline">
        <div class="name">${ex.name}</div>
        <div class="pill">${w==null ? "RPE" : `${fmtKg(w)} ${ex.unit}`}</div>
      </div>
      <div class="meta">${done}/${ex.sets} sets • ${ex.reps} • Rest ${fmtMin(ex.rest)}</div>
    `;
    div.onclick = () => openDetail(ex, i);
    workoutList.appendChild(div);
  });
}

// ---------- Next exercise logic ----------
function getExerciseList(){
  if(!st.active) return [];
  return Program.template[st.active.key];
}

function isExerciseComplete(ex){
  const arr = st.active?.sets?.[ex.id] || [];
  return arr.length === ex.sets && arr.filter(s=>s.completed).length === ex.sets;
}

function nextIncompleteIndex(fromIndex){
  const exs = getExerciseList();
  for(let j = fromIndex + 1; j < exs.length; j++){
    if(!isExerciseComplete(exs[j])) return j;
  }
  for(let j = 0; j < exs.length; j++){
    if(!isExerciseComplete(exs[j])) return j;
  }
  return -1; // all done
}

// ---------- Detail ----------
function openDetail(ex, index){
  currentExercise = { ex, index };

  const wPlan = plannedWeight(ex);

  if(!st.active.sets[ex.id]){
    st.active.sets[ex.id] = Array.from({length: ex.sets}, (_,i)=>({
      setIndex: i+1,
      weight: wPlan != null ? fmtKg(wPlan) : "",
      reps: "",
      rpe: "8.0",
      completed: false
    }));
    save(st);
  }

  detailTitle.textContent = ex.name;
  detailMeta.textContent = `${ex.sets} sets • ${ex.reps}`;
  planPill.textContent = wPlan==null ? "RPE-based" : `Plan ${fmtKg(wPlan)} ${ex.unit}`;
  renderRestPill();

  renderSets(ex);
  setActiveTab("detail");
}

function computeCompleted(s){
  const reps = normalizeInt(s.reps);
  const w = normalizeNum(s.weight);
  return (reps != null && reps > 0) && (w != null && w > 0);
}

function renderSets(ex){
  setsEl.innerHTML = "";
  const arr = st.active.sets[ex.id];

  arr.forEach((s, idx) => {
    const row = document.createElement("div");
    row.className = "setrow";
    row.innerHTML = `
      <div class="label">
        <div>Set ${s.setIndex}</div>
        <div class="doneDot ${s.completed ? "on" : ""}"></div>
      </div>
      <input inputmode="decimal" placeholder="Weight" value="${s.weight || ""}" data-i="${idx}" data-k="weight" />
      <input inputmode="numeric" placeholder="Reps" value="${s.reps || ""}" data-i="${idx}" data-k="reps" />
      <input inputmode="decimal" placeholder="RPE" value="${s.rpe || "8.0"}" data-i="${idx}" data-k="rpe" />
    `;
    setsEl.appendChild(row);
  });

  // draft-save on input, commit on blur/enter
  setsEl.querySelectorAll("input").forEach(inp => {
    inp.oninput = () => {
      const i = Number(inp.dataset.i);
      const k = inp.dataset.k;
      st.active.sets[ex.id][i][k] = inp.value;
      save(st);
    };

    const commit = () => {
      const i = Number(inp.dataset.i);
      const s = st.active.sets[ex.id][i];

      // normalize on commit
      const repsN = normalizeInt(s.reps);
      s.reps = repsN == null ? "" : String(repsN);

      const wN = normalizeNum(s.weight);
      s.weight = wN == null ? "" : fmtKg(wN);

      const rpeN = normalizeNum(s.rpe);
      s.rpe = rpeN == null ? (s.rpe || "8.0") : (Math.round(rpeN * 10) / 10).toFixed(1);

      const was = s.completed;
      s.completed = computeCompleted(s);

      save(st);
      renderWorkout();

      // on first-time completion: start rest + refresh dots
      if(!was && s.completed){
        startRest(ex.rest, ex.name);
        renderSets(ex); // refresh completion dots
        toast(`Set ${s.setIndex} complete`);
      }

      // if whole exercise complete: show prompt
      if(currentExercise && isExerciseComplete(ex)){
        promptAfterExerciseComplete(currentExercise.index);
      }
    };

    inp.onblur = commit;
    inp.onchange = commit;
    inp.onkeydown = (e) => { if(e.key === "Enter"){ inp.blur(); } };
  });
}

function promptAfterExerciseComplete(idx){
  const exs = getExerciseList();
  const nextIdx = nextIncompleteIndex(idx);

  if(nextIdx === -1){
    toast("All exercises complete");
    renderWorkout();
    setActiveTab("workout");
    return;
  }

  const nextName = exs[nextIdx].name;
  const ok = confirm(`Exercise complete.\n\nNext: ${nextName}\n\nOK = Next, Cancel = Workout list.`);
  if(ok){
    openDetail(exs[nextIdx], nextIdx);
  } else {
    renderWorkout();
    setActiveTab("workout");
  }
}

backBtn.onclick = () => { renderWorkout(); setActiveTab("workout"); };
doneBtn.onclick = () => { renderWorkout(); setActiveTab("workout"); };
saveAllBtn.onclick = () => { save(st); toast("Saved"); };

// ---------- Finish ----------
finishBtn.onclick = () => {
  if(!st.active) return;
  st.history.push({
    id: st.active.id,
    name: st.active.name,
    week: Math.floor(st.progression.completedSessions/5) + 1,
    startedAt: st.active.startedAt,
    finishedAt: Date.now(),
    sets: st.active.sets
  });
  st.active = null;
  st.progression.completedSessions += 1;
  st.progression.nextIndex = (st.progression.nextIndex + 1) % Program.cycle.length;

  st.timer = { running:false, remaining:0, label:"" };
  save(st);

  render();
  renderHistory();
  setActiveTab("today");
  toast("Workout saved");
};

// ---------- History ----------
function renderHistory(){
  exportOut.classList.add("hidden");
  historyList.innerHTML = "";
  if(!st.history.length){
    const d = document.createElement("div");
    d.className = "item";
    d.innerHTML = `<div class="name">No sessions yet</div><div class="meta">Finish a workout to save it here.</div>`;
    historyList.appendChild(d);
    return;
  }
  [...st.history].slice().reverse().forEach(sess => {
    const setsDone = Object.values(sess.sets || {}).reduce((a, arr)=>a+(arr?.filter(x=>x.completed).length||0),0);
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="topline">
        <div class="name">${sess.name}</div>
        <div class="pill">Week ${sess.week}</div>
      </div>
      <div class="meta">${fmtDate(sess.finishedAt)} • Completed sets: ${setsDone}</div>
    `;
    div.onclick = () => toast(`${sess.name} • Sets: ${setsDone}`);
    historyList.appendChild(div);
  });
}

exportBtn.onclick = () => {
  exportOut.classList.toggle("hidden");
  if(!exportOut.classList.contains("hidden")){
    exportOut.textContent = JSON.stringify(st, null, 2);
  }
};

// ---------- Settings ----------
function renderSettings(){
  benchW.value = st.settings.benchW;
  benchR.value = st.settings.benchR;
  bench1rmEl.textContent = `Bench 1RM est: ${bench1rm(st.settings.benchW, st.settings.benchR).toFixed(1)} kg`;
}

saveSettingsBtn.onclick = () => {
  const w = normalizeNum(benchW.value);
  const r = normalizeInt(benchR.value);
  if(w==null || w<=0 || r==null || r<=0){ toast("Enter valid bench"); return; }
  st.settings.benchW = w;
  st.settings.benchR = r;
  save(st);
  render();
  renderSettings();
  toast("Saved");
};

// ---------- Storage ----------
function load(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if(!parsed.history) parsed.history = [];
    if(!parsed.timer) parsed.timer = { running:false, remaining:0, label:"" };
    return parsed;
  }catch{ return defaultState(); }
}
function save(s){ localStorage.setItem(LS_KEY, JSON.stringify(s)); }
function el(id){ return document.getElementById(id); }

// init
ensureTimer();
render();
renderSettings();
renderHistory();
setActiveTab("today");
