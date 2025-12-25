window.onerror = function(msg, src, line, col, err){
  document.body.innerHTML = `
    <div style="padding:16px;font-family:system-ui;background:#0B0D10;color:#E8EEF8">
      <h2>LiftCut Error</h2>
      <pre>${msg}\n${src}:${line}:${col}</pre>
    </div>`;
  return true;
};

const $ = id => document.getElementById(id);
const LS = "liftcut_clean_v1";

let state = JSON.parse(localStorage.getItem(LS)) || {
  benchW:50,
  benchR:12
};

function save(){ localStorage.setItem(LS, JSON.stringify(state)); }

function bench1rm(w,r){ return (w*(1+r/30)).toFixed(1); }

$("benchW").value = state.benchW;
$("benchR").value = state.benchR;
$("bench1rm").textContent = `Bench 1RM est: ${bench1rm(state.benchW,state.benchR)} kg`;

$("saveSettingsBtn").onclick = () => {
  state.benchW = parseFloat($("benchW").value)||state.benchW;
  state.benchR = parseInt($("benchR").value)||state.benchR;
  save();
  $("bench1rm").textContent = `Bench 1RM est: ${bench1rm(state.benchW,state.benchR)} kg`;
};

$("startBtn").onclick = () => alert("Workout started — base system OK");

["Today","Workout","History","Settings"].forEach(name=>{
  $("tab"+name).onclick = ()=>{
    ["paneToday","paneWorkout","paneHistory","paneSettings"].forEach(p=>$(p).classList.add("hidden"));
    $("pane"+name).classList.remove("hidden");
    document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
    $("tab"+name).classList.add("active");
  };
});

$("sessionName").textContent = "Upper A";
$("sessionMeta").textContent = "Suggested Monday";

$("exercisePreview").innerHTML = `
  <div class="item">Bench Press</div>
  <div class="item">Row</div>
  <div class="item">Overhead Press</div>
`;
