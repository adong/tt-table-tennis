/* TT Table Tennis: ball physics. No Three.js and no DOM, so the browser game and the headless runner
   (node tools/soak.js) share it.

   The table, in metres: its long side runs along z, the net is at z = 0, and the top is at y = H.
   Side 0 plays at the +z end (nearest the 1-player camera) and faces -z; side 1 plays at the -z end and faces +z.
   The ball is drawn and collides as a 4.5 cm ball (twice the real size, so it's easy to see).

   The ball has gravity, a little air drag, and spin: w is its spin vector in rad/s. In flight spin bends the path
   (Magnus): topspin dips, backspin floats and sidespin curves. On the table, topspin kicks the ball on and low,
   backspin checks it and pops it up. The table, the net (a ball that clips the tape dribbles over), the table's
   edges, the floor and the hall's barriers all collide.

   solveShot() and solveServe() find the launch velocity that lands a ball on a chosen spot with chosen spin and a
   chosen flight time, clearing the net. predict() looks ahead along a ball's flight to find where a side should
   meet it. Both step the same integrator as the game at the same 1/240 s substep, so a solved shot flies exactly
   as solved. */
(function (root) {
  'use strict';
  const C = {
    L: 2.74, W: 1.525, H: 0.76, NET_H: 0.1525, NET_OUT: 0.1525, // table and net (real sizes)
    R: 0.045, // ball radius
    G: 9.8,
    E: 0.86, // table bounce: vertical restitution
    FRIC: 0.14, // table friction on the ball's sliding contact
    RS: 0.05, // how much spin moves the contact point (spin x RS = surface speed)
    TOPB: 0.0018, // topspin bounces lower, backspin higher (per rad/s)
    DRAG: 0.03,
    MAG: 0.0105, // Magnus: acceleration = MAG * (w x v)
    SPIN_DECAY: 0.25,
    MIN_ON: 0.55, // after a bounce the ball keeps going at least this fast (no backspin rolling back to the net)
    FLOOR_E: 0.55,
    ARENA_X: 4.3, ARENA_Z: 5.8, // the barriers around the court
    SUB: 1 / 240,
  };
  const EV = { TABLE: 1, NET: 2, CORD: 4, FLOOR: 8, EDGE: 16, WALL: 32, CROSS: 64 };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function newBall() {
    return { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0 };
  }
  function copy(b, o = {}) {
    o.x = b.x; o.y = b.y; o.z = b.z; o.vx = b.vx; o.vy = b.vy; o.vz = b.vz; o.wx = b.wx; o.wy = b.wy; o.wz = b.wz;
    return o;
  }

  // Spin from a shot's top (+ topspin / - backspin) and side (+ curves to the hitter's right) for a ball moving
  // horizontally along (dx, dz). right = d x up = (-dz, 0, dx); w = -right * top - up * side.
  function spinFor(dx, dz, top, side, o) {
    const n = Math.hypot(dx, dz) || 1;
    dx /= n; dz /= n;
    o.wx = dz * top; o.wy = -side; o.wz = -dx * top;
    return o;
  }
  // How much of a ball's spin is topspin along its travel (the inverse of spinFor's top).
  function topOf(b) {
    const n = Math.hypot(b.vx, b.vz) || 1;
    return (b.wx * b.vz - b.wz * b.vx) / n;
  }

  // gravity, drag and Magnus for one substep (no collisions)
  function integrate(b, dt) {
    const sp = Math.hypot(b.vx, b.vy, b.vz);
    const ax = C.MAG * (b.wy * b.vz - b.wz * b.vy) - C.DRAG * sp * b.vx;
    const ay = C.MAG * (b.wz * b.vx - b.wx * b.vz) - C.DRAG * sp * b.vy - C.G;
    const az = C.MAG * (b.wx * b.vy - b.wy * b.vx) - C.DRAG * sp * b.vz;
    b.vx += ax * dt; b.vy += ay * dt; b.vz += az * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    const k = 1 - C.SPIN_DECAY * dt;
    b.wx *= k; b.wy *= k; b.wz *= k;
  }

  // The ball meets the table top: restitution, friction on the sliding contact (which is how spin kicks), spin loss.
  function bounceTable(b) {
    const n = Math.hypot(b.vx, b.vz) || 1, dx = b.vx / n, dz = b.vz / n;
    const top = (b.wx * dz - b.wz * dx);
    const ux = b.vx + C.RS * b.wz, uz = b.vz - C.RS * b.wx; // contact point velocity
    b.vx -= C.FRIC * ux;
    b.vz -= C.FRIC * uz;
    b.vy = -b.vy * C.E * clamp(1 - C.TOPB * top, 0.72, 1.25);
    const along = b.vx * dx + b.vz * dz;
    if (along < C.MIN_ON) { b.vx += (C.MIN_ON - along) * dx; b.vz += (C.MIN_ON - along) * dz; }
    b.wx *= 0.55; b.wy *= 0.7; b.wz *= 0.55;
  }

  // One substep with every collision. Returns EV bits; `hit` (optional) gets where a bounce or net touch happened.
  function step(b, dt, hit) {
    const px = b.x, py = b.y, pz = b.z;
    integrate(b, dt);
    let ev = 0;
    // the net, at z = 0
    if ((pz > 0 && b.z <= 0) || (pz < 0 && b.z >= 0)) {
      const k = pz / (pz - b.z);
      const yc = py + (b.y - py) * k, xc = px + (b.x - px) * k;
      if (Math.abs(xc) < C.W / 2 + C.NET_OUT && yc > C.H - 0.02 && yc - C.R < C.H + C.NET_H) {
        if (hit) { hit.x = xc; hit.y = yc; hit.z = 0; }
        if (yc > C.H + C.NET_H - C.R * 0.25) {
          // clips the tape: it pops up and dribbles over
          b.vz *= 0.42; b.vx *= 0.6; b.vy = Math.abs(b.vy) * 0.25 + 0.75;
          b.wx *= 0.3; b.wy *= 0.3; b.wz *= 0.3;
          ev |= EV.CORD | EV.CROSS;
        } else {
          // into the net: it drops back on the side it came from
          const s = pz > 0 ? 1 : -1;
          b.x = xc; b.y = yc; b.z = s * (C.R + 0.004);
          b.vz = -b.vz * 0.12; b.vx *= 0.35; b.vy = Math.min(b.vy, 0.3) * 0.3;
          b.wx *= 0.3; b.wy *= 0.3; b.wz *= 0.3;
          ev |= EV.NET;
        }
      } else ev |= EV.CROSS;
    }
    const over = Math.abs(b.x) <= C.W / 2 && Math.abs(b.z) <= C.L / 2;
    if (b.vy < 0 && b.y - C.R <= C.H && py - C.R >= C.H - 0.03 && over) {
      b.y = C.H + C.R;
      if (hit) { hit.x = b.x; hit.y = C.H; hit.z = b.z; }
      bounceTable(b);
      ev |= EV.TABLE;
    } else if (over && b.y < C.H + C.R && b.y > C.H - 0.07) {
      // came in from the side or an end, below the top: knocked off the table's edge
      if (Math.abs(pz) > C.L / 2) { b.z = Math.sign(pz) * (C.L / 2 + 0.002); b.vz = -b.vz * 0.4; }
      else { b.x = Math.sign(px) * (C.W / 2 + 0.002); b.vx = -b.vx * 0.4; }
      ev |= EV.EDGE;
    }
    if (b.y < C.R && b.vy < 0) {
      b.y = C.R;
      b.vy = -b.vy * C.FLOOR_E;
      b.vx *= 0.8; b.vz *= 0.8;
      b.wx *= 0.5; b.wy *= 0.5; b.wz *= 0.5;
      if (Math.abs(b.vy) < 0.25) b.vy = 0;
      ev |= EV.FLOOR;
    }
    if (Math.abs(b.x) > C.ARENA_X) { b.x = Math.sign(b.x) * C.ARENA_X; b.vx = -b.vx * 0.4; ev |= EV.WALL; }
    if (Math.abs(b.z) > C.ARENA_Z) { b.z = Math.sign(b.z) * C.ARENA_Z; b.vz = -b.vz * 0.4; ev |= EV.WALL; }
    return ev;
  }

  // Fly from P with velocity v and spin w (no collisions) until the ball comes down through the table-top plane
  // on Q's side of the net. Returns where and when, plus its height over the net and its highest point.
  const tmp = newBall();
  function flyToPlane(P, vx, vy, vz, w, qz, bounces) {
    const b = tmp;
    b.x = P.x; b.y = P.y; b.z = P.z; b.vx = vx; b.vy = vy; b.vz = vz; b.wx = w.wx; b.wy = w.wy; b.wz = w.wz;
    const yl = C.H + C.R;
    let t = 0, netY = null, apex = b.y, first = null, nb = 0;
    while (t < 4) {
      const pz = b.z, py = b.y;
      integrate(b, C.SUB);
      t += C.SUB;
      if (netY === null && ((pz > 0 && b.z <= 0) || (pz < 0 && b.z >= 0))) netY = py + (b.y - py) * (pz / (pz - b.z));
      if (b.y > apex) apex = b.y;
      if (b.vy < 0 && b.y <= yl && py > yl) {
        if (nb < (bounces || 0)) {
          // the serve's first bounce, on the server's own half
          b.y = yl;
          first = { x: b.x, z: b.z, t };
          bounceTable(b);
          nb++;
          apex = b.y;
          continue;
        }
        if (Math.sign(b.z) === Math.sign(qz) || netY !== null) {
          const k = (py - yl) / (py - b.y);
          return { x: b.x, z: b.z, t: t - C.SUB * (1 - k), netY, apex, first, vy: b.vy };
        }
      }
      if (b.y < 0) break;
    }
    return { x: b.x, z: b.z, t, netY, apex, first, vy: b.vy, fail: true };
  }

  // Launch velocity from P that lands on Q (on the table, the other side of the net) after about T seconds,
  // with spin { top, side }, clearing the net tape by at least `clear` metres. If the arc is too low to clear,
  // it's tried again higher and slower. Returns { vx, vy, vz, wx, wy, wz, T, land, netGap }.
  function solveShot(P, Q, o) {
    const top = o.top || 0, side = o.side || 0, clear = o.clear === undefined ? 0.04 : o.clear;
    const w = spinFor(Q.x - P.x, Q.z - P.z, top, side, {});
    const yl = C.H + C.R;
    let T = o.T || 0.8, best = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      let vx = (Q.x - P.x) / T, vz = (Q.z - P.z) / T, vy = (yl - P.y + 0.5 * C.G * T * T) / T;
      let r = null;
      for (let it = 0; it < 8; it++) {
        r = flyToPlane(P, vx, vy, vz, w, Q.z, 0);
        const ex = Q.x - r.x, ez = Q.z - r.z;
        if (Math.abs(ex) < 0.004 && Math.abs(ez) < 0.004 && Math.abs(T - r.t) < 0.01) break;
        const tt = Math.max(0.15, r.t);
        vx += ex / tt; vz += ez / tt;
        vy += (T - r.t) * C.G * 0.5;
      }
      const netGap = r.netY === null ? 1 : r.netY - C.R - (C.H + C.NET_H);
      best = { vx, vy, vz, wx: w.wx, wy: w.wy, wz: w.wz, T: r.t, land: { x: r.x, z: r.z }, netGap, apex: r.apex };
      if (netGap >= clear && !r.fail) return best;
      T *= 1.12; // higher and slower
    }
    return best;
  }

  // A serve from P: it bounces once on the server's half, clears the net and lands on Q. Serves are tried with a
  // few downward launch speeds until the first bounce is on the server's half and the net is cleared.
  function solveServe(P, Q, o) {
    const top = o.top || 0, side = o.side || 0, clear = o.clear === undefined ? 0.03 : o.clear;
    const T = o.T || 0.9;
    const own = Math.sign(P.z);
    let best = null;
    for (const vy0 of o.vys || [-0.6, -0.2, 0.3, 0.8, 1.3]) {
      const w = spinFor(Q.x - P.x, Q.z - P.z, top, side, {});
      let vx = (Q.x - P.x) / T, vz = (Q.z - P.z) / T, r = null;
      for (let it = 0; it < 10; it++) {
        r = flyToPlane(P, vx, vy0, vz, w, Q.z, 1);
        const ex = Q.x - r.x, ez = Q.z - r.z;
        if (Math.abs(ex) < 0.004 && Math.abs(ez) < 0.004) break;
        const tt = Math.max(0.2, r.t);
        vx += ex / tt; vz += ez / tt;
      }
      const f = r.first;
      const netGap = r.netY === null ? -1 : r.netY - C.R - (C.H + C.NET_H);
      const ok = !r.fail && f && Math.sign(f.z) === own && Math.abs(f.z) > 0.2 && Math.abs(f.z) < C.L / 2 - 0.04 &&
        Math.abs(f.x) < C.W / 2 - 0.04 && netGap >= clear;
      const s = { vx, vy: vy0, vz, wx: w.wx, wy: w.wy, wz: w.wz, T: r.t, land: { x: r.x, z: r.z }, first: f, netGap, ok };
      if (ok) return s;
      if (!best || (s.netGap > best.netGap && f)) best = s;
    }
    return best;
  }

  // Look ahead along a ball's flight for the side about to receive it. It must bounce on that side's half first.
  // The contact is at the top of the bounce, moved to between zMin and zMax (metres from the net, on that side),
  // and never so late that it bounces twice. Returns { x, y, z, t (ball seconds from now), bounce, apexY }, or
  // { fault } when the ball won't land on that side's half.
  const pb = newBall(), ph = {};
  const samples = [];
  for (let i = 0; i < 600; i++) samples.push({ x: 0, y: 0, z: 0, t: 0 });
  // o: { bounced (it has already bounced on this side), serve (its first bounce is on the server's half) }
  function predict(b0, side, zMin, zMax, o) {
    o = o || {};
    const b = copy(b0, pb), s = side === 0 ? 1 : -1;
    let t = 0, bounce = o.bounced ? { x: b.x, z: b.z, t: 0 } : null, n = 0, serve = !!o.serve;
    while (t < 4) {
      const ev = step(b, C.SUB, ph);
      t += C.SUB;
      if (ev & EV.FLOOR) return bounce ? finish(n, bounce, s, zMin, zMax) : { fault: 'out', t };
      if (ev & EV.TABLE) {
        if (serve && Math.sign(ph.z) !== s) { serve = false; continue; }
        if (bounce) return finish(n, bounce, s, zMin, zMax);
        if (Math.sign(ph.z) !== s) return { fault: 'side', t };
        bounce = { x: ph.x, z: ph.z, t };
        n = 0;
        continue;
      }
      if (bounce) {
        const q = samples[n++];
        q.x = b.x; q.y = b.y; q.z = b.z; q.t = t;
        if (b.z * s > zMax + 0.05 || n >= samples.length || b.y < C.H - 0.3) return finish(n, bounce, s, zMin, zMax);
      } else if (b.z * s > C.L / 2 + 0.3 && b.y < C.H) return { fault: 'out', t };
    }
    return bounce ? finish(n, bounce, s, zMin, zMax) : { fault: 'none', t };
  }
  function finish(n, bounce, s, zMin, zMax) {
    if (!n) return { x: bounce.x, y: C.H + C.R, z: bounce.z, t: bounce.t, bounce, apexY: C.H };
    let ai = 0;
    for (let i = 1; i < n; i++) if (samples[i].y > samples[ai].y) ai = i;
    const apex = samples[ai];
    const zt = clamp(apex.z * s, zMin, zMax);
    let ci = -1;
    for (let i = 0; i < n; i++) if (samples[i].z * s >= zt) { ci = i; break; }
    if (ci < 0) ci = n - 1;
    // not too low: if it has dropped to the table by then, meet it earlier
    while (ci > ai && samples[ci].y < C.H + 0.09) ci--;
    const c = samples[ci];
    return { x: c.x, y: c.y, z: c.z, t: c.t, bounce, apexY: apex.y };
  }

  root.TTPhys = { C, EV, newBall, copy, spinFor, topOf, integrate, step, bounceTable, solveShot, solveServe, predict, clamp };
})(typeof window !== 'undefined' ? window : globalThis);
