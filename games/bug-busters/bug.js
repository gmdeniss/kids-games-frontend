// === Конфиг ===
const API_BASE = 'https://kids-games-backend.onrender.com'; // HTTPS для GitHub Pages

// === DOM ===
const playfield   = document.getElementById('playfield');
const bug         = document.getElementById('bug');
const timeEl      = document.querySelector('[data-time]');
const scoreEl     = document.querySelector('[data-score]');
const soundToggle = document.getElementById('soundToggle');

const postGame    = document.getElementById('postGame');
const finalScore  = document.getElementById('finalScore');
const form        = document.getElementById('scoreForm');
const nameInput   = document.getElementById('playerName');
const submitBtn   = document.getElementById('submitBtn');
const statusEl    = document.getElementById('scoreStatus');
const leaderboard = document.getElementById('leaderboard');
const restartBtn  = document.getElementById('restartBtn');

// === Параметры игры ===
const ROUND_MS = 20000;       // длительность раунда — 20с
const HOP_MIN  = 500;         // интервал прыжка
const HOP_MAX  = 800;
const BUG_SIZE = 56;          // диаметр жука (должен совпадать со стилем)

// === SFX ===
const SFX = {
  enabled: false,
  primed:  false,   // подготовлены ли медиа под ограничения мобильных браузеров
  click:   new Audio('../../assets/sfx/click.mp3'),
  bg:      new Audio('../../assets/sfx/bg-20s.mp3'),
  last5:   new Audio('../../assets/sfx/last5.mp3'),
};

// базовые настройки громкости/поведения
SFX.bg.loop       = true;
SFX.bg.volume     = 0.25;
SFX.click.volume  = 0.6;
SFX.last5.volume  = 0.7;

// Вспомогательная безопасная «игралка»
function playOnce(a) {
  try { a.currentTime = 0; a.play().catch(()=>{}); } catch {}
}
// Клик часто повторяется → делаем клон, чтобы не обрывать предыдущее воспроизведение
function playClick() {
  if (!SFX.enabled) return;
  try {
    const node = SFX.click.cloneNode();
    node.volume = SFX.click.volume;
    node.play().catch(()=>{});
  } catch {}
}
// Подготовка медиа после первого пользовательского действия
function primeAudio() {
  if (SFX.primed) return;
  // маленький хак: «старт-стоп» сделает аудио разрешённым для последующих .play()
  [SFX.click, SFX.bg, SFX.last5].forEach(a => {
    try { a.play().then(()=>a.pause()).catch(()=>{}); } catch {}
  });
  SFX.primed = true;
}

// Кнопка звука
function refreshSoundUI(){
  if (SFX.enabled) {
    soundToggle.textContent = '🔈 Sound: ON';
    soundToggle.setAttribute('aria-pressed', 'true');
  } else {
    soundToggle.textContent = '🔇 Sound: OFF';
    soundToggle.setAttribute('aria-pressed', 'false');
  }
}
soundToggle.addEventListener('click', () => {
  primeAudio();
  SFX.enabled = !SFX.enabled;
  refreshSoundUI();

  // включили звук — если игра идёт, запустим фон
  if (SFX.enabled && state.running) {
    try { SFX.bg.currentTime = 0; SFX.bg.play().catch(()=>{}); } catch {}
  } else {
    // выключили — всё стопаем
    try { SFX.bg.pause(); } catch {}
    try { SFX.last5.pause(); } catch {}
  }
});
refreshSoundUI();

// === Состояние ===
const state = { running:false, start:0, tickId:0, hopId:0, score:0, last5Played:false };

// Утилиты
const clamp = (v,min,max) => Math.max(min, Math.min(max, v));
const rnd   = (a,b) => Math.floor(a + Math.random()*(b-a+1));

// Таймер/очки (обратный отсчёт + «опасная зона»)
function updateTimer(ms){
  const left = Math.max(0, ROUND_MS - ms);
  timeEl.textContent = 'Time: ' + (left/1000).toFixed(1) + 's';

  // последние 5 секунд — красный + пульс + звуковой сигнал
  if (left <= 5000) {
    timeEl.classList.add('danger');
    if (SFX.enabled && !state.last5Played) {
      playOnce(SFX.last5);
      state.last5Played = true;
    }
  } else {
    timeEl.classList.remove('danger');
    state.last5Played = false;
  }
}
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
  state.last5Played = false;
  updateScore();
  updateTimer(0);

  placeBugRandom();
  hopLoop();
  tick();

  nameInput.value = localStorage.getItem('kg_name') || '';

  // фоновая музыка
  if (SFX.enabled) {
    primeAudio();
    try { SFX.bg.currentTime = 0; SFX.bg.play().catch(()=>{}); } catch {}
  }
}

function endGame(){
  state.running = false;
  cancelAnimationFrame(state.tickId);
  clearTimeout(state.hopId);

  finalScore.textContent = state.score;
  postGame.hidden = false;
  nameInput.focus();

  // стопаем фон
  try { SFX.bg.pause(); } catch {}

  refreshLeaderboard().catch(()=>{});
}

// первый пользовательский тап «будит» аудио-движок
playfield.addEventListener('pointerdown', primeAudio);

// Клик по жуку — +1 очко, прыжок и щелчок
bug.addEventListener('click', () => {
  if (!state.running) return;
  state.score += 1;
  updateScore();
  placeBugRandom();
  playClick();
});

// Рестарт
restartBtn.addEventListener('click', startGame);

// === Работа с бэкендом ===
async function refreshLeaderboard(){
  try{
    const r = await fetch(API_BASE + '/scores', { cache:'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();

    const top = data.sort((a,b)=>b.score - a.score).slice(0,10);
    leaderboard.innerHTML = '';           // очистка
    top.forEach((row, i) => {
      const li = document.createElement('li');
      li.textContent = `${i+1}. ${row.name} — ${row.score}`;
      leaderboard.appendChild(li);
    });
  }catch(e){
    leaderboard.innerHTML = '<li>Scores unavailable (server sleeping or offline).</li>';
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

// Автостарт
(async function init(){
  await refreshLeaderboard();   // «разбудит» Render, если спит
  startGame();
})();
