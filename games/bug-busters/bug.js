// === Config ===
const API_BASE = 'https://kids-games-backend.onrender.com';

// === DOM ===
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

// === Audio (пути относительно корня GitHub Pages) ===
const sounds = {
  click: new Audio('/kids-games-frontend/assets/sfx/click.mp3'),
  bg:    new Audio('/kids-games-frontend/assets/sfx/bg-20s.mp3'),
  last5: new Audio('/kids-games-frontend/assets/sfx/last5.mp3'),
};
sounds.bg.loop = true;
// тюнинг клика (можешь поэкспериментировать)
sounds.click.volume = 0.75;      // 0.0–1.0
sounds.click.playbackRate = 1; // 0.5–4.0

let soundEnabled = false;
let soundWasToggled = false;
let soundsPrimed = false;

// === Game vars ===
const ROUND_MS   = 20000;
const HOP_MIN    = 500;
const HOP_MAX    = 800;
const BUG_SIZE   = 56;

// «глушим» клики во время сирены, чтобы они не перебивали её
const LAST5_MUTE_MS = 1200;

const state = {
  running: false,
  start: 0,
  tickId: 0,
  hopId: 0,
  score: 0,
  warnedLast5: false,
  muteUntil: 0,       // timestamp до которого клики не звучат
  lastClickAt: 0,     // защита от дабл-кликов за 40 мс
};

// === Utils ===
const rnd   = (a,b)=>Math.floor(a + Math.random()*(b-a+1));
const clamp = (v,min,max)=>Math.max(min, Math.min(max, v));

function escapeHtml(s){
  return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function updateTimer(ms){
  const left = Math.max(0, (ROUND_MS - ms)/1000);
  timeEl.textContent = 'Time: ' + left.toFixed(1) + 's';

  if (left <= 5){
    timeEl.classList.add('danger');
    if (soundEnabled && !state.warnedLast5){
      state.warnedLast5 = true;
      try {
        sounds.last5.currentTime = 0;
        sounds.last5.play();
        state.muteUntil = Date.now() + LAST5_MUTE_MS;
      } catch {}
    }
  } else {
    timeEl.classList.remove('danger');
  }
}

function updateScore(){
  scoreEl.textContent = 'Score: ' + state.score;
}

function applySoundState(){
  if (!soundToggle) return;
  soundToggle.setAttribute('aria-pressed', soundEnabled ? 'true' : 'false');
  soundToggle.textContent = soundEnabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
}

function setSoundEnabled(next, userInitiated = false){
  soundEnabled = next;
  if (userInitiated) soundWasToggled = true;
  applySoundState();
  if (!soundEnabled){
    try { sounds.bg.pause(); } catch {}
    try { sounds.last5.pause(); sounds.last5.currentTime = 0; } catch {}
    try { sounds.click.pause(); sounds.click.currentTime = 0; } catch {}
  } else if (state.running){
    try { sounds.bg.currentTime = 0; void sounds.bg.play(); } catch {}
  }
}

function primeSounds(){
  if (soundsPrimed) return;
  soundsPrimed = true;
  Object.values(sounds).forEach(audio=>{
    const originalVolume = audio.volume;
    audio.volume = 0;
    try{
      const playAttempt = audio.play();
      if (playAttempt && typeof playAttempt.catch === 'function'){
        playAttempt.catch(()=>{});
      }
      audio.pause();
      audio.currentTime = 0;
      audio.volume = originalVolume;
    }catch{
      audio.volume = originalVolume;
    }
  });
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
  state.hopId = setTimeout(()=>{
    if (!state.running) return;
    placeBugRandom();
    hopLoop();
  }, dt);
}

function tick(){
  const ms = Date.now() - state.start;
  updateTimer(ms);
  if (ms >= ROUND_MS){ endGame(); return; }
  state.tickId = requestAnimationFrame(tick);
}

// === Main flow ===
function startGame(){
  // UI
  if (startScreen) startScreen.hidden = true;
  if (gameArea) gameArea.hidden = false;

  // state
  postGame.hidden = true;
  statusEl.textContent = '';
  leaderboard.innerHTML = '';

  state.running = true;
  state.score = 0;
  state.start = Date.now();
  state.warnedLast5 = false;
  state.muteUntil = 0;

  // sync audio preference with current run
  setSoundEnabled(soundEnabled);

  updateScore();
  updateTimer(0);
  placeBugRandom();
  hopLoop();
  tick();

  try { nameInput.value = localStorage.getItem('kg_name') || ''; } catch {}
}

function endGame(){
  state.running = false;
  cancelAnimationFrame(state.tickId);
  clearTimeout(state.hopId);
  timeEl.classList.remove('danger');

  if (soundEnabled){
    try { sounds.bg.pause(); } catch {}
    if (!state.warnedLast5){
      try {
        sounds.last5.currentTime = 0;
        sounds.last5.play();
        state.muteUntil = Date.now() + LAST5_MUTE_MS;
      } catch {}
    }
  }

  finalScore.textContent = state.score;
  postGame.hidden = false;
  try { nameInput.focus(); } catch {}
  refreshLeaderboard().catch(()=>{});
}

// === Events ===
// Старт (разрешает звук пользовательским кликом и запускает игру)
startBtn?.addEventListener('click', () => {
  primeSounds();
  if (!soundWasToggled && !soundEnabled) setSoundEnabled(true);
  startGame();
});

// Клик по жуку
bug.addEventListener('click', () => {
  if (!state.running) return;

  // анти-даблклик: не чаще чем раз в ~40мс
  const now = Date.now();
  if (now - state.lastClickAt < 40) return;
  state.lastClickAt = now;

  state.score++;
  updateScore();
  placeBugRandom();

  // звук клика — только если сирена не заглушает
  if (soundEnabled && now >= state.muteUntil){
    try {
      sounds.click.pause();
      sounds.click.currentTime = 0;
      sounds.click.play();
    } catch {}
  }

  // маленький «поп» эффект
  try {
    bug.animate(
      [{ transform:'scale(1)' }, { transform:'scale(1.2)' }, { transform:'scale(1)' }],
      { duration: 150, easing: 'ease-out' }
    );
  } catch {}
});

// Рестарт
restartBtn?.addEventListener('click', startGame);

soundToggle?.addEventListener('click', () => {
  primeSounds();
  setSoundEnabled(!soundEnabled, true);
});

applySoundState();

// === Backend (scores) ===
form.addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  const name = (nameInput.value || '').trim().slice(0,12);
  if (!name){ statusEl.textContent = 'Enter your name.'; return; }

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

    // Без ручной нумерации — пусть <ol> нумерует
    leaderboard.innerHTML = data
      .sort((a,b)=> b.score - a.score)
      .slice(0,10)
      .map(row => `<li><b>${escapeHtml(row.name)}</b> — ${row.score}</li>`)
      .join('');
  }catch(e){
    leaderboard.innerHTML = '<li>Scores unavailable.</li>';
  }
}
