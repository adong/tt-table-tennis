/* TT Table Tennis: the computer player, the test bots, and the headless match runner. No DOM: runs in the page
   and in node (tools/soak.js).

   A CPU brain plans each incoming ball with the engine's look-ahead (TTPhys.predict), then spoils it on purpose:
   it reacts late, misjudges some balls by more than its reach, moves at a limited speed (so wide balls are hard),
   and now and then hits into the net or long. Easy aims back at you and gives you floaters to smash; Pro goes for
   the corners with spin and smashes anything high. Bolt the wall robot (rally challenge) never misses, and his
   returns get faster and wider as the rally grows. */
(function (root) {
  'use strict';
  const P = root.TTPhys, C = P.C, clamp = P.clamp;
  const LV = {
    easy: { react: 0.34, speed: 2.3, miss: 0.05, err: 0.04, power: [0.08, 0.38], spin: 0.25, wide: 0.6, smash: 0.25, smashRet: 0.05, pop: 0.2, toward: 0.35, serveDelay: 1.5, serveVy: [-3.0, -3.6, -2.4, -1.8] },
    normal: { react: 0.2, speed: 3.3, miss: 0.06, err: 0.04, power: [0.3, 0.72], spin: 0.6, wide: 0.75, smash: 0.65, smashRet: 0.25, pop: 0.07, toward: 0.15, serveDelay: 1.1, serveVy: [-2.4, -3.0, -1.8, -3.6] },
    pro: { react: 0.12, speed: 4.5, miss: 0.03, err: 0.03, power: [0.55, 1], spin: 0.9, wide: 1, smash: 0.9, smashRet: 0.45, pop: 0.02, toward: 0, serveDelay: 0.85, serveVy: [-1.8, -2.4, -3.0, -3.6] },
    wall: { react: 0.04, speed: 8, miss: 0, err: 0, power: [0.12, 0.12], spin: 0, wide: 0.25, smash: 0, smashRet: 1, pop: 0, toward: 0, serveDelay: 1.0, serveVy: [-3.0, -3.6, -2.4], never: true },
  };

  function brain(level, rnd) {
    const lv = LV[level] || LV.normal;
    const B = {
      lv, level, never: !!lv.never, strike: -1, delay: 0, off: { x: 0, y: 0 },
      // a fresh prediction: on a new ball, decide how well this one will be read
      plan(M, S) {
        if (!S.pred) return;
        if (M.strikeId === B.strike) return;
        B.strike = M.strikeId;
        const b = M.ball;
        const spin = Math.hypot(b.wx, b.wy, b.wz) / 70;
        const wide = Math.max(0, Math.abs(S.pred.x - S.pad.x) - 0.5);
        let pm = lv.miss * (1 + 1.2 * (b.power || 0) + 0.8 * spin + wide);
        if (b.kind === 'smash') pm = 1 - lv.smashRet;
        if (b.kind === 'serve') pm *= 0.5;
        if (b.kind === 'save') pm *= 0.3;
        const a = rnd() * Math.PI * 2;
        const m = rnd() < pm ? 0.3 + 0.25 * rnd() : rnd() * 0.12;
        B.off.x = Math.cos(a) * m;
        B.off.y = Math.sin(a) * m * 0.7;
        if (B.never) B.off.x = B.off.y = 0;
        B.delay = lv.react * (0.7 + 0.6 * rnd());
      },
      // where the paddle should go this frame
      think(M, S, dt, incoming) {
        if (incoming) {
          if (B.delay > 0) { B.delay -= dt; return B.ready(M, S); }
          return { x: S.pred.x + B.off.x, y: S.pred.y + B.off.y };
        }
        return B.ready(M, S);
      },
      ready(M, S) {
        if (M.phase === 'serve' && M.server === S.i) return { x: S.right * 0.25, y: C.H + 0.3 };
        return { x: S.right * 0.3, y: C.H + 0.38 };
      },
      speed() { return lv.speed; },
      intent(M, S) {
        const b = M.ball, opp = M.sides[1 - S.i];
        const oppX = opp.pad.x * S.right; // the opponent's paddle, in this hitter's left / right
        let wide = lv.wide, power = lv.power[0] + (lv.power[1] - lv.power[0]) * rnd(), spin = lv.spin;
        if (B.never) {
          // Bolt: a little faster and wider every few hits
          const r = M.run;
          power = Math.min(1, 0.12 + 0.03 * r);
          wide = Math.min(1, 0.25 + 0.04 * r);
          spin = r > 8 ? Math.min(1, (r - 8) * 0.05) : 0;
          // after a long rally Bolt tries a turbo smash now and then
          if (r > 25 && rnd() < Math.min(0.3, (r - 25) * 0.012)) return { smash: true, aim: (rnd() * 2 - 1) * wide, power: 1 };
        }
        let aim;
        if (rnd() < lv.toward) aim = clamp(oppX / 0.7, -0.8, 0.8);
        else aim = (rnd() < 0.7 ? -1 : 1) * Math.sign(oppX || (rnd() - 0.5)) * wide * (0.45 + 0.55 * rnd());
        const it = { power, aim, top: spin * (rnd() * 1.5 - 0.45), side: rnd() < 0.3 ? spin * (rnd() * 2 - 1) : 0 };
        if (b.y > C.H + 0.55 && rnd() < lv.smash) return { smash: true, aim, power: 1 };
        if (rnd() < lv.pop) return Object.assign(it, { pop: true, power: 0.3 });
        if (rnd() < lv.err) it.err = ['net', 'long', 'wide'][Math.floor(rnd() * 3)];
        return it;
      },
      serveDelay() { return lv.serveDelay; },
      serveIntent() {
        return { aim: (rnd() * 2 - 1) * Math.max(0.3, lv.wide * 0.8), depth: 0.3 + rnd() * 0.6, top: (rnd() * 2 - 1) * lv.spin, side: rnd() < 0.3 ? (rnd() * 2 - 1) * lv.spin : 0 };
      },
    };
    return B;
  }

  // ---------------------------------------------------------------- test bots: stand-ins for kids at the controls

  // For 'pad' sides (the 1-player mouse / finger controls). Returns an input for one engine frame.
  //   kid:   follows the ball loosely, late and a bit off, swipes at random, calls his brother now and then,
  //          and a quarter of the time is looking somewhere else
  //   good:  gets there and swipes up through the ball
  //   flail: waves the paddle around and taps everything, ignoring the ball
  //   still: never moves and never serves on his own (tests that waiting is fine) -- serves after 3 s
  function padBot(kind, rnd) {
    const st = { tx: 0.3, ty: 1.1, err: { x: 0, y: 0 }, strike: -1, wait: 0, swipe: { x: 0, y: 0 }, react: 0, ignore: false };
    return function (M, S) {
      const inp = { target: null, swipe: null, serve: false, call: false };
      const incoming = M.ball.state === 'play' && M.ball.last !== S.i && !S.done && S.pred;
      if (incoming && st.strike !== M.strikeId) {
        st.strike = M.strikeId;
        // judging where it'll be: harder the faster it comes
        const e = (kind === 'good' ? 0.08 : kind === 'kid' ? 0.3 : 0) + 0.25 * (M.ball.power || 0);
        st.err.x = (rnd() * 2 - 1) * e;
        st.err.y = (rnd() * 2 - 1) * e * 0.6;
        st.react = kind === 'kid' ? 0.3 + rnd() * 0.3 : 0.22 + rnd() * 0.1;
        st.ignore = kind === 'kid' && rnd() < 0.25; // looking somewhere else
        st.onTime = rnd() < (kind === 'good' ? 0.8 : 0.5); // swipes as the ball arrives (or too early / not at all)
        const sp = kind === 'good' ? 1 + rnd() * 2.5 : rnd() * 3.5;
        const a = kind === 'good' ? Math.PI / 2 + (rnd() - 0.5) * 1.6 : rnd() * Math.PI * 2;
        st.swipe = { x: Math.cos(a) * sp, y: Math.sin(a) * sp };
      }
      if (kind === 'flail') {
        st.tx = clamp(st.tx + (rnd() - 0.5) * 0.4, -1.6, 1.6);
        st.ty = clamp(st.ty + (rnd() - 0.5) * 0.3, 0.6, 2.0);
        inp.swipe = { x: (rnd() - 0.5) * 6, y: (rnd() - 0.5) * 6 };
        inp.serve = rnd() < 0.03;
        inp.swing = rnd() < 0.05;
      } else if (incoming) {
        st.react -= 1 / 120;
        if (st.react <= 0 && !st.ignore) {
          // a hand on a mouse or a finger on a screen: about 2 m/s for a little kid, 3.5 m/s for a big one
          const v = (kind === 'kid' ? 2 : 3.5) / 120;
          st.tx += clamp(S.pred.x + st.err.x - st.tx, -v, v);
          st.ty += clamp(S.pred.y + st.err.y - st.ty, -v, v);
        }
        const tl = (S.pred.t - (M.ballTime - S.predAt)) / M.lv.speed;
        inp.swipe = st.onTime && tl < 0.15 ? st.swipe : { x: 0, y: 0 };
      } else {
        st.tx += (0.3 * S.right - st.tx) * 0.02;
        st.ty += (1.05 - st.ty) * 0.02;
        inp.swipe = { x: 0, y: 0 };
      }
      inp.target = { x: st.tx, y: st.ty };
      if (M.phase === 'serve' && M.server === S.i) {
        st.wait += 1 / 120;
        if (st.wait > (kind === 'still' ? 3 : 0.4 + rnd() * 1.5)) { inp.serve = true; st.wait = 0; }
      } else st.wait = 0;
      if (kind !== 'good' && rnd() < (kind === 'flail' ? 0.004 : 0.0015)) inp.call = true;
      return inp;
    };
  }

  // For 'keys' sides (2 players): walks toward the ball and presses swing about on time.
  function keysBot(kind, rnd) {
    const st = { strike: -1, early: 0, wait: 0 };
    return function (M, S) {
      const keys = {}, inp = { keys, swing: false, call: false };
      const incoming = M.ball.state === 'play' && M.ball.last !== S.i && !S.done && S.pred;
      if (kind === 'mash') {
        if (rnd() < 0.3) keys[['fwd', 'back', 'up', 'down'][Math.floor(rnd() * 4)]] = true;
        inp.swing = rnd() < 0.08;
      } else if (incoming) {
        if (st.strike !== M.strikeId) { st.strike = M.strikeId; st.early = (rnd() - 0.5) * (kind === 'eight' ? 0.64 : 0.32); }
        const wantX = S.pred.x - S.right * 0.55, wantZ = S.pred.z + S.s * 0.5;
        if (wantX < S.body.x - 0.1) keys.up = true;
        if (wantX > S.body.x + 0.1) keys.down = true;
        const dz = (wantZ - S.body.z) * -S.s; // + = toward the net
        if (dz > 0.15) keys.fwd = true;
        if (dz < -0.15) keys.back = true;
        const tl = (S.pred.t - (M.ballTime - S.predAt)) / M.lv.speed;
        if (tl < 0.12 + st.early && S.swingT < 0) inp.swing = true;
      }
      if (M.phase === 'serve' && M.server === S.i) {
        st.wait += 1 / 120;
        if (st.wait > 0.5 + rnd()) { inp.swing = true; st.wait = 0; }
      }
      if (rnd() < 0.001) inp.call = true;
      return inp;
    };
  }

  // ---------------------------------------------------------------- headless runs

  const lvls = ['easy', 'normal', 'pro'];
  // who: a CPU level ('easy' | 'normal' | 'pro' | 'wall') or a bot ('pad:kid', 'pad:good', 'pad:flail', 'pad:still',
  // 'keys:eight', 'keys:ten', 'keys:mash'). Returns the result of one match.
  function sim(o = {}) {
    const rnd = root.TTMatch.rng(o.seed || (Math.random() * 1e9) | 0);
    const who = o.who || ['normal', 'normal'];
    const ctrl = who.map((w) => (w.startsWith('pad:') ? 'pad' : w.startsWith('keys:') ? 'keys' : 'cpu'));
    const roster = root.Kit && root.Kit.roster ? root.Kit.roster.list.map((c) => c.id) : ['teddy', 'tommy'];
    const ids = o.p || [roster[Math.floor(rnd() * roster.length)], roster[Math.floor(rnd() * roster.length)]];
    const mode = o.mode || (ctrl.includes('keys') ? '2p' : '1p');
    const M = root.TTMatch.create({
      mode, level: o.level || 'normal', games: o.games || 3, p: ids, ctrl,
      cpu: who.map((w) => (LV[w] ? w : 'normal')), seed: (rnd() * 1e9) | 0,
    });
    const bots = who.map((w, i) => (ctrl[i] === 'pad' ? padBot(w.slice(4), rnd) : ctrl[i] === 'keys' ? keysBot(w.slice(5), rnd) : null));
    const maxFrames = o.maxFrames || 120 * 60 * 60; // an hour of game time
    let frames = 0, pointStart = 0, longestPoint = 0, lastPoints = 0, maxOut = 0, budCalls = 0;
    const kinds = {};
    while (M.phase !== 'over' && frames < maxFrames) {
      const inputs = bots.map((bt, i) => (bt ? bt(M, M.sides[i]) : null));
      if (o.callEvery && frames % o.callEvery === 0) { inputs[0] = inputs[0] || {}; inputs[0].call = true; }
      for (const inp of inputs) if (inp && inp.call) budCalls++;
      root.TTMatch.step(M, inputs);
      frames++;
      const b = M.ball;
      maxOut = Math.max(maxOut, Math.abs(b.x) > C.ARENA_X + 0.01 || Math.abs(b.z) > C.ARENA_Z + 0.01 || b.y < -0.01 || !isFinite(b.x + b.y + b.z) ? 1 : 0);
      for (const e of M.events) {
        if (e.type === 'hit') kinds[e.kind] = (kinds[e.kind] || 0) + 1;
        if (e.type === 'point') { longestPoint = Math.max(longestPoint, (frames - pointStart) / 120); pointStart = frames; }
        if (e.type === 'serveReady') pointStart = frames;
      }
      M.events.length = 0;
      if (o.mode === 'rally' && M.runs >= (o.runs || 5)) break;
      lastPoints = M.stats.points;
    }
    return {
      done: M.phase === 'over' || (o.mode === 'rally' && M.runs >= (o.runs || 5)),
      winner: M.winner, ids, who, frames, seconds: frames / 120,
      games: [M.sides[0].games, M.sides[1].games], points: M.stats.points,
      pts: [M.sides[0].stats.points, M.sides[1].stats.points], longestPoint, watchdog: M.stats.watchdog,
      longest: M.longest, saves: M.sides[0].stats.saves + M.sides[1].stats.saves, smashes: M.sides[0].stats.smashes + M.sides[1].stats.smashes,
      escaped: maxOut, kinds, bestRun: M.bestRun, runs: M.runs, budCalls, cords: M.stats.cords,
    };
  }

  // Many random matches: CPU levels, bots, both view modes, every match length. ok = all finished, no stuck ball.
  function soak(n = 200, o = {}) {
    const rnd = root.TTMatch.rng(o.seed || 12345);
    const pool = ['easy', 'normal', 'pro', 'pad:kid', 'pad:good', 'pad:flail', 'pad:still', 'keys:eight', 'keys:ten', 'keys:mash'];
    const res = { ok: true, n, finished: 0, unfinished: [], watchdog: 0, escaped: 0, points: 0, longestPoint: 0, avgPoints: 0, avgMinutes: 0, saves: 0, smashes: 0, rally: { runs: 0, best: 0 }, kinds: {} };
    let secs = 0;
    for (let i = 0; i < n; i++) {
      let who = [pool[Math.floor(rnd() * pool.length)], pool[Math.floor(rnd() * pool.length)]];
      // keys sides only play keys sides (the 2-player side view); a pad side plays a CPU (1 player)
      if (who[0].startsWith('keys') !== who[1].startsWith('keys')) who = who[0].startsWith('keys') ? [who[0], 'keys:eight'] : [who[0], lvls[Math.floor(rnd() * 3)]];
      if (who[1].startsWith('pad')) who[1] = lvls[Math.floor(rnd() * 3)];
      const rally = i % 10 === 9;
      if (rally) who = [who[0].startsWith('keys') ? 'pad:good' : who[0], 'wall'];
      const r = sim({
        who, mode: rally ? 'rally' : undefined, runs: 4, level: lvls[Math.floor(rnd() * 3)], games: [1, 3, 5][Math.floor(rnd() * 3)],
        seed: (rnd() * 1e9) | 0, maxFrames: o.maxFrames, callEvery: i % 4 === 1 ? 900 : 0,
      });
      if (r.done) res.finished++;
      else { res.ok = false; res.unfinished.push({ who: r.who, games: r.games, points: r.points, seconds: r.seconds }); }
      if (r.escaped) { res.ok = false; res.escaped++; }
      if (r.longestPoint > (rally ? 600 : 60)) res.ok = false; // a rally-challenge run is one long "point"
      res.watchdog += r.watchdog;
      res.points += r.points;
      res.saves += r.saves;
      res.smashes += r.smashes;
      res.longestPoint = Math.max(res.longestPoint, +r.longestPoint.toFixed(1));
      if (rally) { res.rally.runs += r.runs; res.rally.best = Math.max(res.rally.best, r.bestRun); }
      for (const k in r.kinds) res.kinds[k] = (res.kinds[k] || 0) + r.kinds[k];
      secs += r.seconds;
    }
    res.avgPoints = +(res.points / n).toFixed(1);
    res.avgMinutes = +(secs / n / 60).toFixed(1);
    res.unfinished = res.unfinished.slice(0, 5);
    return res;
  }

  // Throw thousands of random balls at the table and check every one ends in a point within a few seconds.
  function fuzz(n = 2000, o = {}) {
    const rnd = root.TTMatch.rng(o.seed || 777);
    let worst = 0, unresolved = 0, escaped = 0;
    const bad = [];
    for (let i = 0; i < n; i++) {
      const M = root.TTMatch.create({ mode: '1p', level: lvls[i % 3], games: 1, p: ['teddy', 'tommy'], ctrl: ['cpu', 'cpu'], cpu: ['pro', 'pro'], seed: i + 1 });
      const S = M.sides[i % 2], b = M.ball;
      b.x = (rnd() - 0.5) * 3; b.y = C.H + 0.05 + rnd() * 1.5; b.z = S.s * (0.1 + rnd() * 2.4);
      const sol = { vx: (rnd() - 0.5) * 8, vy: (rnd() - 0.3) * 8, vz: -S.s * rnd() * 12 + (rnd() - 0.5) * 2, wx: (rnd() - 0.5) * 160, wy: (rnd() - 0.5) * 160, wz: (rnd() - 0.5) * 160 };
      M.phase = 'rally';
      // strike() is internal: emulate it through the public pieces
      Object.assign(b, { vx: sol.vx, vy: sol.vy, vz: sol.vz, wx: sol.wx, wy: sol.wy, wz: sol.wz, state: 'play', last: S.i, bounced: -1, serve: false, netTouched: false, flightT: 0, kind: 'drive', power: 0.5 });
      S.done = true;
      const R = M.sides[1 - S.i];
      R.done = false;
      R.pred = P.predict(b, R.i, root.TTMatch.K.ZMIN, root.TTMatch.K.ZMAX, {});
      if (R.pred.fault) R.pred = null;
      R.predAt = M.ballTime;
      if (R.brain) R.brain.plan(M, R);
      // it must end in a point, or the other side hits it back, within 10 s
      let f = 0, done = false;
      const p0 = M.stats.points;
      while (!done && f < 120 * 10) {
        root.TTMatch.step(M, null);
        f++;
        done = M.stats.points > p0 || M.events.some((e) => e.type === 'hit');
        M.events.length = 0;
      }
      if (!done) { unresolved++; if (bad.length < 3) bad.push({ i, b: [b.x, b.y, b.z].map((v) => +v.toFixed(2)), state: b.state, phase: M.phase, bounced: b.bounced }); }
      worst = Math.max(worst, f / 120);
      if (!isFinite(b.x + b.y + b.z) || Math.abs(b.x) > C.ARENA_X + 0.01 || Math.abs(b.z) > C.ARENA_Z + 0.01 || b.y < -0.01) escaped++;
    }
    return { ok: unresolved === 0 && escaped === 0, n, unresolved, escaped, worstSeconds: +worst.toFixed(2), bad };
  }

  // win counts for one pairing
  function versus(a, b, n = 50, o = {}) {
    const wins = [0, 0], pts = [0, 0];
    let rallies = 0, hits = 0;
    for (let i = 0; i < n; i++) {
      const r = sim({ who: [a, b], level: o.level || 'normal', games: o.games || 1, seed: 1000 + i, p: ['teddy', 'tommy'] });
      if (r.winner >= 0) wins[r.winner]++;
      pts[0] += r.pts[0];
      pts[1] += r.pts[1];
      hits += Object.values(r.kinds).reduce((s, v) => s + v, 0);
      rallies += r.points;
    }
    return { a, b, level: o.level || 'normal', wins, pts, hitsPerPoint: +(hits / Math.max(1, rallies)).toFixed(2) };
  }

  root.TTCPU = { LV, brain, padBot, keysBot, sim, soak, fuzz, versus };
})(typeof window !== 'undefined' ? window : globalThis);
