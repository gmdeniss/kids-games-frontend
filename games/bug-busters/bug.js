import { postScore, fetchScores } from "./shared.js";

const playfield = document.getElementById("playfield");
const bug = document.getElementById("bug");
const timerEl = document.getElementById("timer");
const scoreEl = document.getElementById("score");
const postGame = document.getElementById("postgame");
const finalText = document.getElementById("finalText");
const nameInput = document.getElementById("playerName");
const scoreForm = document.getElementById("scoreForm");
const restartBtn = document.getElementById("restartBtn");
const leaderboard = document.getElementById("leaderboard");

const ROUND_MS = 20000;
const HOP_MIN = 500;
const HOP_MAX = 800;
let score = 0;
let start = performance.now();
let tickId = null;
let hopId = null;

function updateScore() {
  scoreEl.textContent = `Score: ${score}`;
}

function randomPos() {
  const rect = playfield.getBoundingClientRect();
  const x = Math.random() * (rect.width - 50);
  const y = Math.random() * (rect.height - 50);
  bug.style.transform = `translate(${x}px, ${y}px)`;
}

function hop() {
  randomPos();
  hopId = setTimeout(hop, Math.random() * (HOP_MAX - HOP_MIN) + HOP_MIN);
}

function tick() {
  const elapsed = performance.now() - start;
  const remain = Math.max(0, ROUND_MS - elapsed);
  timerEl.textContent = `Time: ${(remain / 1000).toFixed(1)}s`;

  if (remain <= 0) return endGame();

  tickId = requestAnimationFrame(tick);
}

function endGame() {
  cancelAnimationFrame(tickId);
  clearTimeout(hopId);

  postGame.classList.remove("hidden");
  finalText.textContent = `Final score: ${score}`;
  loadScores();
}

async function loadScores() {
  leaderboard.innerHTML = '<li>Loading...</li>';
  const data = await fetchScores();
  leaderboard.innerHTML = data
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((s, i) => `<li>${i + 1}. ${s.name} – ${s.score}</li>`)
    .join("") || "<li>No scores yet.</li>";
}

bug.addEventListener("click", (e) => {
  e.stopPropagation();
  score++;
  updateScore();
});

playfield.addEventListener("click", () => {
  start = performance.now();
  updateScore();
  hop();
  tick();
});

restartBtn.addEventListener("click", () => location.reload());

scoreForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await postScore(nameInput.value || "Anonymous", score);
  loadScores();
  nameInput.value = "";
  document.getElementById("scoreStatus").textContent = "Saved!";
});
