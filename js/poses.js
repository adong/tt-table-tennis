/* TT Table Tennis: the paddle and the table-tennis poses, on top of the kit's people.
   The paddle is not parented to the hand: the engine says where the blade is (that's where the ball is hit), and
   aimArm() turns the right arm at the shoulder to reach the paddle's grip, stretching it a little if needed, so the
   hand always holds the handle and the ball always meets the blade you see.
   drive() eases every other channel of a kit person (legs, the free arm, lean, twist, crouch, rig tilt);
   player() picks the targets for ready, shuffle, serve, sad, dive and give, and uses the kit's own poses for the
   signature celebrations (Teddy's boxing and jump shot, Tommy's Y peace pose). */
(function () {
  'use strict';
  const T = THREE, Kit = window.Kit;
  const { std, mesh } = Kit.gfx;
  const ARM = 0.68; // shoulder to the middle of the hand

  // A paddle: blade centre at the origin, red rubber facing local -z, black on +z, the handle down -y.
  function paddle(rubber = '#e23a3a') {
    const g = new T.Group();
    const wood = std('#d8a46a', { roughness: 0.7 });
    const red = std(rubber, { roughness: 0.55 });
    const black = std('#1d1d24', { roughness: 0.55 });
    const disc = (r, h, mat, z) => {
      const m = mesh(new T.CylinderGeometry(r, r, h, 28), mat, 0, 0, z, g);
      m.rotation.x = Math.PI / 2;
      return m;
    };
    disc(0.15, 0.012, wood, 0);
    disc(0.145, 0.006, red, -0.009);
    disc(0.145, 0.006, black, 0.009);
    mesh(new T.BoxGeometry(0.075, 0.07, 0.03), wood, 0, -0.15, 0, g);
    mesh(new T.BoxGeometry(0.055, 0.15, 0.036), std('#b5793f', { roughness: 0.8 }), 0, -0.24, 0, g);
    mesh(new T.BoxGeometry(0.062, 0.03, 0.04), std('#f4f4f4'), 0, -0.31, 0, g);
    g.grip = new T.Vector3(0, -0.24, 0); // where the hand holds it (local)
    return g;
  }

  const v1 = new T.Vector3(), v2 = new T.Vector3(), v3 = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  const basis = new T.Matrix4();

  // Point the paddle: blade centre at `at`, red face toward `face` (a world direction), handle toward `hand`
  // (a world direction from the blade toward the player's hand).
  function placePaddle(pd, at, face, hand) {
    const y = v1.copy(hand).negate().normalize(); // grip -> blade
    const z = v2.copy(face).negate(); // local +z is the black side, away from where it's facing
    z.addScaledVector(y, -z.dot(y)).normalize();
    const x = v3.crossVectors(y, z).normalize();
    basis.makeBasis(x, y, z);
    pd.quaternion.setFromRotationMatrix(basis);
    pd.position.copy(at);
    pd.updateMatrixWorld(true);
  }

  // Turn an arm at the shoulder so its hand lands on world point `target`; stretch it to reach (cartoon arms).
  const loc = new T.Vector3();
  function aimArm(p, arm, target, stretch = true) {
    p.root.updateMatrixWorld(true);
    loc.copy(target);
    arm.parent.worldToLocal(loc);
    loc.sub(arm.position);
    const d = loc.length() || 1;
    loc.divideScalar(d);
    // the arm hangs along -y; Euler XYZ: Rz first, then Rx
    arm.rotation.set(Math.atan2(-loc.z, -loc.y), 0, Math.asin(Math.max(-1, Math.min(1, loc.x))));
    arm.scale.y = stretch ? Math.max(0.7, Math.min(1.45, d / ARM)) : 1;
    return d;
  }

  const ease = (o, prop, v, k) => { o[prop] += (v - o[prop]) * k; };

  // targets: fx / fz (the free arm forward / outward), lL / lR (legs forward), sp (leg spread), lean, twist, head,
  // crouch (drops the rig), tilt (whole rig sideways), pitch (whole rig forward, for dives), bob.
  function drive(p, t, k) {
    ease(p.armL.rotation, 'x', t.fx || 0, k);
    ease(p.armL.rotation, 'z', -(t.fz || 0), k);
    p.armL.scale.y += (1 - p.armL.scale.y) * k;
    if (t.rx !== undefined) {
      ease(p.armR.rotation, 'x', t.rx, k);
      ease(p.armR.rotation, 'z', t.rz || 0, k);
      p.armR.scale.y += (1 - p.armR.scale.y) * k;
    }
    ease(p.legL.rotation, 'x', t.lL || 0, k);
    ease(p.legR.rotation, 'x', t.lR || 0, k);
    ease(p.legL.rotation, 'z', -(t.sp || 0), k);
    ease(p.legR.rotation, 'z', t.sp || 0, k);
    ease(p.hips.rotation, 'x', t.lean !== undefined ? t.lean : -0.12, k);
    ease(p.hips.rotation, 'y', t.twist || 0, k);
    ease(p.head.rotation, 'x', t.head || 0, k);
    ease(p.head.rotation, 'y', t.look || 0, k);
    ease(p.rig.position, 'y', 0.55 - (t.crouch || 0), k);
    ease(p.rig.rotation, 'z', t.tilt || 0, k);
    ease(p.rig.rotation, 'x', t.pitch || 0, k);
    p.hips.position.y = p.hipY + (t.bob || 0);
    if (p.fingers) for (const f of p.fingers) f.visible = false;
    p.rig.scale.setScalar(1);
  }

  // One frame of a player at the table.
  // st: { mode: 'ready' | 'serve' | 'celebrate' | 'sad' | 'dive' | 'give' | 'hop' | 'run',
  //       cel (celebration pose), t (pose clock), ph (shuffle phase), move (0..1 how fast he's moving),
  //       low (0..1 paddle low: crouch), twist }
  function player(p, st, k) {
    const m = st.mode;
    if (m === 'celebrate' || m === 'hello' || m === 'bye') {
      const cel = st.cel || 'wave';
      Kit.people.pose(p, cel === 'boxing' ? st.t * 6.5 : st.t * 5, cel, k);
      if (cel !== 'jumpshot') { p.legL.rotation.x *= 0.3; p.legR.rotation.x *= 0.3; }
      p.armR.scale.y = p.armL.scale.y = 1;
      ease(p.rig.rotation, 'z', 0, k);
      ease(p.rig.rotation, 'x', 0, k);
      return;
    }
    if (m === 'run' || m === 'hop') {
      Kit.people.pose(p, st.ph || 0, m === 'hop' ? 'jump' : 'run', k);
      p.armR.scale.y = p.armL.scale.y = 1;
      ease(p.rig.rotation, 'z', 0, k);
      ease(p.rig.rotation, 'x', 0, k);
      return;
    }
    const t = { fx: 0.75, fz: 0.25, sp: 0.2, lean: -0.3, crouch: 0.1 + (st.low || 0) * 0.22, lL: 0.2, lR: -0.1, head: 0.1, twist: st.twist || 0 };
    if (st.move > 0.05) {
      // a side-step shuffle
      const s = Math.sin(st.ph || 0) * Math.min(1, st.move);
      t.lL = 0.2 + s * 0.35;
      t.lR = -0.1 - s * 0.35;
      t.sp = 0.24 + Math.abs(s) * 0.1;
      t.bob = Math.abs(Math.cos(st.ph || 0)) * 0.04 * Math.min(1, st.move);
    }
    if (m === 'serve') Object.assign(t, { fx: 0.4, fz: 0.15, lean: -0.22, crouch: 0.06, head: 0.25 });
    else if (m === 'sad') Object.assign(t, { fx: 0.05, fz: 0.05, lean: -0.36, head: 0.5, crouch: 0.04, lL: 0, lR: 0, sp: 0.06, rx: 0.1, rz: 0.08 });
    else if (m === 'dive') Object.assign(t, { fx: 1.6, fz: 0.5, lL: -0.4, lR: -0.9, lean: -0.7, crouch: 0.3, tilt: st.tilt || 0, sp: 0.3 });
    else if (m === 'give') Object.assign(t, { fx: 1.5, fz: 0.05, lean: -0.15, crouch: 0.02 });
    else if (m === 'cheer') Object.assign(t, { fx: 2.6, fz: 0.5, lean: 0, crouch: 0, lL: 0, lR: 0, sp: 0.1, rx: 2.6, rz: 0.5, bob: Math.abs(Math.sin(st.t * 8)) * 0.06 });
    drive(p, t, k);
  }

  window.TTPoses = { paddle, placePaddle, aimArm, drive, player, ARM };
})();
