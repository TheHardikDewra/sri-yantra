// Shodashopachara: the sixteen services, offered to the Meru.
//
// Each upachara gets one clear act in three dimensions - water poured, a lamp
// carried round, petals let fall - built from ordinary geometry and a couple of
// lights. Nothing here is a glow or a gradient; the flame is an actual light
// with an actual falloff, which is a different thing.
//
// Deliberately absent: any mantra. The names of the services and what is done
// at each are open knowledge and are given in full. The syllables that go with
// them are not mine to put on a web page, so they are not here, and the
// sequence is written so nothing depends on them.

import * as THREE from 'three';

export const UPACHARAS = [
  { n: 'Āvāhana', e: 'invocation — the deity is invited to be present' },
  { n: 'Āsana', e: 'a seat is offered' },
  { n: 'Pādya', e: 'water for washing the feet' },
  { n: 'Arghya', e: 'water offered to the hands' },
  { n: 'Ācamanīya', e: 'water for sipping' },
  { n: 'Snāna', e: 'the bath — poured over and let run down' },
  { n: 'Vastra', e: 'cloth, wrapped about the form' },
  { n: 'Yajñopavīta', e: 'the sacred thread, laid across the shoulder' },
  { n: 'Gandha', e: 'sandal paste, smoothed onto the surface' },
  { n: 'Puṣpa', e: 'flowers, let fall over the enclosures' },
  { n: 'Dhūpa', e: 'incense, its smoke drawn upward' },
  { n: 'Dīpa', e: 'the lamp, carried round the form' },
  { n: 'Naivedya', e: 'food, set down at the four gates' },
  { n: 'Tāmbūla', e: 'betel, offered after the meal' },
  { n: 'Pradakṣiṇa', e: 'circumambulation, keeping it to the right' },
  { n: 'Namaskāra', e: 'prostration, and the offering is complete' },
];

const C = {
  water:  0xbfd8e8,
  cloth:  0xb03a2e,
  thread: 0xf2e8d0,
  sandal: 0xd8cbb0,
  petal:  [0xe05a3a, 0xe89a3c, 0xf0c04a, 0xdd7a55, 0xc8455f],
  smoke:  0xb9b2a6,
  flame:  0xffb445,
  food:   0xe0b356,
};

const easeOut = t => 1 - Math.pow(1 - t, 3);

export function createPuja(meru) {
  const scene = meru.scene;
  const group = new THREE.Group();
  scene.add(group);

  // model extent, so every offering scales to the mountain rather than to
  // numbers baked in here
  const bb = meru.mesh.geometry.boundingBox;
  const R = Math.max(bb.max.x, bb.max.z);
  const H = bb.max.y;

  const live = [];              // { obj, tick(dt, age), life }
  const state = { step: -1, playing: false, t: 0, hold: 3.2 };

  const add = (obj, tick, life = Infinity) => {
    group.add(obj);
    const rec = { obj, tick, life, age: 0 };
    live.push(rec);
    return rec;
  };

  function clear() {
    for (const r of live) {
      group.remove(r.obj);
      r.obj.traverse?.(o => {
        o.geometry?.dispose();
        if (o.material) [].concat(o.material).forEach(m => m.dispose());
      });
    }
    live.length = 0;
    if (meru.mesh) meru.setMaterial(meru.material);   // undo any tinting
  }

  // ---- small makers -------------------------------------------------------

  const flat = (color, opacity = 1) => new THREE.MeshStandardMaterial({
    color, roughness: 0.7, metalness: 0.0,
    transparent: opacity < 1, opacity,
  });

  function ring(radius, y, color, tube = R * 0.012) {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 8, 128), flat(color));
    m.rotation.x = Math.PI / 2;
    m.position.y = y;
    return m;
  }

  // A shower of small things: petals, droplets, smoke puffs. `spawn` places one
  // and `step` moves it. Instanced so a few hundred cost nothing.
  function shower(count, colors, size, spawn, step) {
    const geo = new THREE.PlaneGeometry(size, size);
    const mats = colors.map(c => flat(c, 0.95));
    const meshes = mats.map(m => new THREE.InstancedMesh(geo, m,
      Math.ceil(count / mats.length)));
    const holder = new THREE.Group();
    meshes.forEach(m => holder.add(m));
    const bits = [];
    for (let i = 0; i < count; i++) {
      bits.push(Object.assign({ mesh: i % mats.length, idx: (i / mats.length) | 0 },
        spawn(i, count)));
    }
    const dummy = new THREE.Object3D();
    return {
      holder,
      tick(dt) {
        for (const b of bits) {
          step(b, dt);
          dummy.position.set(b.x, b.y, b.z);
          dummy.rotation.set(b.rx || 0, b.ry || 0, b.rz || 0);
          dummy.scale.setScalar(b.s === undefined ? 1 : b.s);
          dummy.updateMatrix();
          meshes[b.mesh].setMatrixAt(b.idx, dummy.matrix);
        }
        meshes.forEach(m => { m.instanceMatrix.needsUpdate = true; });
      },
    };
  }

  // water poured from a height and running down the terraces
  function pour(fromY, count = 260) {
    const s = shower(count, [C.water], R * 0.028,
      i => ({
        a: Math.random() * Math.PI * 2,
        r: Math.random() * R * 0.06,
        y: fromY + Math.random() * H * 0.5,
        v: 0, x: 0, z: 0, s: 0.6 + Math.random() * 0.6,
      }),
      (b, dt) => {
        b.v += dt * 2.2;
        b.y -= b.v * dt;
        // once it lands it spreads outward across the tiers
        if (b.y <= 0.02) { b.y = 0.02; b.r += dt * R * 0.9; }
        if (b.r > R * 1.05 || b.y < -0.1) {
          b.y = fromY + Math.random() * H * 0.2;
          b.r = Math.random() * R * 0.06; b.v = 0;
        }
        b.x = Math.cos(b.a) * b.r;
        b.z = Math.sin(b.a) * b.r;
        b.rx = -Math.PI / 2;
      });
    return s;
  }

  // ---- the sixteen --------------------------------------------------------

  const acts = [
    // 1 Avahana - the form is approached squarely and the bindu answers
    () => {
      meru.view('front');
      const halo = ring(R * 0.16, H + R * 0.02, C.flame, R * 0.006);
      add(halo, (dt, age) => {
        const k = Math.min(1, age / 1.6);
        halo.scale.setScalar(1 + easeOut(k) * 5);
        halo.material.opacity = 1 - k;
        halo.material.transparent = true;
      });
    },
    // 2 Asana - a seat set beneath
    () => {
      const seat = ring(R * 1.12, 0.012, C.petal[1], R * 0.03);
      seat.scale.setScalar(0.01);
      add(seat, (dt, age) => seat.scale.setScalar(easeOut(Math.min(1, age / 0.8))));
    },
    // 3 Padya - water at the feet
    () => {
      const w = ring(R * 0.98, 0.02, C.water, R * 0.016);
      add(w, (dt, age) => { w.rotation.z += dt * 0.6; });
      const s = pour(H * 0.12, 90);
      add(s.holder, dt => s.tick(dt));
    },
    // 4 Arghya - water to the hands, offered higher up
    () => {
      const s = pour(H * 0.55, 120);
      add(s.holder, dt => s.tick(dt));
    },
    // 5 Acamaniya - a sip, at the summit
    () => {
      const s = pour(H * 0.98, 60);
      add(s.holder, dt => s.tick(dt));
    },
    // 6 Snana - the bath, poured over the whole form
    () => {
      const s = pour(H * 1.05, 320);
      add(s.holder, dt => s.tick(dt));
      const sheet = ring(R * 1.02, 0.03, C.water, R * 0.022);
      add(sheet, (dt, age) => { sheet.material.opacity = 0.55; sheet.material.transparent = true; });
    },
    // 7 Vastra - cloth wound about the tiers
    () => {
      for (let k = 0; k < 3; k++) {
        const y = H * (0.16 + k * 0.13);
        const r = R * (0.86 - k * 0.16);
        const band = ring(r, y, C.cloth, R * 0.028);
        band.scale.set(0.01, 0.01, 1);
        add(band, (dt, age) => {
          const t = easeOut(Math.min(1, Math.max(0, age - k * 0.18) / 0.7));
          band.scale.set(t, t, 1);
        });
      }
    },
    // 8 Yajnopavita - the thread, over one shoulder and under the other arm
    () => {
      const pts = [];
      for (let i = 0; i <= 160; i++) {
        const t = i / 160, a = t * Math.PI * 2;
        pts.push(new THREE.Vector3(
          Math.cos(a) * R * 0.72,
          H * (0.86 - 0.66 * Math.abs(Math.sin(a / 2))),
          Math.sin(a) * R * 0.72 * 0.55));
      }
      const thread = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true),
          200, R * 0.008, 6, true), flat(C.thread));
      thread.rotation.y = -0.5;
      add(thread, (dt, age) => {
        thread.visible = age > 0.15;
      });
    },
    // 9 Gandha - sandal paste, taken onto the surface itself
    () => {
      const m = meru.mesh.material;
      const from = m.color.clone(), to = new THREE.Color(C.sandal);
      add(new THREE.Object3D(), (dt, age) => {
        m.color.copy(from).lerp(to, Math.min(1, age / 1.2) * 0.75);
      });
    },
    // 10 Pushpa - flowers let fall
    () => {
      const s = shower(420, C.petal, R * 0.05,
        () => {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * R * 1.15;
          return { a, r, x: Math.cos(a) * r, z: Math.sin(a) * r,
                   y: H * (1.1 + Math.random() * 1.4), v: 0,
                   rx: Math.random() * 3, ry: Math.random() * 3, rz: Math.random() * 3,
                   spin: (Math.random() - 0.5) * 2, rest: Math.random() * H * 0.55 };
        },
        (b, dt) => {
          if (b.y > b.rest) {
            b.v += dt * 1.1; b.y -= b.v * dt;
            b.rx += b.spin * dt; b.rz += b.spin * dt * 0.6;
          }
        });
      add(s.holder, dt => s.tick(dt));
    },
    // 11 Dhupa - incense, drawn upward
    () => {
      const s = shower(200, [C.smoke], R * 0.09,
        () => ({ a: Math.random() * Math.PI * 2, r: R * (0.2 + Math.random() * 0.7),
                 y: Math.random() * H, x: 0, z: 0, s: 0.4 + Math.random() }),
        (b, dt) => {
          b.y += dt * H * 0.28;
          b.a += dt * 0.5;
          b.r *= 1 - dt * 0.06;
          b.s *= 1 - dt * 0.12;
          if (b.y > H * 2.1 || b.s < 0.05) {
            b.y = 0.05; b.r = R * (0.2 + Math.random() * 0.7);
            b.s = 0.4 + Math.random();
          }
          b.x = Math.cos(b.a) * b.r; b.z = Math.sin(b.a) * b.r;
        });
      s.holder.children.forEach(m => {
        m.material.transparent = true; m.material.opacity = 0.22;
      });
      add(s.holder, dt => s.tick(dt));
    },
    // 12 Dipa - the lamp carried round. A real light, not a painted one.
    () => {
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(R * 0.035, 12, 10),
        new THREE.MeshBasicMaterial({ color: C.flame }));
      const glow = new THREE.PointLight(C.flame, 6, R * 3.2, 2);
      lamp.add(glow);
      add(lamp, (dt, age) => {
        const a = age * 1.15;
        lamp.position.set(Math.cos(a) * R * 0.85,
                          H * (0.45 + 0.24 * Math.sin(age * 2.2)),
                          Math.sin(a) * R * 0.85);
      });
    },
    // 13 Naivedya - food set at the four gates
    () => {
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2;
        const bowl = new THREE.Mesh(
          new THREE.SphereGeometry(R * 0.055, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
          flat(C.food));
        bowl.rotation.x = Math.PI;
        bowl.position.set(Math.cos(a) * R * 0.95, 0.06, Math.sin(a) * R * 0.95);
        bowl.scale.setScalar(0.01);
        add(bowl, (dt, age) => bowl.scale.setScalar(
          easeOut(Math.min(1, Math.max(0, age - k * 0.12) / 0.5))));
      }
    },
    // 14 Tambula - betel, after the meal
    () => {
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + Math.PI / 4;
        const leaf = new THREE.Mesh(
          new THREE.ConeGeometry(R * 0.05, R * 0.11, 3), flat(0x4c7a3c));
        leaf.position.set(Math.cos(a) * R * 0.9, 0.08, Math.sin(a) * R * 0.9);
        leaf.rotation.y = -a;
        leaf.scale.setScalar(0.01);
        add(leaf, (dt, age) => leaf.scale.setScalar(
          easeOut(Math.min(1, Math.max(0, age - k * 0.12) / 0.5))));
      }
    },
    // 15 Pradakshina - once round, keeping it to the right
    () => {
      meru.circumambulate();
    },
    // 16 Namaskara - down to the ground, then back to standing
    () => {
      meru.bow();
    },
  ];

  // ---- driving ------------------------------------------------------------

  function go(i) {
    if (i < 0 || i >= acts.length) return;
    clear();
    state.step = i;
    state.t = 0;
    acts[i]();
    meru.onPujaStep?.(i);
  }

  let last = performance.now();
  function tick() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (let k = live.length - 1; k >= 0; k--) {
      const r = live[k];
      r.age += dt;
      r.tick(dt, r.age);
    }
    if (state.playing) {
      state.t += dt;
      if (state.t > state.hold) {
        if (state.step >= acts.length - 1) { state.playing = false; meru.onPujaEnd?.(); }
        else go(state.step + 1);
      }
    }
  }

  return {
    UPACHARAS,
    tick,
    go,
    get step() { return state.step; },
    get playing() { return state.playing; },
    next: () => go(Math.min(acts.length - 1, state.step + 1)),
    prev: () => go(Math.max(0, state.step - 1)),
    play: () => { state.playing = true; if (state.step < 0) go(0); },
    pause: () => { state.playing = false; },
    stop: () => { state.playing = false; state.step = -1; clear(); meru.onPujaStep?.(-1); },
  };
}
