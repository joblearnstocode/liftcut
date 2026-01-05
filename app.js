/* LiftCut — app.js (FULL, REPLACEABLE) — v10.1
   - Restores: full history editing + safe deletion controls
   - Adds: forced baseline onboarding gate
   - Keeps: auto-advance reps, prev-line under sets, safe progression + caps, editable weights/reps
*/

const LS_KEYS = ["liftcut_state_v101", "liftcut_state_v10", "liftcut_state_v9", "liftcut_state_v8", "liftcut_state_v7", "liftcut_state_v6", "liftcut_state_v5_history_accordion"];

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
      ex("squat", "Back Squat", 3, "10–12", 210, "kg"),
      ex("rdl", "Romanian Deadlift", 3, "10–12", 180, "kg"),
      ex("lp", "Leg Press", 3, "12–15", 150, "kg"),
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
      ex("hipthrust", "Hip Thrust", 3, "10–12", 180, "kg"),
      ex("bulg", "Bulgarian Split Squat (DB)", 2, "10/leg", 120, "kg/hand"),
      ex("legcurl", "Seated Leg Curl", 3, "12–15", 120, "kg"),
      ex("legext", "Leg Extension", 3, "12–15", 90, "kg"),
      ex("calf2", "Seated Calf Raise", 3, "12–15", 90, "kg"),
    ],
  },
};
function ex(id, name, sets, reps, rest, unit) { return { id, name, sets, reps, rest, unit }; }

/* ---------------- Defaults: steps ---------------- */
const DEFAULT_STEP_KG = {
  bench: 2.5, row: 2.5, ohp: 2.5, squat: 2.5, rdl: 2.5, deadlift: 2.5, hipthrust: 2.5,
  latpd: 2.5, tpd: 2.5, fly: 2.5, toh: 2.5, facepull: 2.5, pull: 2.5, csrow: 2.5, latrow: 2.5, reardelt: 2.5,
  legcurl: 2.5, legext: 2.5, calf: 2.5, calf2: 2.5,
  lp: 5,
  hc: 2, incdb: 2, latraise: 2, curl: 2, lunge: 2, bulg: 2,
};

const SEED_RATIO_TO_BENCH_1RM = {
  bench: 0.68, row: 0.60, ohp: 0.42, latpd: 0.50, tpd: 0.40, fly: 0.32, toh: 0.36, facepull: 0.30, reardelt: 0.20,
  csrow: 0.55, latrow: 0.40, pull: 0.50,
  hc: 0.20, incdb: 0.20, latraise: 0.09, curl: 0.16,
  squat: 0.70, rdl: 0.65, deadlift: 0.80, hipthrust: 0.80, lp: 1.35,
  lunge: 0.18, bulg: 0.16, legcurl: 0.45, legext: 0.38, calf: 0.85, calf2: 0.75,
};

const AUTO_CAP_RATIO_TO_BENCH_1RM = {
  bench: 0.80, row: 0.78, ohp: 0.55,
  latpd: 0.70, pull: 0.75, csrow: 0.80, latrow: 0.60,
  tpd: 0.60, fly: 0.55, toh: 0.60, facepull: 0.55, reardelt: 0.35,
  incdb: 0.32, hc: 0.30, curl: 0.26, latraise: 0.16, lunge: 0.28, bulg: 0.26,
  squat: 0.88, rdl: 0.85, deadlift: 1.05, hipthrust: 1.05, lp: 1.65,
  legcurl: 0.70, legext: 0.60, calf: 1.10, calf2: 1.00,
};

const LOWER_MACHINE_IDS = new Set(["lp", "legcurl", "legext", "calf", "calf2"]);
function isLowerMachine(exId) { return LOWER_MACHINE_IDS.has(exId); }

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
      benchSetWeightKg: 50,
      benchSetReps: 12,
      benchE1RM: null,
      coeffRSI: null,
      coeffASI: null,
      coeffLeanIndex: null,
    },
    steps: { ...DEFAULT_STEP_KG },
    progression: { completedSessions: 0, nextIndex: 0 },
    active: null,
    history: [],
    timer: { running: false, endAt: 0, lastShownDone: false, label: "" },
  };
}

let st = load();

/* ---------------- UI refs ---------------- */
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

let currentExercise = null;
let timerInterval = null;
let prevSetsForDetail = null;
let promptedExerciseIds = new Set();

/* History edit state */
let editingSessionId = null;
const editSnapshot = new Map();

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
  if (!st.profile.onboarded) { render(); setActiveTab("today"); toast("Set baseline first"); return; }
  st.active ? (renderWorkout(), setActiveTab("workout")) : setActiveTab("today");
};

tabHistory.onclick = () => { renderHistory(); setActiveTab("history"); };
tabSettings.onclick = () => { renderSettings(); setActiveTab("settings"); };

/* ---------------- Toast ---------------- */
function toast(msg) {
  if (toastTimer) clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 1600);
}

/* ---------------- Helpers ---------------- */
function normalizeNum(v){ const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : null; }
function normalizeInt(v){ const n = parseInt(String(v), 10); return isFinite(n) ? n : null; }
function roundToStep(value, step){ if (!isFinite(value) || !isFinite(step) || step<=0) return value; return Math.round(value/step)*step; }
function bench1rmEpley(w, reps){ return w * (1 + reps/30); }
function allometricIndex(oneRM, bw){ return oneRM / Math.pow(bw, 0.67); }
function fmtKg(x){ return x==null || !isFinite(x) ? "—" : Number(x).toFixed(1); }
function fmtMin(sec){ return `${Math.round(sec/60)}m`; }
function fmtClock(sec){ const m=Math.floor(sec/60), s=sec%60; return `${m}:${String(s).padStart(2,"0")}`; }
function esc(s){ return String(s ?? "").replace(/[&<>"']/g,(ch)=> ch==="&"?"&amp;":ch==="<"?"&lt;":ch===">"?"&gt;":ch===`"`?"&quot;":"&#39;"); }
function deepCopy(obj){ return JSON.parse(JSON.stringify(obj)); }
function msDays(days){ return days*24*60*60*1000; }
function isClose(a,b,tol=0.51){ return isFinite(a)&&isFinite(b)&&Math.abs(a-b)<=tol; }

/* ---------------- Benchmark ---------------- */
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
    } else p.coeffLeanIndex = null;
  } else {
    p.benchE1RM = null; p.coeffRSI = null; p.coeffASI = null; p.coeffLeanIndex = null;
  }
}

/* ---------------- Onboarding UI ---------------- */
function renderOnboardingCard(next) {
  exercisePreview.innerHTML = `
    <div class="card">
      <div class="h">Set your baseline first</div>
      <div class="s" style="margin-top:6px;">
        To generate safe suggested weights and track progress, enter your bench set weight + reps in Settings.
      </div>
      <div class="divider"></div>
      <div class="row">
        <div class="pill subtle">Next: ${esc(next.name)} • ${esc(next.suggested)}</div>
        <button class="btn" id="goBaselineBtn" type="button">Set baseline</button>
      </div>
    </div>
  `;
  const btn = document.getElementById("goBaselineBtn");
  if (btn) btn.onclick = () => { renderSettings(); setActiveTab("settings"); };
}

/* ---------------- Suggested weights ---------------- */
function stepForExercise(exId){ return st.steps?.[exId] ?? 2.5; }

function maxAutoWeight(exercise){
  recomputeBenchmark();
  const e1 = st.profile.benchE1RM;
  if (!e1 || !isFinite(e1)) return null;
  const ratio = AUTO_CAP_RATIO_TO_BENCH_1RM[exercise.id];
  if (!ratio || !isFinite(ratio)) return null;
  return roundToStep(e1 * ratio, stepForExercise(exercise.id));
}
function seedWeight(exercise){
  recomputeBenchmark();
  const e1 = st.profile.benchE1RM;
  const ratio = SEED_RATIO_TO_BENCH_1RM[exercise.id] ?? 0.45;
  const step = stepForExercise(exercise.id);

  let raw = (e1 && isFinite(e1)) ? e1 * ratio : 0;
  if (!raw || raw <= 0) raw = String(exercise.unit || "").toLowerCase().includes("hand") ? 10 : 20;

  let seeded = roundToStep(raw, step);
  const cap = maxAutoWeight(exercise);
  if (cap != null && isFinite(cap)) seeded = roundToStep(Math.min(seeded, cap), step);
  return seeded;
}
function parseRepRange(repStr){
  const s=String(repStr||"").toLowerCase();
  const nums=s.match(/\d+/g);
  if(!nums||!nums.length) return {min:null,max:null};
  if(s.includes("steps")||s.includes("/leg")){ const v=parseInt(nums[0],10); return {min:v,max:v}; }
  const n1=parseInt(nums[0],10), n2=nums.length>=2?parseInt(nums[1],10):n1;
  return {min:n1,max:n2};
}
function extractSessionPerformance(sess, exId, requiredSets){
  const arr=sess?.sets?.[exId];
  if(!arr||!Array.isArray(arr)||!arr.length) return null;
  const completed=arr.filter(s=>s?.completed);
  if(!completed.length) return null;
  const weights=completed.map(s=>normalizeNum(s.weight)).filter(v=>v!=null&&v>0);
  const reps=completed.map(s=>normalizeInt(s.reps)).filter(v=>v!=null&&v>0);
  if(!weights.length||!reps.length) return null;
  const wSorted=weights.slice().sort((a,b)=>a-b);
  const medianW=wSorted[Math.floor(wSorted.length/2)];
  const repsBySet=completed.map(s=>normalizeInt(s.reps)).filter(v=>v!=null&&v>0).slice(0,requiredSets);
  return { lastWeight: medianW, repsBySet, completedCount: completed.length, requiredSets };
}
function getLastPerformance(exId, requiredSets){
  for(let i=st.history.length-1;i>=0;i--){
    const perf=extractSessionPerformance(st.history[i], exId, requiredSets);
    if(perf) return perf;
  }
  return null;
}
function topStreakAtSameWeight(exId, requiredSets, repMax){
  let streak=0, lastW=null;
  for(let i=st.history.length-1;i>=0;i--){
    const perf=extractSessionPerformance(st.history[i], exId, requiredSets);
    if(!perf) continue;
    const allTop = perf.completedCount>=requiredSets && perf.repsBySet.length>=requiredSets && perf.repsBySet.every(r=>r>=repMax);
    if(!allTop) break;
    if(lastW==null){ streak=1; lastW=perf.lastWeight; continue; }
    if(isClose(perf.lastWeight,lastW)) streak+=1; else break;
  }
  return streak;
}
function suggestNextWeight(exercise){
  const requiredSets=exercise.sets;
  const perf=getLastPerformance(exercise.id, requiredSets);
  const step=stepForExercise(exercise.id);
  const rr=parseRepRange(exercise.reps);

  if(!perf) return seedWeight(exercise);
  if(rr.min==null||rr.max==null) return roundToStep(perf.lastWeight, step);

  const belowMinCount=perf.repsBySet.filter(r=>r<rr.min).length;
  const manyBelowMin=belowMinCount>=Math.ceil(requiredSets/2);

  const allTop=perf.completedCount>=requiredSets && perf.repsBySet.length>=requiredSets && perf.repsBySet.every(r=>r>=rr.max);
  const needStreak=isLowerMachine(exercise.id)?2:1;
  const streak=allTop?topStreakAtSameWeight(exercise.id, requiredSets, rr.max):0;

  let next=perf.lastWeight;
  if(allTop && streak>=needStreak) next=perf.lastWeight+step;
  else if(manyBelowMin) next=Math.max(step, perf.lastWeight-step);

  const cap=maxAutoWeight(exercise);
  if(cap!=null&&isFinite(cap) && perf.lastWeight<=cap+0.51) next=Math.min(next, cap);
  return roundToStep(next, step);
}

/* ---------------- Prev comparison ---------------- */
function getPrevComparableSets(activeKey, exId){
  for(let i=st.history.length-1;i>=0;i--){
    const sess=st.history[i];
    if(sess?.key===activeKey && sess?.sets?.[exId]) return sess.sets[exId];
  }
  for(let i=st.history.length-1;i>=0;i--){
    const sess=st.history[i];
    if(sess?.sets?.[exId]) return sess.sets[exId];
  }
  return null;
}
function formatPrevLine(prevSet){
  if(!prevSet) return "Prev: —";
  const w=String(prevSet.weight??"").trim();
  const r=String(prevSet.reps??"").trim();
  if(!w && !r) return "Prev: —";
  return `Prev: ${w?`${w} kg`:"— kg"} · ${r?`${r} reps`:"— reps"}`;
}

/* ---------------- Timer ---------------- */
function remainingSeconds(){
  if(!st.timer?.running) return 0;
  return Math.max(0, Math.ceil((st.timer.endAt-Date.now())/1000));
}
function ensureTimer(){
  if(timerInterval) return;
  timerInterval=setInterval(()=>{
    if(!st.timer?.running) return;
    renderRestPill();
    if(remainingSeconds()<=0){
      st.timer.running=false; st.timer.endAt=0;
      save(st);
      toast("Rest complete");
      renderRestPill();
    } else save(st);
  }, 500);
}
function startRest(seconds){
  ensureTimer();
  const secs=Math.max(0, Math.round(seconds));
  st.timer.running=true;
  st.timer.endAt=Date.now()+secs*1000;
  save(st);
  renderRestPill();
}
function renderRestPill(){
  if(!currentExercise){ restPill.textContent="Rest —"; return; }
  const base=`Rest ${fmtMin(currentExercise.ex.rest)}`;
  restPill.textContent = st.timer?.running ? `${base} • ${fmtClock(remainingSeconds())}` : base;
}

/* ---------------- Today render ---------------- */
function render(){
  const next = Program.cycle[st.progression.nextIndex % Program.cycle.length];
  recomputeBenchmark();
  subhead.textContent = `Next: ${next.name} (Suggested ${next.suggested})`;

  if(!st.profile.onboarded){
    sessionNameEl.textContent = next.name;
    sessionMetaEl.textContent = "Set baseline to generate safe suggested weights";
    startBtn.textContent = "Set baseline";
    startBtn.onclick = () => { renderSettings(); setActiveTab("settings"); };
    renderOnboardingCard(next);
    tabWorkout.style.opacity = "0.5";
    return;
  }

  const e1 = st.profile.benchE1RM;
  sessionNameEl.textContent = next.name;
  sessionMetaEl.textContent = e1 ? `Bench e1RM ${Number(e1).toFixed(1)} kg • RSI ${st.profile.coeffRSI ?? "—"}` : "Benchmark missing";

  startBtn.textContent = "Start workout";
  startBtn.onclick = () => { ensureActive(); renderWorkout(); setActiveTab("workout"); };

  exercisePreview.innerHTML = "";
  (Program.template[next.key] || []).forEach((exercise)=>{
    const w=suggestNextWeight(exercise);
    const div=document.createElement("div");
    div.className="item";
    div.innerHTML = `
      <div class="topline">
        <div class="name">${esc(exercise.name)}</div>
        <div class="pill">Plan ${fmtKg(w)} ${esc(exercise.unit)}</div>
      </div>
      <div class="meta">${exercise.sets} sets • ${esc(exercise.reps)} • Rest ${fmtMin(exercise.rest)}</div>
    `;
    exercisePreview.appendChild(div);
  });

  tabWorkout.style.opacity = "1";
}

function ensureActive(){
  if(st.active) return;
  const next = Program.cycle[st.progression.nextIndex % Program.cycle.length];
  st.active = { id: crypto.randomUUID(), key: next.key, name: next.name, suggested: next.suggested, startedAt: Date.now(), sets: {} };
  promptedExerciseIds = new Set();
  save(st);
}

/* ---------------- Workout list + detail ---------------- */
function renderWorkout(){
  workoutList.innerHTML="";
  workoutTitle.textContent = st.active ? st.active.name : "Workout";
  workoutSubtitle.textContent = st.active ? `Suggested ${st.active.suggested}` : "—";
  if(!st.active) return;

  const exs = Program.template[st.active.key] || [];
  exs.forEach((exercise,i)=>{
    const div=document.createElement("div");
    div.className="item";
    const w=suggestNextWeight(exercise);
    const done=(st.active.sets[exercise.id]||[]).filter(s=>s.completed).length;
    div.innerHTML = `
      <div class="topline">
        <div class="name">${esc(exercise.name)}</div>
        <div class="pill">${fmtKg(w)} ${esc(exercise.unit)}</div>
      </div>
      <div class="meta">${done}/${exercise.sets} sets • ${esc(exercise.reps)} • Rest ${fmtMin(exercise.rest)}</div>
    `;
    div.onclick = ()=>openDetail(exercise,i);
    workoutList.appendChild(div);
  });
}

function computeCompleted(set){
  const reps=normalizeInt(set.reps);
  const w=normalizeNum(set.weight);
  return reps!=null && reps>0 && w!=null && w>0;
}
function isExerciseComplete(exercise){
  const arr = st.active?.sets?.[exercise.id] || [];
  return arr.length===exercise.sets && arr.filter(s=>s.completed).length===exercise.sets;
}
function getExerciseList(){ return st.active ? (Program.template[st.active.key]||[]) : []; }
function nextIncompleteIndex(fromIndex){
  const exs=getExerciseList();
  for(let j=fromIndex+1;j<exs.length;j++) if(!isExerciseComplete(exs[j])) return j;
  for(let j=0;j<exs.length;j++) if(!isExerciseComplete(exs[j])) return j;
  return -1;
}
function promptAfterExerciseComplete(idx){
  const exs=getExerciseList();
  const nextIdx=nextIncompleteIndex(idx);
  if(nextIdx===-1){ toast("All exercises complete"); renderWorkout(); setActiveTab("workout"); return; }
  const ok = confirm(`Exercise complete.\n\nNext: ${exs[nextIdx].name}\n\nOK = Next, Cancel = Workout list.`);
  if(ok) openDetail(exs[nextIdx], nextIdx);
  else { renderWorkout(); setActiveTab("workout"); }
}

function openDetail(exercise,index){
  currentExercise={ ex: exercise, index };
  prevSetsForDetail = getPrevComparableSets(st.active?.key, exercise.id);

  const wPlan=suggestNextWeight(exercise);
  const cap=maxAutoWeight(exercise);
  const step=stepForExercise(exercise.id);

  if(!st.active.sets[exercise.id]){
    st.active.sets[exercise.id] = Array.from({length: exercise.sets}, (_,i)=>({
      setIndex:i+1, weight: fmtKg(wPlan), reps:"", completed:false
    }));
    save(st);
  }

  detailTitle.textContent=exercise.name;
  detailMeta.textContent=`${exercise.sets} sets • ${exercise.reps}`;
  let extra=`step ${step}${exercise.unit.includes("hand")?"/hand":""}`;
  if(cap!=null && isFinite(cap)) extra+=` • cap ${fmtKg(cap)} ${exercise.unit}`;
  planPill.textContent=`Plan ${fmtKg(wPlan)} ${exercise.unit} • ${extra}`;

  renderRestPill();
  renderSets(exercise);
  setActiveTab("detail");
}

function renderSets(exercise){
  setsEl.innerHTML="";
  const arr=st.active.sets[exercise.id];

  arr.forEach((s,idx)=>{
    const prev = Array.isArray(prevSetsForDetail) ? prevSetsForDetail[idx] : null;
    const prevLine = formatPrevLine(prev);

    const row=document.createElement("div");
    row.className="setrow";
    row.innerHTML=`
      <div class="label">
        <div>Set ${s.setIndex}</div>
        <div class="doneDot ${s.completed ? "on" : ""}"></div>
      </div>
      <input class="wIn" inputmode="decimal" placeholder="Weight (kg)" value="${esc(s.weight||"")}" data-i="${idx}" data-k="weight" />
      <input class="rIn" inputmode="numeric" placeholder="Reps" value="${esc(s.reps||"")}" data-i="${idx}" data-k="reps" />
      <div class="prevMini">${esc(prevLine)}</div>
    `;
    setsEl.appendChild(row);
  });

  [...setsEl.querySelectorAll("input")].forEach((inp)=>{
    inp.oninput=()=>{
      const i=Number(inp.dataset.i), k=inp.dataset.k;
      st.active.sets[exercise.id][i][k]=inp.value;
      save(st);
    };
  });

  setsEl.querySelectorAll("input.wIn").forEach((inp)=>{
    inp.onblur=()=>{
      const i=Number(inp.dataset.i);
      const s=st.active.sets[exercise.id][i];
      const wN=normalizeNum(s.weight);
      s.weight = (wN==null) ? "" : fmtKg(roundToStep(wN, stepForExercise(exercise.id)));
      save(st);
      renderSets(exercise);
    };
    inp.onkeydown=(e)=>{
      if(e.key==="Enter"){
        const i=Number(inp.dataset.i);
        const repsInp = setsEl.querySelector(`input.rIn[data-i="${i}"]`);
        if(repsInp) repsInp.focus();
      }
    };
  });

  function focusNextRepsInput(currentIdx){
    const next = setsEl.querySelector(`input.rIn[data-i="${currentIdx+1}"]`);
    if(next) setTimeout(()=>next.focus({preventScroll:true}),0);
    else {
      const cur = setsEl.querySelector(`input.rIn[data-i="${currentIdx}"]`);
      if(cur) cur.blur();
    }
  }

  function commitSet(i, autoAdvance){
    const s=st.active.sets[exercise.id][i];
    const repsN=normalizeInt(s.reps);
    s.reps = repsN==null ? "" : String(repsN);

    const wN=normalizeNum(s.weight);
    s.weight = (wN==null) ? "" : fmtKg(roundToStep(wN, stepForExercise(exercise.id)));

    const was=!!s.completed;
    s.completed=computeCompleted(s);

    save(st);
    renderWorkout();

    if(!was && s.completed){
      startRest(exercise.rest);
      toast(`Set ${s.setIndex} complete`);
    }

    renderSets(exercise);
    if(autoAdvance) focusNextRepsInput(i);

    if(currentExercise && isExerciseComplete(exercise) && !promptedExerciseIds.has(exercise.id)){
      promptedExerciseIds.add(exercise.id);
      promptAfterExerciseComplete(currentExercise.index);
    }
  }

  setsEl.querySelectorAll("input.rIn").forEach((inp)=>{
    inp.onblur=()=>commitSet(Number(inp.dataset.i), false);
    inp.onkeydown=(e)=>{
      if(e.key==="Enter"){
        e.preventDefault();
        commitSet(Number(inp.dataset.i), true);
      }
    };
  });
}

backBtn.onclick=()=>{ renderWorkout(); setActiveTab("workout"); };
doneBtn.onclick=()=>{ renderWorkout(); setActiveTab("workout"); };
saveAllBtn.onclick=()=>{ save(st); toast("Saved"); };

/* ---------------- Finish workout ---------------- */
finishBtn.onclick=()=>{
  if(!st.active) return;

  st.history.push({
    id: st.active.id,
    key: st.active.key,
    name: st.active.name,
    week: Math.floor(st.progression.completedSessions/5)+1,
    startedAt: st.active.startedAt,
    finishedAt: Date.now(),
    sets: st.active.sets,
  });

  st.active=null;
  st.progression.completedSessions += 1;
  st.progression.nextIndex = (st.progression.nextIndex + 1) % Program.cycle.length;
  st.timer = { running:false, endAt:0, lastShownDone:false, label:"" };
  promptedExerciseIds = new Set();
  prevSetsForDetail = null;

  save(st);
  render();
  renderHistory();
  setActiveTab("today");
  toast("Workout saved");
};

/* ---------------- History: FULL feature set ---------------- */
function fmtDate(ts){
  const d=new Date(ts);
  const day=d.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});
  const time=d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});
  return `${day} • ${time}`;
}
function guessKeyFromName(name){
  const n=String(name||"").toLowerCase();
  if(n.includes("upper a")) return "UA";
  if(n.includes("lower a")) return "LA";
  if(n.includes("upper b")) return "UB";
  if(n.includes("upper c")) return "UC";
  if(n.includes("lower b")) return "LB";
  return "UA";
}
function getExerciseNameById(sessionKey, exId){
  const arr=Program.template[sessionKey]||[];
  const found=arr.find(x=>x.id===exId);
  return found?found.name:exId;
}
function countCompletedSets(setsArr){ return (setsArr||[]).filter(s=>s&&s.completed).length; }
function buildSetLine(s){
  const w=(s?.weight??"").toString().trim();
  const r=(s?.reps??"").toString().trim();
  const pieces=[];
  if(w) pieces.push(`${w}kg`);
  if(r) pieces.push(`${r} reps`);
  pieces.push(s?.completed ? "Done" : "Not done");
  return pieces.join(" • ");
}
function applyHistoryEdit(inp){
  const sid=inp.dataset.sid, exId=inp.dataset.ex, si=Number(inp.dataset.si), k=inp.dataset.k;
  const idx=st.history.findIndex(x=>x.id===sid);
  if(idx===-1) return;
  const sess=st.history[idx];
  if(!sess.sets||!sess.sets[exId]||!sess.sets[exId][si]) return;
  if(k==="completed") sess.sets[exId][si].completed = !!inp.checked;
  else sess.sets[exId][si][k] = inp.value;
  save(st);
}
function deleteSingleSession(sessionId){
  const idx=st.history.findIndex(x=>x.id===sessionId);
  if(idx===-1) return;
  const sess=st.history[idx];
  const name=sess?.name?` (${sess.name})`:"";
  if(!confirm(`Delete this session${name}? This cannot be undone.`)) return;
  if(editingSessionId===sessionId){ editingSessionId=null; editSnapshot.delete(sessionId); }
  st.history.splice(idx,1);
  save(st);
  renderHistory();
  toast("Session deleted");
}
function deleteHistoryByRange(mode){
  if(!st.history?.length){ toast("No history to delete"); return; }

  if(mode==="all"){
    if(!confirm("Delete ALL history? This cannot be undone.")) return;
    const reset = confirm("Also reset your program back to Upper A / Week 1?\n\nOK = Yes, reset\nCancel = No");
    st.history = [];
    if(reset){
      st.progression = { completedSessions: 0, nextIndex: 0 };
      st.active = null;
      st.timer = { running:false, endAt:0, lastShownDone:false, label:"" };
    }
    editingSessionId=null;
    editSnapshot.clear();
    save(st);
    render();
    renderWorkout();
    renderHistory();
    setActiveTab("today");
    toast(reset ? "History deleted + program reset" : "History deleted");
    return;
  }

  const now=Date.now();
  const cutoff= now - (mode==="7d" ? msDays(7) : msDays(30));
  const label = mode==="7d" ? "the last 7 days" : "the last 30 days";
  if(!confirm(`Delete sessions from ${label}? This cannot be undone.`)) return;

  st.history = st.history.filter(sess => (sess.finishedAt || sess.startedAt || 0) < cutoff);
  if(editingSessionId && !st.history.some(s=>s.id===editingSessionId)) editingSessionId=null;

  save(st);
  renderHistory();
  toast("History deleted");
}
function renderHistory(){
  exportOut.classList.add("hidden");
  historyList.innerHTML="";

  const global=document.createElement("div");
  global.className="card";
  global.innerHTML=`
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

  const d7 = global.querySelector("#del7");
  const d30 = global.querySelector("#del30");
  const dAll = global.querySelector("#delAll");
  if(d7) d7.onclick=()=>deleteHistoryByRange("7d");
  if(d30) d30.onclick=()=>deleteHistoryByRange("30d");
  if(dAll) dAll.onclick=()=>deleteHistoryByRange("all");

  if(!st.history.length){
    const d=document.createElement("div");
    d.className="item";
    d.innerHTML=`<div class="name">No sessions yet</div><div class="meta">Finish a workout to save it here.</div>`;
    historyList.appendChild(d);
    return;
  }

  const sessions=[...st.history].slice().reverse();
  sessions.forEach((sess)=>{
    const sessKey = sess.key || guessKeyFromName(sess.name);
    const setsDone = Object.values(sess.sets||{}).reduce((a,arr)=>a+countCompletedSets(arr),0);
    const isEditing = editingSessionId === sess.id;

    const details=document.createElement("details");
    details.className="histDetails";

    const summary=document.createElement("summary");
    summary.className="histSummary";
    summary.innerHTML=`
      <div class="histHead">
        <div>
          <div class="histTitle">${esc(sess.name||"Session")}</div>
          <div class="histMeta">${esc(fmtDate(sess.finishedAt||sess.startedAt||Date.now()))} • Completed sets: ${setsDone}</div>
        </div>
        <div class="pill">Week ${esc(sess.week ?? "—")}</div>
      </div>
    `;
    details.appendChild(summary);

    const body=document.createElement("div");
    body.className="histBody";

    const bar=document.createElement("div");
    bar.className="histBar";

    if(!isEditing){
      const editBtn=document.createElement("button");
      editBtn.className="histBtn";
      editBtn.type="button";
      editBtn.textContent="Edit";
      editBtn.onclick=(e)=>{
        e.preventDefault(); e.stopPropagation();
        editingSessionId = sess.id;
        editSnapshot.set(sess.id, deepCopy(sess));
        renderHistory();
      };
      bar.appendChild(editBtn);

      const delBtn=document.createElement("button");
      delBtn.className="histBtn danger";
      delBtn.type="button";
      delBtn.textContent="Delete session";
      delBtn.onclick=(e)=>{
        e.preventDefault(); e.stopPropagation();
        deleteSingleSession(sess.id);
      };
      bar.appendChild(delBtn);

      const hint=document.createElement("div");
      hint.className="s";
      hint.textContent="Edit or delete this session.";
      bar.appendChild(hint);
    } else {
      const saveBtn=document.createElement("button");
      saveBtn.className="histBtn primary";
      saveBtn.type="button";
      saveBtn.textContent="Save";
      saveBtn.onclick=(e)=>{
        e.preventDefault(); e.stopPropagation();
        save(st);
        editingSessionId=null;
        editSnapshot.delete(sess.id);
        renderHistory();
        toast("History updated");
      };

      const cancelBtn=document.createElement("button");
      cancelBtn.className="histBtn danger";
      cancelBtn.type="button";
      cancelBtn.textContent="Cancel";
      cancelBtn.onclick=(e)=>{
        e.preventDefault(); e.stopPropagation();
        const snap=editSnapshot.get(sess.id);
        if(snap){
          const idx=st.history.findIndex(x=>x.id===sess.id);
          if(idx!==-1) st.history[idx]=snap;
          save(st);
        }
        editingSessionId=null;
        editSnapshot.delete(sess.id);
        renderHistory();
        toast("Reverted");
      };

      bar.appendChild(saveBtn);
      bar.appendChild(cancelBtn);
    }

    body.appendChild(bar);

    const exIds=Object.keys(sess.sets||{});
    if(!exIds.length){
      body.insertAdjacentHTML("beforeend", `<div class="s">No exercise data saved for this session.</div>`);
    } else {
      const order=(Program.template[sessKey]||[]).map(x=>x.id);
      const sorted=exIds.slice().sort((a,b)=>{
        const ia=order.indexOf(a), ib=order.indexOf(b);
        if(ia===-1 && ib===-1) return a.localeCompare(b);
        if(ia===-1) return 1;
        if(ib===-1) return -1;
        return ia-ib;
      });

      sorted.forEach((exId)=>{
        const setsArr=sess.sets[exId]||[];
        const done=countCompletedSets(setsArr);
        const planned=setsArr.length||"—";
        const exName=getExerciseNameById(sessKey, exId);

        const exBlock=document.createElement("div");
        exBlock.className="histExercise";
        exBlock.innerHTML=`
          <div class="histExName">${esc(exName)}</div>
          <div class="histExSub">${done}/${planned} sets completed</div>
        `;

        const setsWrap=document.createElement("div");
        setsWrap.className="histSets";

        setsArr.forEach((s,si)=>{
          if(!isEditing){
            const row=document.createElement("div");
            row.className="histSetRow";
            row.innerHTML=`<div class="l">Set ${esc(s?.setIndex ?? "")}</div><div class="r">${esc(buildSetLine(s))}</div>`;
            setsWrap.appendChild(row);
            return;
          }

          const er=document.createElement("div");
          er.className="histEditRow";
          er.innerHTML=`
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

    if(isEditing){
      details.open=true;
      details.querySelectorAll("input").forEach((inp)=>{
        inp.oninput=()=>applyHistoryEdit(inp);
        inp.onchange=()=>applyHistoryEdit(inp);
        inp.onkeydown=(e)=>{ if(e.key==="Enter") inp.blur(); };
      });
    }
  });
}

exportBtn.onclick=()=>{
  exportOut.classList.toggle("hidden");
  if(!exportOut.classList.contains("hidden")) exportOut.textContent = JSON.stringify(st,null,2);
};

/* ---------------- Settings ---------------- */
function renderSettings(){
  benchW.value = st.profile.benchSetWeightKg ?? 50;
  benchR.value = st.profile.benchSetReps ?? 12;
  recomputeBenchmark();
  const e1=st.profile.benchE1RM;
  bench1rmEl.textContent = e1 ? `Bench e1RM: ${Number(e1).toFixed(1)} kg • RSI ${st.profile.coeffRSI ?? "—"}` : `Bench e1RM: —`;
}
saveSettingsBtn.onclick=()=>{
  const w=normalizeNum(benchW.value);
  const r=normalizeInt(benchR.value);
  if(w==null || w<=0 || r==null || r<=0){ toast("Enter valid bench set"); return; }
  st.profile.benchSetWeightKg=w;
  st.profile.benchSetReps=r;
  st.profile.onboarded=true;
  recomputeBenchmark();
  save(st);
  render();
  renderSettings();
  toast("Baseline saved");
  setActiveTab("today");
};

/* ---------------- Storage ---------------- */
function load(){
  for(const key of LS_KEYS){
    try{
      const raw=localStorage.getItem(key);
      if(!raw) continue;
      const parsed=JSON.parse(raw);
      if(!parsed || typeof parsed!=="object") continue;

      const def=defaultState();
      if(!parsed.profile) parsed.profile = {...def.profile};
      if(!parsed.steps) parsed.steps = {...def.steps};
      parsed.steps = {...def.steps, ...parsed.steps};
      if(!parsed.progression) parsed.progression = def.progression;
      if(!Array.isArray(parsed.history)) parsed.history = [];
      if(!parsed.timer) parsed.timer = def.timer;

      localStorage.setItem(LS_KEYS[0], JSON.stringify(parsed));
      return parsed;
    }catch(_){}
  }
  const d=defaultState();
  localStorage.setItem(LS_KEYS[0], JSON.stringify(d));
  return d;
}
function save(s){ localStorage.setItem(LS_KEYS[0], JSON.stringify(s)); }
function el(id){ const n=document.getElementById(id); if(!n) throw new Error(`Missing #${id}`); return n; }

/* ---------------- Init ---------------- */
ensureTimer();
recomputeBenchmark();
render();
renderSettings();
renderHistory();
setActiveTab("today");
