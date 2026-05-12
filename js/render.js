// ----- Drawing -----
function draw() {
  const cam = { x: player.x - W/2, y: player.y - H/2 };

  // bg gradient
  const grad = ctx.createRadialGradient(W/2, H/2, 80, W/2, H/2, Math.max(W,H));
  grad.addColorStop(0, '#0a0d18');
  grad.addColorStop(1, '#03040a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // ----- Camera zoom-out: scale world rendering down by VIEW_ZOOM so each
  // viewport reveals proportionally more world. Per-object cull margins below
  // are widened to account for the wider effective view (pre-scale virtual
  // coords span W*VIEW_ZOOM × H*VIEW_ZOOM, all clipped onto the W × H canvas).
  ctx.save();
  ctx.translate(W/2, H/2);
  ctx.scale(1 / VIEW_ZOOM, 1 / VIEW_ZOOM);
  ctx.translate(-W/2, -H/2);

  drawGrid(cam);

  for (const s of stars) {
    let sx = s.x - cam.x * s.layer;
    let sy = s.y - cam.y * s.layer;
    sx = ((sx % WORLD.w) + WORLD.w) % WORLD.w;
    sy = ((sy % WORLD.h) + WORLD.h) % WORLD.h;
    if (sx > W + 200 || sy > H + 200) continue;
    s.twinkle += 0.02;
    const alpha = 0.3 + Math.sin(s.twinkle) * 0.2 + s.layer * 0.4;
    ctx.fillStyle = `rgba(${200 + s.layer*55|0}, ${220 + s.layer*35|0}, 255, ${alpha})`;
    ctx.fillRect(sx, sy, s.r, s.r);
  }

  // pickups (drawn under bullets)
  for (const p of pickups) {
    const def = POWERUP_DEFS[p.key];
    const sxw = wrapDelta(cam.x + W/2, p.x, WORLD.w);
    const syw = wrapDelta(cam.y + H/2, p.y, WORLD.h);
    const sx = W/2 + sxw;
    const sy = H/2 + syw;
    if (sx < -240 || sx > W+240 || sy < -240 || sy > H+240) continue;
    p.bob += 0.04;
    const bob = Math.sin(p.bob) * 3;

    // Expiration blink — last 5 seconds, 5 visible flashes
    const remaining = p.expiresAt - performance.now();
    let blinkAlpha = 1;
    if (remaining < PICKUP_FLASH_WINDOW_MS) {
      // 5 flashes over 5000ms => 1000ms period. Use a square-ish wave.
      const phase = (PICKUP_FLASH_WINDOW_MS - remaining) % 1000;
      // ON for ~600ms, OFF for ~400ms
      blinkAlpha = phase < 600 ? 1 : 0.15;
    }
    ctx.globalAlpha = blinkAlpha;

    // pulse glow
    const pulse = 0.6 + Math.sin(performance.now()/250 + p.bob) * 0.3;
    ctx.fillStyle = def.color + '33';
    ctx.beginPath();
    ctx.arc(sx, sy + bob, 22 * pulse, 0, Math.PI*2);
    ctx.fill();

    // Emanating rings — two concentric hollow rings expanding outward and
    // fading as they grow. Each ring is offset in phase so they cascade gently.
    const RING_PERIOD_MS = 3000;
    const RING_MIN_R = 12;
    const RING_MAX_R = 50;
    const phaseOffsetMs = (p.bob * 1000) % RING_PERIOD_MS; // per-pickup variation
    for (let i = 0; i < 2; i++) {
      const phase = ((performance.now() + phaseOffsetMs + i * (RING_PERIOD_MS / 2)) % RING_PERIOD_MS) / RING_PERIOD_MS;
      const r = RING_MIN_R + (RING_MAX_R - RING_MIN_R) * phase;
      const ringAlpha = (1 - phase) * 0.55 * blinkAlpha;
      ctx.strokeStyle = def.color;
      ctx.globalAlpha = ringAlpha;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(sx, sy + bob, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = blinkAlpha; // restore for the orb itself

    ctx.fillStyle = def.color;
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(sx, sy + bob, 8, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // letter inside
    ctx.fillStyle = '#0a0d18';
    ctx.font = 'bold 12px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.name[0], sx, sy + bob + 1);

    // Price tag below the orb
    ctx.font = '14px JetBrains Mono, monospace';
    ctx.fillStyle = def.color;
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 6;
    const tierLabel = def.tier === 1 ? 'ANY LVL' : `LVL ${def.tier}+`;
    ctx.fillText(`${def.name} · ${tierLabel}`, sx, sy + bob + 24);
    ctx.shadowBlur = 0;

    // "NEED LEVEL N" rejection text — fades out
    if (p.rejectFlashAt) {
      const elapsed = performance.now() - p.rejectFlashAt;
      if (elapsed < 800) {
        const a = 1 - elapsed / 800;
        ctx.globalAlpha = a;
        ctx.fillStyle = '#ff2d6f';
        ctx.shadowColor = '#ff2d6f';
        ctx.shadowBlur = 8;
        ctx.font = 'bold 16px JetBrains Mono, monospace';
        ctx.fillText(`NEED LEVEL ${p.rejectNeed}`, sx, sy + bob - 28 - (1 - a) * 14);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }
    }
    ctx.globalAlpha = 1; // reset alpha after blink
  }

  // shockwaves (expanding rings)
  for (const sw of shockwaves) {
    const sxw = wrapDelta(cam.x + W/2, sw.x, WORLD.w);
    const syw = wrapDelta(cam.y + H/2, sw.y, WORLD.h);
    const sx = W/2 + sxw;
    const sy = H/2 + syw;
    if (sx < -400 || sx > W+400 || sy < -400 || sy > H+400) continue;
    const alpha = sw.life / sw.maxLife;
    ctx.strokeStyle = sw.color;
    ctx.shadowColor = sw.color;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 4;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(sx, sy, sw.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.globalAlpha = alpha * 0.6;
    ctx.beginPath();
    ctx.arc(sx, sy, sw.radius * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  // bullets
  for (const b of bullets) {
    // Per-viewer visibility: skip bullets whose fire origin was outside
    // the local viewport. Each client checks against its own camera/player.
    if (b.fx !== undefined && b.fy !== undefined && !isOnPlayerScreen(b.fx, b.fy)) continue;
    const sxw = wrapDelta(cam.x + W/2, b.x, WORLD.w);
    const syw = wrapDelta(cam.y + H/2, b.y, WORLD.h);
    const sx = W/2 + sxw;
    const sy = H/2 + syw;
    if (sx < -240 || sx > W+240 || sy < -240 || sy > H+240) continue;
    if (b.isNuke) {
      // Big pulsing orb with red-hot core. Hard to miss.
      const t = performance.now() / 100;
      const pulse = 1 + Math.sin(t) * 0.18;
      const r = (b.nukeRadius || 14) * pulse;
      // Outer halo
      ctx.fillStyle = b.color;
      ctx.globalAlpha = 0.25;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 28;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // Mid yellow body
      ctx.fillStyle = b.color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      // Red-hot inner core
      ctx.shadowColor = '#ff2030';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ff2030';
      ctx.beginPath();
      ctx.arc(sx, sy, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (b.isGiant) {
      const r = b.giantRadius || 20;
      // Soft outer halo
      ctx.fillStyle = b.color;
      ctx.globalAlpha = 0.18;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 1.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // Solid body
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      // Bright inner core
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.55;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (b.isKing) {
      ctx.fillStyle = 'rgba(255,210,63,0.3)';
      ctx.beginPath();
      ctx.arc(sx, sy, 9, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(sx, sy, 4.5, 0, Math.PI*2);
      ctx.fill();
    } else {
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.fillRect(sx-2.5, sy-2.5, 5, 5);
      ctx.shadowBlur = 0;
    }
  }

  // particles
  for (const p of particles) {
    const sxw = wrapDelta(cam.x + W/2, p.x, WORLD.w);
    const syw = wrapDelta(cam.y + H/2, p.y, WORLD.h);
    const sx = W/2 + sxw;
    const sy = H/2 + syw;
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(sx-p.r/2, sy-p.r/2, p.r, p.r);
    ctx.globalAlpha = 1;
  }

  // ships
  const renderList = remotePlayer ? [...bots, remotePlayer, player] : [...bots, player];
  for (const s of renderList) {
    if (!s.alive) continue;
    drawShip(s, cam);
  }

  // End of zoomed world rendering — flash overlay and minimap stay at 1:1
  // canvas coords so they remain crisp and edge-locked.
  ctx.restore();

  // flash overlay
  if (flash && performance.now() < flash.until) {
    const t = (flash.until - performance.now()) / 150;
    ctx.fillStyle = flash.color;
    ctx.globalAlpha = Math.max(0, Math.min(1, t)) * 0.4;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  drawMinimap();
}

function drawGrid(cam) {
  const step = 200;
  ctx.strokeStyle = 'rgba(0,255,224,0.04)';
  ctx.lineWidth = 1;
  const startX = -((cam.x % step) + step) % step;
  const startY = -((cam.y % step) + step) % step;
  ctx.beginPath();
  for (let x = startX; x < W; x += step) {
    ctx.moveTo(x, 0); ctx.lineTo(x, H);
  }
  for (let y = startY; y < H; y += step) {
    ctx.moveTo(0, y); ctx.lineTo(W, y);
  }
  ctx.stroke();
}

function drawShip(s, cam) {
  // wrap-aware screen position
  const dxw = wrapDelta(cam.x + W/2, s.x, WORLD.w);
  const dyw = wrapDelta(cam.y + H/2, s.y, WORLD.h);
  const sx = W/2 + dxw;
  const sy = H/2 + dyw;
  if (sx < -300 || sx > W+300 || sy < -300 || sy > H+300) return;

  const size = s.size;
  const half = size / 2;
  const isKingShip = (king && king.id === s.id);
  const flashed = (performance.now() - s.flashAt) < 120;
  const thrust = (performance.now() - s.thrustAt) < 200;

  // (Removed king aura halo — it looked like a defensive shield. The blinking
  // gold border and inner stroke alone communicate king status now.)

  // (Thrust glow trail removed — used to flash on the side opposite the thrust
  // direction, which read as confusing: pressing top made the bottom glow.)

  // PHANTOM: render the whole ship semi-transparent
  const isPhantomShip = s.activePowerup && s.activePowerup.key === 'phantom';
  if (isPhantomShip) ctx.globalAlpha = 0.4;

  // Ship body
  const bodyColor = flashed ? '#ffffff' : 'rgba(10,13,24,0.85)';
  ctx.fillStyle = bodyColor;
  ctx.fillRect(sx - half, sy - half, size, size);

  // Player-only inner pulse on successful thrust/aim/fire — brief flash that
  // confirms the action registered.
  if (s.isPlayer && s.actionPulseAt) {
    const elapsed = performance.now() - s.actionPulseAt;
    const PULSE_MS = 220;
    if (elapsed < PULSE_MS) {
      const t = 1 - elapsed / PULSE_MS; // 1 -> 0
      const alpha = t * 0.55;
      const inset = 4 + (1 - t) * (size * 0.15); // grows inward as it fades
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillRect(sx - half + inset, sy - half + inset, size - inset * 2, size - inset * 2);
    }
  }

  // Neon border. King's border BLINKS (alpha pulse) but with no glow halo,
  // so it doesn't get confused with a defensive shield effect.
  // Stealth ships get a very faint dim outline — barely visible against space.
  if (isKingShip) {
    const t = performance.now() / 400;
    const blink = 0.55 + Math.sin(t) * 0.45; // 0.10 → 1.00 alpha
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(255, 210, 63, ${blink})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(sx - half, sy - half, size, size);
    // Inner companion stroke for that "second skin" gold thickness
    ctx.strokeStyle = `rgba(255, 244, 194, ${blink * 0.7})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - half + 3, sy - half + 3, size - 6, size - 6);
  } else if (s.stealth) {
    // Stealth: only a very faint outline, no glow at all. Hard to spot.
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(180, 180, 195, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - half, sy - half, size, size);
  } else {
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx - half, sy - half, size, size);
    ctx.shadowBlur = 0;
  }

  if (isPhantomShip) ctx.globalAlpha = 1;

  // ----- Glowing fire-ready edge (dramatic — layered halo + crisp line) -----
  if (s.fireCooldown <= 0.01) {
    const wcol = s.weaponColor();
    const ep = 0.6 + Math.sin(performance.now()/130) * 0.4; // 0.2 → 1.0
    // Helper to draw the edge segment for the current lastDir
    const drawEdge = () => {
      ctx.beginPath();
      if (s.lastDir.x === 1) {
        ctx.moveTo(sx + half, sy - half);
        ctx.lineTo(sx + half, sy + half);
      } else if (s.lastDir.x === -1) {
        ctx.moveTo(sx - half, sy - half);
        ctx.lineTo(sx - half, sy + half);
      } else if (s.lastDir.y === -1) {
        ctx.moveTo(sx - half, sy - half);
        ctx.lineTo(sx + half, sy - half);
      } else if (s.lastDir.y === 1) {
        ctx.moveTo(sx - half, sy + half);
        ctx.lineTo(sx + half, sy + half);
      }
      ctx.stroke();
    };
    // Outer wide halo — soft, very glowy
    ctx.shadowColor = wcol;
    ctx.shadowBlur = 32;
    ctx.strokeStyle = wcol;
    ctx.lineWidth = 8;
    ctx.globalAlpha = ep * 0.55;
    drawEdge();
    // Mid stroke — solid color
    ctx.lineWidth = 4;
    ctx.globalAlpha = ep;
    drawEdge();
    // Inner crisp white-hot core for brightness
    ctx.shadowBlur = 14;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = ep * 0.9;
    drawEdge();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  // ----- Shield ring (from powerup purchase) -----
  if (s.shieldHP > 0) {
    ctx.strokeStyle = '#00ffe0';
    ctx.shadowColor = '#00ffe0';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7 + Math.sin(performance.now()/200) * 0.3;
    ctx.beginPath();
    ctx.arc(sx, sy, half + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  // ----- Kill-reward invulnerability shield (bright white, fades out near end) -----
  if (performance.now() < s.killShieldUntil) {
    const remainingMs = s.killShieldUntil - performance.now();
    const totalMs = 3000;
    const t = remainingMs / totalMs; // 1.0 -> 0.0
    const fade = t < 0.3 ? t / 0.3 : 1; // fade alpha in last 30% (~900ms)

    // Pulsing radius
    const pulse = Math.sin(performance.now() / 120) * 3;
    const r = half + 16 + pulse;

    // Outer soft glow halo
    const halo = ctx.createRadialGradient(sx, sy, half, sx, sy, r + 18);
    halo.addColorStop(0, `rgba(255,255,255,${0.0 * fade})`);
    halo.addColorStop(0.5, `rgba(255,255,255,${0.18 * fade})`);
    halo.addColorStop(1, `rgba(255,255,255,0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(sx, sy, r + 18, 0, Math.PI * 2);
    ctx.fill();

    // Bright crisp ring
    ctx.strokeStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 22;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = (0.85 + Math.sin(performance.now() / 100) * 0.15) * fade;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Inner thinner ring for depth
    ctx.strokeStyle = 'rgba(220,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6 * fade;
    ctx.beginPath();
    ctx.arc(sx, sy, r - 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  // (BOOST powerup trail removed — same reason as the thrust glow.
  // BOOST is still indicated via the HUD bar and the green firing-edge color.)

  // ----- Vampire aura (red pulsing glow) -----
  if (s.activePowerup && s.activePowerup.key === 'vampire') {
    const pulseV = 0.3 + Math.sin(performance.now() / 220) * 0.12;
    ctx.fillStyle = `rgba(255, 48, 80, ${pulseV})`;
    ctx.beginPath();
    ctx.arc(sx, sy, half + 14, 0, Math.PI * 2);
    ctx.fill();
  }

  // ----- Nuke aura (white-hot, intense, just a tease — fire to detonate) -----
  if (s.activePowerup && s.activePowerup.key === 'nuke') {
    const pulseN = 0.5 + Math.sin(performance.now() / 80) * 0.4;
    ctx.shadowColor = '#fff4c2';
    ctx.shadowBlur = 25;
    ctx.strokeStyle = `rgba(255, 244, 194, ${pulseN})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, sy, half + 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // ----- Multishot indicator (4 small dots at corners) -----
  if (s.activePowerup && s.activePowerup.key === 'multishot') {
    ctx.fillStyle = '#3aa0ff';
    ctx.shadowColor = '#3aa0ff';
    ctx.shadowBlur = 8;
    const pulseM = 2 + Math.sin(performance.now() / 200) * 1;
    ctx.beginPath(); ctx.arc(sx + half + 6, sy, pulseM, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx - half - 6, sy, pulseM, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx, sy + half + 6, pulseM, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx, sy - half - 6, pulseM, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // ----- Giant indicator (heavy pulsing ring — like a charging cannon) -----
  if (s.activePowerup && s.activePowerup.key === 'giant') {
    const pulseG = 0.5 + Math.sin(performance.now() / 240) * 0.4;
    ctx.shadowColor = '#ff9933';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = `rgba(255, 153, 51, ${pulseG})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, sy, half + 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // ----- Spike aura (8 triangular spikes around the ship) -----
  if (s.activePowerup && s.activePowerup.key === 'spike') {
    const spikeLen = 12 + Math.sin(performance.now() / 220) * 2;
    const baseHalf = 3.5;
    ctx.fillStyle = '#c8cdd6';
    ctx.strokeStyle = '#ffffff';
    ctx.shadowColor = '#c8cdd6';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const ang = i * (Math.PI / 4);
      const baseX = sx + Math.cos(ang) * half;
      const baseY = sy + Math.sin(ang) * half;
      const tipX = sx + Math.cos(ang) * (half + spikeLen);
      const tipY = sy + Math.sin(ang) * (half + spikeLen);
      const perp = ang + Math.PI / 2;
      const b1x = baseX + Math.cos(perp) * baseHalf;
      const b1y = baseY + Math.sin(perp) * baseHalf;
      const b2x = baseX - Math.cos(perp) * baseHalf;
      const b2y = baseY - Math.sin(perp) * baseHalf;
      ctx.beginPath();
      ctx.moveTo(b1x, b1y);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(b2x, b2y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  // ----- Multi-spread indicator (8 spokes — cardinals + diagonals) -----
  if (s.activePowerup && s.activePowerup.key === 'multispread') {
    ctx.fillStyle = '#7a4cff';
    ctx.shadowColor = '#7a4cff';
    ctx.shadowBlur = 10;
    const pulseMS = 2.5 + Math.sin(performance.now() / 180) * 1;
    for (let i = 0; i < 8; i++) {
      const ang = i * (Math.PI / 4);
      const ox = Math.cos(ang) * (half + 8);
      const oy = Math.sin(ang) * (half + 8);
      ctx.beginPath();
      ctx.arc(sx + ox, sy + oy, pulseMS, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  // Words on edges (font scales gently with ship size)
  const edgeFontSize = Math.max(14, Math.round(size * 0.30));
  ctx.font = `${edgeFontSize}px JetBrains Mono, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const w = s.words;
  const edgeColor = s.isPlayer ? '#e6f1ff' : 'rgba(230,241,255,0.7)';
  const fireColor = s.weaponColor();

  function drawEdgeWord(word, x, y, isFire=false) {
    if (s.isPlayer && typedBuffer && word.startsWith(typedBuffer)) {
      const typed = typedBuffer;
      const rest = word.slice(typed.length);
      const fullW = ctx.measureText(word).width;
      const typedW = ctx.measureText(typed).width;
      const startX = x - fullW/2;
      ctx.fillStyle = '#00ffe0';
      ctx.shadowColor = '#00ffe0';
      ctx.shadowBlur = 6;
      ctx.textAlign = 'left';
      ctx.fillText(typed, startX, y);
      ctx.fillStyle = isFire ? fireColor : edgeColor;
      ctx.shadowBlur = 0;
      ctx.fillText(rest, startX + typedW, y);
      ctx.textAlign = 'center';
    } else {
      ctx.fillStyle = isFire ? fireColor : edgeColor;
      ctx.fillText(word, x, y);
    }
  }

  // Directional words OUTSIDE the square
  drawEdgeWord(w.up, sx, sy - half - 10);
  drawEdgeWord(w.down, sx, sy + half + 10);
  drawEdgeWord(w.left, sx - half - 22, sy);
  drawEdgeWord(w.right, sx + half + 22, sy);

  // Fire word inside the square. For the player it's truly centered (no name below).
  // For bots, it sits slightly above to make room for the name+score line.
  if (s.isPlayer) {
    drawEdgeWord(w.fire, sx, sy, true);
  } else {
    drawEdgeWord(w.fire, sx, sy - 6, true);
    // Bots show just the name inside the square (score is on the leaderboard)
    const nameFontSize = Math.max(10, Math.round(size * 0.18));
    ctx.font = `${nameFontSize}px JetBrains Mono, monospace`;
    ctx.fillStyle = isKingShip ? '#ffd23f' : 'rgba(230,241,255,0.55)';
    ctx.fillText(s.name, sx, sy + half - nameFontSize * 0.8);
  }

  if (isKingShip) {
    ctx.font = '22px serif';
    ctx.fillText('👑', sx, sy - half - 28);
  }
}

function drawMinimap() {
  const mw = 200, mh = 150;
  const x = W - mw - 18;
  const y = H - mh - 18;
  ctx.fillStyle = 'rgba(5,6,10,0.75)';
  ctx.fillRect(x, y, mw, mh);
  ctx.strokeStyle = 'rgba(0,255,224,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x+0.5, y+0.5, mw-1, mh-1);
  ctx.fillStyle = 'rgba(107,122,153,0.9)';
  ctx.font = '12px JetBrains Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('// minimap', x+6, y+14);

  const sx = mw / WORLD.w;
  const sy = mh / WORLD.h;

  // pickups — drawn as small diamonds (rotated squares) with a pulsing ring
  // and a white center pip so they're clearly distinguishable from ship dots
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 280);
  for (const p of pickups) {
    const def = POWERUP_DEFS[p.key];
    const dx = x + p.x * sx;
    const dy = y + p.y * sy;
    // pulsing outer ring
    ctx.strokeStyle = def.color;
    ctx.globalAlpha = 0.35 + 0.45 * pulse;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(dx, dy, 4 + pulse * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // diamond shape
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.moveTo(dx, dy - 3);
    ctx.lineTo(dx + 3, dy);
    ctx.lineTo(dx, dy + 3);
    ctx.lineTo(dx - 3, dy);
    ctx.closePath();
    ctx.fill();
    // white center pip — high contrast against any color
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(dx - 0.5, dy - 0.5, 1, 1);
  }

  // bullets — tiny dots, only for projectiles fired by the local player so
  // you can track where your shots are going on the minimap.
  for (const b of bullets) {
    if (!b.owner || b.owner !== player) continue;
    const bx = x + b.x * sx;
    const by = y + b.y * sy;
    if (bx < x || bx > x + mw || by < y || by > y + mh) continue;
    ctx.fillStyle = b.color;
    ctx.fillRect(bx - 1, by - 1, 2, 2);
  }

  // ships
  const mmList = remotePlayer ? [...bots, remotePlayer, player] : [...bots, player];
  for (const s of mmList) {
    if (!s.alive) continue;
    const dx = x + s.x * sx;
    const dy = y + s.y * sy;
    const isKingShip = (king && king.id === s.id);
    const fill = isKingShip ? '#ffd23f' : s.color;
    if (s.isPlayer) {
      // Humans: filled square with a thin white outline. Local player slightly
      // larger than remote so you can always identify yourself at a glance.
      const half = s === player ? 4 : 3.5;
      ctx.fillStyle = fill;
      ctx.fillRect(dx - half, dy - half, half * 2, half * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1;
      ctx.strokeRect(dx - half, dy - half, half * 2, half * 2);
    } else {
      // Bots: small filled circle in ship color.
      const r = isKingShip ? 3 : 2;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(dx, dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // viewport rectangle (handles wrap by drawing up to 4 copies)
  const vw = W * sx;
  const vh = H * sy;
  const baseVX = (player.x - W/2);
  const baseVY = (player.y - H/2);
  ctx.strokeStyle = 'rgba(0,255,224,0.7)';
  ctx.lineWidth = 1;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, mw, mh);
  ctx.clip();
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      const vx = x + (baseVX + ox * WORLD.w) * sx;
      const vy = y + (baseVY + oy * WORLD.h) * sy;
      ctx.strokeRect(vx, vy, vw, vh);
    }
  }
  ctx.restore();
}

// ----- HUD -----
const levelText = document.getElementById('levelText');
const leaderboardEl = document.getElementById('leaderboard');
const powerupBox = document.getElementById('powerupBox');
const powerupLabel = document.getElementById('powerupLabel');
const powerupFill = document.getElementById('powerupFill');

function updateHUD() {
  // Show the local player's personal level (each ship has its own level)
  const myLevel = (player && player.level) || 1;
  const cfg = LEVEL_CONFIG[Math.min(myLevel, LEVEL_CONFIG.length) - 1];
  levelText.textContent = cfg.label;
  // Top-center shows the player's LIVE score.
  const myScore = (player && player.score) || 0;
  highscoreValueEl.textContent = fmtScoreSelf(myScore);
  // Glow effect when the live score is at-or-above the prior best — meaning
  // the player is currently sitting on a new high score.
  const beating = player && player.alive && myScore > 0 && myScore >= priorHighScore;
  highscoreEl.classList.toggle('beating', beating);
  // Persistent high score is included when leaderboard rebuilds below.

  // powerup box
  if (player.activePowerup) {
    const def = POWERUP_DEFS[player.activePowerup.key];
    const isShield = player.activePowerup.key === 'shield';
    powerupBox.classList.add('show');
    if (isShield) {
      // Shield is persistent until consumed
      powerupLabel.innerHTML = `<span style="color:${def.color}; text-shadow: 0 0 6px ${def.color}">▸ ${def.name}</span> · ready`;
      powerupFill.style.width = '100%';
    } else {
      const remain = (player.activePowerup.expiresAt - performance.now()) / 1000;
      const total = player.activePowerup.totalSec || def.duration;
      powerupLabel.innerHTML = `<span style="color:${def.color}; text-shadow: 0 0 6px ${def.color}">▸ ${def.name}</span> · ${remain.toFixed(1)}s`;
      powerupFill.style.width = Math.max(0, Math.min(100, (remain/total)*100)) + '%';
    }
    powerupFill.style.background = def.color;
    powerupFill.style.boxShadow = `0 0 8px ${def.color}`;
  } else {
    powerupBox.classList.remove('show');
  }

  // All ships for leaderboard: include remotePlayer (in host mode) alongside player + bots
  const allShips = remotePlayer ? [player, remotePlayer, ...bots] : [player, ...bots];
  const ships = allShips.slice().sort((a,b) => b.score - a.score);
  // Rebuild the whole leaderboard, including the high-row at the top.
  let html = `
    <div class="high-row">
      <span class="high-label">// all-time high</span>
      <span class="high-value">${fmtScore(highScore)}</span>
    </div>
    <h3>// leaderboard</h3>
  `;
  for (const s of ships) {
    const cls = [];
    if (king && king.id === s.id) cls.push('king');
    if (s.isPlayer) cls.push('you');
    if (!s.alive) cls.push('dead');
    const crown = (king && king.id === s.id) ? '👑 ' : '';
    const isKingOrYou = cls.includes('king') || cls.includes('you');
    let textColor = s.color;
    if (s.stealth) textColor = '#aab';
    const styleAttr = isKingOrYou ? '' : ` style="color:${textColor}; text-shadow: 0 0 6px ${textColor}80"`;
    html += `<div class="row ${cls.join(' ')}"${styleAttr}>${crown}${s.name} · ${fmtScore(s.score)}</div>`;
  }
  leaderboardEl.innerHTML = html;
}

// ----- Banner -----
const banner = document.getElementById('banner');
const bannerBig = document.getElementById('bannerBig');
const bannerSmall = document.getElementById('bannerSmall');
function showBanner(big, small) {
  bannerBig.textContent = big;
  bannerSmall.textContent = small;
  banner.classList.add('show');
  setTimeout(() => banner.classList.remove('show'), 2200);
}

// ----- Level intro toast (non-blocking, bottom of screen, auto-dismiss) -----
const intro = document.getElementById('intro');
const introLevelTag = document.getElementById('introLevelTag');
const introTitle = document.getElementById('introTitle');
const introPwDesc = document.getElementById('introPwDesc');
let introHideTimer = null;

function showLevelIntro() {
  const playerLevel = (player && player.level) || 1;
  const idx = Math.min(playerLevel, LEVEL_CONFIG.length) - 1;
  const cfg = LEVEL_CONFIG[idx];
  introLevelTag.textContent = `LEVEL ${cfg.n}`;
  const t = cfg.label.split('—')[1] || cfg.label;
  introTitle.textContent = t.trim();
  introPwDesc.textContent = cfg.sub;
  intro.classList.add('show');
  if (introHideTimer) clearTimeout(introHideTimer);
  introHideTimer = setTimeout(() => intro.classList.remove('show'), 3500);
  // Grant 3-second spawn invulnerability ONLY to the player who leveled up
  // (the local player here). Other ships keep their own state.
  if (player && player.alive) {
    const now = performance.now();
    const grantUntil = now + 3000;
    if (grantUntil > player.killShieldUntil) player.killShieldUntil = grantUntil;
  }
}

// Kept as a no-op alias for back-compat in case anything else calls it
function hideLevelIntro() {
  intro.classList.remove('show');
  if (introHideTimer) { clearTimeout(introHideTimer); introHideTimer = null; }
}

// ----- Death overlay -----
const death = document.getElementById('death');
const respawnText = document.getElementById('respawnText');
const runStatsEl = document.getElementById('runStats');
let respawnInterval = null;
function showDeath(lostScore = 0, lostLevel = 1) {
  death.classList.add('show');
  // Show how much was lost — bigger numbers feel more punishing
  const reachedHigh = lostScore > 0 && lostScore >= highScore;
  if (reachedHigh) {
    runStatsEl.innerHTML = `you reached <span class="lost">${fmtScore(lostScore)}</span> · level ${lostLevel} — new high score`;
  } else {
    runStatsEl.innerHTML = `<span class="lost">${fmtScore(lostScore)}</span> points lost · level ${lostLevel}`;
  }
  let t = 3;
  respawnText.textContent = `new run in ${t}...`;
  clearInterval(respawnInterval);
  respawnInterval = setInterval(() => {
    t--;
    if (t <= 0) { clearInterval(respawnInterval); return; }
    respawnText.textContent = `new run in ${t}...`;
  }, 1000);
}
function hideDeath() {
  death.classList.remove('show');
  clearInterval(respawnInterval);
}

// ----- High Score (persisted) -----
const HIGHSCORE_KEY = 'wordsteroids:highscore';
let highScore = 0;
let priorHighScore = 0; // captured at game start / after death — basis for "actively beating it"
const highscoreEl = document.getElementById('highscore');
const highscoreValueEl = document.getElementById('highscoreValue');

async function loadHighScore() {
  try {
    if (typeof window.storage === 'undefined') return;
    const result = await window.storage.get(HIGHSCORE_KEY);
    if (result && result.value) {
      const parsed = parseFloat(result.value);
      if (!isNaN(parsed)) highScore = parsed;
    }
  } catch (e) {
    // Key doesn't exist yet, or storage unavailable — start at 0
  }
  priorHighScore = highScore;
}

async function saveHighScore() {
  try {
    if (typeof window.storage === 'undefined') return;
    await window.storage.set(HIGHSCORE_KEY, String(highScore));
  } catch (e) {
    // Storage unavailable — score is in-memory only this session
  }
}

function maybeUpdateHighScore() {
  if (player.score > highScore) {
    highScore = player.score;
    // Trigger celebration pulse on the live score display
    highscoreEl.classList.remove('beat');
    void highscoreEl.offsetWidth; // restart animation
    highscoreEl.classList.add('beat');
    saveHighScore();
  }
}
