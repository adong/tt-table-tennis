/* TT Table Tennis: controls.
   1 player: the paddle follows the mouse or your finger (a finger moves it from just above your fingertip, so you
   can see it). The swipe speed is measured here in pixels a second; game.js turns it into metres on the paddle's
   plane. A tap or click serves. Keys work too: A D / arrows move the paddle, W S / up down hold topspin / backspin,
   Space or F swings for power (and serves), T calls your brother.
   2 players (side view): P1 WASD + F, T calls; P2 arrows + L, Enter calls. On a touch screen each player taps his
   own half to swing; the game walks him to the ball.
   Presses are latched until the engine's next frame reads them, so a tap shorter than a frame still counts. */
(function () {
  'use strict';
  const KEYS1 = {
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  };
  const KEYS2 = [
    { KeyA: 'back', KeyD: 'fwd', KeyW: 'up', KeyS: 'down' },
    { ArrowLeft: 'fwd', ArrowRight: 'back', ArrowUp: 'up', ArrowDown: 'down' },
  ];
  const SWING1 = { Space: 1, KeyF: 1, KeyL: 1 };
  const SWING2 = { KeyF: 0, KeyL: 1, Numpad0: 1 };
  const CALL1 = { KeyT: 1, KeyB: 1 };
  const CALL2 = { KeyT: 0, Enter: 1, NumpadEnter: 1 };

  const held = {};
  const latch = [{}, {}];
  const ptr = { x: -1, y: -1, active: 0, down: false, type: 'mouse', vx: 0, vy: 0, samples: [], seen: false };
  const halves = [{ swing: false, at: 0 }, { swing: false, at: 0 }];
  let twoPlayer = false;
  const now = () => performance.now() / 1000;

  function onKey(e, down) {
    if (e.metaKey || e.ctrlKey || e.altKey) return false;
    const c = e.code;
    if (down) held[c] = true;
    else delete held[c];
    if (!down || e.repeat) return c in KEYS1 || c === 'Space';
    if (twoPlayer) {
      if (c in SWING2) latch[SWING2[c]].swing = true;
      if (c in CALL2) latch[CALL2[c]].call = true;
    } else {
      if (c in SWING1) latch[0].swing = true;
      if (c in CALL1) latch[0].call = true;
      if (c === 'Enter') latch[0].serve = true;
    }
    return c in KEYS1 || c === 'Space';
  }

  // pointer samples for the swipe: the fastest stretch over the last 0.12 s, in px/s (screen y is down)
  function sample(x, y) {
    const t = now();
    ptr.samples.push([t, x, y]);
    while (ptr.samples.length > 2 && t - ptr.samples[0][0] > 0.2) ptr.samples.shift();
  }
  function swipe() {
    const s = ptr.samples, t = now();
    let bx = 0, by = 0, best = 0;
    for (let i = 1; i < s.length; i++) {
      if (t - s[i][0] > 0.12) continue;
      const j = Math.max(0, i - 3); // a few samples apart, so one jittery event doesn't count
      const dt = s[i][0] - s[j][0];
      if (dt < 0.008) continue;
      const vx = (s[i][1] - s[j][1]) / dt, vy = (s[i][2] - s[j][2]) / dt;
      const m = vx * vx + vy * vy;
      if (m > best) { best = m; bx = vx; by = vy; }
    }
    return { x: bx, y: by };
  }

  function bind(el, o) {
    window.addEventListener('keydown', (e) => {
      if (o.key && o.key(e) === false) return;
      if (onKey(e, true)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => onKey(e, false));
    window.addEventListener('blur', () => { for (const k in held) delete held[k]; });
    const pos = (e) => {
      ptr.type = e.pointerType || 'mouse';
      const lift = ptr.type === 'touch' ? 64 : 0; // keep the paddle visible above the finger
      ptr.x = e.clientX;
      ptr.y = e.clientY - lift;
      ptr.active = now();
      ptr.seen = true;
      sample(ptr.x, ptr.y);
    };
    el.addEventListener('pointermove', (e) => {
      if (ptr.type === 'touch' && !ptr.down && e.pointerType === 'touch') return;
      pos(e);
    });
    el.addEventListener('pointerdown', (e) => {
      ptr.down = true;
      pos(e);
      ptr.samples.length = 0;
      sample(ptr.x, ptr.y);
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      if (twoPlayer) {
        const side = e.clientX < window.innerWidth / 2 ? 0 : 1;
        halves[side].swing = true;
        halves[side].at = now();
      } else latch[0].tap = true;
      if (o.down) o.down(e);
    });
    const up = (e) => { ptr.down = false; if (o.up) o.up(e); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  const any = (map) => { for (const c in map) if (held[c]) return true; return false; };

  // The input for one engine frame. Clears the presses it reports.
  function snapshot(side) {
    const out = { keys: {}, swing: false, serve: false, call: false, tap: false, auto: false };
    const L = latch[side];
    if (twoPlayer) {
      for (const c in KEYS2[side]) if (held[c]) out.keys[KEYS2[side][c]] = true;
      if (halves[side].swing) { out.swing = true; halves[side].swing = false; }
      out.auto = now() - halves[side].at < 6; // a touch player: walk him to the ball
    } else {
      for (const c in KEYS1) if (held[c]) out.keys[KEYS1[c]] = true;
      if (any(SWING1)) out.power = true;
    }
    if (L.swing) out.swing = true;
    if (L.call) out.call = true;
    if (L.serve || L.tap) out.serve = true;
    if (L.tap) out.tap = true;
    latch[side] = {};
    return out;
  }

  function clear() {
    for (const k in held) delete held[k];
    latch[0] = {}; latch[1] = {};
    halves[0].swing = halves[1].swing = false;
  }

  window.TTInput = {
    bind, snapshot, clear, swipe, ptr, held,
    setTwoPlayer(on) { twoPlayer = on; clear(); },
    pointerFresh: () => ptr.seen && (ptr.down || (ptr.type !== 'touch' && now() - ptr.active < 3)),
    press(side, what) { latch[side][what] = true; },
  };
})();
