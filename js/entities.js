// ----- Ship -----
class Ship {
  constructor(opts) {
    this.id = opts.id;
    this.name = opts.name;
    this.isPlayer = !!opts.isPlayer;
    this.x = opts.x; this.y = opts.y;
    this.vx = (Math.random() - 0.5) * 60;
    this.vy = (Math.random() - 0.5) * 60;
    this.color = opts.color;
    this.score = 0;
    this.alive = true;
    this.respawnAt = 0;
    this.lastDir = { x: 1, y: 0 };
    // Size grows with score (roguelike: bigger = easier to hit)
    this.baseSize = 36;
    this.maxSize = 90;
    this.size = this.baseSize;
    this.level = 1; // personal level — each ship advances independently based on its own score
    this.words = pickShipWords(this.level);
    this.botCooldown = 0.5 + Math.random() * 1.5; // initial idle so bots don't all fire at boot
    this.fireCooldown = 0;
    this.flashAt = 0;
    this.thrustAt = 0;
    this.actionPulseAt = 0; // brief inner-square pulse on any successful action
    this.braking = false; // when true, ship rapidly decelerates (spacebar for player, AI for bots)
    // Powerup state
    this.activePowerup = null; // { key, expiresAt }
    this.shieldHP = 0; // shield consumes a hit
    // Spawn invulnerability — 3 seconds so you can orient before getting shot
    this.killShieldUntil = performance.now() + 3000;
  }

  // Awarded on each completed action word: 0.02 score per letter.
  // Partial typing earns nothing (callers only invoke this on completion).
  creditCorrectLetters(n) {
    this.score = Math.round((this.score + n * 0.02) * 100) / 100;
  }

  isKing() { return king && king.id === this.id; }
  resetWords() {
    this.words = pickShipWords(this.level);
    if (this.isPlayer) typedBuffer = '';
  }

  // Returns weapon color for the firing edge & bullets
  weaponColor() {
    if (this.isKing()) return '#ffd23f';
    if (this.activePowerup) {
      const def = POWERUP_DEFS[this.activePowerup.key];
      if (def.type === 'weapon') return def.color;
    }
    // Stealth ships have near-black hulls but their bullets are visible (a dim purple-red),
    // since invisible bullets would be unfair.
    if (this.stealth) return '#9a8aa0';
    return this.color === '#00ffe0' ? '#ff2d6f' : this.color; // player's default weapon = pink
  }

  // Effective hitbox half-size = the visible square. (Hitbox always matches the ship.)
  hitHalf() {
    return this.size / 2;
  }

  applyPowerup(key) {
    const def = POWERUP_DEFS[key];
    if (key === 'shield') {
      // SHIELD stacks with any other active powerup. It only sets shieldHP
      // (absorbs one hit, persists until consumed) and never touches activePowerup.
      this.shieldHP = Math.max(this.shieldHP, 1);
      return;
    }
    // Duration scales with the firer's personal level: 10s per level.
    // Level 1 = 10s, level 3 = 30s (the old default), level 10 = 100s.
    // Snapshot the total so the HUD bar uses the same value even if the
    // ship levels up mid-effect.
    const totalSec = this.level * 10;
    this.activePowerup = {
      key,
      expiresAt: performance.now() + totalSec * 1000,
      totalSec,
    };
  }

  damage(byShip) {
    if (!this.alive) return false;
    // Kill-reward invulnerability — bullets pass right through, no shield consumed
    if (performance.now() < this.killShieldUntil) {
      // small flicker on the kill-shield to show the deflection
      spawnExplosion(this.x, this.y, '#ffd23f', 6);
      return false;
    }
    if (this.shieldHP > 0) {
      this.shieldHP -= 1;
      this.flashAt = performance.now();
      // small particle puff in cyan
      spawnExplosion(this.x, this.y, '#00ffe0', 12);
      return false; // damage absorbed
    }
    this.die(byShip);
    return true;
  }

  die(byShip) {
    this.alive = false;
    this.respawnAt = performance.now() + 3000;
    if (byShip) {
      // Regicide bounty: killing the king is worth 5 points instead of 1.
      const wasKing = king && king.id === this.id;
      byShip.score += wasKing ? 5 : 1;
      const isVampire = byShip.activePowerup && byShip.activePowerup.key === 'vampire';
      if (isVampire) {
        // VAMPIRE: replaces the standard white kill-shield with a cyan one.
        // Cyan = no time limit, but breaks after one hit. Also resets fire
        // cooldown so vampires can chain kills.
        byShip.shieldHP = Math.max(byShip.shieldHP, 1);
        byShip.fireCooldown = 0;
      } else {
        // Standard kill-reward: 3-second white invulnerability.
        byShip.killShieldUntil = performance.now() + 3000;
      }
    }
    spawnExplosion(this.x, this.y, this.stealth ? '#888' : this.color, 24);
    const lostScore = this.score;
    const lostLevel = this.level;
    // Death overlay only fires for the local player (not the remote/joiner
    // ship, which is also marked isPlayer:true on the host for scoring purposes).
    if (this === player) showDeath(lostScore, lostLevel);
    if (king && king.id === this.id) king = null;
    // Drop active powerup as a pickup at death location, if any
    if (this.activePowerup && POWERUP_DEFS[this.activePowerup.key]) {
      pickups.push(makePickup(this.x, this.y, this.activePowerup.key));
    }
    this.activePowerup = null;
    this.shieldHP = 0;
    // Roguelike: dying wipes your run. Score AND personal level reset.
    this.score = 0;
    this.level = 1;
    this.resetWords(); // pull fresh level-1 words
    if (this.isPlayer) {
      // Update the "what to beat" baseline so the active-beating stars only
      // light up once this new run surpasses our session's best so far.
      priorHighScore = highScore;
    }
    // Recompute world size in case the highest-level human changed
    applyWorldSizeForLevel();
  }

  respawn() {
    this.alive = true;
    this.x = Math.random() * (WORLD.w - 400) + 200;
    this.y = Math.random() * (WORLD.h - 400) + 200;
    this.vx = (Math.random() - 0.5) * 60;
    this.vy = (Math.random() - 0.5) * 60;
    this.size = this.baseSize; // shrink back to small
    this.braking = false; // start fresh, not braking
    // 3-second spawn invulnerability so you don't get instakilled appearing
    this.killShieldUntil = performance.now() + 3000;
    this.resetWords();
    if (this === player) hideDeath();
  }

  thrust(dx, dy) {
    const boosted = this.activePowerup && this.activePowerup.key === 'boost';
    // BOOST doubles the per-thrust impulse (110 → 220). On top of that, the
    // base impulse grows ~5% per personal level so high-level ships feel
    // snappier. Safety speed ceiling below is the same for everyone.
    const levelScale = 1 + Math.max(0, (this.level || 1) - 1) * 0.05;
    const speed = (boosted ? 220 : 110) * levelScale;
    this.vx += dx * speed;
    this.vy += dy * speed;
    // High safety ceiling: only here to prevent ships from teleporting through
    // each other (collision check would miss if movement-per-frame > ship size).
    // At 60fps, 1800 px/s = 30 px/frame, well under typical ship size of ~50px.
    const cap = 1800;
    const m = Math.hypot(this.vx, this.vy);
    if (m > cap) { this.vx = this.vx / m * cap; this.vy = this.vy / m * cap; }
    this.lastDir = { x: dx, y: dy };
    this.thrustAt = performance.now();
    if (this.isPlayer) this.actionPulseAt = performance.now();
  }

  // Change facing/firing direction without applying thrust (shift+word).
  aim(dx, dy) {
    this.lastDir = { x: dx, y: dy };
    this.thrustAt = performance.now(); // reuse the thrust glow for the brief edge highlight
    if (this.isPlayer) this.actionPulseAt = performance.now();
  }

  fire() {
    if (this.fireCooldown > 0) return;
    if (this.isPlayer) this.actionPulseAt = performance.now();
    const isKing = this.isKing();
    const apk = this.activePowerup ? this.activePowerup.key : null;
    const isSpread = apk === 'spread';
    const isBlast = apk === 'blast';
    const isMulti = apk === 'multishot';
    const isNuke = apk === 'nuke';
    const isGiant = apk === 'giant';
    const isMultiSpread = apk === 'multispread';
    const baseColor = this.weaponColor();

    if (isNuke) {
      // Long cooldown so it's not spam.
      this.fireCooldown = 1.2;
      // Fire a single large slow nuke projectile in lastDir.
      // It explodes on hit with a wide circular blast (smaller than the old
      // screen-clear nuke, but still very large).
      const nukeAngle = Math.atan2(this.lastDir.y, this.lastDir.x);
      const nukeSpeed = 460; // slower than normal bullets so it's dodgeable
      const nukeBullet = {
        x: this.x, y: this.y,
        vx: Math.cos(nukeAngle) * nukeSpeed,
        vy: Math.sin(nukeAngle) * nukeSpeed,
        owner: this,
        life: 2.4, // longer lifetime so it can travel further
        color: baseColor,
        isKing,
        hits: new Set(),
        fx: this.x, fy: this.y, // fire origin for per-viewer visibility check
        isNuke: true,            // marks it for the special render & explode logic
        nukeRadius: 14,           // big visual size
        nukeBlastRadius: 280,     // smaller than the old 9999 screen-clearer
      };
      bullets.push(nukeBullet);
      return;
    }

    if (isGiant) {
      // Ship-sized projectile that pierces (each target hit at most once).
      // Diameter = current ship size, scaled up further by player level past 3.
      this.fireCooldown = 0.6;
      const giantAngle = Math.atan2(this.lastDir.y, this.lastDir.x);
      const giantSpeed = 280; // slower than normal bullets (520) — big and lumbering
      const levelScale = 1 + Math.max(0, this.level - 3) * 0.08;
      bullets.push({
        x: this.x, y: this.y,
        vx: Math.cos(giantAngle) * giantSpeed,
        vy: Math.sin(giantAngle) * giantSpeed,
        owner: this,
        life: 2.2,
        color: baseColor,
        isKing,
        hits: new Set(),
        fx: this.x, fy: this.y,
        isGiant: true,
        giantRadius: this.size * 0.5 * levelScale,
      });
      return;
    }

    if (isBlast) {
      // Omnidirectional shockwave. Radius scales with the firer's personal
      // level so high-level players get a meaningfully wider blast.
      this.fireCooldown = 0.45;
      const radius = Math.min(420, 180 + 25 * ((this.level || 1) - 1));
      const targets = remotePlayer ? [player, remotePlayer, ...bots] : [player, ...bots];
      for (const s of targets) {
        if (!s.alive || s === this) continue;
        const dx = wrapDelta(this.x, s.x, WORLD.w);
        const dy = wrapDelta(this.y, s.y, WORLD.h);
        if (Math.hypot(dx, dy) <= radius + s.hitHalf()) {
          s.damage(this);
        }
      }
      shockwaves.push({
        x: this.x, y: this.y,
        radius: 0, maxRadius: radius,
        life: 0.4, maxLife: 0.4,
        color: baseColor,
      });
      return;
    }

    this.fireCooldown = 0.25;
    const speed = 520;
    const dirAngle = Math.atan2(this.lastDir.y, this.lastDir.x);

    function makeBullet(angle, owner) {
      return {
        x: owner.x, y: owner.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        owner,
        life: 1.6,
        color: baseColor,
        isKing,
        hits: new Set(),
        // Fire origin — used by each client to decide visibility on its own viewport.
        fx: owner.x, fy: owner.y,
      };
    }

    if (isMultiSpread) {
      // 3-bullet spread in each of 4 cardinal directions = 12 bullets
      const cardinals = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
      for (const a of cardinals) {
        bullets.push(makeBullet(a - 0.25, this));
        bullets.push(makeBullet(a, this));
        bullets.push(makeBullet(a + 0.25, this));
      }
    } else if (isMulti) {
      // Fire from all 4 cardinal directions at once
      bullets.push(makeBullet(0, this));
      bullets.push(makeBullet(Math.PI / 2, this));
      bullets.push(makeBullet(Math.PI, this));
      bullets.push(makeBullet(-Math.PI / 2, this));
    } else if (isSpread) {
      bullets.push(makeBullet(dirAngle - 0.25, this));
      bullets.push(makeBullet(dirAngle, this));
      bullets.push(makeBullet(dirAngle + 0.25, this));
    } else {
      bullets.push(makeBullet(dirAngle, this));
    }

    // (Muzzle flash removed — was producing a visible "blast" behind every
    // shot. The bullet itself is the visual indicator now.)
  }

  update(dt) {
    // Update size based on current score (roguelike: bigger target as you climb)
    this.size = sizeForScore(this.score, this.baseSize, this.maxSize);

    if (!this.alive) {
      if (performance.now() >= this.respawnAt) this.respawn();
      return;
    }
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    // expire powerup. The cyan shield (shieldHP) is intentionally NOT cleared
    // here — it lasts until consumed by a hit, independent of any activePowerup.
    if (this.activePowerup && performance.now() >= this.activePowerup.expiresAt) {
      this.activePowerup = null;
    }

    // Space physics: very gentle ambient drag (~8%/sec) plus a strong brake
    // when actively braking. Player brakes by holding spacebar; bots may decide
    // to brake via their AI.
    if (this.braking) {
      const brake = 0.90;
      this.vx *= brake;
      this.vy *= brake;
      if (Math.abs(this.vx) < 1) this.vx = 0;
      if (Math.abs(this.vy) < 1) this.vy = 0;
    } else {
      // Ambient drag — ~20% velocity loss per second. Frame-rate independent.
      // Ships still coast meaningfully but slow to a near-stop within a few seconds.
      const decayPerSec = 0.80;
      const decay = Math.pow(decayPerSec, dt);
      this.vx *= decay;
      this.vy *= decay;
      if (Math.abs(this.vx) < 0.5) this.vx = 0;
      if (Math.abs(this.vy) < 0.5) this.vy = 0;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < 0) this.x += WORLD.w;
    if (this.x > WORLD.w) this.x -= WORLD.w;
    if (this.y < 0) this.y += WORLD.h;
    if (this.y > WORLD.h) this.y -= WORLD.h;

    // Pickup gating (wrap-aware). Free to take, but you must be at least
    // tier-level to collect (tier 1 = any level, tier 2 = level 2+, etc).
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      const dx = wrapDelta(this.x, p.x, WORLD.w);
      const dy = wrapDelta(this.y, p.y, WORLD.h);
      if (Math.abs(dx) < this.size/2 + 16 && Math.abs(dy) < this.size/2 + 16) {
        const def = POWERUP_DEFS[p.key];
        const need = def.tier;
        if (this.level >= need) {
          this.applyPowerup(p.key);
          // Remember where it was collected so the next spawn can be far away
          lastPickupLocation = { x: p.x, y: p.y };
          pickups.splice(i, 1);
          if (this === player) flashScreen(def.color, 0.2);
        } else if (this === player) {
          // floating "NEED LEVEL N" text
          if (!p.rejectFlashAt || performance.now() - p.rejectFlashAt > 800) {
            p.rejectFlashAt = performance.now();
            p.rejectNeed = need;
          }
        }
      }
    }

    // Bot AI — difficulty scales with level
    if (!this.isPlayer) {
      const isSpeedy = this.botType === 'speedy';
      // Auto-brake when bot speed exceeds a threshold. Bots can't hold a key,
      // so this gives them a poor-man's deceleration: when going too fast, they
      // brake until they're under control again.
      // Threshold scales with level: bots are slow at L1, faster at high levels.
      // SPEEDY never brakes — it just accumulates velocity. Wheeeee.
      if (!isSpeedy) {
        const speedSq = this.vx * this.vx + this.vy * this.vy;
        const BRAKE_THRESHOLD = Math.min(900, 150 + (this.level - 1) * 40); // L1=150, L10=510, L20=900 cap
        if (speedSq > BRAKE_THRESHOLD * BRAKE_THRESHOLD) {
          this.braking = true;
        } else if (speedSq < (BRAKE_THRESHOLD * 0.5) * (BRAKE_THRESHOLD * 0.5)) {
          this.braking = false;
        }
      } else {
        this.braking = false;
      }

      this.botCooldown -= dt;
      if (this.botCooldown <= 0) {
        const lvl = this.level;
        const t = 1 - Math.pow(0.80, Math.max(0, lvl - 1));
        const minInterval = Math.max(0.35, 1.8 - t * 1.5);
        const intervalRange = Math.max(0.5, 1.4 - t * 0.95);
        const actionInterval = minInterval + Math.random() * intervalRange;
        const aimChance = 0.65 + t * 0.33; // 0.65 → 0.98
        const fireChance = 0.40 + t * 0.20;
        // Leader-bias uses the GLOBAL level (heat of the match) so even
        // fresh-respawned level-1 bots will hunt the leader. Combined with
        // a minimum floor so bots always have SOME tendency to target.
        const globalT = 1 - Math.pow(0.80, Math.max(0, level - 1));
        const leaderBias = Math.max(0.35, Math.min(0.85, globalT * 0.95));
        this.botCooldown = actionInterval;

        if (Math.random() < fireChance) {
          this.fire();
          // Bot "types" the fire word — credit its letters before resetWords replaces it
          if (this.words && this.words.fire) this.creditCorrectLetters(this.words.fire.length);
          this.resetWords();
        } else {
          let target = null;
          if (Math.random() < aimChance) target = pickHostileTarget(this, leaderBias);
          // Build the allowed cardinal directions. SPEEDY excludes the direction
          // opposite its current dominant motion — it never wants to slow itself
          // down. Other bots have all 4 directions available.
          let cardinals = [[1,0],[-1,0],[0,1],[0,-1]];
          if (isSpeedy) {
            // Determine dominant motion axis and forbid its reverse
            const speedSq2 = this.vx * this.vx + this.vy * this.vy;
            if (speedSq2 > 30 * 30) { // only filter if moving meaningfully
              const ax = Math.abs(this.vx), ay = Math.abs(this.vy);
              let forbiddenX = 0, forbiddenY = 0;
              if (ax >= ay) forbiddenX = this.vx > 0 ? -1 : 1; // moving east → forbid west, etc.
              else          forbiddenY = this.vy > 0 ? -1 : 1;
              cardinals = cardinals.filter(c => !(c[0] === forbiddenX && c[1] === forbiddenY));
            }
          }
          let dx, dy;
          if (target) {
            const tdx = wrapDelta(this.x, target.x, WORLD.w);
            const tdy = wrapDelta(this.y, target.y, WORLD.h);
            const ang = Math.atan2(tdy, tdx);
            cardinals.sort((a,b) => {
              const da = Math.acos(Math.max(-1, Math.min(1, a[0]*Math.cos(ang) + a[1]*Math.sin(ang))));
              const db = Math.acos(Math.max(-1, Math.min(1, b[0]*Math.cos(ang) + b[1]*Math.sin(ang))));
              return da - db;
            });
            [dx, dy] = cardinals[0];
          } else {
            [dx, dy] = randFrom(cardinals);
          }
          this.thrust(dx, dy);
          // Credit the directional word the bot just "typed"
          const slot = dx === -1 ? 'left' : dx === 1 ? 'right' : dy === -1 ? 'up' : 'down';
          if (this.words && this.words[slot]) this.creditCorrectLetters(this.words[slot].length);
          this.resetWords();
        }
      }
    }
  }
}

// ----- Pickups -----
const PICKUP_LIFETIME_MS = 30000; // 30 seconds before despawn
const PICKUP_FLASH_WINDOW_MS = 5000; // last 5 seconds: flash 5 times

function makePickup(x, y, key) {
  return {
    x, y, key,
    born: performance.now(),
    expiresAt: performance.now() + PICKUP_LIFETIME_MS,
    bob: Math.random() * Math.PI * 2,
  };
}

let pickups = [];
let lastPickupLocation = null; // {x, y} of the last collected pickup
const MIN_SPAWN_DISTANCE = 1200; // wrap-aware min distance from last pickup

function spawnRandomPickup() {
  const allKeys = Object.keys(POWERUP_DEFS);
  // Determine if a tier-1 pickup is already on the map. If not, this spawn
  // must be tier 1 so beginners always have an accessible powerup available.
  const hasTier1 = pickups.some(p => POWERUP_DEFS[p.key] && POWERUP_DEFS[p.key].tier === 1);
  let candidates = allKeys;
  if (!hasTier1) {
    candidates = allKeys.filter(k => POWERUP_DEFS[k].tier === 1);
  }
  const key = randFrom(candidates);
  // Pick a location far from the previously collected pickup (if any)
  let x, y;
  let attempts = 0;
  while (attempts++ < 30) {
    x = Math.random() * WORLD.w;
    y = Math.random() * WORLD.h;
    if (!lastPickupLocation) break;
    const dx = wrapDelta(lastPickupLocation.x, x, WORLD.w);
    const dy = wrapDelta(lastPickupLocation.y, y, WORLD.h);
    if (Math.hypot(dx, dy) >= MIN_SPAWN_DISTANCE) break;
  }
  pickups.push(makePickup(x, y, key));
}
let pickupTimer = 0;
const PICKUP_RESPAWN_DELAY = 4; // seconds after one is collected before next appears
const MAX_PICKUPS = 3;
