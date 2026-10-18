/* TT Table Tennis: the rules engine. No Three.js and no DOM: a match is plain state stepped at a fixed 120 frames
   a second, so the same code runs the browser game and the headless runner (node tools/soak.js).

   Each side has a paddle and a body. How they move depends on who controls the side:
   - 'pad'  (1 player): the paddle follows the mouse or finger on a "contact plane", an upright plane across the
     table's end that slides to where the ball will be best to hit. The swipe speed and direction when the paddle
     meets the ball set the shot. The keyboard can drive it too (A D / arrows, Space for power).
   - 'keys' (2 players, side view): WASD or the arrows move the body; the paddle reaches for the ball by itself,
     and F or L swings. The keys held at the swing pick the shot.
   - 'cpu': js/cpu.js moves the paddle and picks the shots.
   The ball is hit when it reaches the contact plane, after its bounce on that side, if the paddle is close enough.

   Ball time runs slower than game time (LEVELS[...].speed), which keeps the real gravity but slows and flattens
   the flight so kids can follow it.

   Rules (kid-friendly ITTF): the serve bounces once on the server's half, then on the other side. After that the
   ball must bounce once on the receiver's half before it's hit back. A second bounce, a ball that gets past you,
   into the net, or off the table wins the point for the other side. First to 11, win by 2; serves change every
   2 points (every point from 10-10); 1 game, best of 3 or best of 5. No lets: a serve that clips the net and lands
   is in ("LUCKY NET!").

   The companion (the other brother) joins a side for 10 s: the first ball that side misses is saved. */
(function (root) {
  'use strict';
  const P = root.TTPhys, C = P.C, EV = P.EV, clamp = P.clamp;
  const DT = 1 / 120;
  const K = {
    BY: 2,
    POINT_T: 1.9, GAME_T: 2.9, RUN_T: 2.4, TOSS_T: 0.38,
    PLANE0: C.L / 2 + 0.3, // where the contact plane rests, metres from the net
    ZMIN: C.L / 2 - 0.42, ZMAX: C.L / 2 + 0.52, // the range it slides in
    CPU_REACH: 0.27,
    SWING_T: 0.36, LIVE0: 0.02,
    BUD_TIME: 10, BUD_COOL: 5, SAVE_DELAY: 0.12,
    WATCHDOG: 6, // ball seconds without a hit before a point is called anyway (never needed in testing)
  };
  // Level settings for human sides: ball speed (time scale), paddle reach, the pull toward the ball, and so on.
  const LEVELS = {
    // smashY: a ball met this high over the table can be smashed (smashP: with at least this much swipe power)
    // live1 / late: the 2-player swing's live window and the grace for a late swing, in seconds
    easy: { speed: 0.52, reach: 0.38, reachX: 0.9, assist: 0.75, assistR: 0.55, smashY: 0.52, smashP: 0, autoMove: 1, live1: 0.34, late: 0.22, serveVy: [-3.0, -3.6, -2.4, -1.8] },
    normal: { speed: 0.64, reach: 0.3, reachX: 0.72, assist: 0.3, assistR: 0.45, smashY: 0.55, smashP: 0.2, autoMove: 0.6, live1: 0.26, late: 0.14, serveVy: [-2.4, -3.0, -1.8, -3.6] },
    pro: { speed: 0.84, reach: 0.22, reachX: 0.6, assist: 0, assistR: 0, smashY: 0.58, smashP: 0.4, autoMove: 0, live1: 0.22, late: 0.1, serveVy: [-1.8, -2.4, -3.0, -3.6] },
  };

  function rng(seed) {
    let a = seed >>> 0 || 1;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function newSide(i, id, ctrl) {
    const s = i === 0 ? 1 : -1; // the z sign of this side's end
    return {
      i, id, ctrl, s, right: s, // world x of this side's right hand (side 0 faces -z, so its right is +x)
      pad: { x: 0.3 * s, y: C.H + 0.35, z: s * K.PLANE0 }, raw: { x: 0.3 * s, y: C.H + 0.35 },
      plane: s * K.PLANE0,
      body: { x: -0.3 * s, z: s * (K.PLANE0 + 0.6), vx: 0, vz: 0 },
      home: { x: 0, y: 1.05, z: 0 },
      swipe: { x: 0, y: 0 }, hist: [],
      swingT: -1, swingKeys: null, lateT: -1, kbdPow: -1,
      pred: null, predAt: 0, done: false, // the prediction for the incoming ball, and whether it's been played
      score: 0, games: 0,
      bud: { on: false, t: 0, armed: false, cool: 0, visits: 0, treats: 0, saves: 0, saving: -1, sx: 0, sy: 0, sz: 0 },
      brain: null, stats: { hits: 0, smashes: 0, points: 0, saves: 0, aces: 0 },
    };
  }

  // cfg: { mode: '1p' | '2p' | 'rally' | 'demo', level, games (1 | 3 | 5), p: [id0, id1], ctrl: [c0, c1], cpu: [lvl0, lvl1], seed }
  function create(cfg) {
    const M = {
      cfg, mode: cfg.mode || '1p', level: cfg.level || 'normal', lv: LEVELS[cfg.level] || LEVELS.normal,
      bestOf: cfg.games || 3, toWin: cfg.toWin || 11,
      rnd: rng(cfg.seed || (Math.random() * 1e9) | 0),
      t: 0, frame: 0, ballTime: 0, ballAcc: 0,
      sides: [newSide(0, cfg.p[0], cfg.ctrl[0]), newSide(1, cfg.p[1], cfg.ctrl[1])],
      ball: Object.assign(P.newBall(), { state: 'hold', last: -1, bounced: -1, serve: false, servedBounce: false, netTouched: false, flightT: 0, kind: '', power: 0 }),
      phase: 'serve', phaseT: 0, server: 0, gameFirst: 0, gameNo: 1,
      rally: 0, longest: 0, run: 0, bestRun: 0, runs: 0, strikeId: 0,
      winner: -1, lastPoint: null, events: [], stats: { points: 0, watchdog: 0, lets: 0, cords: 0, maxFlight: 0 },
      hold: [], // per side: server's ball-in-hand time
    };
    if (M.mode === 'rally') M.toWin = Infinity;
    for (const S of M.sides) if (S.ctrl === 'cpu' && root.TTCPU) S.brain = root.TTCPU.brain(cfg.cpu ? cfg.cpu[S.i] : M.level, M.rnd);
    M.server = M.gameFirst = M.mode === 'rally' ? 1 : (cfg.firstServer || 0);
    setupServe(M);
    return M;
  }

  const ev = (M, o) => { M.events.push(o); return o; };
  const other = (M, S) => M.sides[1 - S.i];
  // ball time per game second; in the rally challenge it speeds up as the rally grows
  const speedOf = (M) => M.lv.speed * (M.mode === 'rally' ? 1 + Math.min(1.5, M.run * 0.025) : 1);

  // ---------------------------------------------------------------- serving

  function setupServe(M) {
    const S = M.sides[M.server], b = M.ball;
    M.phase = 'serve';
    M.phaseT = 0;
    M.rally = 0;
    b.state = 'hold';
    b.last = -1; b.bounced = -1; b.serve = false; b.netTouched = false; b.flightT = 0;
    b.vx = b.vy = b.vz = b.wx = b.wy = b.wz = 0;
    for (const T of M.sides) {
      T.pred = null; T.done = false; T.lateT = -1; T.swingT = -1;
      T.plane = T.s * K.PLANE0;
      if (T.ctrl === 'keys') { T.body.x = -0.35 * T.right; T.body.z = T.s * (C.L / 2 + 0.75); }
    }
    placeHeld(M);
    ev(M, { type: 'serveReady', side: S.i });
  }

  function servePoint(S) {
    return { x: clamp(S.pad.x, -C.W / 2 + 0.15, C.W / 2 - 0.15), y: C.H + 0.22, z: S.s * (C.L / 2 + 0.12) };
  }

  // the ball floats by the server's paddle until the toss
  function placeHeld(M) {
    const S = M.sides[M.server], b = M.ball, p = servePoint(S);
    // it bounces gently on the paddle
    b.x = p.x; b.y = p.y + Math.abs(Math.sin(M.t * 5)) * 0.07; b.z = p.z;
  }

  // intent: { aim (-1 left .. 1 right, from the server's view), depth 0..1, top, side } (top/side -1..1)
  function startToss(M, S, intent) {
    if (M.phase !== 'serve' || M.server !== S.i) return false;
    M.phase = 'toss';
    M.phaseT = 0;
    M.ball.state = 'toss';
    M.tossIntent = intent || {};
    M.tossFrom = servePoint(S);
    ev(M, { type: 'toss', side: S.i });
    return true;
  }

  function doServe(M, S) {
    const b = M.ball, it = M.tossIntent, P0 = M.tossFrom, R = other(M, S);
    const lvl = S.brain ? S.brain.lv.serveVy || M.lv.serveVy : M.lv.serveVy;
    const aim = clamp(it.aim || 0, -1, 1);
    const Q = { x: aim * (C.W / 2 - 0.2) * S.right, z: R.s * (0.42 + 0.4 * clamp(it.depth === undefined ? 0.6 : it.depth, 0, 1)) * (C.L / 2) };
    const sol = P.solveServe(P0, Q, { T: 0.6, top: (it.top || 0) * 50, side: (it.side || 0) * 30, vys: lvl });
    b.x = P0.x; b.y = P0.y; b.z = P0.z;
    strike(M, S, sol, 'serve', 0.4);
  }

  // ---------------------------------------------------------------- shots

  // intent: { power 0..1, aim -1..1 (the hitter's view), top -1..1, side -1..1, smash, lob, err: 'net' | 'long' | 'wide' }
  function makeShot(M, S, it) {
    const b = M.ball, toward = -S.s;
    let power = clamp(it.power === undefined ? 0.4 : it.power, 0, 1), top = clamp(it.top || 0, -1, 1), side = clamp(it.side || 0, -1, 1);
    const aim = clamp(it.aim || 0, -1, 1);
    let kind = it.kind || (top > 0.45 ? 'top' : top < -0.45 ? 'chop' : Math.abs(side) > 0.55 ? 'curve' : power < 0.18 ? 'block' : 'drive');
    let T = 0.62 - 0.26 * power, depth = 0.42 + 0.46 * power, clear = 0.03 + (1 - power) * 0.07;
    if (top < 0) T += 0.07 * -top;
    if (it.smash) { kind = 'smash'; T = 0.27; depth = 0.66 + 0.2 * power; top = 0.6; clear = 0.02; }
    if (it.lob) { T = 0.92; depth = 0.82; clear = 0.25; }
    if (it.pop) { T = 0.85; depth = 0.5 + 0.2 * power; clear = 0.2; top = -0.3; } // a floater: easy to smash
    let qx = aim * (C.W / 2 - 0.13) * S.right, qz = toward * depth * (C.L / 2);
    if (it.err === 'long') qz = toward * (C.L / 2 + 0.18 + 0.3 * M.rnd());
    if (it.err === 'wide') qx = S.right * (aim < 0 ? -1 : 1) * (C.W / 2 + 0.16 + 0.2 * M.rnd());
    if (it.err === 'net') { qz = toward * 0.18; T = 0.22; clear = -1; }
    const sol = P.solveShot({ x: b.x, y: b.y, z: b.z }, { x: qx, z: qz }, { T, top: top * 70, side: side * 45, clear });
    return { sol, kind, power: it.smash ? 1 : power };
  }

  function strike(M, S, sol, kind, power) {
    const b = M.ball, R = other(M, S);
    b.vx = sol.vx; b.vy = sol.vy; b.vz = sol.vz; b.wx = sol.wx; b.wy = sol.wy; b.wz = sol.wz;
    b.state = 'play';
    b.last = S.i; b.bounced = -1; b.netTouched = false; b.flightT = 0;
    b.serve = kind === 'serve'; b.servedBounce = false; b.kind = kind; b.power = power;
    M.strikeId++;
    M.phase = 'rally';
    S.done = true; S.pred = null; S.lateT = -1;
    R.done = false; R.lateT = -1;
    if (kind !== 'serve') M.rally++;
    M.longest = Math.max(M.longest, M.rally);
    S.stats.hits++;
    if (kind === 'smash') S.stats.smashes++;
    ev(M, { type: 'hit', side: S.i, kind, power, x: b.x, y: b.y, z: b.z, rally: M.rally });
    replan(M, R, false);
  }

  function replan(M, R, bounced) {
    const b = M.ball;
    R.pred = P.predict(b, R.i, K.ZMIN, K.ZMAX, { bounced, serve: b.serve && !b.servedBounce });
    if (R.pred.fault) R.pred = null;
    R.predAt = M.ballTime;
    if (R.brain) R.brain.plan(M, R);
  }

  // ball seconds and game seconds until the predicted contact
  function timeToContact(M, S) {
    if (!S.pred) return Infinity;
    return (S.pred.t - (M.ballTime - S.predAt)) / speedOf(M);
  }

  function intentFor(M, S) {
    const b = M.ball, lv = M.lv;
    let it;
    if (S.ctrl === 'cpu') return S.brain.intent(M, S);
    if (S.ctrl === 'keys') it = keysIntent(M, S, S.swingKeys || {});
    else {
      // the swipe: lateral (to the hitter's right) and up
      const lat = S.swipe.x * S.right, up = S.swipe.y, sp = Math.hypot(lat, up);
      let power = clamp((sp - 0.35) / 3.2, 0, 1);
      const top = clamp(up / 2.2, -1, 1);
      if (top < 0) power *= 0.6;
      it = { power, aim: clamp((lat / (sp + 0.6)) * 1.15, -1, 1), top, side: clamp(lat / 2.6, -1, 1) * 0.8 };
      // keyboard play: Space just before contact is a power drive; up / down add topspin / backspin
      if (S.kbdPow >= 0 && M.t - S.kbdPow < 0.45) { it.power = Math.max(it.power, 0.85); it.top = Math.max(it.top, 0.5); }
      const k = S.keysHeld || {};
      if (k.up) it.top = Math.max(it.top, 0.7);
      if (k.down) { it.top = Math.min(it.top, -0.7); it.power = Math.min(it.power, 0.4); }
      if (k.left || k.right) { it.aim = k.left ? -0.8 : 0.8; it.side = k.left ? -0.5 : 0.5; }
      if (M.level === 'easy') it.power = Math.max(it.power, 0.15);
      if (sp < 0.35 && !(S.kbdPow >= 0 && M.t - S.kbdPow < 0.45)) it.aim = clamp(-(b.x * S.right) * 0.4, -0.5, 0.5); // a still paddle blocks it back cross-court
      if (b.y > C.H + lv.smashY && it.power >= lv.smashP) it.smash = true;
      // a wild flat swipe can fly long (rarely on Easy)
      if (it.power > 0.97 && it.top < 0.3 && !it.smash && M.rnd() < (M.level === 'pro' ? 0.35 : M.level === 'normal' ? 0.2 : 0.1)) it.err = 'long';
    }
    return spinTrouble(M, it);
  }

  // Real table tennis: spin coming at you needs an answer. Block topspin and it pops up (a floater the other side
  // can smash); push backspin without lifting it (a swipe up) and it goes into the net. Gentle on Easy.
  function spinTrouble(M, it) {
    if (it.smash || it.err) return it;
    const tin = P.topOf(M.ball) / 40, r = M.rnd(), lvl = M.level;
    if (tin < -0.25 && it.top < 0.2 && r < (lvl === 'pro' ? 0.55 : lvl === 'normal' ? 0.35 : 0)) it.err = 'net';
    else if (tin > 0.3 && it.power < 0.22 && r < (lvl === 'pro' ? 0.65 : lvl === 'normal' ? 0.45 : 0.15)) { it.pop = true; it.power = 0.3; }
    return it;
  }

  function keysIntent(M, S, k) {
    const it = { power: 0.5, aim: clamp(-(M.ball.x * S.right) * 0.45, -0.6, 0.6), top: 0.2, side: 0 };
    if (k.fwd) { it.power = 0.85; it.top = 0.7; }
    if (k.back) { it.power = 0.3; it.top = -0.8; }
    if (k.up || k.down) {
      // in the side view "up" is away from the camera (-x): turn it into the hitter's left or right
      const wx = k.up ? -1 : 1;
      it.aim = wx * S.right * 0.85;
      it.side = it.aim * 0.5;
    }
    if (M.ball.y > C.H + M.lv.smashY) it.smash = true;
    // a swing that meets the ball right at its start or its very end is a mishit: a floater the other side can smash
    const u = S.swingT, easy = M.level === 'easy';
    if (u >= 0 && (u < (easy ? 0.03 : 0.06) || u > (easy ? 0.31 : 0.22)) && !it.smash) { it.pop = true; it.power = 0.25; }
    return it;
  }

  // how close the paddle must be; a smash is much harder to get back
  function reachFor(M, S) {
    const k = M.ball.kind === 'smash' ? 0.5 : 1;
    return (S.ctrl === 'keys' ? M.lv.reachX : S.ctrl === 'cpu' ? K.CPU_REACH : M.lv.reach) * k;
  }

  // The ball has reached side S's contact plane (or, with `late`, is just past it). Is the paddle there?
  function tryHit(M, S, late) {
    const b = M.ball, lv = M.lv;
    let ok;
    if (S.ctrl === 'keys') {
      // a smash coming at you has to be timed just right
      const live = b.kind === 'smash' ? S.swingT >= 0.06 && S.swingT <= 0.17 : S.swingT >= K.LIVE0 && S.swingT <= lv.live1;
      if (late && b.kind === 'smash') return false;
      const reach = Math.abs(b.x - S.home.x) < reachFor(M, S) && b.y > 0.3 && b.y < 2.15;
      ok = reach && (live || (late && S.swingT >= 0));
      if (ok) { S.pad.x = b.x; S.pad.y = b.y; }
    } else if (S.brain && S.brain.never) {
      ok = true;
      S.pad.x = b.x; S.pad.y = b.y;
    } else ok = Math.hypot(b.x - S.pad.x, b.y - S.pad.y) < reachFor(M, S);
    if (!ok) return false;
    const it = intentFor(M, S);
    const shot = makeShot(M, S, it);
    strike(M, S, shot.sol, shot.kind, shot.power);
    return true;
  }

  // ---------------------------------------------------------------- points

  // Side S failed to return a ball it could have played. His companion may save it.
  function miss(M, S, why) {
    const B = S.bud;
    if (B.on && B.armed && B.saving < 0) {
      B.armed = false;
      B.saving = K.SAVE_DELAY;
      S.done = true;
      const b = M.ball;
      B.sx = b.x; B.sy = Math.max(b.y, 0.45); B.sz = b.z;
      ev(M, { type: 'saving', side: S.i, x: b.x, y: B.sy, z: b.z, why });
      return;
    }
    point(M, 1 - S.i, why, S.i);
  }

  function doSave(M, S) {
    const b = M.ball, B = S.bud;
    B.saving = -1;
    // he scoops it up wherever it is: keep it above the floor and inside the hall
    b.x = clamp(b.x, -2.6, 2.6);
    b.y = clamp(b.y, 0.45, 2.0);
    if (b.z * S.s < C.L / 2 - 0.3) b.z = S.s * (C.L / 2 - 0.3);
    b.z = clamp(b.z, -3.4, 3.4);
    const shot = makeShot(M, S, { power: 0.35, aim: (M.rnd() - 0.5) * 0.6, top: -0.2, lob: true, kind: 'save' });
    B.saves++;
    S.stats.saves++;
    ev(M, { type: 'save', side: S.i, x: b.x, y: b.y, z: b.z, id: S.id });
    strike(M, S, shot.sol, 'save', 0.35);
  }

  const REASON = { double: 'TWO BOUNCES', passed: 'MISSED', floor: 'MISSED', net: 'NET', out: 'OUT', own: 'NET', serve: 'FAULT', watchdog: 'TIME' };

  function point(M, w, why, loser) {
    const b = M.ball, W = M.sides[w], Lz = M.sides[1 - w];
    if (b.state !== 'play') return;
    b.state = 'dead';
    M.stats.points++;
    const byStrike = b.last === w; // the winner's shot did it (rather than the loser's mistake)
    const info = { type: 'point', winner: w, why, reason: REASON[why] || why, kind: b.kind, byStrike, rally: M.rally, smash: byStrike && b.kind === 'smash', ace: b.serve && byStrike };
    M.lastPoint = info;
    if (info.ace) W.stats.aces++;
    if (M.mode === 'rally') {
      // the challenge: the run ends when the player (side 0) loses a point
      info.run = M.run;
      if (w === 1) {
        info.runOver = true;
        M.runs++;
        M.bestRun = Math.max(M.bestRun, M.run);
        info.best = M.bestRun;
      }
      ev(M, info);
      M.phase = 'point';
      M.phaseT = 0;
      return;
    }
    W.score++;
    W.stats.points++;
    M.phase = 'point';
    M.phaseT = 0;
    const a = W.score, o = Lz.score;
    info.score = [M.sides[0].score, M.sides[1].score];
    if (a >= M.toWin && a - o >= K.BY) {
      W.games++;
      info.game = true;
      info.games = [M.sides[0].games, M.sides[1].games];
      if (W.games > M.bestOf / 2) { info.match = true; M.winner = w; }
    } else {
      const need = M.toWin;
      if (a === o && a >= need - 1) info.call = 'DEUCE!';
      else if (Math.max(a, o) >= need - 1 && Math.abs(a - o) >= 1) {
        const lead = a > o ? W : Lz;
        info.call = lead.games + 1 > M.bestOf / 2 ? 'MATCH POINT!' : 'GAME POINT!';
        info.callSide = lead.i;
      }
    }
    ev(M, info);
  }

  function nextServer(M) {
    const n = M.sides[0].score + M.sides[1].score, d = M.toWin - 1;
    const flip = n < 2 * d ? Math.floor(n / 2) % 2 : n % 2;
    return M.gameFirst ^ flip;
  }

  function afterPoint(M) {
    const info = M.lastPoint;
    if (M.mode === 'rally') {
      if (info && info.runOver) M.run = 0;
      M.server = 1;
      setupServe(M);
      return;
    }
    if (info && info.match) {
      M.phase = 'over';
      M.phaseT = 0;
      ev(M, { type: 'match', winner: M.winner, games: [M.sides[0].games, M.sides[1].games] });
      return;
    }
    if (info && info.game) {
      M.phase = 'game';
      M.phaseT = 0;
      ev(M, { type: 'game', winner: info.winner, games: info.games, no: M.gameNo, score: info.score });
      return;
    }
    M.server = nextServer(M);
    setupServe(M);
  }

  function newGame(M) {
    for (const S of M.sides) S.score = 0;
    M.gameNo++;
    M.gameFirst = 1 - M.gameFirst;
    M.server = M.gameFirst;
    ev(M, { type: 'newGame', no: M.gameNo });
    setupServe(M);
  }

  // ---------------------------------------------------------------- the companion

  function call(M, S) {
    const B = S.bud, two = M.mode === '2p';
    if (M.phase === 'over') return;
    if (B.on) {
      // already here: another treat; in 1 player he also stays longer and is ready to save again
      B.treats++;
      if (!two) { B.t = K.BUD_TIME; B.armed = true; }
      ev(M, { type: 'treat', side: S.i, again: true });
      return;
    }
    if (B.cool > 0) { ev(M, { type: 'budNope', side: S.i }); return; }
    B.on = true;
    B.t = K.BUD_TIME;
    B.armed = true;
    B.visits++;
    B.treats++;
    ev(M, { type: 'budIn', side: S.i });
  }

  function updateBud(M, S, dt) {
    const B = S.bud;
    if (B.saving >= 0) {
      B.saving -= dt;
      if (B.saving < 0) {
        if (M.ball.state === 'play') doSave(M, S);
      }
    }
    if (B.on) {
      B.t -= dt;
      if (B.t <= 0 && B.saving < 0) {
        B.on = false;
        B.armed = false;
        B.t = 0;
        B.cool = M.mode === '2p' ? K.BUD_COOL : 0;
        ev(M, { type: 'budOut', side: S.i });
      }
    } else if (B.cool > 0) B.cool = Math.max(0, B.cool - dt);
  }

  // ---------------------------------------------------------------- controls

  // inp: { ray: {ox,oy,oz,dx,dy,dz} | target: {x,y} | keys: {left,right,up,down,fwd,back}, swipe: {x,y}, swing, serve, call, power }
  function control(M, S, inp, dt) {
    inp = inp || {};
    if (inp.call) call(M, S);
    const b = M.ball, lv = M.lv;
    const incoming = b.state === 'play' && b.last !== S.i && !S.done && S.pred;
    // the contact plane slides to where this ball is best met
    if (S.ctrl !== 'keys') {
      const want = incoming ? S.pred.z : S.s * K.PLANE0;
      S.plane += clamp(want - S.plane, -3.2 * dt, 3.2 * dt);
    }
    if (S.ctrl === 'pad') padControl(M, S, inp, dt, incoming);
    else if (S.ctrl === 'cpu') cpuControl(M, S, dt, incoming);
    else keysControl(M, S, inp, dt, incoming);
    // swings (keys) and serves
    if (S.swingT >= 0) { S.swingT += dt; if (S.swingT > K.SWING_T) S.swingT = -1; }
    const swingPressed = !!inp.swing;
    if (S.ctrl === 'keys' && swingPressed && S.swingT < 0) {
      S.swingT = 0;
      S.swingKeys = Object.assign({}, inp.keys || {});
      ev(M, { type: 'swing', side: S.i });
    }
    if (S.ctrl === 'pad' && (swingPressed || inp.power)) S.kbdPow = M.t;
    if (M.phase === 'serve' && M.server === S.i && S.ctrl !== 'cpu' && (inp.serve || swingPressed)) {
      startToss(M, S, humanServeIntent(M, S, inp));
    }
  }

  function humanServeIntent(M, S, inp) {
    const k = inp.keys || {};
    let aim = clamp(S.pad.x * S.right * 0.9, -0.8, 0.8), top = 0, side = 0;
    if (S.ctrl === 'keys') {
      aim = k.up ? -0.6 * S.right : k.down ? 0.6 * S.right : (M.rnd() - 0.5) * 0.8;
      if (k.fwd) top = 0.6;
      if (k.back) top = -0.6;
    } else if (inp.swipe) {
      const lat = inp.swipe.x * S.right, up = inp.swipe.y;
      top = clamp(up / 2.5, -1, 1);
      side = clamp(lat / 2.5, -1, 1);
    }
    return { aim, depth: 0.6, top, side };
  }

  function padControl(M, S, inp, dt, incoming) {
    const b = M.ball, lv = M.lv, raw = S.raw;
    S.keysHeld = inp.keys || null;
    if (inp.ray && Math.abs(inp.ray.dz) > 1e-4) {
      const r = inp.ray, t = (S.plane - r.oz) / r.dz;
      raw.x = r.ox + r.dx * t;
      raw.y = r.oy + r.dy * t;
    } else if (inp.target) {
      raw.x = inp.target.x;
      raw.y = inp.target.y;
    } else if (inp.keys) {
      const k = inp.keys, sp = 2.6 * dt;
      raw.x += ((k.right ? 1 : 0) - (k.left ? 1 : 0)) * sp * S.right;
      if (k.up || k.down) raw.y += ((k.up ? 1 : 0) - (k.down ? 1 : 0)) * sp * 0.8;
      else if (incoming) raw.y += clamp(S.pred.y - raw.y, -1.6 * dt, 1.6 * dt); // the height follows the ball
    }
    raw.x = clamp(raw.x, -2.1, 2.1);
    raw.y = clamp(raw.y, 0.5, 2.25);
    let x = raw.x, y = raw.y;
    // assist: in the last moment the paddle is pulled onto the ball
    if (incoming && lv.assist > 0 && M.ball.kind !== 'smash') {
      const tl = timeToContact(M, S);
      const d = Math.hypot(S.pred.x - x, S.pred.y - y);
      if (tl < 0.4 && d < lv.assistR) {
        const w = lv.assist * clamp(1 - tl / 0.4, 0, 1);
        x += (S.pred.x - x) * w;
        y += (S.pred.y - y) * w;
      }
    }
    const px = S.pad.x, py = S.pad.y;
    S.pad.x = x; S.pad.y = y; S.pad.z = S.plane;
    // the swipe: from the page (real time, measured by the input code) or from the paddle's own motion
    if (inp.swipe) { S.swipe.x = inp.swipe.x; S.swipe.y = inp.swipe.y; }
    else {
      const vx = (x - px) / dt, vy = (y - py) / dt;
      S.hist.push([M.t, vx, vy]);
      while (S.hist.length && M.t - S.hist[0][0] > 0.12) S.hist.shift();
      let best = S.hist[0] || [0, 0, 0];
      for (const h of S.hist) if (h[1] * h[1] + h[2] * h[2] > best[1] * best[1] + best[2] * best[2]) best = h;
      S.swipe.x = best[1]; S.swipe.y = best[2];
    }
    followBody(S, dt, 7);
  }

  function cpuControl(M, S, dt, incoming) {
    const tgt = S.brain.think(M, S, dt, incoming);
    const sp = S.brain.speed(M, S) * dt;
    S.pad.x += clamp(tgt.x - S.pad.x, -sp, sp);
    S.pad.y += clamp(tgt.y - S.pad.y, -sp, sp);
    S.pad.z = S.plane;
    S.swipe.x = S.swipe.y = 0;
    followBody(S, dt, 6);
  }

  // pad and CPU sides: the body stands behind and to the left of the paddle (it's a forehand)
  function followBody(S, dt, v) {
    const bx = S.pad.x - S.right * 0.62;
    const bz = S.s * Math.max(Math.abs(S.plane) + 0.55, C.L / 2 + 0.42);
    const B = S.body, ox = B.x, oz = B.z;
    B.x += clamp(bx - B.x, -v * dt, v * dt);
    B.z += clamp(bz - B.z, -v * dt, v * dt);
    B.vx = (B.x - ox) / dt;
    B.vz = (B.z - oz) / dt;
  }

  function keysControl(M, S, inp, dt, incoming) {
    const k = inp.keys || {}, B = S.body, lv = M.lv;
    let mx = 0, mz = 0;
    if (k.fwd) mz -= S.s;
    if (k.back) mz += S.s;
    if (k.up) mx -= 1;
    if (k.down) mx += 1;
    const moving = mx || mz;
    // the assist walks you to the ball when you're not steering
    if (!moving && incoming && lv.autoMove > 0) {
      const wantX = S.pred.x - S.right * 0.55, wantZ = S.pred.z + S.s * 0.5;
      const dx = wantX - B.x, dz = lv.autoMove >= 1 ? wantZ - B.z : 0;
      const d = Math.hypot(dx, dz);
      if (d > 0.04) { mx = (dx / d) * lv.autoMove; mz = (dz / d) * lv.autoMove; }
    }
    const n = Math.hypot(mx, mz) || 1, run = 3.5;
    const tvx = (mx / Math.max(1, n)) * run, tvz = (mz / Math.max(1, n)) * run;
    const a = 1 - Math.exp(-14 * dt);
    B.vx += (tvx - B.vx) * a;
    B.vz += (tvz - B.vz) * a;
    B.x = clamp(B.x + B.vx * dt, -2.5, 2.5);
    const az = clamp(Math.abs(B.z + B.vz * dt), C.L / 2 + 0.45, C.L / 2 + 2.6);
    B.z = S.s * az;
    // the paddle's home is in front of the right hip; it reaches toward an incoming ball
    S.home.x = B.x + S.right * 0.55;
    S.home.y = 1.05;
    S.home.z = B.z - S.s * 0.5;
    S.plane = S.home.z;
    let tx = S.home.x, ty = S.home.y;
    if (incoming) {
      tx = clamp(M.ball.x, S.home.x - lv.reachX, S.home.x + lv.reachX);
      ty = clamp(S.pred.y, 0.5, 2.0);
    }
    const r = 1 - Math.exp(-12 * dt);
    S.pad.x += (tx - S.pad.x) * r;
    S.pad.y += (ty - S.pad.y) * r;
    S.pad.z = S.plane;
  }
  // ---------------------------------------------------------------- the ball and the rules

  const hitAt = {};
  function substep(M) {
    const b = M.ball;
    const e = P.step(b, C.SUB, hitAt);
    M.ballTime += C.SUB;
    if (b.state !== 'play') {
      // a dead ball still makes sounds and bounce rings
      if (e & EV.FLOOR && Math.abs(b.vy) > 0.4) ev(M, { type: 'deadBounce' });
      if (e & EV.TABLE) ev(M, { type: 'bounce', half: hitAt.z > 0 ? 0 : 1, x: hitAt.x, z: hitAt.z, v: -b.vy, dead: true });
      return;
    }
    b.flightT += C.SUB;
    M.stats.maxFlight = Math.max(M.stats.maxFlight, b.flightT);
    const S = M.sides[b.last], R = other(M, S);
    if (S.bud.saving >= 0 || R.bud.saving >= 0) return; // a save is on its way
    if (e & EV.NET) { b.netTouched = true; ev(M, { type: 'net', x: hitAt.x, y: hitAt.y }); replan(M, R, false); }
    if (e & EV.CORD) { b.netTouched = true; M.stats.cords++; ev(M, { type: 'cord', x: hitAt.x, y: hitAt.y }); replan(M, R, false); }
    if (e & EV.TABLE) {
      const half = hitAt.z > 0 ? 0 : 1;
      ev(M, { type: 'bounce', half, x: hitAt.x, z: hitAt.z, v: -b.vy });
      if (b.serve && !b.servedBounce) {
        if (half === S.i) { b.servedBounce = true; replan(M, R, false); }
        else return point(M, R.i, 'serve', S.i);
      } else if (half === S.i) return point(M, R.i, b.netTouched ? 'net' : 'own', S.i);
      else if (b.bounced !== R.i) {
        b.bounced = R.i;
        if (M.mode === 'rally' && S.i === 0) { M.run++; ev(M, { type: 'run', run: M.run }); }
        replan(M, R, true);
      } else return miss(M, R, 'double');
    }
    if (e & EV.FLOOR) {
      if (b.bounced === R.i) return miss(M, R, 'floor');
      return point(M, R.i, b.netTouched ? 'net' : 'out', S.i);
    }
    // off the table and below its top without landing on the other side: out (or the net)
    if (b.bounced !== R.i && b.y < C.H && (Math.abs(b.x) > C.W / 2 + C.R || Math.abs(b.z) > C.L / 2 + C.R) && (!b.serve || b.servedBounce || Math.sign(b.z) !== S.s)) {
      return point(M, R.i, b.netTouched && Math.sign(b.z) === S.s ? 'net' : 'out', S.i);
    }
    if (b.bounced !== R.i && Math.abs(b.z) > C.L / 2 + 1.3) return point(M, R.i, 'out', S.i);
    // the receiver: the ball has reached his contact plane
    if (b.bounced === R.i && !R.done) {
      const bl = b.z * R.s, pl = R.plane * R.s;
      if (R.lateT < 0 && bl >= pl) {
        if (!tryHit(M, R, false)) {
          if (R.ctrl === 'cpu') { R.done = true; return miss(M, R, 'passed'); }
          R.lateT = M.lv.late;
        }
      } else if (R.lateT >= 0 && bl > pl + 0.6) { R.done = true; return miss(M, R, 'passed'); }
    }
    if (b.flightT > K.WATCHDOG) {
      M.stats.watchdog++;
      return point(M, b.bounced === R.i ? S.i : R.i, 'watchdog', -1);
    }
  }

  function step(M, inputs) {
    const dt = DT;
    M.t += dt;
    M.frame++;
    M.phaseT += dt;
    for (const S of M.sides) control(M, S, inputs ? inputs[S.i] : null, dt);
    for (const S of M.sides) updateBud(M, S, dt);
    const b = M.ball;
    // a human that's a moment late can still get it (lateT)
    for (const S of M.sides) {
      if (S.lateT >= 0 && b.state === 'play' && b.bounced === S.i && !S.done) {
        if (S.ctrl !== 'keys' || S.swingT >= 0) {
          if (b.y > 0.3 && tryHit(M, S, true)) continue;
        }
        S.lateT -= dt;
        if (S.lateT < 0) { S.done = true; miss(M, S, 'passed'); }
      }
    }
    if (M.phase === 'serve') {
      placeHeld(M);
      const S = M.sides[M.server];
      if (S.ctrl === 'cpu' && M.phaseT > S.brain.serveDelay(M)) startToss(M, S, S.brain.serveIntent(M, S));
    } else if (M.phase === 'toss') {
      const S = M.sides[M.server], u = M.phaseT / K.TOSS_T, p = M.tossFrom;
      b.x = p.x; b.z = p.z;
      b.y = p.y + Math.sin(Math.min(1, u) * Math.PI) * 0.42;
      if (u >= 1) doServe(M, S);
    } else {
      M.ballAcc += dt * speedOf(M);
      while (M.ballAcc >= C.SUB) {
        M.ballAcc -= C.SUB;
        substep(M);
      }
      if (M.phase === 'point' && M.phaseT > (M.mode === 'rally' && M.lastPoint && M.lastPoint.runOver ? K.RUN_T : K.POINT_T)) afterPoint(M);
      else if (M.phase === 'game' && M.phaseT > K.GAME_T) newGame(M);
    }
  }

  root.TTMatch = { create, step, call, startToss, intentFor, makeShot, timeToContact, nextServer, DT, K, LEVELS, rng };
})(typeof window !== 'undefined' ? window : globalThis);
