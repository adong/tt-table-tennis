/* TT Table Tennis: the sports hall. A blue table with its net, the red court floor, low barriers with our own
   "TT" boards, a flip-card scoreboard, benches with friends from the kit roster watching, bunting and lights.
   Everything is boxes and canvas textures (no image files). Exposes window.TTStage.build(scene). */
(function () {
  'use strict';
  const T = THREE, Kit = window.Kit;
  const { makeCanvas, toTexture, std, mesh, roundRect, FONT } = Kit.gfx;
  const C = window.TTPhys.C;

  function tableTopTexture() {
    const [c, g] = makeCanvas(512, 920);
    g.fillStyle = '#1f62b8';
    g.fillRect(0, 0, 512, 920);
    // a faint sheen
    const gr = g.createLinearGradient(0, 0, 512, 920);
    gr.addColorStop(0, 'rgba(255,255,255,0.08)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0)');
    gr.addColorStop(1, 'rgba(255,255,255,0.05)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 512, 920);
    g.fillStyle = '#ffffff';
    const e = 9;
    g.fillRect(0, 0, 512, e); g.fillRect(0, 920 - e, 512, e);
    g.fillRect(0, 0, e, 920); g.fillRect(512 - e, 0, e, 920);
    g.fillRect(256 - 2, 0, 4, 920); // the centre line, for doubles
    return toTexture(c);
  }

  function netTexture() {
    const [c, g] = makeCanvas(512, 64);
    g.clearRect(0, 0, 512, 64);
    g.strokeStyle = 'rgba(20,24,40,0.85)';
    g.lineWidth = 2;
    for (let x = 0; x <= 512; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke(); }
    for (let y = 0; y <= 64; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
    const t = toTexture(c);
    return t;
  }

  function floorTexture() {
    const [c, g] = makeCanvas(512, 512);
    g.fillStyle = '#b84a35';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
      g.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }
    return toTexture(c, true);
  }

  function woodTexture() {
    const [c, g] = makeCanvas(512, 512);
    g.fillStyle = '#d9a86a';
    g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 32) {
      g.fillStyle = y % 64 ? '#cf9d5f' : '#ddb077';
      g.fillRect(0, y, 512, 30);
      g.fillStyle = 'rgba(90,50,20,0.35)';
      g.fillRect(0, y + 30, 512, 2);
      for (let x = (y / 32) % 2 ? 0 : 128; x < 512; x += 256) g.fillRect(x, y, 2, 32);
    }
    return toTexture(c, true);
  }

  // A barrier board: dark blue with our own name and a ball. The TT logo and the kids' names stay in English;
  // PING ★ PONG is redrawn when the language changes.
  const T_ = (s) => (Kit.lang ? Kit.lang.t(s) : s);
  function boardTexture(kind, old) {
    const [c, g] = old ? [old.image, old.image.getContext('2d')] : makeCanvas(512, 160);
    g.fillStyle = '#1b2768';
    g.fillRect(0, 0, 512, 160);
    g.fillStyle = '#2d3f9a';
    g.fillRect(0, 128, 512, 32);
    g.textBaseline = 'middle';
    if (kind === 0) {
      g.font = `86px ${FONT}`;
      g.fillStyle = '#ffd400';
      g.textAlign = 'right';
      g.fillText('TT', 210, 72);
      g.font = `38px ${FONT}`;
      g.fillStyle = '#ffffff';
      g.textAlign = 'left';
      g.fillText('TABLE', 236, 50);
      g.fillText('TENNIS', 236, 94);
      g.fillStyle = '#ff9f1c';
      g.beginPath(); g.arc(440, 72, 26, 0, Math.PI * 2); g.fill();
    } else if (kind === 1) {
      g.font = `52px ${FONT}`;
      g.textAlign = 'center';
      g.fillStyle = '#ffffff';
      g.fillText('TEDDY ♥ TOMMY', 256, 70);
    } else {
      g.font = `52px ${FONT}`;
      g.textAlign = 'center';
      g.fillStyle = '#5ef2ff';
      g.fillText(T_('PING ★ PONG'), 256, 70);
    }
    if (old) { old.needsUpdate = true; return old; }
    return toTexture(c);
  }

  // The flip-card scoreboard on its stand. update(a, b, ga, gb) repaints it.
  function scoreboard(parent) {
    const [c, g] = makeCanvas(512, 256);
    const tex = toTexture(c);
    const grp = new T.Group();
    parent.add(grp);
    const dark = std('#22232c', { roughness: 0.6 });
    mesh(new T.BoxGeometry(0.06, 0.9, 0.06), dark, 0, 0.45, -0.4, grp);
    mesh(new T.BoxGeometry(0.06, 0.9, 0.06), dark, 0, 0.45, 0.4, grp);
    mesh(new T.BoxGeometry(0.12, 0.62, 1.12), dark, 0, 1.15, 0, grp);
    const face = new T.Mesh(new T.PlaneGeometry(1.06, 0.53), new T.MeshBasicMaterial({ map: tex }));
    face.position.set(0.065, 1.15, 0);
    face.rotation.y = Math.PI / 2;
    grp.add(face);
    const back = face.clone();
    back.position.x = -0.065;
    back.rotation.y = -Math.PI / 2;
    grp.add(back);
    let last = '', args = [0, 0, 0, 0, null];
    function update(a, b, ga, gb, names) {
      args = [a, b, ga, gb, names];
      const key = [a, b, ga, gb, names, Kit.lang ? Kit.lang.get() : ''].join();
      if (key === last) return;
      last = key;
      g.fillStyle = '#14121f';
      g.fillRect(0, 0, 512, 256);
      const card = (x, val, col) => {
        g.fillStyle = col;
        roundRect(g, x, 40, 190, 170, 18);
        g.fill();
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(x, 123, 190, 4);
        g.fillStyle = '#ffffff';
        g.font = `120px ${FONT}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(String(val), x + 95, 132);
      };
      card(24, a, '#2f6fe0');
      card(298, b, '#e0364a');
      g.font = `30px ${FONT}`;
      g.fillStyle = '#ffd400';
      g.textAlign = 'center';
      g.fillText(`${ga} - ${gb}`, 256, 125);
      g.font = `22px ${FONT}`;
      g.fillStyle = '#ffffff';
      if (names) { g.fillText(T_(names[0]), 119, 20); g.fillText(T_(names[1]), 393, 20); }
      tex.needsUpdate = true;
    }
    return { group: grp, update, redraw: () => update(...args) };
  }

  function bunting(parent, x0, z0, x1, z1, y) {
    const n = 18, cols = ['#ff3d7f', '#ffd400', '#18d4ff', '#3fc22b', '#ff9f1c', '#8d5bd8'];
    const geo = new T.ConeGeometry(0.16, 0.34, 3);
    geo.rotateX(Math.PI);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const m = new T.Mesh(geo, std(cols[i % cols.length], { roughness: 0.9, side: T.DoubleSide }));
      m.position.set(x0 + (x1 - x0) * u, y - Math.sin(u * Math.PI) * 0.6 - 0.17, z0 + (z1 - z0) * u);
      m.rotation.y = Math.atan2(x1 - x0, z1 - z0);
      parent.add(m);
    }
  }

  // friends from the roster on the benches: they cheer when a point is won
  function crowd(parent, skip) {
    const ids = Kit.roster.list.map((c) => c.id).filter((id) => !skip.includes(id) && id !== 'zombie').slice(0, 4);
    const fans = [];
    ids.forEach((id, i) => {
      const e = Kit.roster.get(id);
      const p = Kit.people.build(e.look);
      const left = i % 2 === 0;
      p.root.position.set(left ? -5.05 : 5.05, 0, -1.6 + Math.floor(i / 2) * 2.6 + (left ? 0 : 0.8));
      p.root.rotation.y = left ? -Math.PI / 2 : Math.PI / 2;
      p.root.scale.setScalar(0.92);
      parent.add(p.root);
      fans.push({ p, id, ph: Math.random() * 6, cheer: 0, sig: Kit.roster.signature(e, 'hello') });
    });
    return fans;
  }

  function build(scene, o = {}) {
    const root = new T.Group();
    scene.add(root);

    // ---------- lights
    const hemi = new T.HemisphereLight('#fff6e8', '#8a5a48', 0.85);
    root.add(hemi);
    const sun = new T.DirectionalLight('#fff3df', 1.05);
    sun.position.set(-3.5, 9, 4.5);
    sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -5; sc.right = 5; sc.top = 6; sc.bottom = -6; sc.near = 1; sc.far = 25;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    root.add(sun, sun.target);
    const fill = new T.DirectionalLight('#cfe4ff', 0.35);
    fill.position.set(5, 6, -6);
    root.add(fill);

    // ---------- the hall
    const floorMat = std('#ffffff', { map: floorTexture(), roughness: 0.75 });
    floorMat.map.repeat.set(3, 3);
    const floor = mesh(new T.PlaneGeometry(9.2, 12.2), floorMat, 0, 0, 0, root, false);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    const wood = std('#ffffff', { map: woodTexture(), roughness: 0.6 });
    wood.map.repeat.set(6, 7);
    const outer = mesh(new T.PlaneGeometry(26, 30), wood, 0, -0.005, 0, root, false);
    outer.rotation.x = -Math.PI / 2;
    outer.receiveShadow = true;
    // court lines on the floor
    const lineMat = new T.MeshBasicMaterial({ color: '#f3e6d6' });
    for (const [w, d, x, z] of [[9.2, 0.06, 0, 6.07], [9.2, 0.06, 0, -6.07], [0.06, 12.2, 4.57, 0], [0.06, 12.2, -4.57, 0]]) {
      const l = mesh(new T.PlaneGeometry(w, d), lineMat, x, 0.003, z, root, false);
      l.rotation.x = -Math.PI / 2;
    }
    const wallMat = std('#9fd3ef', { roughness: 0.95 });
    const wallLow = std('#3a63b8', { roughness: 0.9 });
    for (const [w, x, z, ry] of [[26, 0, -13, 0], [26, 0, 13, Math.PI], [30, -11, 0, Math.PI / 2], [30, 11, 0, -Math.PI / 2]]) {
      const wl = mesh(new T.PlaneGeometry(w, 9), wallMat, x, 4.5, z, root, false);
      wl.rotation.y = ry;
      const wb = mesh(new T.PlaneGeometry(w, 1.6), wallLow, x * 0.999, 0.8, z * 0.999, root, false);
      wb.rotation.y = ry;
    }
    // windows high on the back walls
    const winMat = new T.MeshBasicMaterial({ color: '#e9f8ff' });
    for (let i = -3; i <= 3; i++) {
      for (const z of [-12.98, 12.98]) {
        const w = mesh(new T.PlaneGeometry(2.2, 1.6), winMat, i * 3.4, 6.2, z, root, false);
        w.rotation.y = z > 0 ? Math.PI : 0;
      }
    }
    // ceiling lights
    const lamp = new T.MeshBasicMaterial({ color: '#fffbe8' });
    for (const x of [-3, 3]) for (const z of [-4, 0, 4]) mesh(new T.BoxGeometry(1.6, 0.08, 0.5), lamp, x, 8.6, z, root, false);
    bunting(root, -8, -6.5, 8, -6.5, 6.4);
    bunting(root, -8, 6.5, 8, 6.5, 6.4);
    bunting(root, -8.5, -6, -8.5, 6, 6.2);

    // barriers around the court, with gaps at the corners
    const boards = [0, 1, 2].map((k) => boardTexture(k));
    const boardGeo = new T.BoxGeometry(2.0, 0.72, 0.05);
    let k = 0;
    const place = (x, z, ry) => {
      const mat = [std('#1b2768'), std('#1b2768'), std('#1b2768'), std('#1b2768'), std('#ffffff', { map: boards[k % 3] }), std('#ffffff', { map: boards[(k + 1) % 3] })];
      const b = mesh(boardGeo, mat, x, 0.36, z, root);
      b.rotation.y = ry;
      b.receiveShadow = true;
      k++;
    };
    for (const x of [-3.15, -1.05, 1.05, 3.15]) { place(x, -6.0, 0); place(x, 6.0, Math.PI); }
    for (const z of [-4.2, -2.1, 0, 2.1, 4.2]) { place(-4.5, z, Math.PI / 2); place(4.5, z, -Math.PI / 2); }

    // benches for the fans, outside the barriers
    const benchMat = std('#7a4a2a', { roughness: 0.8 });
    for (const x of [-5.15, 5.15]) {
      mesh(new T.BoxGeometry(0.5, 0.08, 5.6), benchMat, x, 0.48, 0.2, root);
      for (const z of [-2.4, 0.2, 2.8]) mesh(new T.BoxGeometry(0.4, 0.46, 0.08), benchMat, x, 0.23, z, root);
    }

    // ---------- the table
    const table = new T.Group();
    root.add(table);
    const topTex = tableTopTexture();
    const side = std('#173f7a', { roughness: 0.5 });
    const topMat = std('#ffffff', { map: topTex, roughness: 0.35, metalness: 0.05 });
    const top = mesh(new T.BoxGeometry(C.W, 0.035, C.L), [side, side, topMat, side, side, side], 0, C.H - 0.0175, 0, table);
    top.receiveShadow = true;
    // the apron (a band under the edge) and the frame, legs and wheels
    const apronTex = (() => {
      const [c, g] = makeCanvas(512, 32);
      g.fillStyle = '#132f5e';
      g.fillRect(0, 0, 512, 32);
      g.font = `22px ${FONT}`;
      g.fillStyle = '#ffd400';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('TT', 128, 17);
      g.fillText('TT', 384, 17);
      return toTexture(c);
    })();
    const apron = std('#ffffff', { map: apronTex, roughness: 0.6 });
    for (const sx of [-1, 1]) {
      const a = mesh(new T.BoxGeometry(0.02, 0.08, C.L - 0.1), apron, sx * (C.W / 2 - 0.08), C.H - 0.075, 0, table);
      a.material = [side, side, side, side, side, side];
      const aw = new T.Mesh(new T.PlaneGeometry(C.L - 0.1, 0.08), apron);
      aw.position.set(sx * (C.W / 2 - 0.068), C.H - 0.075, 0);
      aw.rotation.y = sx * Math.PI / 2;
      table.add(aw);
    }
    const frame = std('#2a2c36', { roughness: 0.5, metalness: 0.4 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      mesh(new T.BoxGeometry(0.05, C.H - 0.1, 0.05), frame, sx * (C.W / 2 - 0.16), (C.H - 0.1) / 2, sz * (C.L / 2 - 0.3), table);
      mesh(new T.CylinderGeometry(0.04, 0.04, 0.04, 10), std('#111111'), sx * (C.W / 2 - 0.16), 0.03, sz * (C.L / 2 - 0.3), table);
    }
    for (const sz of [-1, 1]) mesh(new T.BoxGeometry(C.W - 0.3, 0.05, 0.05), frame, 0, 0.2, sz * (C.L / 2 - 0.3), table);
    mesh(new T.BoxGeometry(0.05, 0.05, C.L - 0.6), frame, 0, 0.2, 0, table);

    // the net: posts, a see-through mesh and the white tape
    const postMat = std('#16181f', { roughness: 0.4, metalness: 0.5 });
    const netW = C.W + 2 * C.NET_OUT;
    for (const sx of [-1, 1]) {
      mesh(new T.BoxGeometry(0.03, C.NET_H + 0.02, 0.03), postMat, sx * netW / 2, C.H + C.NET_H / 2, 0, table);
      mesh(new T.BoxGeometry(0.06, 0.05, 0.12), postMat, sx * (C.W / 2 + 0.03), C.H + 0.02, 0, table);
    }
    const netTex = netTexture();
    netTex.repeat.set(1, 1);
    const net = new T.Mesh(new T.PlaneGeometry(netW, C.NET_H - 0.012), new T.MeshBasicMaterial({ map: netTex, transparent: true, side: T.DoubleSide, depthWrite: false }));
    net.position.set(0, C.H + (C.NET_H - 0.012) / 2, 0);
    table.add(net);
    const tape = mesh(new T.BoxGeometry(netW, 0.016, 0.012), std('#ffffff', { roughness: 0.5 }), 0, C.H + C.NET_H - 0.008, 0, table);
    tape.castShadow = false;

    // ---------- the scoreboard and the fans
    const board = scoreboard(root);
    board.group.position.set(-2.75, 0, 0.0);
    if (Kit.lang) {
      const redraw = () => { boardTexture(2, boards[2]); board.redraw(); };
      Kit.lang.onChange(redraw);
      window.addEventListener('load', redraw); // the game's 中文 words (js/zh.js) load after this is drawn
    }
    const fans = crowd(root, o.skip || []);

    return { root, table, net, tape, board, fans, sun };
  }

  window.TTStage = { build, crowd };
})();
