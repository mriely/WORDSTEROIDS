// ============================================================
// AUDIO — background music playlist
// ============================================================
const TRACK_URLS = [
  'https://cdn.jsdelivr.net/gh/mriely/WORDSTEROIDS@main/wordsteroids2.mp3',
  'https://cdn.jsdelivr.net/gh/mriely/WORDSTEROIDS@main/wordsteroids3.mp3',
];

const audio = {
  el: null,
  order: [],   // shuffled indices into TRACK_URLS
  pos: 0,      // index into order[]
  muted: false,
  started: false,
  volume: 0.4, // default low so it doesn't blast on first play
};

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function audioInit() {
  if (audio.el) return;
  audio.el = new Audio();
  audio.el.volume = audio.volume;
  audio.el.preload = 'auto';
  audio.el.crossOrigin = 'anonymous';
  audio.failedTracks = new Set();
  audio.el.addEventListener('ended', audioNext);
  audio.el.addEventListener('error', () => {
    const failedSrc = audio.el.src;
    console.warn('audio failed:', failedSrc);
    audio.failedTracks.add(failedSrc);
    // If every track has failed, give up instead of looping forever
    if (audio.failedTracks.size >= TRACK_URLS.length) {
      console.warn('all audio tracks failed to load — giving up. Try opening this file directly in a browser instead of the sandbox.');
      return;
    }
    setTimeout(audioNext, 800);
  });
  audio.order = shuffle(TRACK_URLS.map((_, i) => i));
  audio.pos = 0;
}

function audioPlayCurrent() {
  if (!audio.el || TRACK_URLS.length === 0) return;
  const idx = audio.order[audio.pos];
  audio.el.src = TRACK_URLS[idx];
  audio.el.play().catch(err => {
    console.warn('audio play deferred (will retry on first keypress):', err.message);
    audio.started = false;
  });
  showAudioToast(`♪ track ${audio.pos + 1}/${TRACK_URLS.length}`);
}

function audioNext() {
  if (!audio.el || TRACK_URLS.length === 0) return;
  audio.pos = (audio.pos + 1) % audio.order.length;
  if (audio.pos === 0) audio.order = shuffle(TRACK_URLS.map((_, i) => i));
  audioPlayCurrent();
}

function audioPrev() {
  if (!audio.el || TRACK_URLS.length === 0) return;
  audio.pos = (audio.pos - 1 + audio.order.length) % audio.order.length;
  audioPlayCurrent();
}

function audioToggleMute() {
  if (!audio.el) return;
  audio.muted = !audio.muted;
  audio.el.muted = audio.muted;
  showAudioToast(audio.muted ? '♪ MUTED' : '♪ UNMUTED');
}

// Browsers allow muted autoplay. We start muted at boot, then on the first
// user keypress (a "user gesture") we unmute. This way music begins playing
// silently the moment the game loads and becomes audible the instant you start.
function audioBootStart() {
  if (!audio.el) audioInit();
  if (audio.started) return;
  audio.started = true;
  audio.el.muted = true; // muted autoplay is allowed
  audioPlayCurrent();
}

function audioStartIfPending() {
  // Called on first user keypress.
  if (!audio.el) audioInit();
  if (!audio.started) {
    // Edge case: boot autoplay didn't fire for some reason, start fresh
    audio.started = true;
    audio.el.muted = false;
    audioPlayCurrent();
    return;
  }
  // Boot already started a muted track; unmute it now (user gesture allows this).
  if (audio.el.muted && !audio.muted) {
    audio.el.muted = false;
  }
}

// Small temporary toast at bottom-right (above minimap is fine, it's transient)
let audioToastTimer = null;
function showAudioToast(msg) {
  let el = document.getElementById('audioToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'audioToast';
    el.style.cssText = `
      position:absolute; bottom:200px; right:20px; z-index:10;
      font-family: 'VT323', monospace; font-size:18px;
      color: var(--neon-2); letter-spacing: 0.18em;
      text-shadow: 0 0 8px rgba(0,255,224,0.5);
      padding: 6px 14px; background: rgba(5,6,10,0.7);
      border: 1px solid rgba(0,255,224,0.3);
      pointer-events: none; opacity: 0; transition: opacity 0.3s;
    `;
    // Append inside stage so it scales with the game
    (document.getElementById('stage') || document.body).appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  if (audioToastTimer) clearTimeout(audioToastTimer);
  audioToastTimer = setTimeout(() => { el.style.opacity = '0'; }, 1600);
}
