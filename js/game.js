/* TT Table Tennis: the page. Scene and camera, the players and their paddles, the companion's visits, the HUD,
   the menus, the main loop and the window.game test hooks. The rules live in js/match.js; this file reads match
   state every frame and turns match.events into sounds, effects, calls and celebrations.

   Views: '1p' puts the camera behind and above you, looking down the table at the CPU; 'side' is the 2-player view
   from the side of the table; 'demo' slowly circles a CPU-vs-CPU rally behind the menus. */
(function () {
  'use strict';
  const T = THREE, Kit = window.Kit, P = window.TTPhys, C = P.C, MM = window.TTMatch, IN = window.TTInput, SFX = window.TTSfx;
  const $ = (id) => document.getElementById(id);
  const DT = MM.DT, clamp = P.clamp;
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE'], ['🍪', 'A COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'A BANANA']];
  const STORE = 'ttTableTennis.';
  const load = (k, d) => { try { const v = localStorage.getItem(STORE + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(STORE + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } };
  const rnow = () => performance.now() / 1000;

  // ---------------------------------------------------------------- renderer and scene
  const canvas = $('game');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  scene.background = new T.Color('#9fd3ef');
  scene.fog = new T.Fog('#9fd3ef', 20, 42);
  const camera = new T.PerspectiveCamera(50, 1, 0.05, 80);
  const stage = window.TTStage.build(scene, { skip: ['teddy', 'tommy'] });
  const fx = window.TTFx.create(scene);
  const faces = Kit.portraits(Kit.roster.list);

  const G = {
    screen: 'title',
    settings: Object.assign({ level: 'easy', games: 3, picks: { '1p': ['teddy', 'tommy'], '2p': ['teddy', 'tommy'], rally: ['teddy'] } }, load('settings', {})),
    M: null, mode: 'demo', view: 'demo', sides: [null, null], buds: [null, null],
    slow: 1, slowTarget: 1, slowT: 0, shake: 0, acc: 0, time: 0, camX: 0, camT: 0,
    hold: false, paused: false, testing: false, lastKeyAt: -9, script: null, auto: [false, false],
    overT: -1, gameScores: [], treats: 0, hintT: 0, servedOnce: false, firstRally: true, fans: stage.fans, look: null,
  };
  if (!G.settings.picks) G.settings.picks = { '1p': ['teddy', 'tommy'], '2p': ['teddy', 'tommy'], rally: ['teddy'] };
  const persist = () => save('settings', G.settings);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------------- people

  function buildPerson(id, tint) {
    const e = Kit.roster.get(id) || Kit.roster.get('teddy');
    const look = Object.assign({}, e.look, tint || {});
    const p = Kit.people.build(look);
    scene.add(p.root);
    return { p, e, id };
  }

  function disposePerson(o) {
    if (!o) return;
    scene.remove(o.p.root);
    if (o.pd) scene.remove(o.pd);
    if (o.tag) scene.remove(o.tag);
  }

  function makeSideView(i, id, tint) {
    const o = buildPerson(id, tint);
    o.pd = window.TTPoses.paddle();
    scene.add(o.pd);
    Object.assign(o, { i, ph: 0, poseT: 0, cel: null, celT: 0, sadT: 0, follow: 0, followUp: 0, turn: 0, jumpY: 0, jumpT: -1, treat: null, swingT: -1 });
    return o;
  }

  function setFans(skip) {
    for (const f of G.fans) stage.root.remove(f.p.root);
    G.fans = window.TTStage.crowd(stage.root, skip);
  }

  // ---------------------------------------------------------------- starting a match

  function startMatch(mode, o = {}) {
    const st = G.settings;
    let picks;
    if (mode === 'rally') picks = [(st.picks.rally || ['teddy'])[0], 'bolt'];
    else if (mode === 'demo') picks = o.p || pickDemo();
    else picks = (st.picks[mode] || ['teddy', 'tommy']).slice();
    const ctrl = mode === '2p' ? ['keys', 'keys'] : mode === 'demo' ? ['cpu', 'cpu'] : ['pad', 'cpu'];
    const level = mode === 'demo' ? 'normal' : o.level || st.level;
    const cpu = mode === 'rally' ? [level, 'wall'] : mode === 'demo' ? ['normal', 'normal'] : [level, level];
    G.M = MM.create({ mode: mode === 'demo' ? '1p' : mode, level, games: mode === 'demo' ? 1 : o.games || st.games, p: picks, ctrl, cpu, seed: o.seed });
    G.mode = mode;
    G.view = mode === '2p' ? 'side' : mode === 'demo' ? 'demo' : '1p';
    IN.setTwoPlayer(mode === '2p');
    for (let i = 0; i < 2; i++) {
      disposePerson(G.sides[i]);
      disposeBud(i);
      // a mirror match (or the robot vs himself) gets a second colour scheme
      const tint = i === 1 && picks[0] === picks[1] ? { top: '#18d4ff', bottom: '#2a2f45' } : null;
      G.sides[i] = makeSideView(i, picks[i], tint);
    }
    setFans(picks);
    fx.clear();
    G.slow = G.slowTarget = 1;
    G.slowT = 0;
    G.overT = -1;
    G.gameScores = [];
    G.treats = 0;
    G.paused = false;
    G.servedOnce = false;
    G.firstRally = true;
    G.acc = 0;
    G.script = null;
    G.auto = [false, false];
    setupHud();
    if (mode !== 'demo') { showScreen('hud'); Kit.sound.music('play'); }
    return G.M;
  }

  function pickDemo() {
    const pairs = [['teddy', 'tommy'], ['tommy', 'teddy'], ['teddy', 'zoom'], ['luna', 'tommy'], ['bruno', 'teddy'], ['tommy', 'bolt']];
    return pairs[Math.floor(Math.random() * pairs.length)];
  }

  // ---------------------------------------------------------------- the companion (visuals; the rules are in match.js)

  function disposeBud(i) {
    const b = G.buds[i];
    if (!b) return;
    disposePerson(b.o);
    G.buds[i] = null;
  }

  function budView(i) {
    if (G.buds[i]) return G.buds[i];
    const S = G.M.sides[i], id = Kit.roster.buddyFor(S.id);
    const other = G.M.sides[1 - i];
    // the same brother on both sides (2 players): the second one wears different colours
    const tint = G.buds[1 - i] && G.buds[1 - i].id === id ? { top: '#ffb02e', bottom: '#3a3f55' } : null;
    const o = buildPerson(id, tint);
    o.pd = window.TTPoses.paddle('#2f7de0');
    scene.add(o.pd);
    const scale = o.e.buddyScale || 0.8;
    o.p.root.scale.setScalar(scale);
    o.tag = Kit.gfx.nameTag(o.e.name, i === 0 ? '#8cc2ff' : '#ffb3bd');
    scene.add(o.tag);
    const b = { o, id, name: o.e.name, side: i, state: 'off', t: 0, x: 0, z: 0, fx: 0, fz: 0, ph: 0, scale, hop: 0, cel: Kit.roster.signature(o.e, 'hello'), bye: Kit.roster.signature(o.e, 'goodbye'), queueTreat: 0, saveTo: null };
    o.p.root.visible = o.pd.visible = o.tag.visible = false;
    G.buds[i] = b;
    void other;
    return b;
  }

  // where he stands: beside his player, on the free-hand side
  function budSpot(i) {
    const S = G.M.sides[i];
    return { x: clamp(S.body.x - S.right * 1.15, -2.9, 2.9), z: S.body.z + S.s * 0.15 };
  }

  function budArrive(i) {
    const b = budView(i), S = G.M.sides[i];
    const sp = budSpot(i);
    if (b.state === 'off' || b.state === 'out') {
      b.x = clamp(S.body.x - S.right * 3.4, -4.0, 4.0);
      b.z = sp.z;
      b.state = 'in';
      b.t = 0;
    } else {
      b.state = 'hello';
      b.t = 0;
    }
    b.queueTreat = 1;
    b.o.p.root.visible = b.o.pd.visible = b.o.tag.visible = true;
    SFX.boing();
  }

  function giveTreat(i) {
    const b = G.buds[i], o = G.sides[i];
    if (!b || !o) return;
    const [emo, word] = TREATS[Math.floor(Math.random() * TREATS.length)];
    b.o.p.root.updateMatrixWorld(true);
    o.p.root.updateMatrixWorld(true);
    const from = Kit.people.handWorld(b.o.p, -1, new T.Vector3());
    const hand = () => Kit.people.handWorld(o.p, -1, new T.Vector3()).add(new T.Vector3(0, 0.08, 0));
    if (o.treat) o.treat.t = Math.max(o.treat.t, o.treat.dur + o.treat.hold - 0.3);
    o.treat = fx.fly(emo, from, hand(), { dur: 0.7, arc: 0.7, follow: hand, hold: 3, size: 0.38 });
    toast(`${emo} ${word} FROM ${b.name}!`, 'treat');
    G.treats++;
    SFX.yum();
  }

  function updateBud(i, dt) {
    const b = G.buds[i];
    if (!b || b.state === 'off') return;
    const S = G.M.sides[i], p = b.o.p, sp = budSpot(i);
    b.t += dt;
    b.ph += dt * 9;
    let mode = 'ready', cel = null, y = 0;
    const toward = (tx, tz, v) => {
      const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
      if (d < 0.01) return true;
      const m = Math.min(d, v * dt);
      b.x += (dx / d) * m;
      b.z += (dz / d) * m;
      return d <= v * dt;
    };
    if (b.state === 'in') {
      // hops in from the side
      const there = toward(sp.x, sp.z, 3.4);
      mode = 'hop';
      y = Math.abs(Math.sin(b.t * 6.5)) * 0.35;
      if (there) { b.state = 'hello'; b.t = 0; }
    } else if (b.state === 'hello') {
      toward(sp.x, sp.z, 3);
      mode = 'hello';
      cel = b.cel;
      if (b.t > 1.1) {
        b.state = 'here';
        b.t = 0;
        if (b.queueTreat) { b.queueTreat = 0; b.giveT = 0.5; giveTreat(i); }
      }
    } else if (b.state === 'here') {
      toward(sp.x, sp.z, 4);
      mode = b.giveT > 0 ? 'give' : 'ready';
      if (b.giveT > 0) b.giveT -= dt;
    } else if (b.state === 'dive') {
      // throws himself at the ball
      const tgt = b.saveTo;
      if (tgt) toward(tgt.x - S.right * 0.55, tgt.z + S.s * 0.45, 9);
      mode = 'dive';
      if (b.t > 0.9) { b.state = 'here'; b.t = 0; }
    } else if (b.state === 'bye') {
      mode = 'bye';
      cel = b.bye;
      if (b.cel === 'boxing' && b.bye === 'jumpshot') y = Math.max(0, Math.sin(Math.min(1, b.t / 0.6) * Math.PI)) * 0.4;
      if (b.t > 1.0) { b.state = 'out'; b.t = 0; }
    } else if (b.state === 'out') {
      const there = toward(clamp(S.body.x - S.right * 3.6, -4, 4), sp.z, 3.4);
      mode = 'hop';
      y = Math.abs(Math.sin(b.t * 6.5)) * 0.35;
      if (there) { b.state = 'off'; b.o.p.root.visible = b.o.pd.visible = b.o.tag.visible = false; }
    }
    p.root.position.set(b.x, y, b.z);
    let face = S.s === 1 ? 0 : Math.PI;
    if (mode === 'hop' || (mode === 'hello' && b.state === 'hello')) {
      // turn to show his hello to the camera
      if (mode === 'hello') face = G.view === 'side' ? -Math.PI / 2 : S.i === 0 ? Math.PI : 0;
      else face = (b.state === 'in' ? Math.sign(sp.x - b.x) : -Math.sign(sp.x - b.x)) > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    if (mode === 'bye') face = G.view === 'side' ? -Math.PI / 2 : S.i === 0 ? Math.PI : 0;
    p.root.rotation.y += angleDiff(face, p.root.rotation.y) * Math.min(1, dt * 10);
    const k = 1 - Math.exp(-14 * dt);
    window.TTPoses.player(p, { mode, cel, t: b.t, ph: b.ph, move: 0, low: 0, tilt: mode === 'dive' ? -S.right * 0.5 : 0 }, k);
    // his paddle
    const pd = b.o.pd;
    const showPad = mode === 'ready' || mode === 'dive' || mode === 'give';
    pd.visible = showPad;
    if (showPad) {
      p.root.updateMatrixWorld(true);
      const sh = p.armR.getWorldPosition(new T.Vector3());
      let at;
      if (mode === 'dive' && b.saveTo) at = new T.Vector3(b.saveTo.x, b.saveTo.y, b.saveTo.z);
      else at = sh.clone().add(new T.Vector3(S.right * 0.25 * b.scale, -0.35 * b.scale, -S.s * 0.45 * b.scale));
      placePaddleFor(b.o, at, new T.Vector3(0, 0.1, -S.s), sh, b.scale);
    }
    b.o.tag.position.set(b.x, (y + 2.25) * b.scale + 0.3, b.z);
  }

  const angleDiff = (a, b) => {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  };

  // Put a paddle's blade at `at`, facing `face`, with its handle toward the shoulder; then reach for it.
  const tv = new T.Vector3(), tw = new T.Vector3();
  function placePaddleFor(o, at, face, shoulder, scale = 1) {
    o.pd.scale.setScalar(scale);
    const hand = tv.copy(shoulder).sub(at).normalize().multiplyScalar(0.55).add(tw.set(0, -0.45, 0)).normalize();
    window.TTPoses.placePaddle(o.pd, at, face, hand);
    const grip = o.pd.localToWorld(o.pd.grip.clone());
    window.TTPoses.aimArm(o.p, o.p.armR, grip);
  }

  // ---------------------------------------------------------------- players, every frame

  function updateSide(i, dt) {
    const o = G.sides[i], M = G.M, S = M.sides[i], p = o.p;
    o.poseT += dt;
    if (o.celT > 0) o.celT -= dt;
    if (o.sadT > 0) o.sadT -= dt;
    if (o.follow > 0) o.follow -= dt;
    // the jump-shot hop
    if (o.jumpT >= 0) {
      o.jumpT += dt;
      const u = o.jumpT / 0.65;
      o.jumpY = u < 1 ? Math.sin(u * Math.PI) * 0.5 : 0;
      if (u >= 1) o.jumpT = -1;
    }
    p.root.position.set(S.body.x, o.jumpY, S.body.z);
    const sp = Math.hypot(S.body.vx, S.body.vz);
    o.ph += dt * (3 + sp * 4.5);
    const serving = (M.phase === 'serve' || M.phase === 'toss') && M.server === i;
    let mode = 'ready';
    if (o.celT > 0) mode = 'celebrate';
    else if (o.sadT > 0) mode = 'sad';
    else if (serving) mode = 'serve';
    // facing the net; turned to the camera to celebrate
    let face = S.s === 1 ? 0 : Math.PI;
    if (mode === 'celebrate') face = G.view === 'side' ? -Math.PI / 2 : i === 0 ? Math.PI : 0;
    p.root.rotation.y += angleDiff(face, p.root.rotation.y) * Math.min(1, dt * 9);
    const k = 1 - Math.exp(-16 * dt);
    const low = clamp((1.05 - S.pad.y) / 0.35, 0, 1);
    const reachFwd = clamp((Math.abs(S.body.z) - Math.abs(S.pad.z) - 0.6) / 0.5, 0, 1);
    window.TTPoses.player(p, { mode, cel: o.cel, t: o.poseT, ph: o.ph, move: sp / 2.5, low, twist: 0.15 }, k);
    if (mode !== 'celebrate' && mode !== 'sad') p.hips.rotation.x -= reachFwd * 0.35 * k;
    // the paddle
    const hidePad = mode === 'celebrate';
    o.pd.visible = !hidePad;
    if (hidePad) return;
    p.root.updateMatrixWorld(true);
    const sh = p.armR.getWorldPosition(new T.Vector3());
    const fwd = new T.Vector3(0, 0, -S.s);
    const at = new T.Vector3(S.pad.x, S.pad.y, S.pad.z);
    let faceV = fwd.clone().add(new T.Vector3(0, 0.12, 0));
    const b = M.ball;
    if (serving) {
      // holding the ball on the paddle, then a little backswing during the toss
      at.set(b.x, (M.phase === 'toss' ? M.tossFrom.y : b.y) - 0.065, b.z);
      if (M.phase === 'toss') {
        const u = M.phaseT / MM.K.TOSS_T;
        at.z += S.s * Math.sin(Math.min(1, u) * Math.PI * 0.9) * 0.28;
        at.y += Math.sin(Math.min(1, u) * Math.PI) * 0.1;
        faceV.set(0, 0.25, -S.s);
      } else faceV.set(0, 1, -S.s * 0.35);
    } else if (o.follow > 0) {
      // follow-through after a hit
      const u = 1 - o.follow / 0.32;
      at.addScaledVector(fwd, Math.sin(u * Math.PI) * 0.26);
      at.y += o.followUp * Math.sin(u * Math.PI * 0.5);
      faceV.y += o.followUp > 0 ? -0.35 : 0.5;
    } else if (S.ctrl === 'cpu' || S.ctrl === 'keys') {
      // a backswing as the ball comes in
      const tl = MM.timeToContact(M, S);
      if (b.state === 'play' && b.last !== i && !S.done && tl < 0.3 && tl > 0) at.addScaledVector(fwd, -(0.3 - tl) * 0.9);
      if (S.ctrl === 'keys' && S.swingT >= 0) {
        const u = S.swingT / MM.K.SWING_T;
        at.addScaledVector(fwd, -0.25 + Math.sin(u * Math.PI) * 0.45);
      }
    }
    placePaddleFor(o, at, faceV, sh);
  }

  function updateFans(dt) {
    for (const f of G.fans) {
      f.ph += dt;
      if (f.cheer > 0) {
        f.cheer -= dt;
        Kit.people.pose(f.p, f.ph * (f.sig === 'boxing' ? 6.5 : 5), f.sig, 0.25);
        f.p.legL.rotation.x *= 0.3;
        f.p.legR.rotation.x *= 0.3;
      } else {
        Kit.people.pose(f.p, 0, 'idle', 0.1);
        f.p.hips.rotation.z = Math.sin(f.ph * 1.3) * 0.04;
        f.p.head.rotation.y = clamp(-G.M.ball.z * 0.25, -0.6, 0.6) * (f.p.root.position.x < 0 ? 1 : -1);
      }
    }
  }

  // ---------------------------------------------------------------- the camera

  const camPos = new T.Vector3(), camLook = new T.Vector3();
  function updateCamera(dt) {
    const M = G.M, asp = camera.aspect;
    let fov = 50;
    if (G.look) {
      camPos.set(...G.look.pos);
      camLook.set(...G.look.at);
      fov = G.look.fov || 40;
    } else if (G.view === '1p') {
      const S = M.sides[0];
      G.camX += (S.pad.x * 0.3 - G.camX) * (1 - Math.exp(-2.5 * dt));
      // keep the whole table in view on narrow screens: a wider lens and a step back
      const narrow = clamp((1.5 - asp) / 0.8, 0, 1);
      fov = 52 + narrow * 14;
      camPos.set(G.camX, 3.05 + narrow * 0.6, 4.9 + narrow * 1.0);
      camLook.set(G.camX * 0.35, 0.78, -0.9);
    } else if (G.view === 'side') {
      // the table and both players across the screen
      const half = 3.3, dist = 7.6;
      const hfov = 2 * Math.atan(half / dist);
      fov = clamp((2 * Math.atan(Math.tan(hfov / 2) / asp) * 180) / Math.PI, 28, 75);
      camPos.set(dist, 3.25, 0);
      camLook.set(0, 0.95, 0);
    } else {
      G.camT += dt * 0.07;
      const a = G.camT + 0.6;
      camPos.set(Math.sin(a) * 6.6, 3.2 + Math.sin(G.camT * 0.7) * 0.4, Math.cos(a) * 6.6);
      camLook.set(0, 0.85, 0);
    }
    if (G.slow < 0.8 && !G.look) fov -= (0.8 - G.slow) * 9;
    camera.position.copy(camPos);
    if (G.shake > 0) {
      G.shake = Math.max(0, G.shake - dt * 2.5);
      const s = G.shake * 0.06;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
    }
    camera.lookAt(camLook);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }

  // ---------------------------------------------------------------- input -> engine

  const ndc = new T.Vector2(), ray = new T.Raycaster();
  function rayAt(x, y) {
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    return { ox: o.x, oy: o.y, oz: o.z, dx: d.x, dy: d.y, dz: d.z };
  }

  // the swipe in metres a second on the paddle's plane
  function swipeOnPlane(S) {
    const s = IN.swipe();
    const d = camera.position.distanceTo(tv.set(S.pad.x, S.pad.y, S.pad.z));
    const mpp = (2 * d * Math.tan((camera.fov * Math.PI) / 360)) / window.innerHeight;
    return { x: s.x * mpp, y: -s.y * mpp };
  }

  function inputFor(i) {
    const M = G.M, S = M.sides[i];
    if (S.ctrl === 'cpu') return null;
    if (G.auto[i]) return autoInput(i);
    const raw = IN.snapshot(i);
    if (G.script && G.script.side === i) return scriptedInput(i, raw);
    if (S.ctrl === 'keys') return { keys: raw.keys, swing: raw.swing, call: raw.call, auto: raw.auto };
    const k = raw.keys;
    if (k.left || k.right || k.up || k.down) G.lastKeyAt = rnow();
    const inp = { keys: k, swing: raw.swing, serve: raw.serve, call: raw.call, power: raw.power };
    if (IN.ptr.seen && IN.ptr.active >= G.lastKeyAt) {
      inp.ray = rayAt(IN.ptr.x, IN.ptr.y);
      inp.swipe = swipeOnPlane(S);
      inp.keys = { up: k.up, down: k.down };
    }
    return inp;
  }

  // test hook: meet the next ball with a chosen swipe (game.swing)
  function scriptedInput(i, raw) {
    const M = G.M, S = M.sides[i], sc = G.script;
    const inp = { keys: {}, call: raw.call, swing: false, serve: false };
    const incoming = M.ball.state === 'play' && M.ball.last !== i && !S.done && S.pred;
    if (S.ctrl === 'keys') {
      if (incoming) {
        inp.keys = sc.keys || {};
        const tl = MM.timeToContact(M, S);
        if (tl < 0.16 && S.swingT < 0) inp.swing = true;
      }
      inp.auto = true;
    } else {
      inp.target = incoming ? { x: S.pred.x, y: S.pred.y } : { x: S.pad.x, y: S.pad.y };
      inp.swipe = incoming && MM.timeToContact(M, S) < 0.15 ? sc.swipe : { x: 0, y: 0 };
    }
    if (M.phase === 'serve' && M.server === i && sc.serve) inp.serve = inp.swing = true;
    if (S.done && M.ball.last === i && !sc.keep) G.script = null;
    return inp;
  }

  // test hook: let a bot play a human side (game.auto)
  const bots = [null, null];
  function autoInput(i) {
    const S = G.M.sides[i];
    if (!bots[i]) bots[i] = S.ctrl === 'keys' ? window.TTCPU.keysBot('ten', Math.random) : window.TTCPU.padBot('good', Math.random);
    return bots[i](G.M, S);
  }

  // ---------------------------------------------------------------- events -> sounds, effects, HUD

  const NAME = (i) => (G.sides[i] ? G.sides[i].e.name : '');
  const human = (i) => G.M.sides[i].ctrl !== 'cpu';
  const KIND_WORD = { top: 'TOPSPIN!', chop: 'BACKSPIN!', curve: 'CURVE!', smash: 'SMASH!' };

  function onEvent(e) {
    const M = G.M, demo = G.mode === 'demo';
    switch (e.type) {
      case 'hit': {
        const o = G.sides[e.side];
        o.follow = 0.32;
        o.followUp = e.kind === 'chop' ? -0.12 : e.kind === 'smash' ? -0.2 : 0.22;
        if (demo) break;
        if (e.kind === 'smash') {
          SFX.smash();
          SFX.slowmo();
          slowmo(0.2, 0.6);
          G.shake = 1;
          fx.burst(['POW!', 'WHAM!', 'SMASH!', 'KAPOW!'][Math.floor(Math.random() * 4)], e.x, e.y + 0.35, e.z, 1.1);
          fx.spark(e.x, e.y, e.z, 18, '#fff2a8', 3);
          callout(e.side, 'SMASH!');
        } else {
          SFX.tok(e.power);
          fx.spark(e.x, e.y, e.z, 5, '#ffe9b0', 1.4);
          if (human(e.side) && KIND_WORD[e.kind]) callout(e.side, KIND_WORD[e.kind]);
        }
        if (e.kind !== 'serve' && e.side === 0) G.firstRally = false;
        break;
      }
      case 'bounce':
        if (!demo) SFX.tik(e.v);
        fx.bounceRing(e.x, C.H, e.z, '#ffffff');
        break;
      case 'deadBounce':
        if (!demo) SFX.floor();
        break;
      case 'net':
        if (!demo) SFX.net();
        break;
      case 'cord':
        if (!demo) { SFX.net(); callout(M.ball.last, 'LUCKY NET!'); }
        break;
      case 'toss':
        if (!demo) SFX.toss();
        break;
      case 'serveReady':
        G.hintT = 0;
        break;
      case 'point': onPoint(e); break;
      case 'game': {
        G.gameScores.push(e.score);
        if (demo) break;
        bigCall(`GAME ${NAME(e.winner)}!`, `${e.score[0]} – ${e.score[1]}`, 'gold');
        SFX.fanfare();
        break;
      }
      case 'newGame':
        if (!demo) $('gameNo').textContent = `GAME ${e.no}`;
        break;
      case 'match': {
        if (demo) { G.overT = 2.5; break; }
        const w = G.sides[e.winner];
        w.cel = w.id === 'teddy' ? 'jumpshot' : Kit.roster.signature(w.e, 'hello');
        w.celT = 4;
        w.poseT = 0;
        if (w.cel === 'jumpshot') jumpShot(e.winner);
        G.sides[1 - e.winner].sadT = 3;
        fx.confetti(0, 2.5, 0, 140);
        bigCall(`${NAME(e.winner)} WINS!`, `${e.games[0]} – ${e.games[1]}`, 'gold');
        SFX.fanfare();
        SFX.cheer(1.5);
        for (const f of G.fans) f.cheer = 3;
        G.overT = 3.2;
        break;
      }
      case 'budIn':
        if (!demo) budArrive(e.side);
        break;
      case 'treat': {
        if (demo) break;
        const b = budView(e.side);
        if (b.state === 'here' || b.state === 'dive') { b.state = 'hello'; b.t = 0; b.queueTreat = 1; }
        else b.queueTreat = 1;
        SFX.boing();
        break;
      }
      case 'budOut': {
        const b = G.buds[e.side];
        if (b && b.state !== 'off') { b.state = 'bye'; b.t = 0; }
        break;
      }
      case 'budNope':
        wiggle(e.side);
        SFX.nope();
        break;
      case 'saving': {
        const b = budView(e.side);
        b.state = 'dive';
        b.t = 0;
        b.saveTo = { x: e.x, y: e.y, z: e.z };
        slowmo(0.3, 0.7);
        break;
      }
      case 'save': {
        const b = budView(e.side);
        b.saveTo = { x: e.x, y: e.y, z: e.z };
        if (demo) break;
        toast(`${b.name} SAVED IT!`, 'save');
        fx.burst('SAVED!', e.x, e.y + 0.4, e.z, 1.0, '#9dff6a');
        SFX.tok(0.5);
        SFX.cheer(0.8);
        break;
      }
      case 'run': {
        const el = $('runNo');
        el.textContent = e.run;
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
        if (e.run % 10 === 0) { callout(0, `${e.run} IN A ROW!`); SFX.cheer(0.7); }
        else SFX.beep(e.run % 5 === 0);
        break;
      }
    }
  }

  function celebrationFor(i, info) {
    const o = G.sides[i];
    if (o.id === 'teddy') return info.smash ? 'jumpshot' : 'boxing';
    return Kit.roster.signature(o.e, 'hello');
  }

  function onPoint(e) {
    const M = G.M, demo = G.mode === 'demo', w = e.winner, l = 1 - w;
    const W = G.sides[w], Lo = G.sides[l];
    if (M.mode === 'rally') {
      if (!demo && e.runOver) {
        const best = load('bestRally.' + M.level, 0);
        const rec = e.run > best;
        if (rec) save('bestRally.' + M.level, e.run);
        $('runBest').textContent = Math.max(best, e.run);
        bigCall(`RALLY: ${e.run}!`, rec && e.run > 0 ? 'NEW BEST!' : `BEST ${Math.max(best, e.run)}`, rec ? 'gold' : '');
        if (rec && e.run > 2) { fx.confetti(0, 2.5, 1.5, 80); SFX.fanfare(); G.sides[0].cel = celebrationFor(0, e); G.sides[0].celT = 1.8; G.sides[0].poseT = 0; }
        else { SFX.aww(); G.sides[0].sadT = 1.2; }
        $('runNo').textContent = 0;
      }
      return;
    }
    if (!demo) {
      updateScoreHud(true, w);
      const reason = e.byStrike ? (e.ace ? 'ACE!' : e.smash ? 'SMASH!' : '') : e.reason;
      if (e.match) { /* the match event does the big call */ }
      else if (e.game) { /* so does the game event */ }
      else if (e.call) bigCall(e.call, reason, 'gold');
      else bigCall(`POINT ${NAME(w)}!`, reason, w === 1 ? 'red' : '');
      const good = G.mode === '2p' || w === 0;
      SFX.point(good);
      if (good) SFX.cheer(e.smash ? 1.4 : 0.8);
      else SFX.aww();
      for (const f of G.fans) if (Math.random() < 0.7) f.cheer = 1.3;
    }
    if (e.match) return;
    W.cel = celebrationFor(w, e);
    W.celT = 1.6;
    W.poseT = 0;
    if (W.cel === 'jumpshot') jumpShot(w);
    Lo.sadT = 1.1;
    stage.board.update(M.sides[0].score, M.sides[1].score, M.sides[0].games, M.sides[1].games, [NAME(0), NAME(1)]);
  }

  // Teddy's jump shot: a hop, both hands up, and a basketball flies off: SWISH!
  function jumpShot(i) {
    const o = G.sides[i];
    o.jumpT = 0;
    o.p.root.updateMatrixWorld(true);
    const from = Kit.people.handWorld(o.p, 1, new T.Vector3()).add(new T.Vector3(0, 0.4, 0));
    const to = from.clone().add(new T.Vector3((Math.random() - 0.5) * 2, 1.6, -G.M.sides[i].s * 3));
    setTimeoutGame(0.25, () => { fx.fly('🏀', from, to, { dur: 1.1, arc: 1.2, size: 0.4, spin: 6 }); Kit.sound.swish(); });
  }

  function slowmo(v, t) {
    if (G.testing && G.noSlow) return;
    G.slowTarget = v;
    G.slowT = t;
  }

  // timers in real (unpaused) time, so they also work while the Browser pane is hidden
  const timers = [];
  function setTimeoutGame(t, fn) { timers.push({ t, fn }); }

  // ---------------------------------------------------------------- HUD

  function setupHud() {
    const M = G.M;
    if (G.mode === 'demo') return;
    for (let i = 0; i < 2; i++) {
      const pb = $('pb' + i), S = M.sides[i];
      pb.querySelector('.face img').src = faces[S.id] || '';
      pb.querySelector('.nm').textContent = NAME(i);
      pb.querySelector('.who').textContent = G.mode === '2p' ? `P${i + 1}` : i === 0 ? 'YOU' : G.mode === 'rally' ? 'WALL' : M.level.toUpperCase();
      const g = pb.querySelector('.gms');
      g.innerHTML = '';
      const need = Math.ceil(M.bestOf / 2);
      for (let k = 0; k < need; k++) g.appendChild(document.createElement('i'));
      g.style.display = M.bestOf > 1 && G.mode !== 'rally' ? '' : 'none';
      pb.querySelector('.pts').style.display = G.mode === 'rally' ? 'none' : '';
      const budId = Kit.roster.buddyFor(S.id), bud = pb.querySelector('.bud');
      bud.querySelector('img').src = faces[budId] || '';
      const canCall = S.ctrl !== 'cpu';
      bud.style.display = canCall ? '' : 'none';
      bud.querySelector('.k').textContent = G.mode === '2p' ? (i === 0 ? 'T' : 'ENTER') : 'T';
      const btn = $('budBtn' + i);
      btn.style.display = canCall ? '' : 'none';
      btn.querySelector('img').src = faces[budId] || '';
      btn.querySelector('.lab').textContent = Kit.roster.get(budId).name;
      btn.querySelector('.key').textContent = G.mode === '2p' ? (i === 0 ? 'T' : 'ENTER') : 'T';
    }
    $('gameNo').textContent = G.mode === 'rally' ? `🤖 ${M.level.toUpperCase()}` : M.bestOf > 1 ? `GAME ${M.gameNo}` : 'TO 11';
    $('rallyBox').classList.toggle('hidden', G.mode !== 'rally');
    $('runNo').textContent = 0;
    $('runBest').textContent = load('bestRally.' + M.level, 0);
    updateScoreHud(false);
    stage.board.update(0, 0, 0, 0, [NAME(0), NAME(1)]);
  }

  function updateScoreHud(bump, side) {
    const M = G.M;
    for (let i = 0; i < 2; i++) {
      const pb = $('pb' + i), el = pb.querySelector('.pts');
      el.textContent = M.sides[i].score;
      if (bump && side === i) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
      pb.querySelectorAll('.gms i').forEach((d, k) => d.classList.toggle('on', k < M.sides[i].games));
    }
  }

  function hudFrame() {
    const M = G.M;
    if (G.mode === 'demo') return;
    for (let i = 0; i < 2; i++) {
      const S = M.sides[i], B = S.bud, pb = $('pb' + i);
      pb.querySelector('.srv').classList.toggle('on', (M.phase === 'serve' || M.phase === 'toss') && M.server === i && G.mode !== 'rally');
      if (S.ctrl === 'cpu') continue;
      const fill = B.on ? B.t / MM.K.BUD_TIME : B.cool > 0 ? 1 - B.cool / MM.K.BUD_COOL : 1;
      const bud = pb.querySelector('.bud'), btn = $('budBtn' + i);
      bud.querySelector('i').style.setProperty('--fill', fill.toFixed(3));
      bud.classList.toggle('on', B.on);
      bud.classList.toggle('rest', !B.on && B.cool > 0);
      btn.style.setProperty('--fill', B.on ? fill.toFixed(3) : 0);
      btn.classList.toggle('on', B.on);
      btn.classList.toggle('rest', !B.on && B.cool > 0);
    }
    // hints
    let hint = '';
    const touch = IN.ptr.type === 'touch';
    if (M.phase === 'serve' && M.sides[M.server].ctrl !== 'cpu' && M.phaseT > 1.2 && !G.paused) {
      hint = G.mode === '2p' ? `${NAME(M.server)}: PRESS ${M.server === 0 ? 'F' : 'L'} TO SERVE` : touch ? 'TAP TO SERVE!' : 'CLICK OR SPACE TO SERVE!';
    } else if (G.firstRally && G.mode !== '2p' && M.phase === 'rally' && M.ball.last === 1 && M.level === 'easy') {
      hint = 'PUT YOUR PADDLE IN THE RING!';
    }
    const h = $('hint');
    if (h.textContent !== hint && hint) h.textContent = hint;
    h.classList.toggle('on', !!hint);
  }

  function bigCall(text, small, cls) {
    const el = $('call');
    el.className = 'call';
    el.querySelector('b').textContent = text;
    el.querySelector('small').textContent = small || '';
    void el.offsetWidth;
    el.className = 'call show ' + (cls || '');
  }
  function callout(side, text) {
    const el = $('co' + (side === 1 ? 1 : 0));
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }
  function toast(text, cls) {
    const box = $('toasts');
    const t = document.createElement('div');
    t.className = 'toast ' + (cls || '');
    t.textContent = text;
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeoutGame(2.1, () => t.remove());
  }
  function wiggle(i) {
    for (const el of [$('pb' + i).querySelector('.bud'), $('budBtn' + i)]) { el.classList.remove('no'); void el.offsetWidth; el.classList.add('no'); }
  }

  // ---------------------------------------------------------------- screens and menus

  function showScreen(name) {
    G.screen = name;
    for (const id of ['title', 'pick', 'pause', 'results']) $(id).classList.toggle('hidden', id !== name);
    $('hud').classList.toggle('hidden', !(name === 'hud' || name === 'pause'));
    $('muteMenu').classList.toggle('hidden', name === 'hud');
    if (name === 'title' || name === 'pick') Kit.sound.music('title');
  }

  function segInit(id, key, parse) {
    const seg = $(id);
    const paint = () => seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', parse(b.dataset.v) === G.settings[key]));
    seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { G.settings[key] = parse(b.dataset.v); persist(); paint(); SFX.beep(); }));
    paint();
    return paint;
  }
  const paintLevel = segInit('segLevel', 'level', (v) => v);
  const paintGames = segInit('segGames', 'games', (v) => +v);

  let pickMode = '1p';
  const ROSTER = Kit.roster.list.map((c) => c.id);
  function openPick(mode) {
    Kit.sound.init();
    pickMode = mode;
    const picks = (G.settings.picks[mode] || ['teddy', 'tommy']).slice();
    G.settings.picks[mode] = picks;
    $('pickTitle').textContent = mode === '2p' ? 'PICK YOUR PLAYERS!' : mode === 'rally' ? 'RALLY CHALLENGE' : "WHO'S PLAYING?";
    $('lab0').textContent = mode === '2p' ? 'PLAYER 1 · A D + F' : 'YOU';
    $('lab1').textContent = mode === '2p' ? 'PLAYER 2 · ← → + L' : 'VS (COMPUTER)';
    $('row1').style.display = mode === 'rally' ? 'none' : '';
    $('pickFoot').innerHTML = mode === 'rally'
      ? 'Keep the ball going against <b>Bolt the wall robot</b>. He never misses, and he gets faster every hit. How many can you do?'
      : mode === '2p'
        ? 'Side view. <b>P1</b>: W A S D move, <b>F</b> swing, <b>T</b> calls your brother. <b>P2</b>: arrows move, <b>L</b> swing, <b>Enter</b> calls. Hold toward the net for topspin, away for backspin. On a touch screen, tap your half to swing.'
        : 'First to 11 (win by 2). Serves change every 2 points. Tap your brother\'s face, or press <b>T</b>, to call him in for 10 seconds of doubles!';
    for (let r = 0; r < 2; r++) {
      const row = $('row' + r), cards = row.querySelector('.cards');
      cards.innerHTML = '';
      for (const id of ROSTER) {
        const e = Kit.roster.get(id);
        const c = document.createElement('button');
        c.className = 'card';
        c.dataset.id = id;
        c.innerHTML = `<img src="${faces[id]}" alt=""><span>${e.name}</span>`;
        c.addEventListener('click', () => { picks[r] = id; paintPick(); SFX.beep(); persist(); });
        cards.appendChild(c);
      }
    }
    paintPick();
    showScreen('pick');
  }
  function paintPick() {
    const picks = G.settings.picks[pickMode];
    for (let r = 0; r < 2; r++) {
      const row = $('row' + r);
      row.querySelectorAll('.card').forEach((c) => c.classList.toggle('sel', c.dataset.id === picks[r]));
      const bid = Kit.roster.buddyFor(picks[r] || 'teddy');
      const note = row.querySelector('.buddyNote');
      note.querySelector('img').src = faces[bid];
      note.querySelector('span').textContent = r === 1 && pickMode !== '2p' ? 'plays alone' : `+ BUDDY: ${Kit.roster.get(bid).name}`;
      note.style.visibility = r === 1 && pickMode !== '2p' ? 'hidden' : '';
    }
  }
  function cyclePick(r, d) {
    const picks = G.settings.picks[pickMode];
    const i = ROSTER.indexOf(picks[r]);
    picks[r] = ROSTER[(i + d + ROSTER.length) % ROSTER.length];
    paintPick();
    SFX.beep();
    persist();
  }

  function play() {
    Kit.sound.init();
    persist();
    startMatch(pickMode);
  }

  function toMenu() {
    G.paused = false;
    startMatch('demo');
    showScreen('title');
  }

  function pause(on) {
    if (G.mode === 'demo' || G.screen === 'results') return;
    G.paused = on;
    showScreen(on ? 'pause' : 'hud');
    $('pauseFoot').innerHTML = G.mode === '2p'
      ? 'P1: W A S D + F, T calls · P2: arrows + L, Enter calls · P pauses · M sound'
      : 'Mouse or finger moves the paddle · swipe up = topspin, down = backspin, sideways = curve · T calls your brother · P pauses · M sound';
    Kit.sound.music(on ? 'pause' : 'play');
  }

  function showResults() {
    const M = G.M, w = M.winner, o = G.sides[w];
    $('winText').textContent = `${o.e.name} WINS!`;
    $('winFace').src = faces[o.id];
    $('winScore').textContent = `${M.sides[0].games} – ${M.sides[1].games}`;
    $('winGames').textContent = G.gameScores.map((s) => `${s[0]}–${s[1]}`).join('   ');
    const st = M.sides[0].stats, st2 = M.sides[1].stats;
    $('winStats').textContent = `Longest rally ${M.longest} · smashes ${st.smashes + st2.smashes} · brother saves ${st.saves + st2.saves} · treats ${G.treats}`;
    let msg = '';
    if (G.mode === '1p') msg = w === 0 ? 'Great match! Try a harder level next?' : 'So close! Call your brother in and try again!';
    else if (G.mode === '2p') msg = `Well played, ${NAME(0)} and ${NAME(1)}!`;
    $('winMsg').textContent = msg;
    showScreen('results');
    Kit.sound.music('over');
  }

  $('go1').addEventListener('click', () => openPick('1p'));
  $('go2').addEventListener('click', () => openPick('2p'));
  $('go3').addEventListener('click', () => openPick('rally'));
  $('pickBack').addEventListener('click', () => { SFX.beep(); showScreen('title'); });
  $('pickGo').addEventListener('click', play);
  $('pauseBtn').addEventListener('click', () => pause(true));
  $('resumeBtn').addEventListener('click', () => pause(false));
  $('quitBtn').addEventListener('click', toMenu);
  $('againBtn').addEventListener('click', () => startMatch(G.mode));
  $('menuBtn').addEventListener('click', toMenu);
  const paintMute = () => { const m = Kit.sound.isMuted() ? '🔇' : '🔊'; $('muteBtn').textContent = m; $('muteMenu').textContent = m; };
  const toggleMute = () => { Kit.sound.init(); Kit.sound.toggleMute(); paintMute(); };
  $('muteBtn').addEventListener('click', toggleMute);
  $('muteMenu').addEventListener('click', toggleMute);
  paintMute();
  for (let i = 0; i < 2; i++) {
    const call = (ev) => { ev.stopPropagation(); Kit.sound.init(); IN.press(i, 'call'); };
    $('budBtn' + i).addEventListener('pointerdown', call);
    $('pb' + i).querySelector('.bud').addEventListener('pointerdown', call);
  }

  IN.bind(canvas, {
    down() { Kit.sound.init(); },
    key(e) {
      Kit.sound.init();
      const c = e.code, s = G.screen;
      if (e.repeat) return;
      if (c === 'KeyM') { toggleMute(); return false; }
      if (s === 'title') {
        if (c === 'Digit1' || c === 'Enter') openPick('1p');
        else if (c === 'Digit2') openPick('2p');
        else if (c === 'Digit3' || c === 'KeyR') openPick('rally');
        else if (c === 'ArrowLeft' || c === 'ArrowRight') {
          const L = ['easy', 'normal', 'pro'];
          G.settings.level = L[(L.indexOf(G.settings.level) + (c === 'ArrowLeft' ? 2 : 1)) % 3];
          persist(); paintLevel();
        } else if (c === 'KeyG') {
          const N = [1, 3, 5];
          G.settings.games = N[(N.indexOf(G.settings.games) + 1) % 3];
          persist(); paintGames();
        }
        return false;
      }
      if (s === 'pick') {
        if (c === 'KeyA') cyclePick(0, -1);
        else if (c === 'KeyD') cyclePick(0, 1);
        else if (c === 'ArrowLeft') cyclePick(pickMode === '1p' || pickMode === '2p' ? 1 : 0, -1);
        else if (c === 'ArrowRight') cyclePick(pickMode === '1p' || pickMode === '2p' ? 1 : 0, 1);
        else if (c === 'Enter' || c === 'Space' || c === 'KeyF') play();
        else if (c === 'Escape') showScreen('title');
        return false;
      }
      if (s === 'results') {
        if (c === 'Enter' || c === 'Space') startMatch(G.mode);
        else if (c === 'Escape') toMenu();
        return false;
      }
      if (s === 'pause') {
        if (c === 'KeyP' || c === 'Escape' || c === 'Space' || c === 'Enter') pause(false);
        return false;
      }
      if (s === 'hud' && (c === 'KeyP' || c === 'Escape')) { pause(true); return false; }
      return true;
    },
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { Kit.sound.suspend(); if (G.screen === 'hud' && !G.testing) pause(true); }
    else Kit.sound.resume();
  });

  // ---------------------------------------------------------------- the loop

  function engineFrame() {
    const M = G.M;
    const inputs = [inputFor(0), inputFor(1)];
    MM.step(M, inputs);
    for (const e of M.events) onEvent(e);
    M.events.length = 0;
  }

  function tick(rdt) {
    G.time += rdt;
    for (let i = timers.length - 1; i >= 0; i--) {
      timers[i].t -= rdt;
      if (timers[i].t <= 0) { const f = timers[i].fn; timers.splice(i, 1); f(); }
    }
    if (G.slowT > 0) { G.slowT -= rdt; if (G.slowT <= 0) G.slowTarget = 1; }
    G.slow += (G.slowTarget - G.slow) * Math.min(1, rdt * (G.slowTarget < G.slow ? 30 : 3));
    const running = G.M && !G.paused && G.screen !== 'results';
    if (running) {
      G.acc += rdt * G.slow;
      let n = 0;
      while (G.acc >= DT && n < 14) { G.acc -= DT; engineFrame(); n++; }
      if (n >= 14) G.acc = 0;
    }
    if (G.overT > 0 && running) {
      G.overT -= rdt;
      if (G.overT <= 0) {
        if (G.mode === 'demo') startMatch('demo');
        else showResults();
      }
    }
    animate(running ? rdt * G.slow : 0, rdt);
  }

  function animate(dt, rdt) {
    const M = G.M;
    if (!M) return;
    for (let i = 0; i < 2; i++) updateSide(i, dt);
    for (let i = 0; i < 2; i++) updateBud(i, dt);
    updateFans(dt);
    // the aim ring: where to put your paddle (Easy: bright, Normal: faint)
    let aim = null;
    const S0 = M.sides[0];
    const show = G.mode !== 'demo' && M.ball.state === 'play' && M.ball.last === 1 && !S0.done && S0.pred && S0.ctrl !== 'cpu';
    if (show && M.level !== 'pro') {
      const p = S0.pred;
      aim = { on: true, x: p.x, y: p.y, z: p.z, size: S0.ctrl === 'keys' ? 0.45 : M.lv.reach * 1.6, strength: M.level === 'easy' ? 0.95 : 0.45 };
    }
    if (G.mode === '2p' && M.level === 'easy') {
      const S1 = M.sides[1];
      if (M.ball.state === 'play' && M.ball.last === 0 && !S1.done && S1.pred) aim = { on: true, x: S1.pred.x, y: S1.pred.y, z: S1.pred.z, size: 0.45, strength: 0.7, color: '#ffb3bd' };
    }
    const sp = Math.hypot(M.ball.vx, M.ball.vy, M.ball.vz);
    fx.update(M.ball, rdt, {
      aim, trail: clamp((sp - 2) / 4, 0, 1) + (M.ball.kind === 'smash' ? 0.6 : 0),
      trailColor: M.ball.kind === 'smash' ? '#ff5a3a' : '#ffb347',
      ballOn: !(M.phase === 'serve' && false),
    });
    updateCamera(rdt);
    hudFrame();
  }

  let last = performance.now();
  function loop(t) {
    requestAnimationFrame(loop);
    const rdt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (!G.hold) tick(rdt);
    renderer.render(scene, camera);
  }

  // ---------------------------------------------------------------- start

  startMatch('demo');
  showScreen('title');
  requestAnimationFrame(loop);

  // ---------------------------------------------------------------- test hooks (window.game)

  function summary() {
    const M = G.M, b = M.ball;
    return {
      screen: G.screen, mode: G.mode, view: G.view, phase: M.phase, server: M.server, level: M.level,
      score: [M.sides[0].score, M.sides[1].score], games: [M.sides[0].games, M.sides[1].games], rally: M.rally, run: M.run,
      ball: { x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2), state: b.state, last: b.last, kind: b.kind },
      pads: M.sides.map((S) => ({ x: +S.pad.x.toFixed(2), y: +S.pad.y.toFixed(2), z: +S.pad.z.toFixed(2) })),
      buds: M.sides.map((S) => ({ on: S.bud.on, t: +S.bud.t.toFixed(1), armed: S.bud.armed, cool: +S.bud.cool.toFixed(1), saves: S.bud.saves, view: G.buds[S.i] ? G.buds[S.i].state : 'off' })),
      slow: +G.slow.toFixed(2), winner: M.winner,
    };
  }

  window.game = {
    G, M: () => G.M, scene, camera, renderer, fx,
    // straight into a match: game.start({ mode: '1p' | '2p' | 'rally', level, games, p: [id, id] })
    start(o = {}) {
      G.testing = true;
      Kit.sound.init();
      const mode = o.mode || '1p';
      if (o.level) G.settings.level = o.level;
      if (o.games) G.settings.games = o.games;
      if (o.p) G.settings.picks[mode] = o.p.slice();
      startMatch(mode, o);
      return summary();
    },
    // advance the game by `seconds` in 1/60 s steps, then draw (works while the tab's animation is throttled)
    step(seconds = 1) {
      G.testing = true;
      const n = Math.max(1, Math.round(seconds * 60));
      for (let i = 0; i < n; i++) tick(1 / 60);
      renderer.render(scene, camera);
      return summary();
    },
    // stop the live loop, so only step() moves time
    hold(on = true) { G.hold = on; G.testing = true; return on; },
    state: summary,
    // serve now (for the side that's serving, if it's a human)
    serve(side = 0) { IN.press(side, G.mode === '2p' ? 'swing' : 'serve'); return this.step(1 / 30); },
    // meet the next ball on a human side with a swipe { x, y } in m/s (y > 0 = up = topspin), or keys for 2P
    swing(o = {}) {
      G.script = { side: o.side || 0, swipe: { x: o.x || 0, y: o.y === undefined ? 2.5 : o.y }, keys: o.keys, serve: o.serve !== false, keep: !!o.keep };
      return G.script;
    },
    // let the test bot play a human side
    auto(side = 0, on = true) { G.auto[side] = on; bots[side] = null; return on; },
    // the next CPU shot is a high floater; with game.swing({ y: 3 }) you smash it
    pop(side = 1) { const S = G.M.sides[side]; if (S.brain) { const f = S.brain.intent; S.brain.intent = (M, s) => { S.brain.intent = f; return { pop: true, power: 0.35, aim: 0 }; }; } return true; },
    buddy(side = 0) { IN.press(side, 'call'); return this.step(1 / 30).buds[side]; },
    celebrate(side = 0, cel) { const o = G.sides[side]; o.cel = cel || celebrationFor(side, {}); o.celT = 2; o.poseT = 0; if (o.cel === 'jumpshot') jumpShot(side); return o.cel; },
    // look from somewhere: game.look([x, y, z], [x, y, z], fov) ; game.look(null) goes back
    look(pos, at, fov) { G.look = pos ? { pos, at, fov } : null; return G.look; },
    view(v) { G.view = v; return v; },
    pause, screen: showScreen, results: showResults, noSlow(on = true) { G.noSlow = on; G.testing = true; },
    sim: (o) => window.TTCPU.sim(o), soak: (n, o) => window.TTCPU.soak(n, o), fuzz: (n) => window.TTCPU.fuzz(n),
  };
})();
