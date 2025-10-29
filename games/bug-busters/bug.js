// === File: games/bug-busters/bug.js ===

// Базовый backend (стоит для GitHub Pages + Render)
const API_BASE = 'https://kids-games-backend.onrender.com';

// Параметры игры
const ROUND_MS      = 15000;   // длительность раунда
const HOP_EVERY_MS  = 800;     // как часто баг сам прыгает
const BUG_SIZE      = 56;      // px, диаметр «жука»
const AUTO_HOP      = true;    // true = баг прыгает сам каждые HOP_EVERY_MS

// DOM
const playfield = document.querySelector('.playfield, .board');
const bug         = document.getElementById('bug') || createBug();
const timeEl      = document.querySelector('[data-time]');
const scoreEl     = document.querySelector('[data-score]');
const panel       = document.getElementById('postGame');
const nameInput   = document.getElementById('playerName');
const submitBtn   = document.getElementById('submitScore');
const statusEl    = document.getElementById('scoreStatus');
const leaderboard = document.getElementById('leaderboard');
const restartBtn  = document.getElementById('restartBtn');

function createBug(){
  const b = document.createElement('button');
  b.id = 'bug';
  b.className = 'bug';
  b.setAttribute('aria-label','Bug — click to score');
  b.innerHTML = '<span>🐞</span>';
  playfield.appendChild(b);
  return b;
}

// Состояние
const state = {
  running : false,
  start   : 0,
  score   : 0,
  rafId   : 0,
  hopId   : 0
};

// Утилиты
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

function randomPos(){
  const r = playfield.getBoundingClientRect();
  const maxX = r.width  - BUG_SIZE - 8; // минус рамки
  const maxY = r.height - BUG_SIZE - 8;
  const x = Math.floor(Math.random() * clamp(maxX, 0, 99999));
  const y = Math.floor(Math.random() * clamp(maxY, 0, 99999));
  bug.style.left = `${x}px`;
  bug.style.top  = `${y}px`;
}

function startTimer(){
  const tick = (t) => {
    if(!state.running) return;
    const ms = Date.now() - state.start;
    timeEl.textContent = `Time: ${(ms/1000).toFixed(1)}s`;
    if(ms >= ROUND_MS){ endGame(); return; }
    state.rafId = requestAnimationFrame(tick);
  };
  state.rafId = requestAnimationFrame(tick);
}

function startHopping(){
  if(!AUTO_HOP) return;
  clearInterval(state.hopId);
  // Первый прыжок сразу:
  randomPos();
  state.hopId = setInterval(() => {
    if(!state.running) return;
    randomPos();
  }, HOP_EVERY_MS);
}

function stopHopping(){
  clearInterval(state.hopId);
  state.hopId = 0;
}

function updateScore(){
  scoreEl.textContent = `Score: ${state.score}`;
}

// Игровые события
function startGame(){
if (panel) panel.hidden = true;
if (statusEl) statusEl.textContent = '';
if (leaderboard) leaderboard.innerHTML = '';
  state.running = true;
  state.score   = 0;
  state.start   = Date.now();
  bug.disabled  = false;
  updateScore();
  randomPos();
  startHopping();
  startTimer();
}

async function endGame(){
  state.running = false;
  cancelAnimationFrame(state.rafId);
  stopHopping();
  bug.disabled = true;
  timeEl.textContent = 'Time: 0.0s';
  if (panel) panel.hidden = false;

  // Подтянем топ с бэка (чтобы сразу показать актуальный список)
  await refreshLeaderboard();
}

bug.addEventListener('click', () => {
  if(!state.running) return;
  state.score += 1;
  updateScore();
  // форсируем прыжок по клику, чтобы не стоял на месте
  randomPos();
});

restartBtn?.addEventListener('click', startGame);

submitBtn?.addEventListener('click', async () => {
  const name = (nameInput.value || '').trim().slice(0, 12) || 'Anon';
  try{
    const res = await fetch(`${API_BASE}/scores`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ name, score: state.score })
    });
    const ok = res.ok;
    statusEl.textContent = ok ? 'Saved ✅' : 'Error saving 😕';
    await refreshLeaderboard();
  }catch(e){
    statusEl.textContent = 'Network error 😕';
  }
});

async function refreshLeaderboard(){
  try{
    const res = await fetch(`${API_BASE}/scores`);
    if(!res.ok) return;
    const list = await res.json();
    leaderboard.innerHTML = '';
    list
      .sort((a,b)=> b.score - a.score)
      .slice(0,10)
      .forEach((row,i)=>{
        const li = document.createElement('li');
        li.textContent = `${i+1}. ${row.name} — ${row.score}`;
        leaderboard.appendChild(li);
      });
  }catch(e){
    // молча игнорируем
  }
}

// Авто-старт при загрузке
window.addEventListener('DOMContentLoaded', startGame);
