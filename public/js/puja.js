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
  function ground(x, z) {
    if (!prof) return 0;
    const r = Math.hypot(x, z);
    let a = Math.atan2(z, x);
    if (a < 0) a += Math.PI * 2;
    const ai = Math.min(NA - 1, Math.round(a / (Math.PI * 2) * NA) % NA);
    for (let i = prof.tiers.length - 1; i >= 0; i--) {
      if (r <= prof.tiers[i].r[ai]) return prof.tiers[i].z;
    }
    return 0;
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

    { view: [0, 1.30, 1.05], hold: 2.8, run() {             // 2 Asana
      const n = 16, r0 = R * 1.02, r1 = R * 1.30;
      const s = swarm(geo.petal, [BLOOM[0], BLOOM[3]], n,
        i => {
          const a = (i / n) * Math.PI * 2;
          return { a, x: Math.cos(a) * (r0 + r1) / 2, z: Math.sin(a) * (r0 + r1) / 2,
                   y: 0.02, rx: -Math.PI / 2, ry: 0, rz: -a + Math.PI / 2,
                   s: 0.001, grow: (r1 - r0) };
        },
        (b, dt, age) => { b.s = ease(Math.min(1, age / 0.9)) * b.grow; });
      add(s.holder, (dt, age) => s.tick(dt, age));
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

    { view: [0.7, 1.20, 0.95], hold: 3.4, run() {           // 7 Vastra
      // a band that follows the silhouette, wound round and up
      const pts = [];
      const turns = 2.4;
      for (let i = 0; i <= 240; i++) {
        const t = i / 240;
        const a = t * Math.PI * 2 * turns;
        const y = H * (0.08 + t * 0.52);
        const rad = R * (0.94 - t * 0.55);
        pts.push(new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const cloth = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 260, R * 0.045, 4, false),
        matt(C.cloth, 1, 0.85));
      cloth.scale.set(1, 1, 1);
      add(cloth, (dt, age) => {
        const t = Math.min(1, age / 1.6);
        cloth.geometry.setDrawRange(0, Math.floor(cloth.geometry.index.count * ease(t)));
      });
    } },

    { view: [0.9, 1.15, 0.95], hold: 3.0, run() {           // 8 Yajnopavita
      const pts = [];
      for (let i = 0; i <= 200; i++) {
        const t = i / 200, a = t * Math.PI * 2;
        pts.push(new THREE.Vector3(
          Math.cos(a) * R * 0.70,
          H * (0.90 - 0.72 * Math.abs(Math.sin(a / 2))),
          Math.sin(a) * R * 0.42));
      }
      const thread = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 240,
          R * 0.007, 5, true), matt(C.thread, 1, 0.9));
      thread.rotation.y = -0.6;
      add(thread, (dt, age) => {
        thread.geometry.setDrawRange(0,
          Math.floor(thread.geometry.index.count * ease(Math.min(1, age / 1.3))));
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

    { view: [0.6, 1.18, 1.05], hold: 4.0, run() {           // 11 Dhupa
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(R * 0.008, R * 0.008, H * 0.22, 6),
        matt(0x6b4b2a));
      stick.position.set(R * 0.72, H * 0.11, R * 0.30);
      add(stick, () => {});
      const s = swarm(new THREE.PlaneGeometry(1, 1), [C.smoke], 150,
        () => ({ a: rnd(0, 6.3), r: rnd(0, R * 0.05),
                 x: R * 0.72, z: R * 0.30, y: H * rnd(0.22, 0.4),
                 s: R * rnd(0.03, 0.08), o: 1 }),
        (b, dt) => {
          b.y += dt * H * 0.30;
          b.a += dt * 1.5;
          b.r += dt * R * 0.09;
          b.s += dt * R * 0.05;
          b.x = R * 0.72 + Math.cos(b.a) * b.r;
          b.z = R * 0.30 + Math.sin(b.a) * b.r;
          b.rz += dt * 0.5;
          if (b.y > H * 1.5) { b.y = H * 0.24; b.r = rnd(0, R * 0.05); b.s = R * 0.03; }
        });
      s.holder.children.forEach(m => {
        m.material.transparent = true; m.material.opacity = 0.16;
        m.material.depthWrite = false;
      });
      add(s.holder, dt => s.tick(dt));
    } },

    { view: [0.3, 1.30, 0.95], hold: 5.0, run() {           // 12 Dipa
      meru.setKeyLight?.(0.22);            // let the flame do the lighting
      const lamp = new THREE.Group();
      const dish = new THREE.Mesh(
        new THREE.SphereGeometry(R * 0.055, 16, 10, 0, 6.3, Math.PI / 2, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: C.brass, metalness: 0.9, roughness: 0.3 }));
      const ghee = new THREE.Mesh(
        new THREE.CircleGeometry(R * 0.048, 20), matt(C.ghee, 1, 0.4));
      ghee.rotation.x = -Math.PI / 2; ghee.position.y = R * 0.006;
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(R * 0.020, R * 0.075, 10),
        new THREE.MeshBasicMaterial({ color: C.flame }));
      flame.position.y = R * 0.045;
      const light = new THREE.PointLight(C.flame, 22, R * 5, 2);
      light.position.y = R * 0.05;
      lamp.add(dish, ghee, flame, light);
      add(lamp, (dt, age) => {
        const a = -age * 1.05;                      // keep it to the right
        lamp.position.set(Math.cos(a) * R * 0.92,
                          H * (0.40 + 0.22 * Math.sin(age * 1.7)),
                          Math.sin(a) * R * 0.92);
        const f = 0.85 + 0.15 * Math.sin(age * 19) + 0.06 * Math.sin(age * 7);
        flame.scale.set(1, f, 1);
        light.intensity = 22 * f;
      });
    } },

    { view: [0, 1.32, 1.05], hold: 3.2, run() {             // 13 Naivedya
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2;
        const x = Math.cos(a) * R * 0.92, z = Math.sin(a) * R * 0.92;
        const g = new THREE.Group();
        const bowl = new THREE.Mesh(
          new THREE.SphereGeometry(R * 0.062, 18, 12, 0, 6.3, Math.PI / 2, Math.PI / 2),
          new THREE.MeshStandardMaterial({ color: C.brass, metalness: 0.85, roughness: 0.35 }));
        const heap = new THREE.Mesh(
          new THREE.SphereGeometry(R * 0.050, 16, 10, 0, 6.3, 0, Math.PI / 2),
          matt(C.food, 1, 0.85));
        heap.position.y = R * 0.004;
        g.add(bowl, heap);
        g.position.set(x, ground(x, z), z);
        g.scale.setScalar(0.01);
        add(g, (dt, age) =>
          g.scale.setScalar(ease(Math.min(1, Math.max(0, age - k * 0.14) / 0.5))));
      }
    } },

    { view: [0, 1.32, 1.05], hold: 3.0, run() {             // 14 Tambula
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + Math.PI / 4;
        const x = Math.cos(a) * R * 0.88, z = Math.sin(a) * R * 0.88;
        const g = new THREE.Group();
        for (let j = 0; j < 2; j++) {
          const leaf = new THREE.Mesh(geo.petal, matt(C.leaf, 1, 0.6));
          leaf.scale.setScalar(R * 0.10);
          leaf.rotation.set(-Math.PI / 2, 0, j * 0.7 - 0.35);
          leaf.position.y = R * 0.004 * j;
          g.add(leaf);
        }
        const nut = new THREE.Mesh(
          new THREE.SphereGeometry(R * 0.016, 10, 8), matt(0xb5651d));
        nut.position.set(0, R * 0.014, R * 0.02);
        g.add(nut);
        g.position.set(x, ground(x, z), z);
        g.rotation.y = -a;
        g.scale.setScalar(0.01);
        add(g, (dt, age) =>
          g.scale.setScalar(ease(Math.min(1, Math.max(0, age - k * 0.14) / 0.5))));
      }
    } },

    { view: null, hold: 9.6, run() { meru.circumambulate(9000); } },   // 15
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
