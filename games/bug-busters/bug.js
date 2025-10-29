// === Config ===
const API_BASE = 'https://kids-games-backend.onrender.com';

// DOM
const startBtn     = document.getElementById('startBtn');
const startScreen  = document.getElementById('startScreen');
const gameArea     = document.getElementById('gameArea');
const playfield    = document.getElementById('playfield');
const bug          = document.getElementById('bug');
const timeEl       = document.querySelector('[data-time]');
const scoreEl      = document.querySelector('[data-score]');
const postGame     = document.getElementById('postGame');
const finalScore   = document.getElementById('finalScore');
const form         = document.getElementById('scoreForm');
const nameInput    = document.getElementById('playerName');
const submitBtn    = document.getElementById('submitBtn');
const statusEl     = document.getElementById('scoreStatus');
const leaderboard  = document.getElementById('leaderboard');
const restartBtn   = document.getElementById('restartBtn');
const soundToggle  = document.getElementById('soundToggle');

// === Audio ===
const sounds = {
  click: new Audio('/kids-games-frontend/assets/sfx/click.mp3'),
  bg:    new Audio('/kids-games-frontend/assets/sfx/bg-20s.mp3'),
  last5: new Audio('/kids-games-frontend/assets/sfx/last5.mp3'),
};
sounds.bg.loop = true;

let soundEnabled = false;

// === Game vars ===
const ROUND_MS = 20000;
const HOP_MIN  = 500;
const HOP_MAX  = 800;
const BUG_SIZE = 56;
const state = { running:false, start:0, tickId:0, hopId:0, score:0 };

// === Utils ===
const rnd = (a,b)=>Math.floor(a+Math.random()*(b-a+1));
function updateTimer(ms){
  const left = Math.max(0, (ROUND_MS - ms)/1000);
  timeEl.textContent = 'Time: ' + left.toFixed(1) + 's';
  if (left <= 10000) timeEl.classList.add('danger'); else timeEl.classList.remove('danger');
}
function updateScore(){ scoreEl.textContent = 'Score: ' + state.score; }

function placeBugRandom(){
  const rect = playfield.getBoundingClientRect();
  const maxX = rect.width - BUG_SIZE;
  const maxY = rect.height - BUG_SIZE;
  const x = rnd(0, maxX);
  const y = rnd(0, maxY);
  bug.style.left = `${x}px`;
  bug.style.top  = `${y}px`;
}

function hopLoop(){
  const dt = rnd(HOP_MIN, HOP_MAX);
  state.hopId = setTimeout(()=>{
    if(!state.running) return;
    placeBugRandom();
    hopLoop();
  }, dt);
}

function tick(){
  const ms = Date.now() - state.start;
  updateTimer(ms);
  if(ms >= ROUND_MS){ endGame(); return; }
  state.tickId = requestAnimationFrame(tick);
}

// === Main ===
function startGame(){
  startScreen.hidden = true;
  gameArea.hidden = false;

  if(soundEnabled) {
    sounds.bg.currentTime = 0;
    sounds.bg.play().catch(()=>{});
  }

  postGame.hidden = true;
  statusEl.textContent = '';
  leaderboard.innerHTML = '';

  state.running = true;
  state.score = 0;
  updateScore();
  state.start = Date.now();

  placeBugRandom();
  hopLoop();
  tick();
}

function endGame(){
  state.running = false;
  cancelAnimationFrame(state.tickId);
  clearTimeout(state.hopId);
  timeEl.classList.remove('danger');
  if(soundEnabled) {
    sounds.bg.pause();
    sounds.last5.play().catch(()=>{});
  }
  finalScore.textContent = state.score;
  postGame.hidden = false;
  nameInput.focus();
  refreshLeaderboard().catch(()=>{});
}

// === Events ===
startBtn.addEventListener('click',()=>{
  soundEnabled = true;
  startGame();
});

bug.addEventListener('click',()=>{
  if(!state.running) return;
  state.score++;
  updateScore();
  placeBugRandom();
  if(soundEnabled) sounds.click.play().catch(()=>{});
});

restartBtn.addEventListener('click',startGame);

form.addEventListener('submit',async ev=>{
  ev.preventDefault();
  const name=(nameInput.value||'').trim().slice(0,12);
  if(!name){statusEl.textContent='Enter your name.';return;}
  localStorage.setItem('kg_name',name);
  submitBtn.disabled=true;
  statusEl.textContent='Submitting…';
  try{
    const r=await fetch(API_BASE+'/scores',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name,score:state.score})
    });
    if(!r.ok)throw new Error('HTTP '+r.status);
    const js=await r.json();
    if(js&&js.ok){
      statusEl.textContent='Leaderboard updated.';
      await refreshLeaderboard();
    }else{
      statusEl.textContent='Server declined.';
    }
  }catch(e){
    statusEl.textContent='Network error.';
  }finally{
    submitBtn.disabled=false;
  }
});

async function refreshLeaderboard(){
  try{
    const r=await fetch(API_BASE+'/scores',{cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const data = await r.json();
leaderboard.innerHTML = data
  .sort((a,b)=> b.score - a.score)
  .slice(0,10)
  .map(row => `<li><b>${escapeHtml(row.name)}</b> — ${row.score}</li>`)
  .join('');
  }catch(e){
    leaderboard.innerHTML='<li>Scores unavailable.</li>';
  }
}
