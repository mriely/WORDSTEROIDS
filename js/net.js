// ============================================================
// MULTIPLAYER (peer-to-peer via WebRTC + PeerJS broker)
// ============================================================
// Architecture:
//   - HOST runs the authoritative simulation. Same code as solo, plus broadcasts
//     state snapshots to JOINER ~20 times/sec.
//   - JOINER renders state from snapshots. Sends inputs (thrust, aim, fire,
//     pickup) to host as messages. Local player typing happens locally; only
//     completed actions cross the wire.
//   - Bots only run on the host.
//
// Mode is one of: 'solo' (default), 'host', 'joiner'.
const NET = {
  mode: 'solo',
  peer: null,         // PeerJS Peer instance
  conn: null,         // active connection (host has 1 conn to joiner; joiner has 1 to host)
  myName: 'YOU',
  remoteName: 'GUEST',
  hostCode: null,
  // Snapshot pacing
  snapshotIntervalMs: 50,
  lastSnapshotAt: 0,
  // Joiner state cache: latest received snapshot
  remoteState: null,
  remoteLastSeen: 0,
  // Joiner input queue: each input is delivered to host as a message
};

// Generate a short, friendly 4-character code for hosting (e.g. "A7K2").
function generateHostCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // skip ambiguous I/O/0/1
  let s = '';
  for (let i = 0; i < 4; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

// Lobby DOM helpers
const lobbyEl = document.getElementById('lobby');
const lobbyName = document.getElementById('lobbyName');
const lobbyMain = document.getElementById('lobbyMain');
const lobbyHost = document.getElementById('lobbyHost');
const lobbyJoinPanel = document.getElementById('lobbyJoin');
const hostCodeEl = document.getElementById('hostCode');
const hostUrlEl = document.getElementById('hostUrl');
const hostWaitMsg = document.getElementById('hostWaitMsg');
const joinCodeInput = document.getElementById('joinCode');
const joinStatus = document.getElementById('joinStatus');
const netstatusEl = document.getElementById('netstatus');

function showLobby() {
  lobbyEl.classList.remove('hidden');
  lobbyMain.style.display = 'block';
  lobbyHost.style.display = 'none';
  lobbyJoinPanel.style.display = 'none';
  // Restore last name
  try {
    const saved = localStorage.getItem('wordsteroids:name');
    if (saved) lobbyName.value = saved;
  } catch (e) {}
  // Auto-fill code from URL ?join=XXX
  const params = new URLSearchParams(window.location.search);
  const j = params.get('join');
  if (j) {
    joinCodeInput.value = j.toUpperCase();
    showJoinPanel();
  }
  setTimeout(() => lobbyName.focus(), 50);
}

function hideLobby() { lobbyEl.classList.add('hidden'); }

function getMyName() {
  let n = (lobbyName.value || '').trim().toUpperCase().slice(0, 14);
  if (!n) n = 'PLAYER' + Math.floor(Math.random() * 90 + 10);
  try { localStorage.setItem('wordsteroids:name', n); } catch (e) {}
  return n;
}

function showHostPanel() {
  lobbyMain.style.display = 'none';
  lobbyHost.style.display = 'block';
}
function showJoinPanel() {
  lobbyMain.style.display = 'none';
  lobbyJoinPanel.style.display = 'block';
  setTimeout(() => joinCodeInput.focus(), 50);
}
function showLobbyMain() {
  lobbyMain.style.display = 'block';
  lobbyHost.style.display = 'none';
  lobbyJoinPanel.style.display = 'none';
}

function updateNetStatus(text, isError) {
  if (!text) {
    netstatusEl.classList.remove('show');
    return;
  }
  netstatusEl.classList.add('show');
  netstatusEl.classList.toggle('error', !!isError);
  netstatusEl.textContent = text;
}

// ----- Host flow -----
// Internal namespace so our short codes don't collide with random other apps
// sharing the public PeerJS broker.
const PEER_NAMESPACE = 'wordsteroids-';

function startHostingGame() {
  NET.myName = getMyName();
  NET.hostCode = generateHostCode();
  showHostPanel();
  hostCodeEl.textContent = NET.hostCode;
  const url = new URL(window.location.href);
  url.search = '?join=' + encodeURIComponent(NET.hostCode);
  hostUrlEl.textContent = url.toString();
  hostWaitMsg.textContent = 'connecting to broker...';

  // PeerJS uses public broker by default. Namespaced peer ID under the hood,
  // but the user only sees the 4-char code.
  NET.peer = new Peer(PEER_NAMESPACE + NET.hostCode);
  NET.peer.on('open', id => {
    hostWaitMsg.textContent = 'waiting for joiner...';
  });
  NET.peer.on('connection', conn => {
    NET.conn = conn;
    conn.on('open', () => {
      // Receive joiner's name first
      conn.send({ type: 'hello', name: NET.myName });
    });
    conn.on('data', data => onHostReceive(data));
    conn.on('close', () => {
      updateNetStatus('joiner disconnected — game over', true);
      NET.mode = 'solo';
    });
    conn.on('error', err => {
      console.warn('host conn error:', err);
    });
    // Joiner is in. Start the multiplayer game.
    NET.mode = 'host';
    hideLobby();
    startGame();
    updateNetStatus(`hosting · code ${NET.hostCode}`);
  });
  NET.peer.on('error', err => {
    console.warn('peer error:', err);
    if (err.type === 'unavailable-id') {
      hostWaitMsg.textContent = 'code already in use, try again';
    } else if (err.type === 'network' || err.type === 'server-error') {
      hostWaitMsg.textContent = 'broker unreachable. check connection.';
    } else {
      hostWaitMsg.textContent = 'error: ' + err.type;
    }
  });
}

function onHostReceive(msg) {
  if (!msg) return;
  switch (msg.type) {
    case 'hello': {
      NET.remoteName = String(msg.name || 'GUEST').toUpperCase().slice(0, 14);
      // Rename the second player slot in the game state
      if (typeof remotePlayer !== 'undefined' && remotePlayer) {
        remotePlayer.name = NET.remoteName;
      }
      break;
    }
    case 'input': {
      // Joiner sent an input action. Apply it on host's authoritative simulation.
      applyRemoteInput(msg.action, msg.dx, msg.dy, msg.shift);
      break;
    }
  }
}

// Translate joiner's action into a call on the remotePlayer ship
function applyRemoteInput(action, dx, dy, shift) {
  if (typeof remotePlayer === 'undefined' || !remotePlayer || !remotePlayer.alive) return;
  if (action === 'thrust' || action === 'aim') {
    if (action === 'thrust') remotePlayer.thrust(dx, dy);
    else remotePlayer.aim(dx, dy);
    // Refresh the word slot corresponding to the direction the joiner just used.
    // Direction (dx, dy) maps to the slot: (-1,0)=left, (1,0)=right, (0,-1)=up, (0,1)=down
    let slot = null;
    if (dx === -1) slot = 'left';
    else if (dx === 1) slot = 'right';
    else if (dy === -1) slot = 'up';
    else if (dy === 1) slot = 'down';
    if (slot && remotePlayer.words && remotePlayer.words[slot]) {
      refreshWordSlot(remotePlayer, remotePlayer.words[slot]);
    }
  } else if (action === 'fire') {
    remotePlayer.fire();
    if (remotePlayer.words && remotePlayer.words.fire) {
      refreshWordSlot(remotePlayer, remotePlayer.words.fire);
    }
  } else if (action === 'brake') {
    remotePlayer.braking = !!dx; // dx=1 means brake on, 0 means off
  }
}

// ----- Joiner flow -----
function startJoiningGame() {
  NET.myName = getMyName();
  const code = (joinCodeInput.value || '').trim().toUpperCase();
  if (!code) { joinStatus.textContent = 'enter a code'; joinStatus.classList.add('error'); return; }
  joinStatus.classList.remove('error');
  joinStatus.textContent = 'connecting to broker...';

  // Use a random peer ID for the joiner (PeerJS will assign one if undefined)
  NET.peer = new Peer();
  NET.peer.on('open', () => {
    joinStatus.textContent = 'connecting to host...';
    const conn = NET.peer.connect(PEER_NAMESPACE + code, { reliable: true });
    NET.conn = conn;
    conn.on('open', () => {
      conn.send({ type: 'hello', name: NET.myName });
      NET.mode = 'joiner';
      hideLobby();
      startGame(); // joiner setup — minimal
      updateNetStatus(`connected to ${code}`);
    });
    conn.on('data', data => onJoinerReceive(data));
    conn.on('close', () => {
      updateNetStatus('host disconnected — game over', true);
      NET.mode = 'solo';
    });
    conn.on('error', err => {
      joinStatus.classList.add('error');
      joinStatus.textContent = 'connect failed: ' + err.type;
    });
  });
  NET.peer.on('error', err => {
    joinStatus.classList.add('error');
    if (err.type === 'peer-unavailable') {
      joinStatus.textContent = 'no host with that code';
    } else if (err.type === 'network' || err.type === 'server-error') {
      joinStatus.textContent = 'broker unreachable. check connection.';
    } else {
      joinStatus.textContent = 'error: ' + err.type;
    }
  });
}

function onJoinerReceive(msg) {
  if (!msg) return;
  switch (msg.type) {
    case 'hello': {
      NET.remoteName = String(msg.name || 'HOST').toUpperCase().slice(0, 14);
      break;
    }
    case 'snapshot': {
      NET.remoteState = msg.s;
      NET.remoteLastSeen = performance.now();
      break;
    }
  }
}

// Joiner-side: send input to host via the data channel
function sendInput(action, dx, dy, shift) {
  if (NET.mode !== 'joiner' || !NET.conn || !NET.conn.open) return;
  try {
    NET.conn.send({ type: 'input', action, dx, dy, shift });
  } catch (e) {
    console.warn('send input failed:', e);
  }
}

// Host-side: serialize game state and broadcast to joiner
function broadcastSnapshot() {
  if (NET.mode !== 'host' || !NET.conn || !NET.conn.open) return;
  const now = performance.now();
  if (now - NET.lastSnapshotAt < NET.snapshotIntervalMs) return;
  NET.lastSnapshotAt = now;
  // Build a compact snapshot
  const ships = [];
  const allShips = [player, remotePlayer, ...bots].filter(Boolean);
  for (const s of allShips) {
    ships.push({
      id: s.id,
      n: s.name,
      x: Math.round(s.x), y: Math.round(s.y),
      vx: Math.round(s.vx), vy: Math.round(s.vy),
      sc: s.score,
      al: s.alive ? 1 : 0,
      sz: Math.round(s.size),
      ld: s.lastDir,
      ws: s.words, // words for showing on remote ships
      pu: s.activePowerup ? s.activePowerup.key : null,
      shp: s.shieldHP,
      ksU: s.killShieldUntil,
      col: s.color,
      ip: s.isPlayer ? 1 : 0,
      lv: s.level || 1, // personal level
    });
  }
  const snap = {
    ships,
    bullets: bullets.map(b => ({ x: Math.round(b.x), y: Math.round(b.y), c: b.color, k: b.isKing ? 1 : 0, fx: Math.round(b.fx || b.x), fy: Math.round(b.fy || b.y), nk: b.isNuke ? 1 : 0, nr: b.nukeRadius || 0 })),
    pickups: pickups.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), k: p.key, exp: p.expiresAt })),
    shockwaves: shockwaves.map(sw => ({ x: Math.round(sw.x), y: Math.round(sw.y), r: Math.round(sw.radius), mr: sw.maxRadius, lf: sw.life, ml: sw.maxLife, c: sw.color })),
    level,
    worldW: WORLD.w, worldH: WORLD.h,
    kingId: king ? king.id : null,
    // flash: send remaining ms (relative to host clock) so the joiner can
    // rebuild against their own local clock. Absolute timestamps would never
    // line up between the two browsers' performance.now() clocks.
    flash: flash ? { color: flash.color, ms: Math.max(0, flash.until - now) } : null,
    t: now,
  };
  try {
    NET.conn.send({ type: 'snapshot', s: snap });
  } catch (e) {
    console.warn('snapshot send failed:', e);
  }
}

// ============================================================
// LOBBY WIRING
// ============================================================
document.getElementById('btnSinglePlayer').addEventListener('click', () => {
  NET.mode = 'solo';
  NET.myName = getMyName();
  hideLobby();
  startGame();
});
document.getElementById('btnHost').addEventListener('click', startHostingGame);
document.getElementById('btnJoin').addEventListener('click', showJoinPanel);
document.getElementById('btnHostBack').addEventListener('click', () => {
  if (NET.peer) { try { NET.peer.destroy(); } catch (e) {} NET.peer = null; }
  showLobbyMain();
});
document.getElementById('btnJoinBack').addEventListener('click', () => {
  if (NET.peer) { try { NET.peer.destroy(); } catch (e) {} NET.peer = null; }
  joinStatus.textContent = '';
  showLobbyMain();
});
document.getElementById('btnJoinConfirm').addEventListener('click', startJoiningGame);
joinCodeInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') startJoiningGame();
});
