const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreElement = document.getElementById("score");
const highScoreElement = document.getElementById("highScore");
const soundToggleBtn = document.getElementById("soundToggleBtn");

const gridSize = 20;
const tileCount = canvas.width / gridSize;

const GameState = { START: "START", PLAYING: "PLAYING", GAMEOVER: "GAMEOVER" };
let currentState = GameState.START;

let snake = [];
let dx = 1;
let dy = 0;
let food = { x: 5, y: 5 };
let obstacles = [];
let score = 0;
let highScore = localStorage.getItem("snakeHighScore") || 0;
highScoreElement.textContent = highScore;

let gameSpeed = 110;
let gameTimeout = null;

let soundEnabled = true;
let gameMode = "CLASSIC"; // Modes: CLASSIC, PASSTHROUGH, MAZE

let particles = [];
const MAX_PARTICLES = 40;

const Themes = {
  volcano: {
    bg1: "#121218", bg2: "#191922",
    snakeHead: "#ff5500", snakeBody: "#d44000",
    eyeColor: "#ffea00", pupilColor: "#111111",
    foodColor: "#ff0055", obstacleColor: "#4a121a",
    overlayBg: "rgba(18, 18, 24, 0.85)", titleColor: "#ff5500"
  },
  nebula: {
    bg1: "#0f0c1b", bg2: "#18142b",
    snakeHead: "#b537f2", snakeBody: "#8a24bd",
    eyeColor: "#ffffff", pupilColor: "#0f0c1b",
    foodColor: "#00f0ff", obstacleColor: "#3a125e",
    overlayBg: "rgba(15, 12, 27, 0.85)", titleColor: "#b537f2"
  },
  cyber: {
    bg1: "#0d232a", bg2: "#09181e",
    snakeHead: "#00ffaa", snakeBody: "#00c483",
    eyeColor: "#09181e", pupilColor: "#00ffaa",
    foodColor: "#ff007f", obstacleColor: "#004d40",
    overlayBg: "rgba(13, 35, 42, 0.85)", titleColor: "#00ffaa"
  }
};

let currentTheme = Themes.volcano;

function setTheme(themeName) {
  if (!Themes[themeName]) return;
  currentTheme = Themes[themeName];
  document.querySelectorAll(".theme-btn").forEach(btn => btn.classList.remove("active"));
  if (event) event.target.classList.add("active");
  const titleHeader = document.querySelector("h1");
  if (titleHeader) titleHeader.style.color = currentTheme.titleColor;
  draw();
}

function setMode(mode) {
  gameMode = mode;
  document.querySelectorAll(".mode-btn").forEach(btn => btn.classList.remove("active"));
  if (event) event.target.classList.add("active");
  resetGame();
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  soundToggleBtn.textContent = soundEnabled ? "🔊 Sound: ON" : "🔇 Sound: OFF";
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  if (!soundEnabled) return;
  if (audioCtx.state === "suspended") audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  const now = audioCtx.currentTime;

  if (type === "eat") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.08);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  } else if (type === "gameover") {
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(70, now + 0.35);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.35);
  }
}

// Touch controls setup
document.getElementById("btnUp").addEventListener("click", () => { if (dy !== 1) { dx = 0; dy = -1; } });
document.getElementById("btnDown").addEventListener("click", () => { if (dy !== -1) { dx = 0; dy = 1; } });
document.getElementById("btnLeft").addEventListener("click", () => { if (dx !== 1) { dx = -1; dy = 0; } });
document.getElementById("btnRight").addEventListener("click", () => { if (dx !== -1) { dx = 1; dy = 0; } });

document.addEventListener("keydown", handleKeyPress);
canvas.addEventListener("click", handleCanvasClick);

draw();

function resetGame() {
  snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  dx = 1; dy = 0;
  score = 0;
  gameSpeed = 110;
  particles = [];
  obstacles = [];

  if (gameMode === "MAZE") {
    generateMazeObstacles();
  }

  scoreElement.textContent = score;
  generateFood();
  currentState = GameState.PLAYING;

  if (gameTimeout) clearTimeout(gameTimeout);
  gameLoop();
}

function generateMazeObstacles() {
  obstacles = [
    { x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 },
    { x: 14, y: 12 }, { x: 14, y: 13 }, { x: 14, y: 14 }
  ];
}

function gameLoop() {
  if (currentState !== GameState.PLAYING) return;

  moveSnake();
  updateParticles();

  if (checkCollision()) {
    currentState = GameState.GAMEOVER;
    playSound("gameover");
    if (score > highScore) {
      highScore = score;
      localStorage.setItem("snakeHighScore", highScore);
      highScoreElement.textContent = highScore;
    }
    draw();
    return;
  }

  checkFoodCollision();
  draw();

  gameTimeout = setTimeout(gameLoop, gameSpeed);
}

function moveSnake() {
  let head = { x: snake[0].x + dx, y: snake[0].y + dy };

  if (gameMode === "PASSTHROUGH") {
    if (head.x < 0) head.x = tileCount - 1;
    if (head.x >= tileCount) head.x = 0;
    if (head.y < 0) head.y = tileCount - 1;
    if (head.y >= tileCount) head.y = 0;
  }

  snake.unshift(head);
  snake.pop();
}

function checkCollision() {
  const head = snake[0];

  if (gameMode !== "PASSTHROUGH") {
    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) return true;
  }

  for (let i = 1; i < snake.length; i++) {
    if (head.x === snake[i].x && head.y === snake[i].y) return true;
  }

  for (let obs of obstacles) {
    if (head.x === obs.x && head.y === obs.y) return true;
  }

  return false;
}

function checkFoodCollision() {
  const head = snake[0];
  if (head.x === food.x && head.y === food.y) {
    score += 10;
    playSound("eat");
    if (gameSpeed > 55) gameSpeed -= 1.5;

    scoreElement.textContent = score;
    createExplosion(food.x * gridSize + gridSize / 2, food.y * gridSize + gridSize / 2, currentTheme.foodColor);
    snake.push({ ...snake[snake.length - 1] });
    generateFood();
  }
}

function generateFood() {
  let validSpot = false;
  while (!validSpot) {
    food.x = Math.floor(Math.random() * tileCount);
    food.y = Math.floor(Math.random() * tileCount);
    
    let inSnake = snake.some(s => s.x === food.x && s.y === food.y);
    let inObs = obstacles.some(o => o.x === food.x && o.y === food.y);
    validSpot = !inSnake && !inObs;
  }
}

function createExplosion(x, y, color) {
  for (let i = 0; i < 8; i++) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push({
      x: x, y: y,
      vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5,
      size: Math.random() * 3 + 2, color: color, alpha: 1
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.alpha -= 0.08;
    if (p.alpha <= 0) particles.splice(i, 1);
  }
}

function handleKeyPress(event) {
  const key = event.key;
  if (currentState === GameState.START || currentState === GameState.GAMEOVER) {
    if (key === " " || key === "Enter") resetGame();
    return;
  }

  if ((key === "ArrowUp" || key === "w") && dy !== 1) { dx = 0; dy = -1; }
  else if ((key === "ArrowDown" || key === "s") && dy !== -1) { dx = 0; dy = 1; }
  else if ((key === "ArrowLeft" || key === "a") && dx !== 1) { dx = -1; dy = 0; }
  else if ((key === "ArrowRight" || key === "d") && dx !== -1) { dx = 1; dy = 0; }
}

function handleCanvasClick() {
  if (currentState === GameState.START || currentState === GameState.GAMEOVER) {
    resetGame();
  }
}

function drawBackground() {
  for (let r = 0; r < tileCount; r++) {
    for (let c = 0; c < tileCount; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? currentTheme.bg1 : currentTheme.bg2;
      ctx.fillRect(c * gridSize, r * gridSize, gridSize, gridSize);
    }
  }
}

function draw() {
  drawBackground();

  if (currentState === GameState.START) {
    drawOverlay("SNAKE RECHARGED", "Click or Press SPACE to Start");
    return;
  }

  // Draw Particles
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Draw Obstacles (Maze Mode)
  obstacles.forEach(obs => {
    ctx.fillStyle = currentTheme.obstacleColor;
    ctx.fillRect(obs.x * gridSize + 1, obs.y * gridSize + 1, gridSize - 2, gridSize - 2);
  });

  // Draw Food
  const foodX = food.x * gridSize + gridSize / 2;
  const foodY = food.y * gridSize + gridSize / 2;

  ctx.save();
  ctx.shadowColor = currentTheme.foodColor;
  ctx.shadowBlur = 10;
  ctx.fillStyle = currentTheme.foodColor;
  ctx.beginPath();
  ctx.moveTo(foodX, foodY - gridSize / 2 + 3);
  ctx.lineTo(foodX + gridSize / 2 - 3, foodY);
  ctx.lineTo(foodX, foodY + gridSize / 2 - 3);
  ctx.lineTo(foodX - gridSize / 2 + 3, foodY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Draw Snake
  snake.forEach((segment, index) => {
    const x = segment.x * gridSize;
    const y = segment.y * gridSize;

    ctx.save();
    if (index === 0) {
      ctx.shadowColor = currentTheme.snakeHead;
      ctx.shadowBlur = 8;
      ctx.fillStyle = currentTheme.snakeHead;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, gridSize - 2, gridSize - 2, 7);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = currentTheme.eyeColor;
      let eye1X, eye1Y, eye2X, eye2Y;
      let pupilDX = dx * 1.2;
      let pupilDY = dy * 1.2;

      if (dx === 1) { eye1X = x + 13; eye1Y = y + 5; eye2X = x + 13; eye2Y = y + 13; }
      else if (dx === -1) { eye1X = x + 5; eye1Y = y + 5; eye2X = x + 5; eye2Y = y + 13; }
      else if (dy === -1) { eye1X = x + 5; eye1Y = y + 5; eye2X = x + 13; eye2Y = y + 5; }
      else if (dy === 1) { eye1X = x + 5; eye1Y = y + 13; eye2X = x + 13; eye2Y = y + 13; }

      ctx.beginPath();
      ctx.arc(eye1X, eye1Y, 3, 0, Math.PI * 2);
      ctx.arc(eye2X, eye2Y, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = currentTheme.pupilColor;
      ctx.beginPath();
      ctx.arc(eye1X + pupilDX, eye1Y + pupilDY, 1.5, 0, Math.PI * 2);
      ctx.arc(eye2X + pupilDX, eye2Y + pupilDY, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = currentTheme.snakeBody;
      ctx.beginPath();
      ctx.roundRect(x + 2, y + 2, gridSize - 4, gridSize - 4, 5);
      ctx.fill();
    }
    ctx.restore();
  });

  if (currentState === GameState.GAMEOVER) {
    drawOverlay("GAME OVER", `Final Score: ${score} | Press SPACE to Restart`);
  }
}

function drawOverlay(title, subtitle) {
  ctx.fillStyle = currentTheme.overlayBg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = currentTheme.titleColor;
  ctx.font = "bold 26px Arial";
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 20);

  ctx.fillStyle = "#ffffff";
  ctx.font = "14px Arial";
  ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 20);
}