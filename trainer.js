/**
 * Original monster-trainer homage — not affiliated with Nintendo or Pokémon.
 * Protagonist Ash with intentional African American representation in portrait/sprite colors.
 */
(function () {
  "use strict";

  const TILE = 32;
  const COLS = 16;
  const ROWS = 12;
  const ENCOUNTER_CHANCE = 0.18;

  const canvas = document.getElementById("trainerCanvas");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const statusEl = document.getElementById("trainerStatus");
  const partyLabel = document.getElementById("partyLabel");
  const restartBtn = document.getElementById("trainerRestart");

  /** @type {'overworld'|'battle'|'menu'} */
  let mode = "overworld";
  let keys = Object.create(null);

  const mapLayout = [
    "TTTTTTTTTTTTTTTT",
    "TGGGGGGGGGGGGGGT",
    "TGGGGGGGGGGGGGGT",
    "TGGPPPPPPPPGGGGT",
    "TGGPGGGGGGGPGGGT",
    "TGGPGGGGGGGPGGGT",
    "TGGPPPPPPPPGGGGT",
    "TGGGGGGGGGGGGGGT",
    "TGGGGGGGGGGGGGGT",
    "TGGGGGGGGGGGGGGT",
    "TGGGGGGGGGGGGGGT",
    "TTTTTTTTTTTTTTTT",
  ];

  const legend = { T: "tree", G: "grass", P: "path" };

  function tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return "tree";
    const row = mapLayout[ty];
    const ch = row[tx];
    return legend[ch] || "tree";
  }

  function blocked(tx, ty) {
    const t = tileAt(tx, ty);
    return t === "tree";
  }

  const MOVES = {
    tackle: { name: "Tackle", power: 40 },
    growl: { name: "Growl", power: 0, effect: "weaken" },
    ember: { name: "Ember Spark", power: 35 },
    splash: { name: "Water Poke", power: 30 },
    vine: { name: "Vine Slap", power: 35 },
  };

  const SPECIES = {
    flufflet: { name: "Flufflet", types: ["normal"], color: "#c4a574", moves: ["tackle", "growl"] },
    emberbit: { name: "Emberbit", types: ["fire"], color: "#e85a3c", moves: ["ember", "tackle"] },
    splashling: { name: "Splashling", types: ["water"], color: "#4a9fd4", moves: ["splash", "growl"] },
    mossprite: { name: "Mossprite", types: ["grass"], color: "#5cb85c", moves: ["vine", "tackle"] },
  };

  function makeMon(speciesId, level) {
    const spec = SPECIES[speciesId];
    const maxHp = 12 + level * 4;
    return {
      speciesId,
      name: spec.name,
      level,
      maxHp,
      hp: maxHp,
      atk: 8 + level * 2,
      def: 6 + level,
      attackDown: false,
    };
  }

  let player = {
    x: 8,
    y: 6,
    facing: 0,
  };

  let party = [makeMon("flufflet", 5)];

  let battle = null;

  function wildPoolForPlayer() {
    return ["emberbit", "splashling", "mossprite", "flufflet"];
  }

  function randomWildLevel() {
    return 3 + Math.floor(Math.random() * 4);
  }

  function tryEncounter() {
    const t = tileAt(player.x, player.y);
    if (t !== "grass") return;
    if (Math.random() > ENCOUNTER_CHANCE) return;
    const pool = wildPoolForPlayer();
    const sid = pool[Math.floor(Math.random() * pool.length)];
    const lv = randomWildLevel();
    startBattle(makeMon(sid, lv));
  }

  function startBattle(wild) {
    const lead = party[0];
    battle = {
      wild,
      playerMon: lead,
      menu: "root",
      message: `Wild ${wild.name} appeared!`,
      turn: "player",
      pendingEnemyMove: null,
    };
    mode = "battle";
    statusEl.textContent = battle.message;
  }

  function typeMultiplier(attacker, defender) {
    const a = SPECIES[attacker.speciesId].types[0];
    const d = SPECIES[defender.speciesId].types[0];
    const chart = {
      fire: { grass: 1.5, water: 0.75, fire: 0.75, normal: 1 },
      water: { fire: 1.5, grass: 0.75, water: 0.75, normal: 1 },
      grass: { water: 1.5, fire: 0.75, grass: 0.75, normal: 1 },
      normal: { fire: 1, water: 1, grass: 1, normal: 1 },
    };
    return chart[a][d] != null ? chart[a][d] : 1;
  }

  function damageFor(attacker, defender, moveId) {
    const m = MOVES[moveId];
    if (!m.power) return 0;
    let dmg = Math.max(
      1,
      Math.floor(
        ((2 * attacker.level) / 5 + 2) * (m.power * (attacker.atk / Math.max(1, defender.def))) * 0.08
      )
    );
    dmg = Math.floor(dmg * typeMultiplier(attacker, defender));
    if (attacker.attackDown) dmg = Math.floor(dmg * 0.85);
    return dmg;
  }

  /** @param {'won'|'fled'|'lost'} outcome */
  function endBattle(outcome) {
    battle = null;
    mode = "overworld";
    if (outcome === "won") {
      statusEl.textContent =
        "You won! Keep exploring — more grass, more battles.";
      partyLabel.textContent = `${party[0].name} Lv.${party[0].level} — HP ${party[0].hp}/${party[0].maxHp}`;
    } else if (outcome === "fled") {
      statusEl.textContent = "You got away safely. Keep walking if you want another fight.";
    } else {
      statusEl.textContent =
        "Your creature fainted! Ash heads to safety. Press New game to retry.";
      party[0].hp = 0;
    }
  }

  function processBattleAction(kind, payload) {
    if (!battle || battle.turn !== "player") return;
    const pm = battle.playerMon;
    const wm = battle.wild;

    if (kind === "run") {
      if (Math.random() < 0.55) {
        battle.message = "Got away safely!";
        statusEl.textContent = battle.message;
        setTimeout(() => endBattle("fled"), 400);
        return;
      }
      battle.message = "Can't escape!";
      battle.turn = "enemy";
      statusEl.textContent = battle.message;
      return;
    }

    if (kind === "fight" && payload) {
      const moveId = payload;
      const mv = MOVES[moveId];
      if (mv.effect === "weaken") {
        wm.attackDown = true;
        battle.message = `${pm.name} used ${mv.name}! Foe's attack fell!`;
      } else {
        const dmg = damageFor(pm, wm, moveId);
        wm.hp = Math.max(0, wm.hp - dmg);
        battle.message = `${pm.name} used ${mv.name}! ${dmg} dmg`;
      }
      if (wm.hp <= 0) {
        battle.message = `Wild ${wm.name} fainted!`;
        statusEl.textContent = battle.message;
        setTimeout(() => endBattle("won"), 500);
        return;
      }
      battle.turn = "enemy";
      statusEl.textContent = battle.message;
    }
  }

  function enemyAct() {
    if (!battle || battle.turn !== "enemy") return;
    const pm = battle.playerMon;
    const wm = battle.wild;
    const spec = SPECIES[wm.speciesId];
    const moveId = spec.moves[Math.floor(Math.random() * spec.moves.length)];
    const mv = MOVES[moveId];
    if (mv.effect === "weaken") {
      pm.attackDown = true;
      battle.message = `Wild ${wm.name} used ${mv.name}! Your attack fell!`;
    } else {
      const dmg = damageFor(wm, pm, moveId);
      pm.hp = Math.max(0, pm.hp - dmg);
      battle.message = `Wild ${wm.name} used ${mv.name}! ${dmg} dmg`;
    }
    if (pm.hp <= 0) {
      statusEl.textContent = `${pm.name} fainted!`;
      setTimeout(() => endBattle("lost"), 600);
      return;
    }
    battle.turn = "player";
    statusEl.textContent = battle.message;
  }

  function drawTile(tx, ty) {
    const x = tx * TILE;
    const y = ty * TILE;
    const t = tileAt(tx, ty);
    if (t === "grass") {
      ctx.fillStyle = "#3d7a3d";
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "#4f9f4f";
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(x + 4 + i * 5, y + 8 + (i % 2) * 6, 2, 6);
      }
    } else if (t === "path") {
      ctx.fillStyle = "#c9a66b";
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(x, y + TILE - 6, TILE, 6);
    } else {
      ctx.fillStyle = "#1e4d2b";
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "#2d6b3d";
      ctx.beginPath();
      ctx.arc(x + TILE * 0.5, y + TILE * 0.55, TILE * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0f3318";
      ctx.fillRect(x + TILE * 0.35, y + TILE * 0.65, TILE * 0.3, TILE * 0.35);
    }
  }

  function drawPixel(x, y, size, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);
  }

  function drawAsh(px, py, facing) {
    const cellX = px * TILE;
    const cellY = py * TILE;
    const p = 2;
    const ox = cellX + 6;
    const oy = cellY + 5;
    const skin = "#8D5524";
    const shade = "#6D3F1E";
    const hair = "#181818";
    const cap = "#d9272e";
    const jacket = "#2f7f96";
    const dark = "#232323";

    // Pixel trainer sprite, inspired by classic handheld RPG proportions.
    const facingDir = facing === 3 ? -1 : 1;

    // Hair and cap layer
    drawPixel(ox + 2 * p, oy + 0 * p, p, hair);
    drawPixel(ox + 3 * p, oy + 0 * p, p, hair);
    drawPixel(ox + 4 * p, oy + 0 * p, p, hair);
    drawPixel(ox + 5 * p, oy + 0 * p, p, hair);
    drawPixel(ox + 1 * p, oy + 1 * p, p, cap);
    drawPixel(ox + 2 * p, oy + 1 * p, p, cap);
    drawPixel(ox + 3 * p, oy + 1 * p, p, cap);
    drawPixel(ox + 4 * p, oy + 1 * p, p, cap);
    drawPixel(ox + 5 * p, oy + 1 * p, p, cap);
    drawPixel(ox + 6 * p, oy + 1 * p, p, cap);
    drawPixel(ox + 2 * p, oy + 2 * p, p, "#f0f0f0");
    drawPixel(ox + 3 * p, oy + 2 * p, p, "#f0f0f0");
    drawPixel(ox + 4 * p, oy + 2 * p, p, "#f0f0f0");
    drawPixel(ox + (facingDir > 0 ? 7 : 0) * p, oy + 2 * p, p, cap);

    // Face
    drawPixel(ox + 2 * p, oy + 3 * p, p, skin);
    drawPixel(ox + 3 * p, oy + 3 * p, p, skin);
    drawPixel(ox + 4 * p, oy + 3 * p, p, skin);
    drawPixel(ox + 5 * p, oy + 3 * p, p, skin);
    drawPixel(ox + 2 * p, oy + 4 * p, p, shade);
    drawPixel(ox + 3 * p, oy + 4 * p, p, skin);
    drawPixel(ox + 4 * p, oy + 4 * p, p, skin);
    drawPixel(ox + 5 * p, oy + 4 * p, p, shade);
    drawPixel(ox + 3 * p, oy + 4 * p, p, "#111");
    drawPixel(ox + 4 * p, oy + 4 * p, p, "#111");

    // Torso and jacket
    drawPixel(ox + 2 * p, oy + 5 * p, p, jacket);
    drawPixel(ox + 3 * p, oy + 5 * p, p, jacket);
    drawPixel(ox + 4 * p, oy + 5 * p, p, jacket);
    drawPixel(ox + 5 * p, oy + 5 * p, p, jacket);
    drawPixel(ox + 1 * p, oy + 6 * p, p, dark);
    drawPixel(ox + 2 * p, oy + 6 * p, p, jacket);
    drawPixel(ox + 3 * p, oy + 6 * p, p, jacket);
    drawPixel(ox + 4 * p, oy + 6 * p, p, jacket);
    drawPixel(ox + 5 * p, oy + 6 * p, p, jacket);
    drawPixel(ox + 6 * p, oy + 6 * p, p, dark);
    drawPixel(ox + 2 * p, oy + 7 * p, p, dark);
    drawPixel(ox + 3 * p, oy + 7 * p, p, dark);
    drawPixel(ox + 4 * p, oy + 7 * p, p, dark);
    drawPixel(ox + 5 * p, oy + 7 * p, p, dark);

    // Backpack hint
    const packX = facingDir > 0 ? 6 : 1;
    drawPixel(ox + packX * p, oy + 5 * p, p, "#3f7a4f");
    drawPixel(ox + packX * p, oy + 6 * p, p, "#3f7a4f");

    // Shoes
    drawPixel(ox + 2 * p, oy + 8 * p, p, dark);
    drawPixel(ox + 3 * p, oy + 8 * p, p, dark);
    drawPixel(ox + 4 * p, oy + 8 * p, p, dark);
    drawPixel(ox + 5 * p, oy + 8 * p, p, dark);
  }

  function drawMonBlob(mon, cx, cy, flip) {
    const body = SPECIES[mon.speciesId].color;
    const eye = "#121212";
    const white = "#f5f9ff";
    ctx.save();
    ctx.translate(cx, cy);
    if (flip) ctx.scale(-1, 1);

    // Rounded silhouette with classic RPG-style chunky features.
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 2, 28, 23, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.17)";
    ctx.beginPath();
    ctx.ellipse(-10, -9, 8, 5, -0.2, 0, Math.PI * 2);
    ctx.fill();

    const type = SPECIES[mon.speciesId].types[0];
    if (type === "fire") {
      ctx.fillStyle = "#ffcf55";
      ctx.beginPath();
      ctx.moveTo(14, -5);
      ctx.lineTo(26, -14);
      ctx.lineTo(20, -2);
      ctx.closePath();
      ctx.fill();
    } else if (type === "water") {
      ctx.fillStyle = "#c5efff";
      ctx.beginPath();
      ctx.arc(16, -7, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === "grass") {
      ctx.fillStyle = "#a6f09a";
      ctx.beginPath();
      ctx.moveTo(-6, -14);
      ctx.lineTo(0, -24);
      ctx.lineTo(5, -13);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = "#ead5a2";
      ctx.beginPath();
      ctx.arc(-17, -4, 5, 0, Math.PI * 2);
      ctx.arc(17, -4, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = eye;
    ctx.beginPath();
    ctx.ellipse(-8, -3, 4, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(8, -3, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = white;
    ctx.beginPath();
    ctx.arc(-9, -5, 1.4, 0, Math.PI * 2);
    ctx.arc(7, -5, 1.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 4, 8, 0.25, Math.PI - 0.25);
    ctx.stroke();

    ctx.restore();
  }

  function drawOverworld() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        drawTile(tx, ty);
      }
    }
    drawAsh(player.x, player.y, player.facing);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, canvas.height - 36, canvas.width, 36);
    ctx.fillStyle = "#e8f0ff";
    ctx.font = "14px Segoe UI, sans-serif";
    ctx.fillText("Ash — walk the route. Grass may trigger a wild battle.", 12, canvas.height - 14);
  }

  function drawBattle() {
    if (!battle) return;
    const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grd.addColorStop(0, "#6ec8ff");
    grd.addColorStop(0.45, "#b8e6ff");
    grd.addColorStop(0.46, "#7ecf6a");
    grd.addColorStop(1, "#3d8f3d");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawMonBlob(battle.wild, canvas.width * 0.72, canvas.height * 0.38, true);

    drawMonBlob(battle.playerMon, canvas.width * 0.28, canvas.height * 0.55, false);

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(8, 8, 220, 52);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 15px Segoe UI, sans-serif";
    ctx.fillText(`Wild ${battle.wild.name} Lv.${battle.wild.level}`, 18, 30);
    const whp = battle.wild.hp / battle.wild.maxHp;
    ctx.fillStyle = "#333";
    ctx.fillRect(18, 38, 180, 10);
    ctx.fillStyle = whp > 0.25 ? "#5dff7a" : "#ff5d5d";
    ctx.fillRect(18, 38, 180 * whp, 10);

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(canvas.width - 228, canvas.height - 120, 220, 52);
    ctx.fillStyle = "#fff";
    ctx.fillText(`${battle.playerMon.name} Lv.${battle.playerMon.level}`, canvas.width - 218, canvas.height - 98);
    const php = battle.playerMon.hp / battle.playerMon.maxHp;
    ctx.fillStyle = "#333";
    ctx.fillRect(canvas.width - 218, canvas.height - 86, 180, 10);
    ctx.fillStyle = php > 0.25 ? "#5dff7a" : "#ff5d5d";
    ctx.fillRect(canvas.width - 218, canvas.height - 86, 180 * php, 10);

    ctx.fillStyle = "rgba(15,25,40,0.92)";
    ctx.fillRect(0, canvas.height - 96, canvas.width, 96);
    ctx.strokeStyle = "rgba(140,190,255,0.5)";
    ctx.strokeRect(4, canvas.height - 92, canvas.width - 8, 88);

    ctx.fillStyle = "#d8e6ff";
    ctx.font = "14px Segoe UI, sans-serif";
    const lines = battle.message.split("\n");
    lines.forEach((line, i) => {
      ctx.fillText(line, 16, canvas.height - 68 + i * 18);
    });

    ctx.fillStyle = "#9ec8ff";
    ctx.font = "12px Segoe UI, sans-serif";
    if (battle.turn === "player") {
      ctx.fillText("[F] Fight   [R] Run   [1-4] Quick move when fight menu open", 16, canvas.height - 22);
    } else {
      ctx.fillText("…", 16, canvas.height - 22);
    }
  }

  function loop() {
    if (mode === "overworld") drawOverworld();
    else if (mode === "battle") drawBattle();
    requestAnimationFrame(loop);
  }

  function move(dx, dy) {
    if (mode !== "overworld") return;
    const nx = player.x + dx;
    const ny = player.y + dy;
    if (dx < 0) player.facing = 3;
    if (dx > 0) player.facing = 1;
    if (dy < 0) player.facing = 0;
    if (dy > 0) player.facing = 2;
    if (blocked(nx, ny)) return;
    player.x = nx;
    player.y = ny;
    tryEncounter();
  }

  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;

    if (mode === "battle" && battle) {
      if (battle.turn !== "player") return;

      if (battle.menu === "root") {
        if (e.code === "KeyF") {
          battle.menu = "moves";
          const m = SPECIES[battle.playerMon.speciesId].moves;
          battle.message = m.map((id, i) => `${i + 1}.${MOVES[id].name}`).join("  ");
          statusEl.textContent = "Pick a move (1-4) or B to cancel.";
          e.preventDefault();
          return;
        }
        if (e.code === "KeyR") {
          processBattleAction("run");
          statusEl.textContent = battle.message;
          e.preventDefault();
          return;
        }
      } else if (battle.menu === "moves") {
        const m = SPECIES[battle.playerMon.speciesId].moves;
        const n = e.key;
        if (n >= "1" && n <= "4") {
          const idx = parseInt(n, 10) - 1;
          if (m[idx]) {
            processBattleAction("fight", m[idx]);
            statusEl.textContent = battle.message;
            battle.menu = "root";
            e.preventDefault();
            return;
          }
        }
        if (e.code === "KeyB" || e.code === "Escape") {
          battle.menu = "root";
          battle.message = "What will you do?";
          statusEl.textContent = battle.message;
          e.preventDefault();
          return;
        }
      }
      return;
    }

    if (mode === "overworld") {
      if (e.code === "ArrowUp" || e.code === "KeyW") move(0, -1);
      if (e.code === "ArrowDown" || e.code === "KeyS") move(0, 1);
      if (e.code === "ArrowLeft" || e.code === "KeyA") move(-1, 0);
      if (e.code === "ArrowRight" || e.code === "KeyD") move(1, 0);
    }
  });

  window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });

  setInterval(() => {
    if (mode === "battle" && battle && battle.turn === "enemy") {
      enemyAct();
    }
  }, 700);

  function resetGame() {
    player = { x: 8, y: 6, facing: 0 };
    party = [makeMon("flufflet", 5)];
    battle = null;
    mode = "overworld";
    partyLabel.textContent = `Flufflet Lv.${party[0].level}`;
    statusEl.textContent = "Arrow keys or WASD to walk. Enter grass for wild encounters.";
  }

  restartBtn.addEventListener("click", resetGame);

  resetGame();
  requestAnimationFrame(loop);
})();
