// === Конфиг ===
const API_BASE = 'https://kids-games-backend.onrender.com'; // HTTPS для GitHub Pages

// === DOM ===
const playfield   = document.getElementById('playfield');
const bug         = document.getElementById('bug');
const timeEl      = document.querySelector('[data-time]');
const scoreEl     = document.querySelector('[data-score]');

const postGame    = document.getElementById('postGame');
const finalScore  = document.getElementById('finalScore');
const form        = document.getElementById('scoreForm');
const nameInput   = document.getElementById('playerName');
const submitBtn   = document.getElementById('submitBtn');
const statusEl    = document.getElementById('scoreStatus');
const leaderboard = document.getElementById('leaderboard');
const restartBtn  = document.getElementById('restartBtn');

// === Параметры игры (как в «стабильной» версии) ===
const ROUND_MS   = 20000;       // длительность раунда — 20с
const HOP_MIN    = 500;         // интервал прыжка
const HOP_MAX    = 800;
const BUG_SIZE   = 56;          // диаметр жука (должен совпадать со стилем)

const state = { running:false, start:0, tickId:0, hopId:0, score:0 };

// Утилиты
const clamp = (v,min,max) => Math.max(min, Math.min(max, v));
const rnd   = (a,b) => Math.floor(a + Math.random()*(b-a+1));

// Таймер/очки
function updateTimer(ms){ timeEl.textContent = 'Time: ' + (ms/1000).toFixed(1) + 's'; }
function updateScore(){ scoreEl.textContent = 'Score: ' + state.score; }

// Случайная позиция жука внутри поля
function placeBugRandom(){
  const rect = playfield.getBoundingClientRect();
  const maxX = rect.width  - BUG_SIZE - 4; // минус рамка
  const maxY = rect.height - BUG_SIZE - 4;
  const x = rnd(0, clamp(maxX, 0, 99999));
  const y = rnd(0, clamp(maxY, 0, 99999));
  bug.style.left = x + 'px';
  bug.style.top  = y + 'px';
}

// Жук сам прыгает каждые 500–800 мс
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
  if (ms >= ROUND_MS) { endGame(); return; }
  state.tickId = requestAnimationFrame(tick);
}

function startGame(){
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

  nameInput.value = localStorage.getItem('kg_name') || '';
}

function endGame(){
  state.running = false;
  cancelAnimationFrame(state.tickId);
  clearTimeout(state.hopId);

  finalScore.textContent = state.score;
  postGame.hidden = false;
  nameInput.focus();

  refreshLeaderboard().catch(()=>{});
}

// Клик по жуку — +1 очко и немедленный прыжок
bug.addEventListener('click', () => {
  if (!state.running) return;
  state.score += 1;
  updateScore();
  placeBugRandom();
});

// Рестарт
restartBtn.addEventListener('click', startGame);

// === Работа с бэкендом ===
async function refreshLeaderboard(){
  try{
    const r = await fetch(API_BASE + '/scores', { cache:'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);

    const data = await r.json();
    
    // Сортируем + берем ТОП-10
    const top = data.sort((a,b)=>b.score - a.score).slice(0,10);

    // Очищаем список перед обновлением
    leaderboard.innerHTML = '';

    // Добавляем красивыми <li>
    top.forEach((row, i) => {
      const li = document.createElement('li');
      li.textContent = `${i+1}. ${row.name} — ${row.score}`;
      leaderboard.appendChild(li);
    });

  }catch(e){
    leaderboard.innerHTML =
      '<li>Scores unavailable (server sleeping or offline).</li>';
  }
}

form.addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  const name = (nameInput.value || '').trim().slice(0,12);
  if (!name) { statusEl.textContent = 'Enter your name.'; return; }

  localStorage.setItem('kg_name', name);

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
    if (js && js.ok){
      statusEl.textContent = 'Leaderboard updated.';
      await refreshLeaderboard();
    } else {
      statusEl.textContent = 'Server declined the score.';
    }
  }catch(e){
    statusEl.textContent = 'Can’t submit (server sleeping?). Try again in 10–20s.';
  }finally{
    submitBtn.disabled = false;
  }
});

function escapeHtml(s){ return s.replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// Автостарт
(async function init(){
  await refreshLeaderboard();   // «разбудит» Render, если спит
  startGame();
})();
