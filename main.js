// Two-Player Pong

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');
const fsBtn = document.getElementById('fs-btn');
const gamePanel = document.querySelector('.game-panel');
const p1ScoreEl = document.getElementById('p1-score');
const p2ScoreEl = document.getElementById('p2-score');

// Dimensions
const BASE_W = 800;
const BASE_H = 500;
let W = canvas.width; // 800
let H = canvas.height; // 500

// Game state
const state = {
  running: false,
  p1: { x: 30, y: H/2 - 40, w: 12, h: 80, speed: 360 },
  p2: { x: W-42, y: H/2 - 40, w: 12, h: 80, speed: 360 },
  ball: { x: W/2, y: H/2, r: 8, vx: 0, vy: 0, speed: 360 },
  scores: { p1: 0, p2: 0 },
  serveDelayMs: 500,
  lastTime: performance.now(),
  keys: { w:false, s:false, ArrowUp:false, ArrowDown:false, Space:false },
};

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function updateScore() {
  p1ScoreEl.textContent = String(state.scores.p1);
  p2ScoreEl.textContent = String(state.scores.p2);
}

function resetBall(direction = (Math.random() < 0.5 ? -1 : 1)) {
  const angle = (Math.random() * 0.6 - 0.3); // -0.3..0.3 rad tilt
  state.ball.x = W/2; state.ball.y = H/2;
  const speed = state.ball.speed;
  state.ball.vx = Math.cos(angle) * speed * direction;
  state.ball.vy = Math.sin(angle) * speed;
}

function reset() {
  state.scores.p1 = 0; state.scores.p2 = 0; updateScore();
  state.p1.y = H/2 - state.p1.h/2; state.p2.y = H/2 - state.p2.h/2;
  resetBall( (Math.random()<0.5 ? -1 : 1) );
}

function start() {
  if (!state.running) { state.running = true; state.lastTime = performance.now(); }
}
function pause() { state.running = false; }

// Input
document.addEventListener('keydown', (e) => {
  // prevent page scroll on game keys
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === ' ') e.preventDefault();
  if (e.key in state.keys) state.keys[e.key] = true;
  if (e.key === ' ') { start(); }
});
document.addEventListener('keyup', (e) => { if (e.key in state.keys) state.keys[e.key] = false; });
startBtn.addEventListener('click', start);
pauseBtn.addEventListener('click', pause);
resetBtn.addEventListener('click', () => { reset(); draw(); });

// Fullscreen toggle
function isFull() { return !!document.fullscreenElement; }
function toggleFullscreen() {
  if (!isFull()) {
    if (gamePanel && gamePanel.requestFullscreen) gamePanel.requestFullscreen();
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
  }
}
function updateFsLabel() { fsBtn.textContent = isFull() ? 'Exit Fullscreen' : 'Fullscreen'; }
fsBtn?.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', updateFsLabel);

// Resizing logic to grow board in fullscreen (and restore on exit)
function applyResize(newW, newH) {
  const sx = newW / W;
  const sy = newH / H;
  // scale paddles
  state.p1.x *= sx; state.p1.y *= sy; state.p1.w *= sx; state.p1.h *= sy; state.p1.speed *= (sx + sy) / 2;
  state.p2.x *= sx; state.p2.y *= sy; state.p2.w *= sx; state.p2.h *= sy; state.p2.speed *= (sx + sy) / 2;
  // scale ball
  state.ball.x *= sx; state.ball.y *= sy; state.ball.r *= (sx + sy) / 2; state.ball.vx *= sx; state.ball.vy *= sy; state.ball.speed *= (sx + sy) / 2;
  // apply canvas size
  W = newW; H = newH;
  canvas.width = Math.floor(newW);
  canvas.height = Math.floor(newH);
}

function fitFullscreenSize() {
  const ratio = BASE_H / BASE_W;
  const availW = Math.max(640, Math.floor(gamePanel?.clientWidth || document.documentElement.clientWidth));
  const availH = Math.max(360, Math.floor(document.documentElement.clientHeight));
  let newW = availW - 20; // padding allowance
  let newH = Math.floor(newW * ratio);
  if (newH > availH - 20) {
    newH = availH - 20;
    newW = Math.floor(newH / ratio);
  }
  // minimum safeguard
  newW = Math.max(800, newW);
  newH = Math.max(500, newH);
  applyResize(newW, newH);
}

document.addEventListener('fullscreenchange', () => {
  updateFsLabel();
  if (isFull()) {
    fitFullscreenSize();
  } else {
    // restore to base size
    applyResize(BASE_W, BASE_H);
  }
});

window.addEventListener('resize', () => { if (isFull()) fitFullscreenSize(); });

// Physics and collisions
function step(dt) {
  // Move paddles
  if (state.keys.w) state.p1.y -= state.p1.speed * dt;
  if (state.keys.s) state.p1.y += state.p1.speed * dt;
  if (state.keys.ArrowUp) state.p2.y -= state.p2.speed * dt;
  if (state.keys.ArrowDown) state.p2.y += state.p2.speed * dt;
  state.p1.y = clamp(state.p1.y, 0, H - state.p1.h);
  state.p2.y = clamp(state.p2.y, 0, H - state.p2.h);

  // Move ball
  state.ball.x += state.ball.vx * dt;
  state.ball.y += state.ball.vy * dt;

  // Top/bottom collisions
  if (state.ball.y - state.ball.r <= 0 && state.ball.vy < 0) { state.ball.y = state.ball.r; state.ball.vy *= -1; }
  if (state.ball.y + state.ball.r >= H && state.ball.vy > 0) { state.ball.y = H - state.ball.r; state.ball.vy *= -1; }

  // Paddle collisions
  // Left paddle
  if (state.ball.x - state.ball.r <= state.p1.x + state.p1.w && state.ball.vx < 0) {
    if (state.ball.y >= state.p1.y && state.ball.y <= state.p1.y + state.p1.h) {
      state.ball.x = state.p1.x + state.p1.w + state.ball.r;
      const rel = (state.ball.y - (state.p1.y + state.p1.h/2)) / (state.p1.h/2); // -1..1
      const speed = Math.hypot(state.ball.vx, state.ball.vy) * 1.03; // slight accel
      const angle = rel * 0.6; // tilt
      state.ball.vx = Math.cos(angle) * speed;
      state.ball.vy = Math.sin(angle) * speed;
    }
  }
  // Right paddle
  if (state.ball.x + state.ball.r >= state.p2.x && state.ball.vx > 0) {
    if (state.ball.y >= state.p2.y && state.ball.y <= state.p2.y + state.p2.h) {
      state.ball.x = state.p2.x - state.ball.r;
      const rel = (state.ball.y - (state.p2.y + state.p2.h/2)) / (state.p2.h/2);
      const speed = Math.hypot(state.ball.vx, state.ball.vy) * 1.03;
      const angle = rel * 0.6;
      state.ball.vx = -Math.cos(angle) * speed;
      state.ball.vy = Math.sin(angle) * speed;
    }
  }

  // Scoring
  if (state.ball.x + state.ball.r < 0) { // right scores
    state.scores.p2 += 1; updateScore();
    pause();
    setTimeout(() => { resetBall(1); start(); }, state.serveDelayMs);
  }
  if (state.ball.x - state.ball.r > W) { // left scores
    state.scores.p1 += 1; updateScore();
    pause();
    setTimeout(() => { resetBall(-1); start(); }, state.serveDelayMs);
  }
}

// Rendering
function draw() {
  ctx.clearRect(0,0,W,H);
  // Midline
  ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 2; ctx.setLineDash([8,8]);
  ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H); ctx.stroke(); ctx.setLineDash([]);
  // Paddles
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(state.p1.x, state.p1.y, state.p1.w, state.p1.h);
  ctx.fillRect(state.p2.x, state.p2.y, state.p2.w, state.p2.h);
  // Ball
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath(); ctx.arc(state.ball.x, state.ball.y, state.ball.r, 0, Math.PI*2); ctx.fill();
}

function loop(ts) {
  const dt = Math.min((ts - state.lastTime) / 1000, 0.033); // cap dt
  state.lastTime = ts;
  if (state.running) { step(dt); }
  draw();
  requestAnimationFrame(loop);
}

// Initialize
reset();
draw();
requestAnimationFrame(loop);
updateFsLabel();