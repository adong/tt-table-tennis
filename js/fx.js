/* TT Table Tennis: effects. The ball (orange, with a soft glow so it's easy to follow), its shadow on whatever is
   under it (the table or the floor, smaller and fainter the higher it is), a short trail, bounce rings, the aim
   ring that shows where to put your paddle, comic POW! starbursts for smashes, hit sparks, confetti and flying
   emoji. Exposes window.TTFx.create(scene). */
(function () {
  'use strict';
  const T = THREE, Kit = window.Kit;
  const { makeCanvas, toTexture, dotTexture, glowTexture, emojiTexture, FONT } = Kit.gfx;
  const C = window.TTPhys.C;

  function shadowTexture() {
    const [c, g] = makeCanvas(64, 64);
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.85)');
    gr.addColorStop(0.55, 'rgba(0,0,0,0.5)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return toTexture(c);
  }

  // a comic starburst with a word: POW!, WHAM!, SMASH!
  const burstCache = {};
  function burstTexture(word, fill = '#ffd400') {
    const key = word + fill;
    if (burstCache[key]) return burstCache[key];
    const [c, g] = makeCanvas(256, 256);
    g.translate(128, 128);
    g.beginPath();
    for (let i = 0; i < 28; i++) {
      const r = i % 2 ? 70 : 122, a = (i / 28) * Math.PI * 2;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = '#14121f';
    g.stroke();
    g.rotate(-0.12);
    g.font = `${word.length > 4 ? 46 : 58}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeStyle = '#14121f';
    g.strokeText(word, 0, 4);
    g.fillStyle = '#ff3d7f';
    g.fillText(word, 0, 4);
    return (burstCache[key] = toTexture(c));
  }

  function ringTexture() {
    const [c, g] = makeCanvas(128, 128);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 10;
    g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 4;
    g.setLineDash([10, 10]);
    g.beginPath(); g.arc(64, 64, 36, 0, Math.PI * 2); g.stroke();
    return toTexture(c);
  }

  function create(scene) {
    const grp = new T.Group();
    scene.add(grp);

    // the ball
    const ball = new T.Mesh(new T.SphereGeometry(C.R, 20, 14), new T.MeshStandardMaterial({ color: '#ff9a1f', emissive: '#ff7a00', emissiveIntensity: 0.35, roughness: 0.4 }));
    ball.castShadow = true;
    grp.add(ball);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: glowTexture(), color: '#ffcf7a', transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending }));
    glow.scale.set(0.28, 0.28, 1);
    grp.add(glow);
    const shadow = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.6 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.renderOrder = 2;
    grp.add(shadow);

    // trail
    const TRAIL = 12;
    const trail = [];
    for (let i = 0; i < TRAIL; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: dotTexture(), color: '#ffb347', transparent: true, depthWrite: false, opacity: 0 }));
      grp.add(s);
      trail.push(s);
    }
    const hist = [];

    // the aim ring on the contact plane: where to put your paddle
    const aim = new T.Sprite(new T.SpriteMaterial({ map: ringTexture(), color: '#ffe14a', transparent: true, depthWrite: false, depthTest: false, opacity: 0 }));
    aim.renderOrder = 5;
    grp.add(aim);

    // pools: bounce rings, bursts, sparks, flying emoji, confetti
    const rings = [], bursts = [], sparks = [], flyers = [], confetti = [];
    const ringGeo = new T.RingGeometry(0.05, 0.075, 24);
    function bounceRing(x, y, z, color = '#ffffff') {
      const m = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: T.DoubleSide }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y + 0.004, z);
      grp.add(m);
      rings.push({ m, t: 0 });
    }

    function burst(word, x, y, z, size = 1.1, fill) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: burstTexture(word, fill), transparent: true, depthWrite: false, depthTest: false }));
      s.position.set(x, y, z);
      s.renderOrder = 6;
      grp.add(s);
      bursts.push({ s, t: 0, size });
    }

    function spark(x, y, z, n = 10, color = '#fff2a8', speed = 2.2) {
      for (let i = 0; i < n; i++) {
        const s = new T.Sprite(new T.SpriteMaterial({ map: dotTexture(), color, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
        s.position.set(x, y, z);
        s.scale.setScalar(0.06);
        grp.add(s);
        const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
        sparks.push({ s, t: 0, life: 0.35 + Math.random() * 0.25, v: new T.Vector3(Math.cos(a) * Math.cos(b), Math.sin(b) + 0.4, Math.sin(a) * Math.cos(b)).multiplyScalar(speed * (0.5 + Math.random())) });
      }
    }

    // an emoji that flies from a to b in an arc (a treat), then optionally stays stuck to a target
    function fly(emoji, from, to, opts = {}) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: emojiTexture(emoji), transparent: true, depthWrite: false }));
      s.scale.setScalar(opts.size || 0.42);
      s.position.copy(from);
      s.renderOrder = 4;
      grp.add(s);
      const f = { s, t: 0, dur: opts.dur || 0.7, from: from.clone(), to: to.clone(), arc: opts.arc || 0.9, follow: opts.follow || null, hold: opts.hold || 0, spin: opts.spin || 0 };
      flyers.push(f);
      return f;
    }

    function confettiBurst(x, y, z, n = 90) {
      const cols = ['#ff3d7f', '#ffd400', '#18d4ff', '#3fc22b', '#ff9f1c', '#8d5bd8', '#ffffff'];
      const geo = new T.PlaneGeometry(0.06, 0.1);
      for (let i = 0; i < n; i++) {
        const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: cols[i % cols.length], side: T.DoubleSide }));
        m.position.set(x + (Math.random() - 0.5) * 2, y + Math.random(), z + (Math.random() - 0.5) * 2);
        grp.add(m);
        confetti.push({ m, t: 0, life: 3 + Math.random() * 1.5, v: new T.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 4, (Math.random() - 0.5) * 3), r: new T.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9) });
      }
    }

    const remove = (o) => { grp.remove(o); if (o.material) o.material.dispose(); };

    // b: the engine ball; view: { aim: {x,y,z,on}, cam } ; dt real seconds
    function update(b, dt, view) {
      ball.position.set(b.x, b.y, b.z);
      glow.position.copy(ball.position);
      const visible = view.ballOn !== false;
      ball.visible = glow.visible = shadow.visible = visible;
      // shadow on the table if it's over the table, else on the floor
      const over = Math.abs(b.x) <= C.W / 2 && Math.abs(b.z) <= C.L / 2 && b.y >= C.H - 0.01;
      const gy = over ? C.H + 0.003 : 0.004;
      const h = Math.max(0, b.y - gy);
      shadow.position.set(b.x, gy, b.z);
      const sz = 0.11 + h * 0.06;
      shadow.scale.set(sz, sz, 1);
      shadow.material.opacity = Math.max(0.12, 0.75 - h * 0.35);
      // trail
      hist.unshift([b.x, b.y, b.z]);
      if (hist.length > TRAIL) hist.length = TRAIL;
      const fast = view.trail || 0;
      for (let i = 0; i < TRAIL; i++) {
        const s = trail[i], p = hist[i];
        if (!p || !visible) { s.material.opacity = 0; continue; }
        s.position.set(p[0], p[1], p[2]);
        const u = 1 - i / TRAIL;
        s.scale.setScalar(C.R * 2.2 * u + 0.01);
        s.material.opacity = 0.32 * u * fast;
        s.material.color.set(view.trailColor || '#ffb347');
      }
      // aim ring
      const A = view.aim;
      const target = A && A.on ? A.strength || 0.9 : 0;
      aim.material.opacity += (target - aim.material.opacity) * Math.min(1, dt * 10);
      if (A && A.on) {
        aim.position.set(A.x, A.y, A.z);
        const pulse = 1 + Math.sin(performance.now() / 120) * 0.08;
        const s = (A.size || 0.5) * pulse;
        aim.scale.set(s, s, 1);
        aim.material.color.set(A.color || '#ffe14a');
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.t += dt;
        const u = r.t / 0.45;
        r.m.scale.setScalar(1 + u * 3);
        r.m.material.opacity = Math.max(0, 0.9 * (1 - u));
        if (u >= 1) { remove(r.m); rings.splice(i, 1); }
      }
      for (let i = bursts.length - 1; i >= 0; i--) {
        const q = bursts[i];
        q.t += dt;
        const u = q.t / 0.9;
        const pop = u < 0.15 ? u / 0.15 * 1.25 : u < 0.25 ? 1.25 - (u - 0.15) * 2.5 : 1;
        q.s.scale.setScalar(q.size * pop);
        q.s.material.rotation = Math.sin(q.t * 9) * 0.06;
        q.s.material.opacity = u > 0.75 ? Math.max(0, 1 - (u - 0.75) / 0.25) : 1;
        if (u >= 1) { remove(q.s); bursts.splice(i, 1); }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const q = sparks[i];
        q.t += dt;
        q.v.y -= 6 * dt;
        q.s.position.addScaledVector(q.v, dt);
        q.s.material.opacity = Math.max(0, 1 - q.t / q.life);
        if (q.t >= q.life) { remove(q.s); sparks.splice(i, 1); }
      }
      for (let i = flyers.length - 1; i >= 0; i--) {
        const f = flyers[i];
        f.t += dt;
        const u = Math.min(1, f.t / f.dur);
        if (f.follow) f.to.copy(f.follow());
        if (u < 1) {
          f.s.position.lerpVectors(f.from, f.to, u);
          f.s.position.y += Math.sin(u * Math.PI) * f.arc;
        } else f.s.position.copy(f.to);
        f.s.material.rotation = f.spin * f.t;
        const end = f.dur + f.hold;
        if (f.t > end - 0.3) f.s.material.opacity = Math.max(0, (end - f.t) / 0.3);
        if (f.t >= end) { remove(f.s); flyers.splice(i, 1); }
      }
      for (let i = confetti.length - 1; i >= 0; i--) {
        const q = confetti[i];
        q.t += dt;
        q.v.y -= 3.2 * dt;
        q.v.multiplyScalar(1 - 1.2 * dt);
        q.m.position.addScaledVector(q.v, dt);
        if (q.m.position.y < 0.01) { q.m.position.y = 0.01; q.v.set(0, 0, 0); }
        q.m.rotation.x += q.r.x * dt; q.m.rotation.y += q.r.y * dt;
        if (q.t >= q.life) { remove(q.m); confetti.splice(i, 1); }
      }
    }

    function clear() {
      for (const arr of [rings, bursts, sparks, flyers, confetti]) {
        for (const q of arr) remove(q.m || q.s);
        arr.length = 0;
      }
      hist.length = 0;
    }

    return { ball, shadow, aim, update, bounceRing, burst, spark, fly, confetti: confettiBurst, clear, flyers };
  }

  window.TTFx = { create, burstTexture };
})();
