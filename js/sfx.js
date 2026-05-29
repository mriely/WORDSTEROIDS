// ============================================================
// SFX — Atari-style synthesized sound effects via Web Audio
// ============================================================
// All sounds are generated live: square / sawtooth oscillators with linear
// pitch sweeps and white-noise bursts through a lowpass filter. Nothing is
// pre-recorded — keeps the bundle small and lets each sound react to game
// state (e.g. fire pitch shifting with player level later if we want).
//
// Lazy init: AudioContext is created on first call. Browsers require a
// user gesture to start audio output, so the keydown handler kicks it off.

let sfxCtx = null;
let sfxMaster = null;
let sfxMuted = false;
const SFX_MASTER_VOLUME = 0.18; // sits under music; tweak here if too hot

function sfxInit() {
  if (sfxCtx) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    sfxCtx = new Ctx();
    sfxMaster = sfxCtx.createGain();
    sfxMaster.gain.value = SFX_MASTER_VOLUME;
    sfxMaster.connect(sfxCtx.destination);
  } catch (e) {
    console.warn('SFX: Web Audio unavailable:', e);
  }
}

function sfxResume() {
  if (sfxCtx && sfxCtx.state === 'suspended') sfxCtx.resume();
}

function sfxToggleMute() {
  sfxMuted = !sfxMuted;
}

// Building block: one short oscillator note with optional pitch sweep and a
// simple attack/release envelope. type defaults to 'square' — the Atari
// signature waveform.
function sfxTone({
  freq,
  freqEnd = null,
  type = 'square',
  duration = 0.12,
  attack = 0.004,
  release = 0.04,
  gain = 0.6,
  delay = 0,
}) {
  if (!sfxCtx || sfxMuted) return;
  const t0 = sfxCtx.currentTime + delay;
  const osc = sfxCtx.createOscillator();
  const env = sfxCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== null) {
    // exponentialRampToValueAtTime can't take 0; clamp to >0
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + duration);
  }
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(gain, t0 + attack);
  const sustainEnd = Math.max(t0 + attack, t0 + duration - release);
  env.gain.setValueAtTime(gain, sustainEnd);
  env.gain.linearRampToValueAtTime(0, t0 + duration);
  osc.connect(env);
  env.connect(sfxMaster);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// White-noise burst through a lowpass filter — used for explosion/hit sounds.
function sfxNoise({ duration = 0.25, gain = 0.5, lowpass = 1800, delay = 0 }) {
  if (!sfxCtx || sfxMuted) return;
  const t0 = sfxCtx.currentTime + delay;
  const bufLen = Math.max(1, Math.floor(sfxCtx.sampleRate * duration));
  const buf = sfxCtx.createBuffer(1, bufLen, sfxCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
  const src = sfxCtx.createBufferSource();
  src.buffer = buf;
  const filter = sfxCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  const env = sfxCtx.createGain();
  env.gain.setValueAtTime(gain, t0);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(filter);
  filter.connect(env);
  env.connect(sfxMaster);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

// ----- Concrete game sounds -----

// Classic laser zap — high pitch descending fast through a square wave.
function sfxFire() {
  sfxTone({ freq: 1200, freqEnd: 220, type: 'square', duration: 0.10, gain: 0.45 });
}

// Short whoosh on thrust — saw wave low descend. Kept brief so chains of
// directional words don't drone.
function sfxThrust() {
  sfxTone({ freq: 260, freqEnd: 130, type: 'sawtooth', duration: 0.07, gain: 0.22 });
}

// Tiny aim tick — same shape as thrust but quieter and shorter.
function sfxAim() {
  sfxTone({ freq: 520, freqEnd: 420, type: 'square', duration: 0.04, gain: 0.18 });
}

// Word completion blip — high-pitched short square. Pairs with the sparkle.
function sfxWord() {
  sfxTone({ freq: 1480, type: 'square', duration: 0.05, gain: 0.28 });
}

// Powerup pickup — rising arpeggio (C-E-G-C) on square. Triumphant.
function sfxPickup() {
  sfxTone({ freq: 523, type: 'square', duration: 0.08, gain: 0.4, delay: 0 });
  sfxTone({ freq: 659, type: 'square', duration: 0.08, gain: 0.4, delay: 0.07 });
  sfxTone({ freq: 784, type: 'square', duration: 0.09, gain: 0.4, delay: 0.14 });
  sfxTone({ freq: 1046, type: 'square', duration: 0.16, gain: 0.4, delay: 0.22 });
}

// Bullet hit on a shield — short downward chirp.
function sfxShieldHit() {
  sfxTone({ freq: 700, freqEnd: 300, type: 'square', duration: 0.10, gain: 0.35 });
}

// Death — big noise burst + descending sawtooth growl.
function sfxDeath() {
  sfxNoise({ duration: 0.45, gain: 0.55, lowpass: 1400 });
  sfxTone({ freq: 240, freqEnd: 40, type: 'sawtooth', duration: 0.45, gain: 0.35 });
}

// Kill confirm — pair of fast bright squares, low-then-high.
function sfxKill() {
  sfxTone({ freq: 520, type: 'square', duration: 0.06, gain: 0.4 });
  sfxTone({ freq: 880, type: 'square', duration: 0.10, gain: 0.4, delay: 0.06 });
}

// Level up — ascending C-E-G-C major arpeggio, more pronounced than pickup.
function sfxLevelUp() {
  sfxTone({ freq: 523, type: 'square', duration: 0.11, gain: 0.5 });
  sfxTone({ freq: 659, type: 'square', duration: 0.11, gain: 0.5, delay: 0.10 });
  sfxTone({ freq: 784, type: 'square', duration: 0.11, gain: 0.5, delay: 0.20 });
  sfxTone({ freq: 1046, type: 'square', duration: 0.22, gain: 0.55, delay: 0.30 });
}
