const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("highScore");
const stageEl = document.getElementById("stage");
const statusEl = document.getElementById("status");
const touchControls = document.querySelector(".touch-controls");
const modeSelect = document.getElementById("modeSelect");
const screenEl = document.querySelector(".screen");
const burstBtn = document.getElementById("burstBtn");
const abilityBurstEl = document.getElementById("abilityBurst");
const abilityBonusEl = document.getElementById("abilityBonus");
const abilityControlEl = document.getElementById("abilityControl");

const gridSize = 18;
const tileCount = canvas.width / gridSize;
const baseTickMs = 120;
const minTickMs = 70;
const speedStepMs = 8;
const pointsPerSpeedStep = 3;
const highScoreStorageKey = "isnake-high-score";
const modeStorageKey = "isnake-mode";
const gameModes = {
  CLASSIC: "classic",
  WRAP: "wrap",
  OBSTACLES: "obstacles",
};
const obstacleCount = 14;
const evolutionStages = [
  { minScore: 0, name: "Hatchling", head: "#2b402f", body: "#36583b", accent: "#4f7755" },
  { minScore: 5, name: "Striker", head: "#1f3f4e", body: "#2b5468", accent: "#4d7a8d" },
  { minScore: 12, name: "Viper", head: "#3e3356", body: "#59447c", accent: "#7c64a3" },
  { minScore: 20, name: "Titan", head: "#6a4b1f", body: "#8a642a", accent: "#bc944f" },
];

let snake = [];
let direction = { x: 1, y: 0 };
let directionQueue = [];
let food = { x: 10, y: 10 };
let bonusFood = null;
let obstacles = [];
let score = 0;
let highScore = 0;
let currentMode = gameModes.CLASSIC;
let isRunning = false;
let isGameOver = false;
let isCountingDown = false;
let gameLoopTimer = null;
let currentTickMs = baseTickMs;
let foodsEaten = 0;
let bonusFoodTicksLeft = 0;
let burstTicksLeft = 0;
let burstCooldownTicks = 0;
let particles = [];

const bonusFoodDurationTicks = 40;
const bonusFoodEveryFoods = 4;
const bonusFoodScore = 3;
const burstTickMs = 55;
const burstDurationTicks = 16;
const burstCooldownTicksMax = 70;

function resetGameState() {
  const center = Math.floor(tileCount / 2);

  snake = [
    { x: center, y: center },
    { x: center - 1, y: center },
    { x: center - 2, y: center },
  ];
  direction = { x: 1, y: 0 };
  directionQueue = [];
  score = 0;
  currentTickMs = baseTickMs;
  foodsEaten = 0;
  bonusFood = null;
  bonusFoodTicksLeft = 0;
  burstTicksLeft = 0;
  burstCooldownTicks = 0;
  particles = [];
  isGameOver = false;
  isRunning = false;
  isCountingDown = false;
  scoreEl.textContent = String(score);
  highScoreEl.textContent = String(highScore);
  updateEvolutionDisplay();
  updateAbilityPanel();
  updateVisualState();
  statusEl.textContent = `Tap ⏯ or press Space to start (${modeLabel()})`;
  obstacles = [];
  if (currentMode === gameModes.OBSTACLES) {
    generateObstacles();
  }
  spawnFood();
  startLoop();
  draw();
}

function getEvolutionStage() {
  let selected = evolutionStages[0];
  evolutionStages.forEach((stage) => {
    if (score >= stage.minScore) {
      selected = stage;
    }
  });
  return selected;
}

function updateEvolutionDisplay() {
  const stage = getEvolutionStage();
  stageEl.textContent = stage.name;
}

function updateAbilityPanel() {
  const burstUnlocked = hasStageUnlocked(5);
  const bonusUnlocked = hasStageUnlocked(12);
  const controlUnlocked = hasStageUnlocked(20);

  abilityBurstEl.textContent = burstUnlocked ? "Burst: Unlocked" : "Burst: Locked";
  abilityBonusEl.textContent = bonusUnlocked ? "Bonus: Unlocked" : "Bonus: Locked";
  abilityControlEl.textContent = controlUnlocked ? "Control: Unlocked" : "Control: Locked";

  abilityBurstEl.classList.toggle("unlocked", burstUnlocked);
  abilityBonusEl.classList.toggle("unlocked", bonusUnlocked);
  abilityControlEl.classList.toggle("unlocked", controlUnlocked);

  const canUseBurst = burstUnlocked && isRunning && burstCooldownTicks === 0;
  burstBtn.disabled = !canUseBurst;
}

function updateVisualState() {
  screenEl.classList.toggle("is-running", isRunning);
  screenEl.classList.toggle("is-burst", burstTicksLeft > 0);
}

function spawnFood() {
  let candidate;
  do {
    candidate = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount),
    };
  } while (isOnSnake(candidate) || isOnObstacle(candidate));

  food = candidate;
}

function spawnBonusFood() {
  let candidate;
  do {
    candidate = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount),
    };
  } while (
    isOnSnake(candidate) ||
    isOnObstacle(candidate) ||
    (candidate.x === food.x && candidate.y === food.y)
  );

  bonusFood = candidate;
  bonusFoodTicksLeft = bonusFoodDurationTicks;
}

function isOnSnake(cell) {
  return snake.some((segment) => segment.x === cell.x && segment.y === cell.y);
}

function isOnObstacle(cell) {
  return obstacles.some((obstacle) => obstacle.x === cell.x && obstacle.y === cell.y);
}

function generateObstacles() {
  const generated = [];
  while (generated.length < obstacleCount) {
    const candidate = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount),
    };

    const isDuplicate = generated.some(
      (obstacle) => obstacle.x === candidate.x && obstacle.y === candidate.y
    );
    if (isDuplicate || isOnSnake(candidate)) {
      continue;
    }
    generated.push(candidate);
  }
  obstacles = generated;
}

function startLoop() {
  if (gameLoopTimer) {
    clearInterval(gameLoopTimer);
  }
  gameLoopTimer = setInterval(step, getActiveTickMs());
}

function getActiveTickMs() {
  if (burstTicksLeft > 0) {
    return Math.min(currentTickMs, burstTickMs);
  }
  return currentTickMs;
}

function refreshLoopSpeed() {
  if (gameLoopTimer) {
    startLoop();
  }
}

function loadHighScore() {
  const raw = window.localStorage.getItem(highScoreStorageKey);
  const parsed = Number(raw);
  highScore = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function loadMode() {
  const savedMode = window.localStorage.getItem(modeStorageKey);
  if (savedMode && Object.values(gameModes).includes(savedMode)) {
    currentMode = savedMode;
  }
  modeSelect.value = currentMode;
}

function updateHighScoreIfNeeded() {
  if (score > highScore) {
    highScore = score;
    highScoreEl.textContent = String(highScore);
    window.localStorage.setItem(highScoreStorageKey, String(highScore));
  }
}

function updateSpeedForScore() {
  const speedSteps = Math.floor(score / pointsPerSpeedStep);
  const nextTick = Math.max(minTickMs, baseTickMs - speedSteps * speedStepMs);
  if (nextTick !== currentTickMs) {
    currentTickMs = nextTick;
    refreshLoopSpeed();
  }
}

function isSameDirection(a, b) {
  return a.x === b.x && a.y === b.y;
}

function hasStageUnlocked(minScore) {
  return score >= minScore;
}

function tickAbilities() {
  if (burstCooldownTicks > 0) {
    burstCooldownTicks -= 1;
  }

  if (burstTicksLeft > 0) {
    burstTicksLeft -= 1;
    if (burstTicksLeft === 0) {
      refreshLoopSpeed();
      if (isRunning) {
        statusEl.textContent = "Running";
      }
      updateVisualState();
    }
  }

  if (bonusFoodTicksLeft > 0) {
    bonusFoodTicksLeft -= 1;
    if (bonusFoodTicksLeft === 0) {
      bonusFood = null;
    }
  }

  updateAbilityPanel();
}

function tryActivateBurst() {
  if (!hasStageUnlocked(5) || isGameOver || isCountingDown || !isRunning) {
    return;
  }
  if (burstTicksLeft > 0 || burstCooldownTicks > 0) {
    return;
  }

  burstTicksLeft = burstDurationTicks;
  burstCooldownTicks = burstCooldownTicksMax;
  statusEl.textContent = "Burst!";
  refreshLoopSpeed();
  updateVisualState();
  updateAbilityPanel();
}

function createParticlesFromCell(cell, color, count) {
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x: cell.x * gridSize + gridSize / 2,
      y: cell.y * gridSize + gridSize / 2,
      vx: (Math.random() - 0.5) * 2.8,
      vy: (Math.random() - 0.5) * 2.8,
      life: 20 + Math.floor(Math.random() * 8),
      size: 2 + Math.random() * 2,
      color,
    });
  }
}

function tickParticles() {
  particles = particles
    .map((particle) => ({
      ...particle,
      x: particle.x + particle.vx,
      y: particle.y + particle.vy,
      vy: particle.vy + 0.02,
      life: particle.life - 1,
    }))
    .filter((particle) => particle.life > 0);
}

function step() {
  if (!isRunning || isGameOver) {
    return;
  }

  if (directionQueue.length > 0) {
    direction = directionQueue.shift();
  }

  const head = snake[0];
  let nextHead = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  };

  if (currentMode === gameModes.WRAP) {
    nextHead = {
      x: (nextHead.x + tileCount) % tileCount,
      y: (nextHead.y + tileCount) % tileCount,
    };
  }

  const hitWall =
    currentMode !== gameModes.WRAP &&
    (nextHead.x < 0 ||
      nextHead.x >= tileCount ||
      nextHead.y < 0 ||
      nextHead.y >= tileCount);

  const hitObstacle = currentMode === gameModes.OBSTACLES && isOnObstacle(nextHead);

  if (hitWall || hitObstacle || isOnSnake(nextHead)) {
    const impactCell = {
      x: Math.max(0, Math.min(tileCount - 1, nextHead.x)),
      y: Math.max(0, Math.min(tileCount - 1, nextHead.y)),
    };
    createParticlesFromCell(impactCell, "#ff5d5d", 24);
    isGameOver = true;
    isRunning = false;
    statusEl.textContent = "Game Over — press Enter";
    updateVisualState();
    updateAbilityPanel();
    draw();
    return;
  }

  snake.unshift(nextHead);

  if (nextHead.x === food.x && nextHead.y === food.y) {
    score += 1;
    foodsEaten += 1;
    scoreEl.textContent = String(score);
    updateEvolutionDisplay();
    updateAbilityPanel();
    updateHighScoreIfNeeded();
    updateSpeedForScore();
    createParticlesFromCell(nextHead, "#7ee7ff", 10);
    spawnFood();

    if (hasStageUnlocked(12) && foodsEaten % bonusFoodEveryFoods === 0 && !bonusFood) {
      spawnBonusFood();
    }
  } else {
    snake.pop();
  }

  if (bonusFood && nextHead.x === bonusFood.x && nextHead.y === bonusFood.y) {
    score += bonusFoodScore;
    scoreEl.textContent = String(score);
    updateEvolutionDisplay();
    updateAbilityPanel();
    updateHighScoreIfNeeded();
    updateSpeedForScore();
    bonusFood = null;
    bonusFoodTicksLeft = 0;
    createParticlesFromCell(nextHead, "#ffd46d", 16);
    statusEl.textContent = `Bonus +${bonusFoodScore}!`;
  }

  tickAbilities();
  tickParticles();
  draw();
}

function draw() {
  const evolution = getEvolutionStage();

  ctx.fillStyle = "#e8f5e9";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(125, 154, 115, 0.35)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= tileCount; i += 1) {
    const line = i * gridSize;
    ctx.beginPath();
    ctx.moveTo(line, 0);
    ctx.lineTo(line, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, line);
    ctx.lineTo(canvas.width, line);
    ctx.stroke();
  }

  snake.forEach((segment, index) => {
    const pad = index === 0 ? 2 : 3;
    const x = segment.x * gridSize + pad;
    const y = segment.y * gridSize + pad;
    const size = gridSize - pad * 2;

    ctx.fillStyle = index === 0 ? evolution.head : evolution.body;
    ctx.fillRect(x, y, size, size);

    if (score >= 5 && index > 0) {
      ctx.fillStyle = evolution.accent;
      ctx.fillRect(x + 3, y + 3, size - 6, size - 6);
    }

    if (score >= 12 && index % 2 === 0 && index > 0) {
      ctx.fillStyle = evolution.head;
      ctx.fillRect(x + 5, y + 5, size - 10, size - 10);
    }
  });

  if (snake.length > 0 && score >= 5) {
    const head = snake[0];
    const eyeY = head.y * gridSize + 6;
    ctx.fillStyle = "#e9f3df";
    ctx.fillRect(head.x * gridSize + 5, eyeY, 3, 3);
    ctx.fillRect(head.x * gridSize + gridSize - 8, eyeY, 3, 3);
  }

  ctx.fillStyle = "#253a28";
  ctx.fillRect(food.x * gridSize + 4, food.y * gridSize + 4, gridSize - 8, gridSize - 8);

  if (bonusFood) {
    ctx.fillStyle = "#d19d32";
    ctx.fillRect(
      bonusFood.x * gridSize + 2,
      bonusFood.y * gridSize + 2,
      gridSize - 4,
      gridSize - 4
    );
  }

  if (currentMode === gameModes.OBSTACLES) {
    ctx.fillStyle = "#b24747";
    obstacles.forEach((obstacle) => {
      ctx.fillRect(
        obstacle.x * gridSize + 3,
        obstacle.y * gridSize + 3,
        gridSize - 6,
        gridSize - 6
      );
    });
  }

  particles.forEach((particle) => {
    ctx.globalAlpha = Math.max(0, particle.life / 28);
    ctx.fillStyle = particle.color;
    ctx.fillRect(
      particle.x - particle.size / 2,
      particle.y - particle.size / 2,
      particle.size,
      particle.size
    );
    ctx.globalAlpha = 1;
  });
}

function togglePause() {
  if (isGameOver || isCountingDown) {
    return;
  }
  if (isRunning) {
    isRunning = false;
    statusEl.textContent = "Paused";
    updateVisualState();
    updateAbilityPanel();
    return;
  }
  startCountdownAndRun();
}

function startCountdownAndRun() {
  if (isGameOver || isCountingDown) {
    return;
  }

  let countdown = 3;
  isCountingDown = true;
  statusEl.textContent = String(countdown);

  const countdownTimer = setInterval(() => {
    countdown -= 1;
    if (countdown > 0) {
      statusEl.textContent = String(countdown);
      return;
    }
    clearInterval(countdownTimer);
    isCountingDown = false;
    isRunning = true;
    statusEl.textContent = "Running";
    updateVisualState();
    updateAbilityPanel();
  }, 350);
}

function setDirection(next) {
  const reference =
    directionQueue.length > 0 ? directionQueue[directionQueue.length - 1] : direction;
  const isOpposite = next.x === reference.x * -1 && next.y === reference.y * -1;
  const maxQueueSize = hasStageUnlocked(20) ? 2 : 1;

  if (isOpposite || isSameDirection(next, reference)) {
    return;
  }

  if (maxQueueSize === 1) {
    directionQueue = [next];
    return;
  }

  if (directionQueue.length < maxQueueSize) {
    directionQueue.push(next);
  }
}

function modeLabel() {
  if (currentMode === gameModes.WRAP) {
    return "Wrap";
  }
  if (currentMode === gameModes.OBSTACLES) {
    return "Obstacles";
  }
  return "Classic";
}

window.addEventListener("keydown", (event) => {
  switch (event.key) {
    case "ArrowUp":
      setDirection({ x: 0, y: -1 });
      break;
    case "ArrowDown":
      setDirection({ x: 0, y: 1 });
      break;
    case "ArrowLeft":
      setDirection({ x: -1, y: 0 });
      break;
    case "ArrowRight":
      setDirection({ x: 1, y: 0 });
      break;
    case " ":
      event.preventDefault();
      togglePause();
      break;
    case "Enter":
      if (isGameOver) {
        resetGameState();
      }
      break;
    case "b":
    case "B":
      tryActivateBurst();
      break;
    default:
      return;
  }
});

modeSelect.addEventListener("change", () => {
  currentMode = modeSelect.value;
  window.localStorage.setItem(modeStorageKey, currentMode);
  resetGameState();
});

burstBtn.addEventListener("click", () => {
  tryActivateBurst();
});

touchControls.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) {
    return;
  }

  const dir = target.dataset.dir;
  const action = target.dataset.action;

  if (dir === "up") {
    setDirection({ x: 0, y: -1 });
  } else if (dir === "down") {
    setDirection({ x: 0, y: 1 });
  } else if (dir === "left") {
    setDirection({ x: -1, y: 0 });
  } else if (dir === "right") {
    setDirection({ x: 1, y: 0 });
  } else if (action === "pause") {
    togglePause();
  }
});

loadHighScore();
loadMode();
resetGameState();
