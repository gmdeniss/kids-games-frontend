export const API_BASE = 'https://kids-games-backend.onrender.com';

export async function postScore(name, score) {
  await fetch(`${API_BASE}/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, score }),
  });
}

export async function fetchScores() {
  const res = await fetch(`${API_BASE}/scores`);
  return res.json();
}
