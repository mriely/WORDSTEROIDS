// ============================================================
// WORDSTEROIDS — prototype 0.2
// ============================================================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Fixed virtual resolution. Everything in the game's coordinate space is
// rendered into this canvas size; CSS scales the result to fit the window.
const W = 1600;
const H = 900;
canvas.width = W;
canvas.height = H;

function resize() {
  // Compute scale to fit the actual viewport while preserving aspect ratio
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = Math.min(vw / W, vh / H);
  document.documentElement.style.setProperty('--stage-scale', scale);
}
window.addEventListener('resize', resize);
resize();

// World grows with level. BASE_WORLD is the level-1 size; WORLD is current.
const BASE_WORLD = { w: 6000, h: 4500 };
const WORLD = { w: BASE_WORLD.w, h: BASE_WORLD.h };
const WORLD_GROWTH_PER_LEVEL = 0.15; // 15% bigger per level (linear)

// Camera zoom-out factor — 1.2 means each viewport shows 20% more world per
// axis than the raw 1600×900 canvas would, by scaling world rendering down
// in draw(). HUD/flash/minimap stay at native scale.
const VIEW_ZOOM = 1.2;

// LEVEL_CONFIG is built dynamically by buildLevelConfig() once the dictionary loads.
// Each level has: { n, label, sub, wordLength, scoreToAdvance }

// Powerups: pickup is FREE, but you must have at least `requires` score to collect.
// Higher-tier powerups need higher scores, capping at game-changing ridiculous ones.
// Powerups: pickup is FREE, but you must be at least `tier` level to collect.
// Tier 1 (any level): boost, spread, blast, multishot
// Tier 2 (level 2+):  shield, phantom
// Tier 3 (level 3+):  vampire, nuke
const POWERUP_DEFS = {
  shield: {
    name: 'SHIELD', color: '#00ffe0', tier: 2,
    desc: 'absorbs one hit. lasts until used.',
    duration: 0, // not used — shield is persistent
    type: 'passive',
  },
  boost: {
    name: 'BOOST', color: '#5aff7c', tier: 1,
    desc: 'each thrust pushes you 2× harder.',
    duration: 30,
    type: 'passive',
  },
  spread: {
    name: 'SPREAD', color: '#ff8c1a', tier: 1,
    desc: 'fire = 3-bullet fan.',
    duration: 30,
    type: 'weapon',
  },
  blast: {
    name: 'BLAST', color: '#d65bff', tier: 1,
    desc: 'fire = omnidirectional shockwave. wider at higher level.',
    duration: 30,
    type: 'weapon',
  },
  multishot: {
    name: 'MULTI', color: '#3aa0ff', tier: 1,
    desc: 'fire = bullets from all 4 sides at once.',
    duration: 30,
    type: 'weapon',
  },
  phantom: {
    name: 'PHANTOM', color: '#a06bff', tier: 4,
    desc: 'invisible to enemies. they can\'t target you.',
    duration: 30,
    type: 'passive',
  },
  vampire: {
    name: 'VAMPIRE', color: '#ff3050', tier: 3,
    desc: 'each kill refreshes your invuln shield.',
    duration: 30,
    type: 'passive',
  },
  giant: {
    name: 'GIANT', color: '#ff9933', tier: 3,
    desc: 'fire = ship-sized bullet that pierces. bigger with level.',
    duration: 30,
    type: 'weapon',
  },
  nuke: {
    name: 'NUKE', color: '#fff4c2', tier: 3,
    desc: 'fire = launches a nuke. detonates on impact.',
    duration: 30,
    type: 'weapon',
  },
  multispread: {
    name: 'MULTI SPREAD', color: '#7a4cff', tier: 4,
    desc: 'fire = 3-bullet spread in all 4 directions.',
    duration: 30,
    type: 'weapon',
  },
  spike: {
    name: 'SPIKE', color: '#c8cdd6', tier: 4,
    desc: 'ram into ships to destroy them. shielded enemies are immune.',
    duration: 30,
    type: 'passive',
  },
};

// ----- Stars -----
const stars = [];
for (let i = 0; i < 220; i++) {
  stars.push({
    x: Math.random() * WORLD.w,
    y: Math.random() * WORLD.h,
    r: Math.random() * 1.6 + 0.2,
    layer: Math.random() < 0.5 ? 0.4 : (Math.random() < 0.7 ? 0.7 : 1.0),
    twinkle: Math.random() * Math.PI * 2,
  });
}

// ----- Wrap-aware distance helpers -----
// Shortest delta between two world coords accounting for wrap
function wrapDelta(a, b, span) {
  let d = b - a;
  if (d > span / 2) d -= span;
  if (d < -span / 2) d += span;
  return d;
}

// True if world position (x, y) is currently inside the player's viewport.
// Uses a small margin so the cutoff isn't jarringly precise at the screen edge.
function isOnPlayerScreen(x, y, margin = 40) {
  if (!player) return true;
  const dx = wrapDelta(player.x, x, WORLD.w);
  const dy = wrapDelta(player.y, y, WORLD.h);
  // Half-spans scale with VIEW_ZOOM because draw() shows a wider chunk of world
  return Math.abs(dx) <= W * VIEW_ZOOM / 2 + margin && Math.abs(dy) <= H * VIEW_ZOOM / 2 + margin;
}

// Score-to-size growth (logarithmic — fast early, slow later)
// At score 0 -> baseSize, climbs toward maxSize asymptotically.
function sizeForScore(score, baseSize, maxSize) {
  const growth = Math.log(1 + score / 3) * 20; // tunable: log curve
  return Math.min(maxSize, baseSize + growth);
}

// Display helper — show 1 decimal place
function fmtScore(s) { return s.toFixed(1); }
// 2-decimal variant used ONLY for the local player's own live HUD score, so
// the player can see their fine-grained 0.02-per-letter progress. Leaderboard,
// bots, and remote players stay at 1 decimal to keep the table tidy.
function fmtScoreSelf(s) { return s.toFixed(2); }

// ----- Game state -----
let level = 1;
let player;
let bots = [];
let bullets = [];
const particles = [];
let shockwaves = [];
let king = null;
let kingTimer = 0;
let typedBuffer = '';
let flash = null; // { color, until }

function pickNearestEnemy(ship) {
  let best = null, bd = Infinity;
  const all = remotePlayer ? [player, remotePlayer, ...bots] : [player, ...bots];
  for (const s of all) {
    if (s === ship || !s.alive) continue;
    // PHANTOM: completely invisible to bot targeting
    if (s.activePowerup && s.activePowerup.key === 'phantom') continue;
    const dx = wrapDelta(ship.x, s.x, WORLD.w);
    const dy = wrapDelta(ship.y, s.y, WORLD.h);
    const d = Math.hypot(dx, dy);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

// Picks the highest-scoring living enemy (the leader). Skips PHANTOMs.
function pickLeaderEnemy(ship) {
  let best = null;
  const all = remotePlayer ? [player, remotePlayer, ...bots] : [player, ...bots];
  for (const s of all) {
    if (s === ship || !s.alive) continue;
    if (s.activePowerup && s.activePowerup.key === 'phantom') continue;
    if (!best || s.score > best.score) best = s;
  }
  return best;
}

// Combine leader-hunting and nearest-targeting based on a bias 0..1.
// bias=0 → always nearest. bias=1 → always leader (if leader has score > 0).
function pickHostileTarget(ship, leaderBias) {
  let anyScore = false;
  const all = remotePlayer ? [player, remotePlayer, ...bots] : [player, ...bots];
  for (const s of all) {
    if (s !== ship && s.alive && s.score > 0) { anyScore = true; break; }
  }
  if (anyScore && Math.random() < leaderBias) {
    const leader = pickLeaderEnemy(ship);
    if (leader) return leader;
  }
  return pickNearestEnemy(ship);
}

// In multiplayer:
//   host owns 'player' (local) and 'remotePlayer' (the joiner's ship), plus bots.
//   joiner has only minimal local state — everything is rendered from snapshots.
let remotePlayer = null;

function init() {
  // Player color is always cyan for the local player on host/solo.
  // For joiner, color is assigned by host but we use a placeholder locally.
  if (NET.mode === 'joiner') {
    // Joiner: minimal init. No bots, no local player ship — all comes from snapshots.
    // We still create a placeholder 'player' so existing code doesn't crash, but
    // most fields will be overwritten via snapshots.
    player = new Ship({
      id: 'remote', name: NET.myName, isPlayer: true,
      x: WORLD.w / 2, y: WORLD.h / 2,
      color: '#ff2d6f', // joiner is hot pink in the snapshot scheme
    });
    return;
  }

  // Solo and host setup
  player = new Ship({
    id: 'p', name: NET.myName, isPlayer: true,
    x: WORLD.w / 2, y: WORLD.h / 2,
    color: '#00ffe0',
  });

  if (NET.mode === 'host') {
    // Add the joiner as a second human ship (host-side). Spawn near the host's
    // player (~600px offset) so both players can find each other immediately
    // at game start instead of being scattered randomly across a huge world.
    const offsetAngle = Math.random() * Math.PI * 2;
    const offsetDist = 600;
    remotePlayer = new Ship({
      id: 'r', name: NET.remoteName, isPlayer: true, // isPlayer=true for collision/scoring
      x: player.x + Math.cos(offsetAngle) * offsetDist,
      y: player.y + Math.sin(offsetAngle) * offsetDist,
      color: '#ff2d6f',
    });
    remotePlayer.isRemote = true; // tag so we skip local input handling
  }

  // Color palette. BLACKBYTE is a stealth ship — near-black so it's hard to
  // spot against the dark background. The render code special-cases its border.
  const BLACKBYTE_COLOR = '#0d0d12';
  let botColors, botNames, botTypes;
  if (NET.mode === 'host') {
    // Host: 6 bots, joiner is the hot-pink player.
    botColors = [BLACKBYTE_COLOR, '#e040fb','#1ec8ff','#7cff5a','#ff8c42','#9aa8ff'];
    botNames  = ['BLACKBYTE','SPEEDY','KRAKEN','SCURVY','NULLBEARD','VESPER'];
    botTypes  = ['normal','speedy','normal','normal','normal','normal'];
  } else {
    // Solo: 5 bots.
    botColors = [BLACKBYTE_COLOR, '#e040fb','#1ec8ff','#7cff5a','#ff8c42'];
    botNames  = ['BLACKBYTE','SPEEDY','KRAKEN','SCURVY','NULLBEARD'];
    botTypes  = ['normal','speedy','normal','normal','normal'];
  }
  for (let i = 0; i < botColors.length; i++) {
    const ship = new Ship({
      id: 'b' + i, name: botNames[i],
      x: Math.random() * WORLD.w,
      y: Math.random() * WORLD.h,
      color: botColors[i],
    });
    ship.botType = botTypes[i];
    ship.stealth = (botNames[i] === 'BLACKBYTE'); // render with faint outline
    bots.push(ship);
  }
  showLevelIntro();
}

function spawnExplosion(x, y, color, count = 22) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * 220 + 60;
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.6 + Math.random() * 0.4,
      maxLife: 1.0,
      color,
      r: 1.5 + Math.random() * 2,
    });
  }
}

function flashScreen(color, secs) {
  flash = { color, until: performance.now() + secs * 1000 };
}

// Two-layer rainbow burst spawned at a ship's position whenever a human player
// completes a word. Inner white pop + outer prismatic ring — meant to feel like
// confetti, not damage. Bots don't get this (it'd be constant visual noise).
function spawnWordSparkle(x, y) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * 180 + 60;
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.4 + Math.random() * 0.3,
      maxLife: 0.8,
      color: '#ffffff',
      r: 2 + Math.random() * 2,
    });
  }
  const count = 22;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * 320 + 120;
    const hue = Math.floor((i / count) * 360 + Math.random() * 40) % 360;
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.8 + Math.random() * 0.5,
      maxLife: 1.4,
      color: `hsl(${hue}, 95%, 65%)`,
      r: 2 + Math.random() * 2.5,
    });
  }
}

// ----- Input -----
window.addEventListener('keydown', (e) => {
  // Audio: kick off playback on first interaction (browsers block autoplay)
  audioStartIfPending();

  // Audio controls (use punctuation so they don't conflict with typing letters)
  if (e.key === '\\' || e.key === '|') {
    audioToggleMute();
    return;
  }
  if (e.key === '=' || e.key === '+') {
    audioNext();
    return;
  }
  if (e.key === '-' || e.key === '_') {
    audioPrev();
    return;
  }

  // Cheat: backtick (`) cycles through powerups and grants the next one to the player
  if (e.key === '`' || e.key === '~') {
    cheatCyclePowerup();
    return;
  }

  // Cheat keys: number 1-9 warps to that level (without changing score),
  // 0 resets the high score. Active even when dead.
  if (e.key >= '0' && e.key <= '9' && e.key.length === 1) {
    const n = parseInt(e.key, 10);
    if (n === 0) {
      cheatResetHighScore();
    } else {
      cheatWarpToLevel(n);
    }
    return;
  }
  // (Spacebar unbound for now — ships rely on ambient drag for deceleration.
  // The brake mechanic on Ship still exists and bots can use it.)

  if (!player.alive) return;
  if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
    typedBuffer += e.key.toLowerCase();
    handlePlayerTyping(e.shiftKey);
  } else if (e.key === 'Backspace') {
    typedBuffer = typedBuffer.slice(0, -1);
  } else if (e.key === 'Escape') {
    typedBuffer = '';
  }
});

function cheatWarpToLevel(targetLevel) {
  if (!LEVEL_CONFIG.length || !player) return;
  const clamped = Math.max(1, Math.min(LEVEL_CONFIG.length, targetLevel));
  player.level = clamped;
  player.resetWords();
  applyWorldSizeForLevel();
  showLevelIntro();
}

function cheatResetHighScore() {
  highScore = 0;
  saveHighScore();
}

let cheatPowerupIdx = 0;
function cheatCyclePowerup() {
  if (!player || !player.alive) return;
  const keys = Object.keys(POWERUP_DEFS);
  const key = keys[cheatPowerupIdx % keys.length];
  cheatPowerupIdx++;
  player.applyPowerup(key);
  // Brief screen flash matching the powerup color, just like a normal pickup
  const def = POWERUP_DEFS[key];
  flashScreen(def.color, 0.2);
}

function handlePlayerTyping(shift) {
  // Determine the words for the local player.
  // - Solo/host: read from local player.words (host owns simulation)
  // - Joiner: read from snapshot — find the ship with id 'r' (the joiner)
  let w;
  if (NET.mode === 'joiner') {
    if (!NET.remoteState) return;
    const myShip = NET.remoteState.ships.find(s => s.id === 'r');
    if (!myShip || !myShip.ws) return;
    w = myShip.ws;
  } else {
    w = player.words;
  }

  const aimOnly = !!shift;

  // For solo/host we execute locally. For joiner we send inputs.
  const exec = (kind, dx, dy) => {
    if (NET.mode === 'joiner') {
      sendInput(kind, dx, dy, !!shift);
    } else {
      if (kind === 'thrust') player.thrust(dx, dy);
      else if (kind === 'aim') player.aim(dx, dy);
      else if (kind === 'fire') player.fire();
    }
  };

  const candidates = [
    { word: w.up,    action: () => aimOnly ? exec('aim', 0, -1) : exec('thrust', 0, -1) },
    { word: w.down,  action: () => aimOnly ? exec('aim', 0,  1) : exec('thrust', 0,  1) },
    { word: w.left,  action: () => aimOnly ? exec('aim',-1,  0) : exec('thrust',-1,  0) },
    { word: w.right, action: () => aimOnly ? exec('aim', 1,  0) : exec('thrust', 1,  0) },
    { word: w.fire,  action: () => exec('fire', 0, 0) },
  ];

  // Complete match — fire the action and credit the full word length.
  // Partial typing (prefix progress, smart reroute) earns NO passive points
  // so players can't farm score by spamming letters of unfinished words.
  for (const c of candidates) {
    if (typedBuffer === c.word) {
      c.action();
      if (NET.mode !== 'joiner') {
        refreshWordSlot(player, c.word);
        player.creditCorrectLetters(c.word.length);
        spawnWordSparkle(player.x, player.y);
      }
      typedBuffer = '';
      return;
    }
  }

  // Buffer still a valid prefix of some word — keep typing (no credit yet).
  if (candidates.some(c => c.word.startsWith(typedBuffer))) return;

  // Wrong letter — but if it starts another word, jump to typing that one.
  // No credit because the abandoned word wasn't completed.
  const lastChar = typedBuffer.slice(-1);
  if (lastChar && candidates.some(c => c.word.startsWith(lastChar))) {
    typedBuffer = lastChar;
    return;
  }

  // Otherwise the keystroke was junk — drop everything.
  typedBuffer = '';
}

function refreshWordSlot(ship, oldWord) {
  const slots = ['up','down','left','right','fire'];
  const slot = slots.find(s => ship.words[s] === oldWord);
  if (!slot) return;
  const otherFirsts = new Set(slots.filter(s => s !== slot).map(s => ship.words[s][0]));
  // Use the ship's own personal level for word length
  const lvl = ship.level || 1;
  const cfg = LEVEL_CONFIG[Math.min(lvl, LEVEL_CONFIG.length) - 1];
  const cand = pickWordOfLength(cfg.wordLength, otherFirsts);
  if (cand) ship.words[slot] = cand;
}

// ----- Loop -----
let lastT = performance.now();
let paused = false;
// Joiner-side rendering: hydrate the latest snapshot into stub ship objects
// that have just enough shape for the existing draw() function to consume,
// temporarily swap the globals, render, then restore. This reuses the entire
// existing render pipeline without duplicating the draw code.
function drawFromSnapshot() {
  const state = NET.remoteState;
  if (!state) {
    // No snapshot yet — show a simple holding screen
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#00ffe0';
    ctx.font = '24px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('waiting for first snapshot...', W / 2, H / 2);
    return;
  }

  // Dead-reckon ship positions using velocity from the last snapshot.
  // Snapshots arrive at 20Hz but we render at 60fps; without this, ships
  // freeze for ~3 frames then jump, which reads as jitter. Clamp dtSnap so
  // a stalled connection doesn't fling ships across the map.
  const dtSnap = NET.remoteLastSeen
    ? Math.min(0.25, (performance.now() - NET.remoteLastSeen) / 1000)
    : 0;
  const wrapPos = (v, span) => ((v % span) + span) % span;

  // Build stub ships from snapshot. Each stub mimics the shape draw() expects.
  const stubs = state.ships.map(sh => ({
    id: sh.id,
    name: sh.n,
    x: wrapPos(sh.x + sh.vx * dtSnap, state.worldW),
    y: wrapPos(sh.y + sh.vy * dtSnap, state.worldH),
    vx: sh.vx, vy: sh.vy,
    score: sh.sc,
    alive: !!sh.al,
    size: sh.sz,
    baseSize: 36, maxSize: 90,
    lastDir: sh.ld || { x: 0, y: -1 },
    words: sh.ws || { up: '', down: '', left: '', right: '', fire: '' },
    color: sh.col,
    isPlayer: !!sh.ip,
    level: sh.lv || 1,
    activePowerup: sh.pu ? { key: sh.pu, expiresAt: performance.now() + (sh.puMs || 0), totalSec: sh.puTs || 0 } : null,
    shieldHP: sh.shp || 0,
    killShieldUntil: sh.ksU || 0,
    fireCooldown: 0,
    flashAt: 0,
    thrustAt: 0,
    actionPulseAt: 0,
    // Methods used during draw
    hitHalf() { return this.size * 0.5 - 4; },
    weaponColor() {
      if (this.activePowerup) {
        const def = POWERUP_DEFS[this.activePowerup.key];
        if (def && (def.type === 'weapon' || this.activePowerup.key === 'boost')) return def.color;
      }
      return this.color;
    },
    isKing() { return state.kingId === this.id; },
  }));

  // The joiner is the ship with id 'r' (set by host's init).
  const meStub = stubs.find(s => s.id === 'r');
  if (!meStub) {
    // Joiner ship not in snapshot yet — show holding screen
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#00ffe0';
    ctx.font = '24px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('connected — waiting for spawn...', W / 2, H / 2);
    return;
  }
  // Mark the joiner's stub as the local player so draw() centers on them
  // and treats them as the player ship for HUD/leaderboard etc.
  for (const s of stubs) s.isPlayer = (s.id === 'r');

  // Bullets: preserve isNuke/nukeRadius for proper rendering. Dead-reckon
  // position too — bullets travel ~520u/s so without this they step ~26u
  // per snapshot at 20Hz, which reads as visible jitter.
  const stubBullets = state.bullets.map(b => ({
    x: wrapPos(b.x + (b.vx || 0) * dtSnap, state.worldW),
    y: wrapPos(b.y + (b.vy || 0) * dtSnap, state.worldH),
    color: b.c, isKing: !!b.k, fx: b.fx, fy: b.fy,
    isNuke: !!b.nk, nukeRadius: b.nr || 0,
    isGiant: !!b.g, giantRadius: b.gr || 0,
  }));
  const stubPickups = state.pickups.map(p => ({
    x: p.x, y: p.y, key: p.k,
    expiresAt: p.exp || (performance.now() + 30000),
    bob: 0, rejectFlashAt: 0, rejectNeed: 0,
  }));
  const stubShockwaves = state.shockwaves.map(sw => ({
    x: sw.x, y: sw.y, radius: sw.r, maxRadius: sw.mr,
    life: sw.lf, maxLife: sw.ml, color: sw.c,
  }));
  const stubKing = stubs.find(s => s.id === state.kingId) || null;

  // Swap globals, render via the existing draw(), restore.
  const savedPlayer = player;
  const savedRemote = remotePlayer;
  const savedBots = bots;
  const savedBullets = bullets;
  const savedPickups = pickups;
  const savedShockwaves = shockwaves;
  const savedKing = king;
  const savedLevel = level;
  const savedWorldW = WORLD.w;
  const savedWorldH = WORLD.h;
  const savedFlash = flash;

  player = meStub;
  remotePlayer = null; // joiner doesn't track a separate remotePlayer; everyone else is in `bots` array for draw
  bots = stubs.filter(s => s.id !== 'r');
  bullets = stubBullets;
  pickups = stubPickups;
  shockwaves = stubShockwaves;
  king = stubKing;
  level = state.level;
  WORLD.w = state.worldW;
  WORLD.h = state.worldH;
  // Flash: snapshot carries a remaining-ms field. Rebuild flash.until on the
  // joiner's local clock so it expires correctly here.
  if (state.flash && state.flash.ms > 0) {
    flash = { color: state.flash.color, until: performance.now() + state.flash.ms };
  } else {
    flash = null;
  }

  try {
    draw();
    // Run the HUD update inside the swap so the leaderboard sees all the
    // ships (and updateHUD can read player.score / player.activePowerup etc).
    updateHUD();
    // Joiner doesn't run the host simulation loop, so the high-score check
    // never fires there otherwise — the leaderboard "all-time high" would
    // stay frozen at whatever was in local storage at boot. Run it here off
    // the swapped-in meStub so the joiner's local best tracks their score.
    maybeUpdateHighScore();
  } finally {
    player = savedPlayer;
    remotePlayer = savedRemote;
    bots = savedBots;
    bullets = savedBullets;
    pickups = savedPickups;
    shockwaves = savedShockwaves;
    king = savedKing;
    level = savedLevel;
    WORLD.w = savedWorldW;
    WORLD.h = savedWorldH;
    flash = savedFlash;
  }
}

function loop() {
  const now = performance.now();
  const dt = paused ? 0 : Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  // ---- JOINER MODE: skip simulation, render from latest snapshot ----
  if (NET.mode === 'joiner') {
    drawFromSnapshot();
    requestAnimationFrame(loop);
    return;
  }

  // ---- HOST or SOLO: run authoritative simulation ----
  if (!paused) {
    player.update(dt);
    if (remotePlayer) remotePlayer.update(dt);
    for (const b of bots) b.update(dt);

    // SPIKE — contact damage. Any SPIKE-active ship destroys others it
    // overlaps, except ships that are shielded (any shieldHP) or under
    // spawn/kill-shield invulnerability. Bypasses damage() so a shield is
    // *blocked* (not consumed) by spike contact, per the powerup's design.
    const allShipsForSpike = remotePlayer ? [player, remotePlayer, ...bots] : [player, ...bots];
    for (const a of allShipsForSpike) {
      if (!a.alive) continue;
      if (!(a.activePowerup && a.activePowerup.key === 'spike')) continue;
      for (const t of allShipsForSpike) {
        if (a === t || !t.alive) continue;
        if (t.shieldHP > 0) continue;
        if (performance.now() < t.killShieldUntil) continue;
        const dx = wrapDelta(a.x, t.x, WORLD.w);
        const dy = wrapDelta(a.y, t.y, WORLD.h);
        const minDist = a.hitHalf() + t.hitHalf();
        if (Math.abs(dx) < minDist && Math.abs(dy) < minDist) {
          spawnExplosion(t.x, t.y, '#c8cdd6', 28);
          t.die(a);
        }
      }
    }

    // bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) { bullets.splice(i, 1); continue; }
      if (b.x < 0) b.x += WORLD.w;
      if (b.x > WORLD.w) b.x -= WORLD.w;
      if (b.y < 0) b.y += WORLD.h;
      if (b.y > WORLD.h) b.y -= WORLD.h;

      // wrap-aware collision against all ships including remotePlayer
      const allShips = remotePlayer ? [player, remotePlayer, ...bots] : [player, ...bots];
      let removed = false;
      for (const s of allShips) {
        if (!s.alive || s === b.owner) continue;
        if (b.hits && b.hits.has(s.id)) continue;
        const dx = wrapDelta(b.x, s.x, WORLD.w);
        const dy = wrapDelta(b.y, s.y, WORLD.h);
        const hh = s.hitHalf();
        // Bullet contact size depends on type. GIANT and NUKE projectiles are
        // physically large; GIANT uses circular contact since it's a true disc.
        let contact, inRange;
        if (b.isNuke) {
          contact = hh + (b.nukeRadius || 14);
          inRange = Math.abs(dx) < contact && Math.abs(dy) < contact;
        } else if (b.isGiant) {
          contact = hh + (b.giantRadius || 20);
          inRange = Math.hypot(dx, dy) <= contact;
        } else {
          contact = hh;
          inRange = Math.abs(dx) < contact && Math.abs(dy) < contact;
        }
        if (inRange) {
          if (b.isNuke) {
            // NUKE detonation: spawn a large blast that damages every ship within radius.
            const blastR = b.nukeBlastRadius || 280;
            // Visual shockwave at the impact point
            shockwaves.push({
              x: b.x, y: b.y,
              radius: 0, maxRadius: blastR,
              life: 0.7, maxLife: 0.7,
              color: b.color,
            });
            // Damage every ship in radius (including the one we hit)
            for (const t of allShips) {
              if (!t.alive || t === b.owner) continue;
              const tdx = wrapDelta(b.x, t.x, WORLD.w);
              const tdy = wrapDelta(b.y, t.y, WORLD.h);
              if (Math.hypot(tdx, tdy) <= blastR + t.hitHalf()) {
                t.damage(b.owner);
                spawnExplosion(t.x, t.y, b.color, 14);
              }
            }
            // Red flash for the player if the blast intersects their viewport
            const pdx = wrapDelta(b.x, player.x, WORLD.w);
            const pdy = wrapDelta(b.y, player.y, WORLD.h);
            if (Math.abs(pdx) < W/2 + blastR && Math.abs(pdy) < H/2 + blastR) {
              flashScreen('#ff2030', 0.4);
            }
            bullets.splice(i, 1);
            removed = true;
            break;
          } else if (b.isGiant) {
            // Pierce: damage the target but keep flying. b.hits prevents
            // re-hitting the same ship on later frames.
            s.damage(b.owner);
            b.hits.add(s.id);
            // No splice/break — continue scanning remaining ships this frame
            // so the giant bullet can hit several at once if they're stacked.
          } else {
            s.damage(b.owner);
            bullets.splice(i, 1);
            removed = true;
            break;
          }
        }
      }
      if (removed) continue;
    }

    // shockwaves (visual expansion only — damage already applied at fire time)
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const sw = shockwaves[i];
      sw.life -= dt;
      sw.radius = (1 - sw.life / sw.maxLife) * sw.maxRadius;
      if (sw.life <= 0) shockwaves.splice(i, 1);
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Pickup expiration: 30s lifetime, flashes in last 5s
    for (let i = pickups.length - 1; i >= 0; i--) {
      if (performance.now() >= pickups[i].expiresAt) {
        pickups.splice(i, 1);
      }
    }

    // Pickup spawning: top up to MAX_PICKUPS on the map at a time.
    if (pickups.length < MAX_PICKUPS) {
      pickupTimer += dt;
      if (pickupTimer >= PICKUP_RESPAWN_DELAY) {
        pickupTimer = 0;
        spawnRandomPickup();
      }
    } else {
      pickupTimer = 0;
    }

    // KOTH — king accumulates 0.1 every 3 seconds (slow passive bonus)
    updateKing(dt);
    if (king) {
      kingTimer += dt;
      if (kingTimer >= 3) { kingTimer = 0; king.score = Math.round((king.score + 0.1) * 100) / 100; }
    }

    // High score check (covers kills, KOTH ticks, and any other score change)
    maybeUpdateHighScore();

    // Per-ship level progression: each ship advances when their own score
    // crosses their own personal level's threshold.
    const allShips = remotePlayer ? [player, remotePlayer, ...bots] : [player, ...bots];
    let topHumanLevelChanged = false;
    for (const s of allShips) {
      if (!s.alive) continue;
      while (s.level < LEVEL_CONFIG.length) {
        const cfg = LEVEL_CONFIG[s.level - 1];
        if (s.score >= cfg.scoreToAdvance) {
          s.level++;
          s.resetWords(); // new word length
          // If this was a human player who is now setting a new top-level,
          // recompute world size + show banner
          if (s.isPlayer) {
            if (s.level > level) topHumanLevelChanged = true;
            if (s === player) showLevelIntro(); // local player's level-up gets banner
          }
        } else break;
      }
    }
    if (topHumanLevelChanged) {
      applyWorldSizeForLevel();
    }
  }

  // Host: broadcast world snapshot to joiner (rate-limited inside the function)
  if (NET.mode === 'host') broadcastSnapshot();

  draw();
  updateHUD();
  requestAnimationFrame(loop);
}

function updateKing(dt) {
  let best = null;
  const allShips = remotePlayer ? [player, remotePlayer, ...bots] : [player, ...bots];
  for (const s of allShips) {
    if (!s.alive) continue;
    if (!best || s.score > best.score) best = s;
  }
  if (best && best.score > 0) king = best;
  else king = null;
}

function applyWorldSizeForLevel() {
  // World grows with the highest human player's personal level
  const humans = remotePlayer ? [player, remotePlayer] : [player];
  let topLevel = 1;
  for (const h of humans) if (h && h.level > topLevel) topLevel = h.level;
  level = topLevel; // keep the global `level` mirror in sync (used as a fallback in some places)
  const scale = 1 + WORLD_GROWTH_PER_LEVEL * (level - 1);
  WORLD.w = Math.round(BASE_WORLD.w * scale);
  WORLD.h = Math.round(BASE_WORLD.h * scale);
  // Ensure all entities are inside the new bounds (matters when shrinking)
  const allShips = remotePlayer ? [player, remotePlayer, ...bots] : [player, ...bots];
  for (const s of allShips) {
    if (!s) continue;
    s.x = ((s.x % WORLD.w) + WORLD.w) % WORLD.w;
    s.y = ((s.y % WORLD.h) + WORLD.h) % WORLD.h;
  }
  for (const p of pickups) {
    p.x = ((p.x % WORLD.w) + WORLD.w) % WORLD.w;
    p.y = ((p.y % WORLD.h) + WORLD.h) % WORLD.h;
  }
  // Maintain star density proportional to area
  const targetStars = Math.round(220 * scale * scale);
  while (stars.length < targetStars) {
    stars.push({
      x: Math.random() * WORLD.w,
      y: Math.random() * WORLD.h,
      r: Math.random() * 1.6 + 0.2,
      layer: Math.random() < 0.5 ? 0.4 : (Math.random() < 0.7 ? 0.7 : 1.0),
      twinkle: Math.random() * Math.PI * 2,
    });
  }
  // (Don't trim stars on shrink — extra stars don't hurt)
}

function onLevelUp() {
  for (const s of [player, ...bots]) s.resetWords();
  applyWorldSizeForLevel();
  showLevelIntro();
}

// startGame is the actual transition from lobby to playing.
let gameStarted = false;
function startGame() {
  if (gameStarted) return;
  gameStarted = true;
  init();
  audioInit();
  audioBootStart();
  loop();
}

// ----- Boot -----
async function boot() {
  loadHighScore();
  // Show loading overlay while we fetch the dictionary
  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.classList.add('show');
  const result = await loadDictionary();
  buildLevelConfig();
  if (loadingEl) {
    if (result.fallback) {
      loadingEl.querySelector('.loading-sub').textContent =
        'offline mode — using curated word list';
      await new Promise(r => setTimeout(r, 1200));
    }
    loadingEl.classList.remove('show');
  }
  // Show the lobby. Game starts when the user picks solo/host/join.
  showLobby();
}
boot();
