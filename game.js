const canvas = document.getElementById("gameCanvas");
const scoreEl = document.getElementById("score");
const ballsEl = document.getElementById("balls");
const bestEl = document.getElementById("best");
const statusEl = document.getElementById("status");
const restartBtn = document.getElementById("restartBtn");
const missionTitleEl = document.getElementById("missionTitle");
const missionDetailEl = document.getElementById("missionDetail");
const muteBtn = document.getElementById("muteBtn");

if (!canvas) {
  throw new Error("Game canvas not found.");
}

const renderCtx = canvas.getContext("2d");
/** px/s² — heavier, believable fall on a titled table */
const GRAVITY = 750;
/** Rolling / air drag (applied per physics substep). */
const TABLE_DRAG = 0.999;
const WALL_RESTITUTION = 0.82;
const BUMPER_RESTITUTION = 0.62;
const SLING_OUTWARD = 640;
const ballRadius = 10;
const floorY = canvas.height - 12;
const tableCenterX = canvas.width / 2;
const PLUNGER_MAX_CHARGE = 1;
const PLUNGER_CHARGE_PER_S = 1.15;
const highScoreStorageKey = "galaxy-strike-pinball-best";
const muteStorageKey = "galaxy-pinball-muted";

const ball = {
  x: tableCenterX,
  y: floorY - 34,
  vx: 0,
  vy: 0,
  launched: false,
  slingInside: [false, false],
};

const plunger = {
  charge: 0,
  pulling: false,
};

const leftFlipper = {
  pivotX: 184,
  pivotY: 680,
  length: 96,
  base: -0.36,
  up: 0.32,
  angle: -0.36,
  prevAngle: -0.36,
  lastOmega: 0,
};
const rightFlipper = {
  pivotX: 336,
  pivotY: 680,
  length: 96,
  base: 3.5,
  up: 2.82,
  angle: 3.5,
  prevAngle: 3.5,
  lastOmega: 0,
};
const state = {
  score: 0,
  best: 0,
  balls: 3,
  gameOver: false,
  mission: {
    index: 0,
    prog: {
      bumperMask: 0,
      slingL: false,
      slingR: false,
      wallHits: 0,
      ballScore0: 0,
    },
  },
};
const input = { left: false, right: false };
const bumperCooldown = [0, 0, 0];
const flipperCooldown = { left: 0, right: 0 };

const MISSION_BONUS = 120;
const missions = [
  {
    id: "triad",
    title: "Hyperlane triad",
    detail(prog) {
      const n = [0, 1, 2].filter((i) => (prog.bumperMask & (1 << i)) !== 0).length;
      return `Hit all three reactor nodes on one ball (${n}/3).`;
    },
    isComplete(prog) {
      return prog.bumperMask === 0b111;
    },
  },
  {
    id: "twin",
    title: "Twin surge",
    detail(prog) {
      return `Trigger both slingshots on one ball (${prog.slingL ? "Left ✓" : "Left —"} · ${prog.slingR ? "Right ✓" : "Right —"}).`;
    },
    isComplete(prog) {
      return prog.slingL && prog.slingR;
    },
  },
  {
    id: "breach",
    title: "Score breach",
    detail(prog, scored) {
      const need = 120;
      const cur = Math.max(0, scored - prog.ballScore0);
      return `Earn ${need} points on the current ball (${cur}/${need}).`;
    },
    isComplete(prog, scored) {
      return scored - prog.ballScore0 >= 120;
    },
  },
  {
    id: "rally",
    title: "Deflector rally",
    detail(prog) {
      return `Ricochet off the outer walls ${prog.wallHits}/5 times on one ball.`;
    },
    isComplete(prog) {
      return prog.wallHits >= 5;
    },
  },
];

const bumpers = [
  { x: 180, y: 190, r: 29, color: "#5bd8ff" },
  { x: 342, y: 190, r: 29, color: "#ff6f7b" },
  { x: 260, y: 268, r: 27, color: "#8d7bff" },
];

const slings = [
  [{ x: 120, y: 552 }, { x: 210, y: 602 }, { x: 118, y: 618 }],
  [{ x: 400, y: 552 }, { x: 310, y: 602 }, { x: 402, y: 618 }],
];

/** Midpoint of each sling — impulse pushes away from rubber toward playfield */
const slingCentroids = [
  { x: (120 + 210 + 118) / 3, y: (552 + 602 + 618) / 3 },
  { x: (400 + 310 + 402) / 3, y: (552 + 602 + 618) / 3 },
];

/* ---- Web Audio: cinematic sci-fi pad + SFX (no external files) ---- */
const audio = {
  ctx: null,
  master: null,
  ambientGain: null,
  sfxGain: null,
  ambientNodes: [],
  muted: false,
  started: false,
};

function getAudioContext() {
  if (!audio.ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      return null;
    }
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.9;
    audio.master.connect(audio.ctx.destination);

    audio.ambientGain = audio.ctx.createGain();
    audio.ambientGain.gain.value = 0.11;
    audio.ambientGain.connect(audio.master);

    audio.sfxGain = audio.ctx.createGain();
    audio.sfxGain.gain.value = 0.55;
    audio.sfxGain.connect(audio.master);
  }
  return audio.ctx;
}

function setMuted(muted) {
  audio.muted = muted;
  try {
    window.sessionStorage.setItem(muteStorageKey, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (audio.master) {
    audio.master.gain.setTargetAtTime(muted ? 0 : 0.9, audio.ctx?.currentTime ?? 0, 0.02);
  }
  if (muteBtn) {
    muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
    muteBtn.textContent = muted ? "Sound off" : "Sound on";
  }
  if (muted && audio.ambientNodes.length) {
    stopAmbient();
  } else if (!muted && audio.started && audio.ctx && audio.ctx.state === "running") {
    startAmbientPad();
  }
}

function loadMutePref() {
  try {
    return window.sessionStorage.getItem(muteStorageKey) === "1";
  } catch {
    return false;
  }
}

function stopAmbient() {
  audio.ambientNodes.forEach((n) => {
    try {
      n.stop();
    } catch {
      /* ignore */
    }
    try {
      n.disconnect();
    } catch {
      /* ignore */
    }
  });
  audio.ambientNodes = [];
}

function startAmbientPad() {
  const ac = getAudioContext();
  if (!ac || audio.muted) {
    return;
  }
  stopAmbient();
  const t0 = ac.currentTime;
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(320, t0);
  lp.Q.setValueAtTime(0.7, t0);
  lp.connect(audio.ambientGain);

  const freqs = [57.5, 115, 173];
  const gains = [0.045, 0.022, 0.014];
  freqs.forEach((hz, i) => {
    const osc = ac.createOscillator();
    osc.type = i === 0 ? "sine" : "triangle";
    osc.frequency.setValueAtTime(hz, t0);
    const g = ac.createGain();
    g.gain.setValueAtTime(gains[i], t0);
    osc.connect(g);
    g.connect(lp);
    osc.start(t0);
    audio.ambientNodes.push(osc, g);
  });

  const noiseLen = 4;
  const noiseBuf = ac.createBuffer(1, ac.sampleRate * noiseLen, ac.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * 0.08;
  }
  const noise = ac.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;
  const ng = ac.createGain();
  ng.gain.setValueAtTime(0.018, t0);
  const nf = ac.createBiquadFilter();
  nf.type = "bandpass";
  nf.frequency.setValueAtTime(240, t0);
  nf.Q.setValueAtTime(0.9, t0);
  noise.connect(ng);
  ng.connect(nf);
  nf.connect(lp);
  noise.start(t0);
  audio.ambientNodes.push(noise, ng, nf);

  const lfo = ac.createOscillator();
  lfo.type = "sine";
  lfo.frequency.setValueAtTime(0.07, t0);
  const lfoGain = ac.createGain();
  lfoGain.gain.setValueAtTime(0.03, t0);
  lfo.connect(lfoGain);
  lfoGain.connect(audio.ambientGain.gain);
  lfo.start(t0);
  audio.ambientNodes.push(lfo, lfoGain);
}

async function resumeAudio() {
  const ac = getAudioContext();
  if (!ac) {
    return;
  }
  if (ac.state === "suspended") {
    await ac.resume();
  }
  if (!audio.started && !audio.muted) {
    audio.started = true;
    startAmbientPad();
  }
}

function playSfx(build) {
  const ac = getAudioContext();
  if (!ac || audio.muted) {
    return;
  }
  const t0 = ac.currentTime;
  build(ac, t0);
}

function envGain(ac, t0, peak, attack, decay, bus) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  g.connect(bus);
  return g;
}

function toneHit(ac, t0, freq, duration, type, peak) {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  const g = envGain(ac, t0, peak, 0.006, duration, audio.sfxGain);
  osc.connect(g);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function playBumperSound() {
  playSfx((ac, t0) => {
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(920, t0);
    osc.frequency.exponentialRampToValueAtTime(210, t0 + 0.1);
    const f = ac.createBiquadFilter();
    f.type = "peaking";
    f.frequency.setValueAtTime(700, t0);
    f.Q.setValueAtTime(3, t0);
    const g = envGain(ac, t0, 0.22, 0.002, 0.11, audio.sfxGain);
    osc.connect(f);
    f.connect(g);
    osc.start(t0);
    osc.stop(t0 + 0.18);
  });
}

function playSlingSound() {
  playSfx((ac, t0) => {
    const len = 0.18;
    const buf = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) {
      d[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const f = ac.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(200, t0);
    f.frequency.exponentialRampToValueAtTime(1800, t0 + len);
    f.Q.setValueAtTime(2.5, t0);
    const g = envGain(ac, t0, 0.35, 0.005, len, audio.sfxGain);
    src.connect(f);
    f.connect(g);
    src.start(t0);
    src.stop(t0 + len);
  });
}

function playFlipperSound() {
  playSfx((ac, t0) => {
    const osc = ac.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(150, t0);
    osc.frequency.exponentialRampToValueAtTime(92, t0 + 0.04);
    const f = ac.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(900, t0);
    const g = envGain(ac, t0, 0.06, 0.001, 0.05, audio.sfxGain);
    osc.connect(f);
    f.connect(g);
    osc.start(t0);
    osc.stop(t0 + 0.08);
  });
}

function playWallSound() {
  playSfx((ac, t0) => {
    toneHit(ac, t0, 180, 0.03, "triangle", 0.04);
  });
}

function playLaunchSound() {
  playSfx((ac, t0) => {
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(110, t0);
    osc.frequency.exponentialRampToValueAtTime(880, t0 + 0.22);
    const g = envGain(ac, t0, 0.16, 0.02, 0.28, audio.sfxGain);
    osc.connect(g);
    osc.start(t0);
    osc.stop(t0 + 0.35);
  });
}

function playDrainSound() {
  playSfx((ac, t0) => {
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(220, t0);
    osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.55);
    const g = envGain(ac, t0, 0.18, 0.01, 0.7, audio.sfxGain);
    osc.connect(g);
    osc.start(t0);
    osc.stop(t0 + 0.85);
  });
}

function playMissionCompleteSound() {
  playSfx((ac, t0) => {
    const chord = [261.63, 329.63, 392.0];
    chord.forEach((hz, i) => {
      const osc = ac.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(hz, t0);
      const g = envGain(ac, t0, 0.07 + i * 0.02, 0.04, 0.45, audio.sfxGain);
      osc.connect(g);
      osc.start(t0);
      osc.stop(t0 + 0.55);
    });
  });
}

function playGameOverSound() {
  playSfx((ac, t0) => {
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, t0);
    osc.frequency.exponentialRampToValueAtTime(48, t0 + 0.9);
    const g = envGain(ac, t0, 0.12, 0.02, 1.0, audio.sfxGain);
    osc.connect(g);
    osc.start(t0);
    osc.stop(t0 + 1.2);
  });
}

function loadBest() {
  const raw = Number(window.localStorage.getItem(highScoreStorageKey));
  state.best = Number.isFinite(raw) && raw > 0 ? raw : 0;
  bestEl.textContent = String(state.best);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function currentMission() {
  return missions[state.mission.index % missions.length];
}

function refreshMissionHud() {
  const m = currentMission();
  const prog = state.mission.prog;
  if (missionTitleEl) {
    missionTitleEl.textContent = m.title;
  }
  if (missionDetailEl) {
    if (m.id === "breach") {
      missionDetailEl.textContent = m.detail(prog, state.score);
    } else {
      missionDetailEl.textContent = m.detail(prog, state.score);
    }
  }
}

function resetMissionProgressForBall() {
  state.mission.prog.bumperMask = 0;
  state.mission.prog.slingL = false;
  state.mission.prog.slingR = false;
  state.mission.prog.wallHits = 0;
  state.mission.prog.ballScore0 = state.score;
  ball.slingInside[0] = false;
  ball.slingInside[1] = false;
}

function tryCompleteMission() {
  const m = currentMission();
  const prog = state.mission.prog;
  let done = false;
  if (m.id === "breach") {
    done = m.isComplete(prog, state.score);
  } else {
    done = m.isComplete(prog);
  }
  if (!done) {
    return;
  }
  playMissionCompleteSound();
  statusEl.textContent = `Mission complete — ${m.title} (+${MISSION_BONUS})`;
  state.mission.index = (state.mission.index + 1) % missions.length;
  grantMissionBonus();
  resetMissionProgressForBall();
  refreshMissionHud();
}

/** Glass inner edges (matches frame draw). */
const INNER_LEFT = 18 + ballRadius;
const INNER_RIGHT = canvas.width - 18 - ballRadius;
const INNER_TOP = 16 + ballRadius;
const INNER_BOTTOM = floorY;
/** Center gap: no bottom rail — ball rolls toward drain like real outlanes. */
const DRAIN_GAP_LEFT = 222;
const DRAIN_GAP_RIGHT = 298;

function resetBall() {
  ball.x = tableCenterX;
  ball.y = floorY - 34;
  ball.vx = 0;
  ball.vy = 0;
  ball.launched = false;
  ball.slingInside[0] = false;
  ball.slingInside[1] = false;
  plunger.charge = 0;
  plunger.pulling = false;
}

function resetGame() {
  state.score = 0;
  state.balls = 3;
  state.gameOver = false;
  state.mission.index = 0;
  scoreEl.textContent = "0";
  ballsEl.textContent = "3";
  statusEl.textContent = "Hold Space to charge — release to launch";
  resetMissionProgressForBall();
  refreshMissionHud();
  resetBall();
  bumperCooldown[0] = bumperCooldown[1] = bumperCooldown[2] = 0;
  flipperCooldown.left = flipperCooldown.right = 0;
}

function applyHighScore() {
  scoreEl.textContent = String(state.score);
  if (state.score > state.best) {
    state.best = state.score;
    bestEl.textContent = String(state.best);
    window.localStorage.setItem(highScoreStorageKey, String(state.best));
  }
}

/** Table scoring — counts toward breach and best score. */
function addScore(points) {
  state.score += points;
  applyHighScore();
  if (currentMission().id === "breach") {
    refreshMissionHud();
    tryCompleteMission();
  }
}

/** Mission bonus — does not count toward the Score breach objective. */
function grantMissionBonus() {
  state.score += MISSION_BONUS;
  applyHighScore();
}

function launchBall(charge01) {
  if (state.gameOver || ball.launched) {
    return;
  }
  resumeAudio();
  const cap = clamp(Number(charge01) || PLUNGER_MAX_CHARGE * 0.35, 0.18, PLUNGER_MAX_CHARGE);
  playLaunchSound();
  ball.vx = (Math.random() - 0.5) * 95;
  ball.vy = -(360 + cap * 480);
  ball.launched = true;
  plunger.charge = 0;
  plunger.pulling = false;
  resetMissionProgressForBall();
  refreshMissionHud();
  statusEl.textContent = "Battle engaged";
}

function updateFlippers(dt) {
  const k = 16;
  const t = 1 - Math.exp(-k * dt);
  const prevL = leftFlipper.angle;
  const prevR = rightFlipper.angle;
  leftFlipper.angle += (input.left ? leftFlipper.up : leftFlipper.base - leftFlipper.angle) * t;
  rightFlipper.angle += (input.right ? rightFlipper.up : rightFlipper.base - rightFlipper.angle) * t;
  leftFlipper.lastOmega = dt > 1e-6 ? (leftFlipper.angle - prevL) / dt : 0;
  rightFlipper.lastOmega = dt > 1e-6 ? (rightFlipper.angle - prevR) / dt : 0;
  if (flipperCooldown.left > 0) {
    flipperCooldown.left -= 1;
  }
  if (flipperCooldown.right > 0) {
    flipperCooldown.right -= 1;
  }
}

function reflectOnNormal(nx, ny, restitution) {
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn >= 0) {
    return false;
  }
  const e = restitution;
  ball.vx -= (1 + e) * vn * nx;
  ball.vy -= (1 + e) * vn * ny;
  return true;
}

function applyDrainPull(dt) {
  const inFunnel = ball.y > 632 && ball.y < INNER_BOTTOM + 40;
  if (!inFunnel) {
    return;
  }
  const cx = tableCenterX;
  const pull = (cx - ball.x) * 2.4 * dt;
  ball.vx += pull;
  if (ball.x > DRAIN_GAP_LEFT && ball.x < DRAIN_GAP_RIGHT && ball.y > INNER_BOTTOM - 40) {
    ball.vy += 420 * dt;
  }
}

function tickBumperCooldowns() {
  for (let i = 0; i < bumperCooldown.length; i += 1) {
    if (bumperCooldown[i] > 0) {
      bumperCooldown[i] -= 1;
    }
  }
}

function resolveFrameWalls() {
  let bounced = false;
  if (ball.x < INNER_LEFT) {
    ball.x = INNER_LEFT;
    if (reflectOnNormal(1, 0, WALL_RESTITUTION)) {
      bounced = true;
    }
  } else if (ball.x > INNER_RIGHT) {
    ball.x = INNER_RIGHT;
    if (reflectOnNormal(-1, 0, WALL_RESTITUTION)) {
      bounced = true;
    }
  }

  if (ball.y < INNER_TOP) {
    ball.y = INNER_TOP;
    if (reflectOnNormal(0, 1, WALL_RESTITUTION)) {
      bounced = true;
    }
  }

  if (ball.y + ballRadius > INNER_BOTTOM) {
    if (ball.x < DRAIN_GAP_LEFT || ball.x > DRAIN_GAP_RIGHT) {
      ball.y = INNER_BOTTOM - ballRadius;
      if (reflectOnNormal(0, -1, WALL_RESTITUTION)) {
        bounced = true;
      }
    }
  }
  return bounced;
}

function resolveBumperCollision() {
  bumpers.forEach((bumper, i) => {
    const dx = ball.x - bumper.x;
    const dy = ball.y - bumper.y;
    const dist = Math.hypot(dx, dy);
    const minDist = bumper.r + ballRadius;
    if (dist >= minDist || dist <= 0 || bumperCooldown[i] > 0) {
      return;
    }
    const nx = dx / dist;
    const ny = dy / dist;
    ball.x = bumper.x + nx * minDist;
    ball.y = bumper.y + ny * minDist;
    const vn = ball.vx * nx + ball.vy * ny;
    if (vn < 0) {
      ball.vx -= (1 + BUMPER_RESTITUTION) * vn * nx;
      ball.vy -= (1 + BUMPER_RESTITUTION) * vn * ny;
    }
    const kick = 210;
    ball.vx += nx * kick;
    ball.vy += ny * kick;
    bumperCooldown[i] = 18;
    playBumperSound();
    addScore(50);
    if (currentMission().id === "triad") {
      state.mission.prog.bumperMask |= 1 << i;
      refreshMissionHud();
      tryCompleteMission();
    }
  });
}

function pointInTriangle(px, py, tri) {
  const [a, b, c] = tri;
  const area = (u, v, w) => (u.x * (v.y - w.y) + v.x * (w.y - u.y) + w.x * (u.y - v.y)) / 2;
  const total = Math.abs(area(a, b, c));
  const p1 = Math.abs(area({ x: px, y: py }, b, c));
  const p2 = Math.abs(area(a, { x: px, y: py }, c));
  const p3 = Math.abs(area(a, b, { x: px, y: py }));
  return Math.abs(total - (p1 + p2 + p3)) < 1;
}

function resolveSlingCollision() {
  slings.forEach((tri, index) => {
    const inside = pointInTriangle(ball.x, ball.y, tri);
    const was = ball.slingInside[index];
    if (inside && !was) {
      const c = slingCentroids[index];
      let ox = ball.x - c.x;
      let oy = ball.y - c.y;
      const od = Math.hypot(ox, oy) || 1;
      ox /= od;
      oy /= od;
      ball.vx += ox * SLING_OUTWARD * 0.11;
      ball.vy += oy * SLING_OUTWARD * 0.11 - 320;
      playSlingSound();
      addScore(25);
      if (currentMission().id === "twin") {
        if (index === 0) {
          state.mission.prog.slingL = true;
        } else {
          state.mission.prog.slingR = true;
        }
        refreshMissionHud();
        tryCompleteMission();
      }
    }
    ball.slingInside[index] = inside;
  });
}

function resolveFlipperHit(flipper, isLeft) {
  const tipX = flipper.pivotX + Math.cos(flipper.angle) * flipper.length;
  const tipY = flipper.pivotY + Math.sin(flipper.angle) * flipper.length;
  const dx = tipX - flipper.pivotX;
  const dy = tipY - flipper.pivotY;
  const lenSq = dx * dx + dy * dy;
  const t = clamp(((ball.x - flipper.pivotX) * dx + (ball.y - flipper.pivotY) * dy) / lenSq, 0, 1);
  const nearestX = flipper.pivotX + dx * t;
  const nearestY = flipper.pivotY + dy * t;
  const distX = ball.x - nearestX;
  const distY = ball.y - nearestY;
  const dist = Math.hypot(distX, distY);
  const hitR = 5.2;
  if (dist >= ballRadius + hitR) {
    return;
  }
  const nx = dist > 0 ? distX / dist : 0;
  const ny = dist > 0 ? distY / dist : -1;
  ball.x = nearestX + nx * (ballRadius + hitR);
  ball.y = nearestY + ny * (ballRadius + hitR);
  const tx = dx / Math.sqrt(lenSq);
  const ty = dy / Math.sqrt(lenSq);
  const omega = isLeft ? leftFlipper.lastOmega : rightFlipper.lastOmega;
  const r = Math.hypot(nearestX - flipper.pivotX, nearestY - flipper.pivotY);
  const tangSpeed = omega * r;
  const flipBoost = (isLeft ? input.left : input.right) ? 1 : 0.45;
  ball.vx += tx * tangSpeed * 0.55 * flipBoost;
  ball.vy += ty * tangSpeed * 0.55 * flipBoost;
  if ((isLeft ? input.left : input.right) && Math.abs(omega) > 0.35) {
    ball.vx += (isLeft ? 1 : -1) * 120;
    ball.vy -= 220;
  }
  const cd = isLeft ? flipperCooldown.left : flipperCooldown.right;
  if (cd === 0) {
    if (isLeft) {
      flipperCooldown.left = 8;
    } else {
      flipperCooldown.right = 8;
    }
    playFlipperSound();
    addScore(10);
  }
}

function checkDrain() {
  if (ball.y - ballRadius > canvas.height) {
    state.balls -= 1;
    ballsEl.textContent = String(state.balls);
    playDrainSound();
    if (state.balls <= 0) {
      state.gameOver = true;
      statusEl.textContent = "Mission failed. Press Restart.";
      playGameOverSound();
      resetBall();
      return;
    }
    statusEl.textContent = "Ball drained — hold Space, release to launch.";
    resetBall();
  }
}

function integrateBall(dt) {
  ball.vy += GRAVITY * dt;
  const drag = Math.exp(-4.5 * dt);
  ball.vx *= drag;
  ball.vy *= drag;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
}

function stepPhysics(dt) {
  if (!ball.launched || state.gameOver) {
    return;
  }
  tickBumperCooldowns();
  integrateBall(dt);
  applyDrainPull(dt);

  if (resolveFrameWalls()) {
    playWallSound();
    if (ball.launched && currentMission().id === "rally") {
      state.mission.prog.wallHits += 1;
      refreshMissionHud();
      tryCompleteMission();
    }
  }

  resolveBumperCollision();
  resolveSlingCollision();
  resolveFlipperHit(leftFlipper, true);
  resolveFlipperHit(rightFlipper, false);
  checkDrain();
}

function drawPlayfield() {
  renderCtx.fillStyle = "#071224";
  renderCtx.fillRect(0, 0, canvas.width, canvas.height);

  const gradient = renderCtx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "rgba(72,127,255,0.24)");
  gradient.addColorStop(1, "rgba(255,92,122,0.12)");
  renderCtx.fillStyle = gradient;
  renderCtx.fillRect(18, 16, canvas.width - 36, canvas.height - 28);

  renderCtx.strokeStyle = "rgba(148, 188, 255, 0.78)";
  renderCtx.lineWidth = 3;
  renderCtx.strokeRect(18, 16, canvas.width - 36, canvas.height - 28);

  bumpers.forEach((bumper) => {
    renderCtx.beginPath();
    renderCtx.fillStyle = bumper.color;
    renderCtx.shadowColor = bumper.color;
    renderCtx.shadowBlur = 18;
    renderCtx.arc(bumper.x, bumper.y, bumper.r, 0, Math.PI * 2);
    renderCtx.fill();
  });
  renderCtx.shadowBlur = 0;

  slings.forEach((tri, idx) => {
    renderCtx.beginPath();
    renderCtx.moveTo(tri[0].x, tri[0].y);
    renderCtx.lineTo(tri[1].x, tri[1].y);
    renderCtx.lineTo(tri[2].x, tri[2].y);
    renderCtx.closePath();
    renderCtx.fillStyle = idx === 0 ? "rgba(92, 206, 255, 0.45)" : "rgba(255, 92, 130, 0.45)";
    renderCtx.fill();
  });

  renderCtx.fillStyle = "rgba(190, 215, 255, 0.7)";
  renderCtx.font = "bold 13px Segoe UI";
  renderCtx.fillText("HYPERLANE", 220, 170);
  renderCtx.fillText("CORE REACTOR", 206, 250);
}

function drawFlipper(flipper, color) {
  const tipX = flipper.pivotX + Math.cos(flipper.angle) * flipper.length;
  const tipY = flipper.pivotY + Math.sin(flipper.angle) * flipper.length;
  renderCtx.lineWidth = 14;
  renderCtx.lineCap = "round";
  renderCtx.strokeStyle = color;
  renderCtx.shadowColor = color;
  renderCtx.shadowBlur = 14;
  renderCtx.beginPath();
  renderCtx.moveTo(flipper.pivotX, flipper.pivotY);
  renderCtx.lineTo(tipX, tipY);
  renderCtx.stroke();
  renderCtx.shadowBlur = 0;
}

function drawBall() {
  renderCtx.beginPath();
  renderCtx.fillStyle = "#f4f9ff";
  renderCtx.shadowColor = "#c9deff";
  renderCtx.shadowBlur = 16;
  renderCtx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
  renderCtx.fill();
  renderCtx.shadowBlur = 0;
}

function drawLauncherGuide() {
  if (!ball.launched && !state.gameOver) {
    renderCtx.fillStyle = "rgba(210, 225, 255, 0.9)";
    renderCtx.font = "600 13px Segoe UI";
    renderCtx.fillText("Hold Space — release to launch", 148, 722);
    const w = 200;
    const x0 = (canvas.width - w) / 2;
    const y0 = 730;
    renderCtx.strokeStyle = "rgba(140, 190, 255, 0.5)";
    renderCtx.lineWidth = 4;
    renderCtx.strokeRect(x0, y0, w, 10);
    renderCtx.fillStyle = plunger.pulling ? "rgba(90, 211, 255, 0.95)" : "rgba(120, 180, 255, 0.55)";
    renderCtx.fillRect(x0 + 2, y0 + 2, (w - 4) * clamp(plunger.charge / PLUNGER_MAX_CHARGE, 0, 1), 6);
  }
}

function render() {
  drawPlayfield();
  drawFlipper(leftFlipper, "#5ad3ff");
  drawFlipper(rightFlipper, "#ff6d88");
  drawBall();
  drawLauncherGuide();
}

const PHYS_FIXED_DT = 1 / 240;
let physAccumulator = 0;
let lastFrameTime = 0;

function gameLoop(timeMs) {
  if (!lastFrameTime) {
    lastFrameTime = timeMs;
  }
  const frameDt = Math.min(0.05, (timeMs - lastFrameTime) / 1000);
  lastFrameTime = timeMs;

  if (plunger.pulling && !ball.launched && !state.gameOver) {
    plunger.charge = Math.min(PLUNGER_MAX_CHARGE, plunger.charge + PLUNGER_CHARGE_PER_S * frameDt);
  }

  physAccumulator += frameDt;
  while (physAccumulator >= PHYS_FIXED_DT) {
    updateFlippers(PHYS_FIXED_DT);
    stepPhysics(PHYS_FIXED_DT);
    physAccumulator -= PHYS_FIXED_DT;
  }

  render();
  requestAnimationFrame(gameLoop);
}

function onFirstInteract() {
  resumeAudio();
  window.removeEventListener("pointerdown", onFirstInteract);
}

window.addEventListener("keydown", (event) => {
  resumeAudio();
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    input.left = true;
  } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    input.right = true;
  } else if (event.key === " ") {
    if (!event.repeat && !state.gameOver && !ball.launched) {
      event.preventDefault();
      plunger.pulling = true;
      plunger.charge = 0;
    }
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    input.left = false;
  } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    input.right = false;
  } else if (event.key === " ") {
    if (!state.gameOver && !ball.launched) {
      event.preventDefault();
      plunger.pulling = false;
      launchBall(plunger.charge);
    }
  }
});

window.addEventListener("pointerdown", onFirstInteract);

restartBtn.addEventListener("click", () => {
  resetGame();
  resumeAudio();
});

if (muteBtn) {
  muteBtn.addEventListener("click", () => {
    setMuted(!audio.muted);
    resumeAudio();
  });
}

loadBest();
setMuted(loadMutePref());
refreshMissionHud();
resetGame();
gameLoop();
