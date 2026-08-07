// Shodashopachara: the sixteen services, offered to the Meru.
//
// The offerings are modelled, not suggested. Puspa is blossoms - five petals
// round a centre, built from a bezier petal outline - and loose petals, which
// tumble as they fall and come to rest on whichever terrace is actually
// beneath them, found by casting a ray down onto the mesh. Water is elongated
// drops that stretch as they gather speed and throw a ring when they land.
// Dipa is a dish with a flame in it and the key light drops away so the flame
// is what is lighting the mountain.
//
// Each service also gets its own viewpoint, because half of what makes an
// offering legible is where you are standing when it is made.
//
// Deliberately absent: any mantra. The names of the services and what is done
// at each are open knowledge and are given in full. The syllables that go with
// them are not mine to put on a web page, so they are not here, and the
// sequence is written so nothing depends on them.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const UPACHARAS = [
  { n: 'Āvāhana', e: 'invocation — the deity is invited to be present' },
  { n: 'Āsana', e: 'a seat is offered' },
  { n: 'Pādya', e: 'water for washing the feet' },
  { n: 'Arghya', e: 'water offered to the hands' },
  { n: 'Ācamanīya', e: 'water for sipping' },
  { n: 'Snāna', e: 'the bath — poured over and let run down' },
  { n: 'Vastra', e: 'cloth, wrapped about the form' },
  { n: 'Yajñopavīta', e: 'the sacred thread, laid across the shoulder' },
  { n: 'Gandha', e: 'sandal paste, marked onto the tiers' },
  { n: 'Puṣpa', e: 'flowers, let fall over the enclosures' },
  { n: 'Dhūpa', e: 'incense, its smoke drawn upward' },
  { n: 'Dīpa', e: 'the lamp, carried round the form' },
  { n: 'Naivedya', e: 'food, set down at the four gates' },
  { n: 'Tāmbūla', e: 'betel, offered after the meal' },
  { n: 'Pradakṣiṇa', e: 'circumambulation, keeping it to the right' },
  { n: 'Namaskāra', e: 'prostration, and the offering is complete' },
];

// marigold, hibiscus, jasmine, champaka - what actually gets offered
const BLOOM = [0xf07f1a, 0xd8321f, 0xf6efdc, 0xf2c53d, 0xe45c2a];
const C = {
  water: 0xa9cde4, cloth: 0xa8231b, thread: 0xf4ecd8,
  sandal: 0xe8dcc0, smoke: 0xc4bcae, flame: 0xffbe4d,
  ghee: 0xf3d78a, brass: 0xb98d3c, leaf: 0x3f7a34, food: 0xe8c46a,
};

const ease = t => 1 - Math.pow(1 - t, 3);
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- geometry

// One petal, base at the origin, tip at +Y, slightly cupped along Z.
function petalGeometry(cup = 0.16) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.bezierCurveTo(0.30, 0.10, 0.40, 0.60, 0.045, 1);
  sh.bezierCurveTo(-0.045, 1, -0.40, 0.60, -0.30, 0.10);
  sh.bezierCurveTo(-0.22, 0.05, -0.10, 0.02, 0, 0);
  const g = new THREE.ShapeGeometry(sh, 12);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setZ(i, cup * y * y);          // curl the tip up out of the plane
  }
  g.computeVertexNormals();
  return g;
}

// A blossom: petals round a disc, which is what a flower looks like.
function blossomGeometry(petals = 5) {
  const parts = [];
  const petal = petalGeometry(0.20);
  for (let k = 0; k < petals; k++) {
    const g = petal.clone();
    g.rotateX(-0.42);                       // lift the petals out of the plane
    g.translate(0, 0.16, 0);
    g.rotateZ((k / petals) * Math.PI * 2);
    parts.push(g);
  }
  const eye = new THREE.SphereGeometry(0.17, 10, 8);
  eye.scale(1, 1, 0.6);
  eye.rotateX(Math.PI / 2);
  parts.push(eye);
  const g = mergeGeometries(parts, false);
  g.rotateX(-Math.PI / 2);                  // lie face up
  g.computeVertexNormals();
  parts.forEach(x => x.dispose());
  petal.dispose();
  return g;
}

// A drop: a sphere pulled out along Y, so it can be stretched as it falls.
function dropGeometry() {
  const g = new THREE.SphereGeometry(0.5, 8, 6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const k = (y + 0.5);
    p.setX(i, p.getX(i) * (0.45 + 0.55 * k));
    p.setZ(i, p.getZ(i) * (0.45 + 0.55 * k));
  }
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------- puja

export function createPuja(meru) {
  const scene = meru.scene;
  const group = new THREE.Group();
  scene.add(group);

  const bb = meru.mesh.geometry.boundingBox;
  const R = Math.max(bb.max.x, bb.max.z);
  const H = bb.max.y;

  const HOME = meru.homeSpherical();
  const live = [];
  const st = { step: -1, playing: false, t: 0, hold: 3.4 };

  // How high is the mountain under (x, z)? The solver already knows exactly -
  // the solid is these outlines at these heights - so it ships the profile and
  // this reads it. Raycasting a 59,200-facet mesh a few hundred times a frame
  // would freeze the tab, and it would only be rediscovering this.
  //
  // Nearest angle rather than interpolated: the Meru is a staircase, and the
  // steps should stay steps.
  const prof = meru.profile;
  const NA = prof ? prof.angles.length : 0;
  const bearing = (x, z) => {
    let a = Math.atan2(z, x);
    if (a < 0) a += Math.PI * 2;
    return Math.min(NA - 1, Math.round(a / (Math.PI * 2) * NA) % NA);
  };

  // Height of the solid under a point.
  function ground(x, z) {
    if (!prof) return 0;
    const r = Math.hypot(x, z), ai = bearing(x, z);
    for (let i = prof.tiers.length - 1; i >= 0; i--) {
      if (r <= prof.tiers[i].r[ai]) return prof.tiers[i].z;
    }
    return 0;
  }

  // How far out the solid reaches at a given height, along a given bearing.
  // Cloth and thread have to lie ON the mountain; a radius picked by eye cuts
  // straight through it, which is what was happening.
  function radiusAt(y, theta) {
    if (!prof) return 0;
    let a = theta % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    const ai = Math.min(NA - 1, Math.round(a / (Math.PI * 2) * NA) % NA);
    for (let i = 0; i < prof.tiers.length; i++) {
      if (prof.tiers[i].z >= y) return prof.tiers[i].r[ai];
    }
    return prof.tiers[prof.tiers.length - 1].r[ai];
  }

  const geo = { blossom: blossomGeometry(), petal: petalGeometry(0.22), drop: dropGeometry() };

  const add = (obj, tick) => {
    group.add(obj);
    live.push({ obj, tick, age: 0 });
    return obj;
  };

  function clear() {
    for (const r of live) {
      group.remove(r.obj);
      r.obj.traverse?.(o => {
        if (o.geometry && !Object.values(geo).includes(o.geometry)) o.geometry.dispose();
        if (o.material) [].concat(o.material).forEach(m => m.dispose());
      });
    }
    live.length = 0;
    meru.setKeyLight?.(1);
    if (meru.mesh) meru.setMaterial(meru.material);
  }

  const matt = (color, opacity = 1, rough = 0.72) =>
    new THREE.MeshStandardMaterial({
      color, roughness: rough, metalness: 0.05,
      transparent: opacity < 1, opacity, side: THREE.DoubleSide,
    });

  // A pile of one geometry, moved by `step`. Instanced, so hundreds are free.
  function swarm(g, colors, count, spawn, step) {
    const per = Math.ceil(count / colors.length);
    const meshes = colors.map(c => {
      const m = new THREE.InstancedMesh(g, matt(c), per);
      m.frustumCulled = false;
      return m;
    });
    const holder = new THREE.Group();
    meshes.forEach(m => holder.add(m));
    const bits = [];
    for (let i = 0; i < count; i++) {
      bits.push(Object.assign(
        { m: i % colors.length, k: (i / colors.length) | 0 }, spawn(i, count)));
    }
    const d = new THREE.Object3D();
    return {
      holder,
      tick(dt, age) {
        for (const b of bits) {
          step(b, dt, age);
          d.position.set(b.x, b.y, b.z);
          d.rotation.set(b.rx || 0, b.ry || 0, b.rz || 0);
          d.scale.set(b.sx ?? b.s ?? 1, b.sy ?? b.s ?? 1, b.sz ?? b.s ?? 1);
          d.updateMatrix();
          meshes[b.m].setMatrixAt(b.k, d.matrix);
        }
        meshes.forEach(m => { m.instanceMatrix.needsUpdate = true; });
      },
    };
  }

  // Water: drops stretch as they gather speed; once they strike the mountain
  // they stop falling and start running outward and down over the terraces,
  // following the surface, until they leave the base and are sent up again.
  function water(fromY, count, spread = 0.10, flow = 0.62) {
    const s = swarm(geo.drop, [C.water], count,
      () => {
        // Start them scattered through the cycle. Spawned together they fall
        // together, land together and restart together, and what you see is a
        // clump pulsing rather than a stream running.
        const a = rnd(0, Math.PI * 2);
        const running = Math.random() < 0.62;
        const r = running ? rnd(R * spread, R * 1.05) : rnd(0, R * spread);
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        return { a, r, x, z,
                 y: running ? ground(x, z) + R * 0.010
                            : rnd(ground(x, z) + R * 0.02, fromY + H * 0.12),
                 v: running ? 0 : rnd(0, 1.2),
                 sx: R * 0.015, sy: R * 0.028, sz: R * 0.015, run: running };
      },
      (b, dt) => {
        if (b.run) {
          b.r += dt * R * flow;
          b.x = Math.cos(b.a) * b.r;
          b.z = Math.sin(b.a) * b.r;
          const g = ground(b.x, b.z);
          // fall freely off a step, cling to the tread
          if (b.y - g > R * 0.02) { b.v += dt * 2.6; b.y -= b.v * dt; }
          else { b.y = g + R * 0.010; b.v = 0; }
          b.sy = R * 0.024;
          if (b.r > R * 1.12) {
            b.a = rnd(0, Math.PI * 2);
            b.r = rnd(0, R * spread);
            b.y = fromY + rnd(0, H * 0.12);
            b.v = 0; b.run = false; b.sy = R * 0.028;
          }
        } else {
          b.v += dt * 2.6;
          b.y -= b.v * dt;
          b.sy = R * 0.028 * (1 + b.v * 0.85);    // stretch with speed
          const g = ground(b.x, b.z);
          if (b.y <= g + R * 0.010) { b.y = g + R * 0.010; b.run = true; b.v = 0; }
        }
      });
    return s;
  }

  function ring(radius, y, color, tube, seg = 128) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, seg),
      matt(color, 1, 0.5));
    m.rotation.x = Math.PI / 2;
    m.position.y = y;
    return m;
  }

  // ---- the sixteen ------------------------------------------------------

  const acts = [
    { view: [0, HOME.phi, 1.0], hold: 3.0, run() {          // 1 Avahana
      const pt = new THREE.PointLight(C.flame, 0, R * 4, 2);
      pt.position.set(0, H * 1.02, 0);
      add(pt, (dt, age) => { pt.intensity = 14 * Math.min(1, age / 0.9); });
      for (let k = 0; k < 3; k++) {
        const w = ring(R * 0.10, H * 1.0, C.flame, R * 0.004);
        add(w, (dt, age) => {
          const t = Math.max(0, age - k * 0.45) % 2.4 / 2.4;
          w.scale.setScalar(1 + ease(t) * 9);
          w.material.opacity = 1 - t;
          w.material.transparent = true;
        });
      }
    } },

    { view: [0, 0.95, 1.18], hold: 3.2, run() {             // 2 Asana
      // A lotus seat laid round the base. It has to sit ON the bhupura, not
      // at a radius picked by eye - the gated square reaches 1.80 along the
      // axes and 2.07 into the corners, so anything fixed floats off one and
      // sinks into the other. ground() puts every petal on the terrace.
      const n = 32;
      const s1 = swarm(geo.petal, [BLOOM[0], BLOOM[3], BLOOM[2]], n,
        i => {
          const a = (i / n) * Math.PI * 2;
          const r = R * 0.94;
          const x = Math.cos(a) * r, z = Math.sin(a) * r;
          return { a, x, z, y: ground(x, z) + R * 0.008,
                   rx: -Math.PI / 2, ry: 0, rz: -a - Math.PI / 2,
                   s: 0.001, full: R * 0.30, i };
        },
        (b, dt, age) => {
          b.s = b.full * ease(Math.min(1, Math.max(0, age - b.i * 0.025) / 0.5));
        });
      add(s1.holder, (dt, age) => s1.tick(dt, age));

      const seat = ring(R * 0.94, 0, C.sandal, R * 0.012);
      seat.position.y = ground(R * 0.94, 0) + R * 0.003;
      seat.scale.setScalar(0.01);
      add(seat, (dt, age) => seat.scale.setScalar(ease(Math.min(1, age / 0.8))));
    } },

    { view: [0, 1.38, 1.00], hold: 3.6, run() {             // 3 Padya
      const w = water(H * 0.22, 130, 0.22, 0.5);
      add(w.holder, dt => w.tick(dt));
      const pool = ring(R * 1.00, 0.015, C.water, R * 0.012);
      pool.material.opacity = 0.75; pool.material.transparent = true;
      add(pool, (dt, age) => pool.scale.setScalar(0.4 + 0.6 * ease(Math.min(1, age / 1.2))));
    } },

    { view: [0.5, 1.15, 0.95], hold: 3.2, run() {           // 4 Arghya
      const w = water(H * 0.74, 150, 0.10, 0.7);
      add(w.holder, dt => w.tick(dt));
    } },

    { view: [0, 0.95, 0.72], hold: 3.2, run() {             // 5 Acamaniya
      const w = water(H * 1.04, 80, 0.04, 0.45);
      add(w.holder, dt => w.tick(dt));
    } },

    { view: [0, HOME.phi, 1.12], hold: 5.0, run() {         // 6 Snana
      const w = water(H * 1.08, 380, 0.07, 0.80);
      add(w.holder, dt => w.tick(dt));
      for (let k = 0; k < 4; k++) {
        const y = H * (0.86 - k * 0.22);
        const sheet = ring(R * (0.30 + k * 0.22), y, C.water, R * 0.010);
        sheet.material.opacity = 0.5; sheet.material.transparent = true;
        add(sheet, (dt, age) => {
          const t = Math.min(1, Math.max(0, age - k * 0.35) / 0.8);
          sheet.scale.setScalar(0.2 + 0.8 * ease(t));
        });
      }
    } },

    { view: [0.7, 1.16, 1.00], hold: 3.6, run() {           // 7 Vastra
      // Wound round and up, riding the silhouette. The radius has to be asked
      // of the mountain at each height or the band saws straight through it.
      const pts = [], turns = 2.0;
      for (let i = 0; i <= 300; i++) {
        const t = i / 300;
        const a = t * Math.PI * 2 * turns;
        const y = H * (0.10 + t * 0.56);
        const rad = radiusAt(y, a) + R * 0.105;   // proud of the wall
        pts.push(new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad));
      }
      const cloth = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 320, R * 0.055, 6, false),
        matt(C.cloth, 1, 0.88));
      add(cloth, (dt, age) => {
        cloth.geometry.setDrawRange(0,
          Math.floor(cloth.geometry.index.count * ease(Math.min(1, age / 1.8))));
      });
    } },

    { view: [0.9, 1.10, 1.00], hold: 3.2, run() {           // 8 Yajnopavita
      // Over one shoulder and under the other arm: a loop that rides high on
      // one side and low on the other, held against the surface throughout.
      const pts = [];
      for (let i = 0; i <= 260; i++) {
        const t = i / 260, a = t * Math.PI * 2;
        const y = H * (0.86 - 0.70 * Math.abs(Math.sin(a / 2)));
        const rad = radiusAt(y, a) + R * 0.055;
        pts.push(new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad));
      }
      const thread = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 320,
          R * 0.017, 7, true), matt(C.thread, 1, 0.9));
      add(thread, (dt, age) => {
        thread.geometry.setDrawRange(0,
          Math.floor(thread.geometry.index.count * ease(Math.min(1, age / 1.5))));
      });
    } },

    { view: [0.4, 1.25, 0.90], hold: 3.0, run() {           // 9 Gandha
      // marks smoothed onto each tier, not a wash over the whole thing
      const n = 24;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const t = k / n;
        const rad = R * (0.30 + 0.62 * ((k * 7) % n) / n);
        const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
        const mark = new THREE.Mesh(
          new THREE.CircleGeometry(R * 0.035, 16), matt(C.sandal, 1, 0.95));
        mark.rotation.x = -Math.PI / 2;
        mark.position.set(x, ground(x, z) + R * 0.004, z);
        mark.scale.setScalar(0.01);
        add(mark, (dt, age) =>
          mark.scale.setScalar(ease(Math.min(1, Math.max(0, age - k * 0.045) / 0.4))));
      }
    } },

    { view: [0, 0.80, 1.32], hold: 5.6, run() {             // 10 Puspa
      // whole blossoms, and loose petals, settling where the mesh actually is
      const blooms = swarm(geo.blossom, BLOOM, 130,
        () => {
          const a = rnd(0, Math.PI * 2), r = Math.sqrt(Math.random()) * R * 1.10;
          const x = Math.cos(a) * r, z = Math.sin(a) * r;
          return { x, z, y: H * rnd(1.05, 1.85), v: rnd(0, 0.4),
                   rx: rnd(0, 6), ry: rnd(0, 6), rz: rnd(0, 6),
                   spin: rnd(-2.2, 2.2), rest: ground(x, z) + R * 0.012,
                   s: R * rnd(0.045, 0.085), down: false };
        },
        (b, dt) => {
          if (b.down) return;
          b.v += dt * 1.5; b.y -= b.v * dt;
          b.rx += b.spin * dt; b.rz += b.spin * 0.7 * dt;
          if (b.y <= b.rest) {                    // land flat and stay
            b.y = b.rest; b.down = true;
            b.rx = 0; b.rz = 0; b.ry = rnd(0, 6);
          }
        });
      add(blooms.holder, dt => blooms.tick(dt));

      const petals = swarm(geo.petal, BLOOM, 150,
        () => {
          const a = rnd(0, Math.PI * 2), r = Math.sqrt(Math.random()) * R * 1.15;
          const x = Math.cos(a) * r, z = Math.sin(a) * r;
          return { x, z, y: H * rnd(1.0, 2.0), v: rnd(0, 0.5),
                   rx: rnd(0, 6), ry: rnd(0, 6), rz: rnd(0, 6),
                   spin: rnd(-3, 3), rest: ground(x, z) + R * 0.006,
                   s: R * rnd(0.05, 0.09), down: false };
        },
        (b, dt) => {
          if (b.down) return;
          b.v += dt * 1.2; b.y -= b.v * dt;
          b.rx += b.spin * dt; b.ry += b.spin * 0.5 * dt;
          if (b.y <= b.rest) {
            b.y = b.rest; b.down = true; b.rx = -Math.PI / 2; b.rz = rnd(0, 6);
          }
        });
      add(petals.holder, dt => petals.tick(dt));
    } },

    { view: [0.6, 1.12, 1.05], hold: 4.6, run() {           // 11 Dhupa
      // Smoke was flat untextured quads, which read as blurry grey cards. It
      // is spheres now - round from every angle, no texture, no gradient -
      // faint and many, growing and thinning as they climb.
      const sx = R * 0.70, sz = R * 0.34;
      const gy = ground(sx, sz);
      const holder = new THREE.Group();
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(R * 0.007, R * 0.009, H * 0.26, 8),
        matt(0x5d4326));
      stick.position.set(sx, gy + H * 0.13, sz);
      const ember = new THREE.Mesh(
        new THREE.SphereGeometry(R * 0.010, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
      ember.position.set(sx, gy + H * 0.26, sz);
      holder.add(stick, ember);
      add(holder, () => {});

      const puff = new THREE.SphereGeometry(1, 7, 6);
      const s2 = swarm(puff, [C.smoke], 170,
        () => {
          const t = Math.random();                 // scatter along the column
          return { a: rnd(0, 6.3), r: rnd(0, R * 0.02) + t * R * 0.16,
                   t, x: sx, z: sz,
                   y: gy + H * (0.26 + t * 1.05),
                   s: R * (0.018 + t * 0.075) };
        },
        (b, dt) => {
          b.y += dt * H * 0.24;
          b.a += dt * 1.1;
          b.r += dt * R * 0.055;
          b.s += dt * R * 0.030;
          b.x = sx + Math.cos(b.a) * b.r;
          b.z = sz + Math.sin(b.a) * b.r;
          if (b.y > gy + H * 1.35) {
            b.y = gy + H * 0.27; b.r = rnd(0, R * 0.02);
            b.s = R * 0.018; b.a = rnd(0, 6.3);
          }
        });
      s2.holder.children.forEach(m => {
        m.material.transparent = true;
        m.material.opacity = 0.085;
        m.material.depthWrite = false;
      });
      add(s2.holder, dt => s2.tick(dt));
    } },

    { view: [0.3, 1.24, 0.98], hold: 6.0, run() {           // 12 Dipa
      meru.setKeyLight?.(0.18);            // let the flame do the lighting
      const lamp = new THREE.Group();
      // A diya is a shallow dish pinched to a lip, not half a ball. Turned
      // from a profile so it reads as a vessel from any angle.
      const dish = new THREE.Mesh(
        new THREE.LatheGeometry([
          [0.00, 0.00], [0.42, 0.00], [0.68, 0.05], [0.86, 0.17],
          [0.92, 0.30], [0.88, 0.34], [0.78, 0.24], [0.60, 0.13],
          [0.30, 0.08], [0.00, 0.07],
        ].map(([x, y]) => new THREE.Vector2(x * R * 0.115, y * R * 0.115)), 28),
        new THREE.MeshStandardMaterial({
          color: C.brass, metalness: 0.95, roughness: 0.28,
          side: THREE.DoubleSide }));
      const ghee = new THREE.Mesh(
        new THREE.CircleGeometry(R * 0.078, 24), matt(C.ghee, 1, 0.25));
      ghee.rotation.x = -Math.PI / 2;
      ghee.position.y = R * 0.020;
      const wick = new THREE.Mesh(
        new THREE.CylinderGeometry(R * 0.005, R * 0.006, R * 0.030, 6),
        matt(0x4a3a28));
      wick.position.set(R * 0.055, R * 0.028, 0);
      wick.rotation.z = 0.5;
      // teardrop flame, also a lathe, with a brighter core inside it
      const flameProfile = n => [
        [0.00, 0.00], [0.36, 0.16], [0.42, 0.40], [0.30, 0.68],
        [0.13, 0.88], [0.00, 1.00],
      ].map(([x, y]) => new THREE.Vector2(x * n, y * n));
      const flame = new THREE.Mesh(
        new THREE.LatheGeometry(flameProfile(R * 0.085), 18),
        new THREE.MeshBasicMaterial({ color: 0xffa733, transparent: true, opacity: 0.85 }));
      const core = new THREE.Mesh(
        new THREE.LatheGeometry(flameProfile(R * 0.048), 14),
        new THREE.MeshBasicMaterial({ color: 0xfff0c0 }));
      flame.position.set(R * 0.072, R * 0.038, 0);
      core.position.set(R * 0.072, R * 0.040, 0);
      const light = new THREE.PointLight(C.flame, 26, R * 6, 2);
      light.position.set(R * 0.072, R * 0.075, 0);
      lamp.add(dish, ghee, wick, flame, core, light);
      add(lamp, (dt, age) => {
        const a = -age * 0.95;                      // keep it to the right
        lamp.position.set(Math.cos(a) * R * 1.00,
                          H * (0.42 + 0.20 * Math.sin(age * 1.5)),
                          Math.sin(a) * R * 1.00);
        lamp.rotation.y = -a + Math.PI / 2;         // the lip leads the way
        const f = 0.86 + 0.14 * Math.sin(age * 21) + 0.06 * Math.sin(age * 8.3);
        flame.scale.set(1, f, 1);
        core.scale.set(1, f * 0.96, 1);
        light.intensity = 26 * f;
      });
    } },

    { view: [0, 1.00, 0.90], hold: 3.6, run() {             // 13 Naivedya
      // These were half-spheres placed with their centre on the surface, so
      // the bowl was buried and only its dome showed - a ball stuck in the
      // mountain. A lathed katori stands on its own base at ground level.
      const bowlProfile = [
        [0.00, 0.00], [0.30, 0.00], [0.36, 0.06], [0.62, 0.22],
        [0.78, 0.46], [0.82, 0.60], [0.76, 0.60], [0.72, 0.46],
        [0.56, 0.24], [0.28, 0.10], [0.00, 0.08],
      ];
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2;
        const x = Math.cos(a) * R * 0.94, z = Math.sin(a) * R * 0.94;
        const g = new THREE.Group();
        const n = R * 0.20;
        const bowl = new THREE.Mesh(
          new THREE.LatheGeometry(
            bowlProfile.map(([u, v]) => new THREE.Vector2(u * n, v * n)), 26),
          new THREE.MeshStandardMaterial({
            color: C.brass, metalness: 0.92, roughness: 0.3,
            side: THREE.DoubleSide }));
        const heap = new THREE.Mesh(
          new THREE.SphereGeometry(n * 0.62, 18, 12, 0, 6.3, 0, Math.PI / 2),
          matt(C.food, 1, 0.9));
        heap.position.y = n * 0.34;
        g.add(bowl, heap);
        g.position.set(x, ground(x, z), z);     // base on the terrace
        g.scale.setScalar(0.01);
        add(g, (dt, age) =>
          g.scale.setScalar(ease(Math.min(1, Math.max(0, age - k * 0.13) / 0.5))));
      }
    } },

    { view: [0.5, 1.00, 0.90], hold: 3.4, run() {           // 14 Tambula
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + Math.PI / 4;
        const x = Math.cos(a) * R * 0.94, z = Math.sin(a) * R * 0.94;
        const g = new THREE.Group();
        for (let j = 0; j < 3; j++) {
          const leaf = new THREE.Mesh(geo.petal, matt(C.leaf, 1, 0.55));
          leaf.scale.setScalar(R * 0.21);
          leaf.rotation.set(-Math.PI / 2 + 0.06, 0, (j - 1) * 0.42);
          leaf.position.y = R * 0.004 * j;
          g.add(leaf);
        }
        const nut = new THREE.Mesh(
          new THREE.SphereGeometry(R * 0.032, 14, 10), matt(0xa9541c, 1, 0.6));
        nut.scale.set(1, 0.75, 1);
        nut.position.set(0, R * 0.026, R * 0.055);
        g.add(nut);
        g.position.set(x, ground(x, z) + R * 0.004, z);
        g.rotation.y = -a;
        g.scale.setScalar(0.01);
        add(g, (dt, age) =>
          g.scale.setScalar(ease(Math.min(1, Math.max(0, age - k * 0.13) / 0.5))));
      }
    } },

    { view: [0, 1.40, 1.02], hold: 11.5, run() {            // 15 Pradakshina
      // Orbiting an object against an empty background reads as the object
      // turning, not as you walking - there is nothing to have parallax
      // against. So the path gets lamps standing on it. They stay put, the
      // camera passes them, and the motion becomes yours.
      const n = 12, rad = R * 1.42;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const g = new THREE.Group();
        const cup = new THREE.Mesh(
          new THREE.LatheGeometry([
            [0.00, 0.00], [0.34, 0.00], [0.52, 0.10], [0.56, 0.22],
            [0.50, 0.22], [0.44, 0.11], [0.24, 0.05], [0.00, 0.04],
          ].map(([u, v]) => new THREE.Vector2(u * R * 0.13, v * R * 0.13)), 18),
          new THREE.MeshStandardMaterial({
            color: C.brass, metalness: 0.9, roughness: 0.35,
            side: THREE.DoubleSide }));
        const fl = new THREE.Mesh(
          new THREE.SphereGeometry(R * 0.016, 10, 8),
          new THREE.MeshBasicMaterial({ color: 0xffc25e }));
        fl.scale.set(1, 1.7, 1);
        fl.position.y = R * 0.030;
        const li = new THREE.PointLight(0xffb347, 3.2, R * 1.4, 2);
        li.position.y = R * 0.035;
        g.add(cup, fl, li);
        g.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad);
        g.scale.setScalar(0.01);
        add(g, (dt, age) => {
          g.scale.setScalar(ease(Math.min(1, Math.max(0, age - k * 0.05) / 0.4)));
          fl.scale.set(1, 1.7 * (0.85 + 0.15 * Math.sin(age * 17 + k)), 1);
        });
      }
      // a floor to walk on, so the lamps are standing on something
      const floor = new THREE.Mesh(
        new THREE.RingGeometry(R * 1.18, R * 1.72, 96),
        matt(0x2a251d, 0.9, 0.95));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.002;
      add(floor, () => {});
      setTimeout(() => meru.circumambulate(9200), 700);
    } },

    { view: null, hold: 4.0, run() { meru.bow(3400); } },              // 16
  ];

  // ---- driving ----------------------------------------------------------

  function go(i) {
    if (i < 0 || i >= acts.length) return;
    clear();
    st.step = i;
    st.t = 0;
    const a = acts[i];
    st.hold = a.hold || 3.4;
    if (a.view) meru.look(a.view[0], a.view[1], a.view[2], 900);
    a.run();
    meru.onPujaStep?.(i);
  }

  let last = performance.now();
  function tick() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const r of live) { r.age += dt; r.tick(dt, r.age); }
    if (st.playing) {
      st.t += dt;
      if (st.t > st.hold) {
        if (st.step >= acts.length - 1) { st.playing = false; meru.onPujaEnd?.(); }
        else go(st.step + 1);
      }
    }
  }

  return {
    UPACHARAS, tick, go,
    get step() { return st.step; },
    get playing() { return st.playing; },
    next: () => go(Math.min(acts.length - 1, st.step + 1)),
    prev: () => go(Math.max(0, st.step - 1)),
    play: () => { st.playing = true; if (st.step < 0) go(0); },
    pause: () => { st.playing = false; },
    stop: () => { st.playing = false; st.step = -1; clear(); meru.view('front'); meru.onPujaStep?.(-1); },
  };
}
