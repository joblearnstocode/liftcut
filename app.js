// On-device only storage (no network). No permissions requested.

const LS_KEY = "liftcut_state_v1";

const Program = {
  deloadWeeks: new Set([6, 12]),
  weekIntensity: [0.60,0.60,0.62,0.62,0.65,0.55, 0.62,0.65,0.68,0.68,0.70,0.60, 0.68,0.70,0.72,0.72,0.75,0.77],
  cycle: [
    { name:"Upper A", suggested:"Mon", key:"UA" },
    { name:"Lower A", suggested:"Tue", key:"LA" },
    { name:"Upper B (Push)", suggested:"Thu", key:"UB" },
    { name:"Upper C (Pull)", suggested:"Fri", key:"UC" },
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
    active: null, // {sessionId, week, key, name, suggested, startedAt}
    history: [] // sessions with sets
  };
}

function load(){
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || defaultState(); }
  catch { return defaultState(); }
}
function save(st){ localStorage.setItem(LS_KEY, JSON.stringify(st)); }

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

// UI refs
const subhead = el("subhead");
const sessionName = el("sessionName");
const sessionMeta = el("sessionMeta");
const startBtn = el("startBtn");
const finishBtn = el("finishBtn");
const backBtn = el("backBtn");
const exerciseList = el("exerciseList");
const workoutPane = el("workoutPane");
const detailPane = el("detailPane");
const workoutList = el("workoutList");
const detailTitle = el("detailTitle");
const detailMeta = el("detailMeta");
const setsEl = el("sets");
const benchW = el("benchW");
const benchR = el("benchR");
const bench1rmEl = el("bench1rm");
const saveSettingsBtn = el("saveSettingsBtn");
const exportBtn = el("exportBtn");
const exportOut = el("exportOut");

let st = load();

function render(){
  const week = weekFromCompleted(st.progression.completedSessions);
  const next = Program.cycle[st.progression.nextIndex % Program.cycle.length];
  const deload = isDeload(week);
  const b1 = bench1rm(st.settings.benchW, st.settings.benchR);

  subhead.textContent = `Week ${week} of 18 • Next: ${next.name} (Suggested ${next.suggested})${deload ? " • Deload" : ""}`;
  sessionName.textContent = next.name;
  sessionMeta.textContent = `Suggested ${next.suggested} • Bench 1RM est ${b1.toFixed(1)} kg`;

  benchW.value = st.settings.benchW;
  benchR.value = st.settings.benchR;
  bench1rmEl.textContent = `Bench 1RM est: ${b1.toFixed(1)} kg`;

  // Preview list
  exerciseList.innerHTML = "";
  const exs = Program.template[next.key];
  exs.forEach(exercise => {
    const w = plannedWeight(exercise, week, st);
    exerciseList.appendChild(exerciseCard(exercise, w, week));
  });

  workoutPane.classList.toggle("hidden", !st.active);
  detailPane.classList.add("hidden");
}

function exerciseCard(ex, w, week){
  const div = document.createElement("div");
  div.className = "item";
  const planText = (w==null) ? "RPE-based" : `Plan ${w.toFixed(1)} ${ex.unit}`;
  div.innerHTML = `
    <div class="topline">
      <div class="name">${ex.name}</div>
      <div class="small">${planText}</div>
    </div>
    <div class="meta">${ex.sets} sets • ${ex.reps} • Rest ${Math.round(ex.rest/60)}m ${isDeload(week) ? "• Deload: stay shy of failure" : ""}</div>
  `;
  return div;
}

startBtn.onclick = () => {
  const week = weekFromCompleted(st.progression.completedSessions);
  const next = Program.cycle[st.progression.nextIndex % Program.cycle.length];
  const sessionId = crypto.randomUUID();
  st.active = { sessionId, week, key: next.key, name: next.name, suggested: next.suggested, startedAt: Date.now(), sets:{} };
  save(st);
  renderWorkout();
};

function renderWorkout(){
  if(!st.active) return;
  const exs = Program.template[st.active.key];
  workoutList.innerHTML = "";
  exs.forEach(ex => {
    const item = document.createElement("div");
    item.className = "item";
    const logged = (st.active.sets[ex.id]?.length || 0);
    const w = plannedWeight(ex, st.active.week, st);
    item.innerHTML = `
      <div class="topline">
        <div class="name">${ex.name}</div>
        <div class="small">${logged}/${ex.sets}</div>
      </div>
      <div class="meta">${ex.sets} sets • ${ex.reps} • Rest ${Math.round(ex.rest/60)}m • ${(w==null) ? "RPE-based" : `Plan ${w.toFixed(1)} ${ex.unit}`}</div>
    `;
    item.onclick = () => openDetail(ex);
    workoutList.appendChild(item);
  });
  workoutPane.classList.remove("hidden");
}

function openDetail(ex){
  detailPane.classList.remove("hidden");
  workoutPane.classList.add("hidden");

  detailTitle.textContent = ex.name;
  const w = plannedWeight(ex, st.active.week, st);
  detailMeta.textContent = `${ex.sets} sets • ${ex.reps} • Rest ${Math.round(ex.rest/60)}m • ${w==null ? "RPE-based" : `Plan ${w.toFixed(1)} ${ex.unit}`}`;

  // Ensure set array exists
  if(!st.active.sets[ex.id]) st.active.sets[ex.id] = Array.from({length: ex.sets}, (_,i)=>({
    setIndex:i+1, usedPlanned:true, planned:w, weight:w, reps:"", rpe:8.0
  }));

  // Render set rows
  setsEl.innerHTML = "";
  st.active.sets[ex.id].forEach((s, idx) => {
    const row = document.createElement("div");
    row.className = "setrow";
    row.innerHTML = `
      <div class="small">Set ${s.setIndex}</div>
      <div>
        <div class="toggle">
          ${w==null ? "" : `<input type="checkbox" ${s.usedPlanned ? "checked":""} data-k="usedPlanned" data-i="${idx}"/> <span>Use plan</span>`}
        </div>
        <input ${w!=null && s.usedPlanned ? "disabled":""} inputmode="decimal" placeholder="Weight" value="${s.weight ?? ""}" data-k="weight" data-i="${idx}">
      </div>
      <div>
        <div class="small">Reps</div>
        <input inputmode="numeric" placeholder="Reps" value="${s.reps ?? ""}" data-k="reps" data-i="${idx}">
      </div>
      <div>
        <div class="small">RPE</div>
        <input inputmode="decimal" placeholder="8.0" value="${s.rpe ?? 8.0}" data-k="rpe" data-i="${idx}">
      </div>
    `;
    setsEl.appendChild(row);
  });

  // Bind changes
  setsEl.querySelectorAll("input").forEach(inp => {
    inp.onchange = (e) => {
      const i = Number(inp.dataset.i);
      const k = inp.dataset.k;
      const arr = st.active.sets[ex.id];
      if(k==="usedPlanned"){
        arr[i].usedPlanned = inp.checked;
        if(inp.checked && w!=null){
          arr[i].weight = w.toFixed(1);
        }
        save(st);
        openDetail(ex); // re-render to enable/disable
        return;
      }
      arr[i][k] = inp.value;
      save(st);
    };
  });

  // Add Save buttons (per set, as requested)
  st.active.sets[ex.id].forEach((s, idx) => {
    const btn = document.createElement("button");
    btn.className = "btn ghost";
    btn.textContent = `Save Set ${s.setIndex}`;
    btn.style.marginTop = "8px";
    btn.onclick = () => {
      // normalize weight to planned if usedPlanned
      if(w!=null && s.usedPlanned) s.weight = w.toFixed(1);
      save(st);
      alert(`Saved Set ${s.setIndex}`);
    };
    setsEl.appendChild(btn);
  });
}

backBtn.onclick = () => {
  detailPane.classList.add("hidden");
  workoutPane.classList.remove("hidden");
  renderWorkout();
};

finishBtn.onclick = () => {
  if(!st.active) return;
  st.history.push(st.active);
  st.active = null;
  st.progression.completedSessions += 1;
  st.progression.nextIndex = (st.progression.nextIndex + 1) % Program.cycle.length;
  save(st);
  render();
};

saveSettingsBtn.onclick = () => {
  const w = Number(String(benchW.value).replace(",", "."));
  const r = Number(String(benchR.value).replace(",", "."));
  if(!isFinite(w) || w<=0 || !isFinite(r) || r<=0){ alert("Enter valid bench weight and reps."); return; }
  st.settings.benchW = w;
  st.settings.benchR = Math.round(r);
  save(st);
  render();
};

exportBtn.onclick = () => {
  exportOut.classList.remove("hidden");
  exportOut.textContent = JSON.stringify(st, null, 2);
};

function el(id){ return document.getElementById(id); }

// initial render
render();
if(st.active) renderWorkout();
