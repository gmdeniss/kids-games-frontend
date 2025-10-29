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

// === Audio (пути от корня GitHub Pages) ===
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

const state = {
  running: false,
  start: 0,
  tickId: 0,
  hopId: 0,
  score: 0,
  warnedLast5: false,   // уже проигрывали сирену?
};

// === Utils ===
const rnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const clamp = (v,min,max) => Math.max(min, Math.min(max, v));

function escapeHtml(s){
  return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function updateTimer(ms){
  const left = Math.max(0, (ROUND_MS - ms) / 1000);
  timeEl.textContent = 'Time: ' + left.toFixed(1) + 's';

  if (left <= 5) {
    timeEl.classList.add('danger');
    // однократно запускаем сирену на T-5
    if (soundEnabled && !state.warnedLast5) {
      state.warnedLast5 = true;
      try { sounds.last5.currentTime = 0; sounds.last5.play(); } catch {}
    }
  } else {
    timeEl.classList.remove('danger');
  }
}

function updateScore(){
  scoreEl.textContent = 'Score: ' + state.score;
}

function placeBugRandom(){
  const rect = playfield.getBoundingClientRect();
  const maxX = rect.width  - BUG_SIZE;
  const maxY = rect.height - BUG_SIZE;
  const x = rnd(0, clamp(maxX, 0, 99999));
  const y = rnd(0, clamp(maxY, 0, 99999));
  bug.style.left = `${x}px`;
  bug.style.top  = `${y}px`;
}

function hopLoop(){
  const dt = rnd(HOP_MIN, HOP_MAX);
  state.hopId = setTimeout(() => {
    if (!state.running) return;
    placeBugRandom();
    hopLoop();
  }, dt);
}

function tick(){
  const ms = Date.now() - state.start;
  updateTimer(ms);
  if (ms >= ROUND_MS) { endGame(); return; }
  state.tickId = requestAnimationFrame(tick);
}

// === Main ===
function startGame(){
  startScreen.hidden = true;
  gameArea.hidden = false;

  // звук активируется кликом по Start
  if (soundEnabled) {
    try { sounds.bg.currentTime = 0; sounds.bg.play(); } catch {}
  }

  postGame.hidden = true;
  statusEl.textContent = '';
  leaderboard.innerHTML = '';

  state.running = true;
  state.score = 0;
  state.start = Date.now();
  state.warnedLast5 = false;

  updateScore();
  updateTimer(0);

  placeBugRandom();
  hopLoop();
  tick();

  // подставим имя из localStorage, если есть
  try { nameInput.value = localStorage.getItem('kg_name') || ''; } catch {}
}

function endGame(){
  state.running = false;
  cancelAnimationFrame(state.tickId);
  clearTimeout(state.hopId);
  timeEl.classList.remove('danger');

  if (soundEnabled) {
    try { sounds.bg.pause(); } catch {}
    // сирена в конце — только если мы её ещё не играли на T-5
    if (!state.warnedLast5) {
      try { sounds.last5.currentTime = 0; sounds.last5.play(); } catch {}
    }
  }

  finalScore.textContent = state.score;
  postGame.hidden = false;
  try { nameInput.focus(); } catch {}
  refreshLeaderboard().catch(()=>{});
}

// === Events ===
startBtn?.addEventListener('click', () => {
  soundEnabled = true;
  startGame();
});

sounds.click.volume = 0.9;
sounds.click.playbackRate = 1.5;

bug.addEventListener('click', () => {
  if (!state.running) return;
  state.score++;
  updateScore();
  placeBugRandom();
  if (soundEnabled) {
    try {
      sounds.click.pause();
      sounds.click.currentTime = 0;
      sounds.click.play();
      bug.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }],
                  { duration: 120, easing: 'ease-out' });
    } catch {}
  }
});

restartBtn?.addEventListener('click', startGame);

// === Backend ===
form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const name = (nameInput.value || '').trim().slice(0, 12);
  if (!name) { statusEl.textContent = 'Enter your name.'; return; }

  try { localStorage.setItem('kg_name', name); } catch {}

  submitBtn.disabled = true;
  statusEl.textContent = 'Submitting…';

  try{
    const r = await fetch(API_BASE + '/scores', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ name, score: state.score })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const js = await r.json();
    statusEl.textContent = (js && js.ok) ? 'Leaderboard updated.' : 'Server declined.';
    await refreshLeaderboard();
  }catch(e){
    statusEl.textContent = 'Network error.';
  }finally{
    submitBtn.disabled = false;
  }
});

async function refreshLeaderboard(){
  try{
    const r = await fetch(API_BASE + '/scores', { cache:'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();

    // ВАЖНО: не добавляем номера вручную, чтобы не было «1. 1.».
    leaderboard.innerHTML = data
      .sort((a,b)=> b.score - a.score)
      .slice(0,10)
      .map(row => `<li><b>${escapeHtml(row.name)}</b> — ${row.score}</li>`)
      .join('');
  }catch(e){
    leaderboard.innerHTML = '<li>Scores unavailable.</li>';
  }
}
