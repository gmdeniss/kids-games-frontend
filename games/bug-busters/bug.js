// === games/bug-busters/bug.js ===

// Бэкенд (Render) для лидерборда
const API_BASE = 'https://kids-games-backend.onrender.com';

// Параметры игры
const ROUND_MS     = 15000;   // длительность раунда
const HOP_EVERY_MS = 800;     // как часто баг сам прыгает
const BUG_SIZE     = 56;      // диаметр «жука» в пикселях

// DOM
const playfield   = document.querySelector('.playfield, .board');
const bug         = document.getElementById('bug');
const timeEl      = document.querySelector('[data-time]');
const scoreEl     = document.querySelector('[data-score]');
const panel       = document.getElementById('postGame');
const nameInput   = document.getElementById('playerName');
const submitBtn   = document.getElementById('submitScore');
const statusEl    = document.getElementById('scoreStatus');
const leaderboard = document.getElementById('leaderboard');
const restartBtn  = document.getElementById('restartBtn');

// Состояние
const state = {
  running: false,
  start: 0,
  score: 0,
  rafId: 0,
  hopId: 0,
};

// Утилиты
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function randomPos() {
  if (!playfield || !bug) return;
  const r = playfield.getBoundingClientRect();
  const maxX = Math.max(0, r.width  - BUG_SIZE - 8); // минус рамки
  const maxY = Math.max(0, r.height - BUG_SIZE - 8);
  const x = Math.floor(Math.random() * maxX);
  const y = Math.floor(Math.random() * maxY);
  bug.style.left = `${x}px`;
  bug.style.top  = `${y}px`;
}

// Таймер раунда
function startTimer() {
  const tick = () => {
    if (!state.running) return;
    const ms = Date.now() - state.start;
    if (timeEl) timeEl.textContent = `Time: ${(ms / 1000).toFixed(1)}s`;
    if (ms >= ROUND_MS) { endGame(); return; }
    state.rafId = requestAnimationFrame(tick);
  };
  state.rafId = requestAnimationFrame(tick);
}

// Самопрыжки
function startHopping() {
  clearInterval(state.hopId);
  randomPos(); // первый прыжок сразу
  state.hopId = setInterval(() => {
    if (!state.running) return;
    randomPos();
  }, HOP_EVERY_MS);
}

function stopHopping() {
  clearInterval(state.hopId);
  state.hopId = 0;
}

function updateScore() {
  if (scoreEl) scoreEl.textContent = `Score: ${state.score}`;
}

// Игровые события
function startGame() {
  if (panel) panel.hidden = true;
  if (statusEl) statusEl.textContent = '';
  if (leaderboard) leaderboard.innerHTML = '';

  state.running = true;
  state.score   = 0;
  state.start   = Date.now();

  if (bug) bug.disabled = false;

  updateScore();
  randomPos();
  startHopping();
  startTimer();
}

async function endGame() {
  state.running = false;
  cancelAnimationFrame(state.rafId);
  stopHopping();
  if (bug) bug.disabled = true;
  if (timeEl) timeEl.textContent = 'Time: 0.0s';
  if (panel) panel.hidden = false;
  await refreshLeaderboard();
}

// Клик по жуку — очки + перепрыгнуть сразу
bug?.addEventListener('click', () => {
  if (!state.running) return;
  state.score += 1;
  updateScore();
  randomPos();
});

// Перезапуск
restartBtn?.addEventListener('click', startGame);

// Сохранение и лидерборд
submitBtn?.addEventListener('click', async () => {
  const name = (nameInput?.value || '').trim().slice(0, 12) || 'Anon';
  try {
    const res = await fetch(`${API_BASE}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score: state.score }),
    });
    if (statusEl) statusEl.textContent = res.ok ? 'Saved ✅' : 'Error saving 😕';
    await refreshLeaderboard();
  } catch {
    if (statusEl) statusEl.textContent = 'Network error 😕';
  }
});

async function refreshLeaderboard() {
  if (!leaderboard) return;
  try {
    const res = await fetch(`${API_BASE}/scores`);
    if (!res.ok) return;
    const list = await res.json();
    leaderboard.innerHTML = '';
    list
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .forEach((row, i) => {
        const li = document.createElement('li');
        li.textContent = `${i + 1}. ${row.name} — ${row.score}`;
        leaderboard.appendChild(li);
      });
  } catch {}
}

// Автостарт
window.addEventListener('DOMContentLoaded', startGame);
