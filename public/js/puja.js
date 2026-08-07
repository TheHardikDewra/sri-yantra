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
  { n: 'Āvāhana', nh: 'आवाहन',
    e: 'invocation — the deity is invited to be present',
    eh: 'देवी को उपस्थित होने का निमन्त्रण' },
  { n: 'Āsana', nh: 'आसन',
    e: 'a seat is offered', eh: 'आसन अर्पित किया जाता है' },
  { n: 'Pādya', nh: 'पाद्य',
    e: 'water for washing the feet', eh: 'चरण धोने के लिए जल' },
  { n: 'Arghya', nh: 'अर्घ्य',
    e: 'water offered to the hands', eh: 'हाथों के लिए जल' },
  { n: 'Ācamanīya', nh: 'आचमनीय',
    e: 'water for sipping', eh: 'आचमन के लिए जल' },
  { n: 'Snāna', nh: 'स्नान',
    e: 'the bath — poured over and let run down',
    eh: 'स्नान - ऊपर से अर्पित, बहता हुआ' },
  { n: 'Vastra', nh: 'वस्त्र',
    e: 'cloth, wrapped about the form',
    eh: 'वस्त्र, स्वरूप के चारों ओर' },
  { n: 'Yajñopavīta', nh: 'यज्ञोपवीत',
    e: 'the sacred thread, laid across the shoulder',
    eh: 'यज्ञोपवीत, कन्धे पर धारण' },
  { n: 'Gandha', nh: 'गन्ध',
    e: 'sandal paste, marked onto the form',
    eh: 'चन्दन, स्वरूप पर अंकित' },
  { n: 'Puṣpa', nh: 'पुष्प',
    e: 'flowers, let fall over the enclosures',
    eh: 'पुष्प, आवरणों पर बरसाए हुए' },
  { n: 'Dhūpa', nh: 'धूप',
    e: 'incense, waved before the form',
    eh: 'धूप, स्वरूप के समक्ष घुमाई हुई' },
  { n: 'Dīpa', nh: 'दीप',
    e: 'the lamp, circled before the form',
    eh: 'दीप, स्वरूप के समक्ष घुमाया हुआ' },
  { n: 'Naivedya', nh: 'नैवेद्य',
    e: 'food, set down at the four gates',
    eh: 'भोग, चारों द्वारों पर अर्पित' },
  { n: 'Tāmbūla', nh: 'ताम्बूल',
    e: 'betel, offered after the meal',
    eh: 'ताम्बूल, भोजन के पश्चात्' },
  { n: 'Pradakṣiṇa', nh: 'प्रदक्षिणा',
    e: 'circumambulation, keeping it to the right',
    eh: 'प्रदक्षिणा, दाहिने रखते हुए' },
  { n: 'Namaskāra', nh: 'नमस्कार',
    e: 'prostration, and the offering is complete',
    eh: 'प्रणाम - और अर्पण पूर्ण हुआ' },
];

// marigold, hibiscus, jasmine, champaka, rose and aparajita - what actually
// gets offered
const BLOOM = [0xf07f1a, 0xd8321f, 0xf6efdc, 0xf2c53d, 0xe45c2a,
               0xe87fa3, 0x9b6bb8];
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

// A paan leaf: heart-shaped with round lobes at the stem and a drawn-out
// point, creased along the midrib, tip drooping. The flower petal reads as a
// flower part; a betel leaf is its own thing.
function betelLeafGeometry() {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0.06);
  sh.bezierCurveTo(-0.16, -0.05, -0.46, -0.02, -0.52, 0.30);
  sh.bezierCurveTo(-0.56, 0.58, -0.32, 0.92, 0, 1.12);
  sh.bezierCurveTo(0.32, 0.92, 0.56, 0.58, 0.52, 0.30);
  sh.bezierCurveTo(0.46, -0.02, 0.16, -0.05, 0, 0.06);
  const g = new THREE.ShapeGeometry(sh, 14);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, Math.abs(x) * 0.22 - Math.max(0, y - 0.55) ** 2 * 0.35);
  }
  g.computeVertexNormals();
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
  // this reads it. Raycasting the mesh a few hundred times a frame would
  // freeze the tab, and it would only be rediscovering this.
  //
  // Two conversions matter here. The profile is in the solver's plan
  // coordinates, and the GLB's z-up to y-up flip maps a plan point (x, y) to
  // world (x, -y) in xz - so a world bearing is MINUS the plan bearing. And
  // the angle list is deliberately NOT uniform (it is densified at the
  // figure's corners so the ridges stay sharp), so it is searched, never
  // indexed by proportion. Nearest angle rather than interpolated: the Meru
  // is a staircase, and the steps should stay steps.
  const prof = meru.profile;
  const ANG = prof ? prof.angles : null;
  const NA = ANG ? ANG.length : 0;
  const TAU = Math.PI * 2;

  function planIndex(aPlan) {
    let a = aPlan % TAU;
    if (a < 0) a += TAU;
    let lo = 0, hi = NA - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ANG[mid] < a) lo = mid + 1; else hi = mid;
    }
    let best = lo, bd = Infinity;
    for (const i of [(lo - 1 + NA) % NA, lo % NA, (lo + 1) % NA]) {
      let d = Math.abs(ANG[i] - a);
      d = Math.min(d, TAU - d);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  const inPoly = (pts, x, y) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[j];
      if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / (y2 - y1) + x1)
        c = !c;
    }
    return c;
  };

  // Height of the solid under a point: the mountain tiers by radius, then
  // the bhupura by real polygon containment - the gated square is not a
  // circle, and treating it as one is how offerings ended up floating over
  // the gate notches.
  function ground(x, z) {
    if (!prof) return 0;
    const r = Math.hypot(x, z), ai = planIndex(Math.atan2(-z, x));
    for (let i = prof.tiers.length - 1; i >= 0; i--) {
      if (r <= prof.tiers[i].r[ai]) return prof.tiers[i].z;
    }
    const B = prof.bhupura;
    if (B) {
      for (let k = B.outlines.length - 1; k >= 0; k--) {
        if (inPoly(B.outlines[k], x, -z)) return B.z[k];
      }
    }
    return 0;
  }

  // Where a named tier tops out - act placement derives from the shipped
  // profile, never from remembered heights, so a re-proportioned solver
  // cannot strand an offering in the air.
  const tierZ = name => {
    const q = prof && prof.tiers.find(x => x.name === name);
    return q ? q.z : null;
  };

  // How far out the solid reaches at a given height, along a given bearing.
  // Cloth and thread have to lie ON the mountain; a radius picked by eye cuts
  // straight through it, which is what was happening.
  function radiusAt(y, theta) {
    if (!prof) return 0;
    const ai = planIndex(-theta);
    for (let i = 0; i < prof.tiers.length; i++) {
      if (prof.tiers[i].z >= y) return prof.tiers[i].r[ai];
    }
    return prof.tiers[prof.tiers.length - 1].r[ai];
  }

  const geo = { blossom: blossomGeometry(), petal: petalGeometry(0.22),
                drop: dropGeometry(), leaf: betelLeafGeometry() };

  const add = (obj, tick) => {
    group.add(obj);
    live.push({ obj, tick, age: 0 });
    return obj;
  };

  // Acts may schedule camera moves for later; those must die with the act,
  // or jumping to the next one lets the old act steer the camera through it.
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  function clear() {
    while (timers.length) clearTimeout(timers.pop());
    meru.cancelBow?.();
    meru.cancelWalk?.();
    for (const r of live) {
      group.remove(r.obj);
      r.obj.traverse?.(o => {
        if (o.isInstancedMesh) o.dispose();
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
  //
  // The pour has to happen where the mountain is LOWER than the pour height.
  // Near the axis the summit stands at 2.27; a drop "poured" at 0.5 there
  // would materialise inside the rock and pop to a terrace above - which is
  // exactly what Padya used to do. So the spawn radius starts beyond the
  // outermost tier that still stands at the pour height: Padya's water falls
  // in a ring at the feet, Snana's from above the summit, each by the same
  // rule.
  function water(fromY, count, spread = 0.10, flow = 0.62) {
    let rIn = 0;
    if (prof) {
      for (const t of prof.tiers) {
        if (t.z >= fromY) for (const r of t.r) if (r > rIn) rIn = r;
      }
      if (rIn) rIn = Math.min(rIn * 1.02, R);
    }
    const fallR = () => rIn ? rnd(rIn, Math.min(R * 1.04, rIn + R * spread))
                            : rnd(0, R * spread);
    const s = swarm(geo.drop, [C.water], count,
      () => {
        // Start them scattered through the cycle. Spawned together they fall
        // together, land together and restart together, and what you see is a
        // clump pulsing rather than a stream running.
        const a = rnd(0, Math.PI * 2);
        const running = Math.random() < 0.62;
        const r = running ? rnd(Math.max(rIn, R * spread), R * 1.05) : fallR();
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const g = ground(x, z);
        return { a, r, x, z,
                 y: running ? g + R * 0.010
                            : rnd(g + R * 0.02,
                                  Math.max(fromY + H * 0.12, g + R * 0.02 + H * 0.05)),
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
            b.r = fallR();
            b.x = Math.cos(b.a) * b.r;
            b.z = Math.sin(b.a) * b.r;
            b.y = Math.max(fromY + rnd(0, H * 0.12),
                           ground(b.x, b.z) + R * 0.03);
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

    { view: [0, 0.66, 1.30], hold: 3.2, run() {             // 2 Asana
      // A lotus seat laid round the base. The bhupura is a gated square, not
      // a circle - a ring at any fixed radius crosses its gate openings and
      // corner fields - so the seat follows the outermost tread itself: the
      // centreline between the first two outlines, which by construction
      // lies flat on the first step.
      const B = prof && prof.bhupura;
      const path = [];
      if (B) {
        const o0 = B.outlines[0], o1 = B.outlines[1];
        for (let i = 0; i < o0.length; i++) {
          const px = (o0[i][0] + o1[i][0]) / 2;
          const py = (o0[i][1] + o1[i][1]) / 2;
          path.push(new THREE.Vector3(px, B.z[0] + R * 0.008, -py));
        }
      } else {
        for (let i = 0; i < 64; i++) {
          const a = (i / 64) * Math.PI * 2, r = R * 0.88;
          const x = Math.cos(a) * r, z = Math.sin(a) * r;
          path.push(new THREE.Vector3(x, ground(x, z) + R * 0.008, z));
        }
      }
      const lens = [0];
      for (let i = 1; i <= path.length; i++)
        lens.push(lens[i - 1] + path[i - 1].distanceTo(path[i % path.length]));
      const total = lens[lens.length - 1];
      const at = d => {
        let i = 1;
        while (i < lens.length - 1 && lens[i] < d) i++;
        const p0 = path[i - 1], p1 = path[i % path.length];
        const k = (d - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
        return p0.clone().lerp(p1, k);
      };
      const n = 48;
      const s1 = swarm(geo.petal, [BLOOM[0], BLOOM[3], BLOOM[2]], n,
        i => {
          const p = at((i / n) * total);
          const a = Math.atan2(p.z, p.x);       // petals face out from the axis
          return { x: p.x, z: p.z, y: p.y,
                   rx: -Math.PI / 2, ry: 0, rz: -a - Math.PI / 2,
                   s: 0.001, full: R * 0.26, i };
        },
        (b, dt, age) => {
          b.s = b.full * ease(Math.min(1, Math.max(0, age - b.i * 0.02) / 0.5));
        });
      add(s1.holder, (dt, age) => s1.tick(dt, age));

      const lit = new THREE.PointLight(0xfff0d0, 0, R * 4.5, 2);
      lit.position.set(0, H * 0.75, 0);
      add(lit, (dt, age) => { lit.intensity = 8 * Math.min(1, age / 0.6); });

      const seat = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path, true), 360,
          R * 0.012, 6, true), matt(C.sandal, 1, 0.5));
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

    { view: [0, 0.98, 0.86], hold: 8.5, run() {             // 5 Acamaniya
      // A sip, offered properly: a copper lota with an uddharani in it. The
      // spoon dips, lifts, carries the water to the summit, tips it out, and
      // returns - twice over the hold.
      const copper = extra => new THREE.MeshStandardMaterial(Object.assign({
        color: 0xc06a3d, metalness: 0.85, roughness: 0.30 }, extra));
      const Lx = R * 0.34, Ly = H * 0.74, Lz = R * 0.62;
      const lota = new THREE.Mesh(new THREE.LatheGeometry([
        [0.00, 0.00], [0.30, 0.00], [0.42, 0.04], [0.46, 0.16],
        [0.40, 0.30], [0.33, 0.38], [0.36, 0.44], [0.44, 0.48],
        [0.46, 0.52], [0.42, 0.53], [0.33, 0.50], [0.00, 0.49],
      ].map(([x, y]) => new THREE.Vector2(x * R * 0.16, y * R * 0.16)), 24),
        copper({ side: THREE.DoubleSide }));
      lota.position.set(Lx, Ly, Lz);
      add(lota, () => {});
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(R * 0.048, 20), matt(C.water, 1, 0.15));
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(Lx, Ly + R * 0.070, Lz);
      add(pool, () => {});

      const spoon = new THREE.Group();
      const cup = new THREE.Mesh(
        new THREE.SphereGeometry(R * 0.024, 12, 8, 0, Math.PI * 2,
                                 Math.PI / 2, Math.PI / 2),
        copper({ side: THREE.DoubleSide }));
      const sip = new THREE.Mesh(
        new THREE.CircleGeometry(R * 0.018, 12), matt(C.water, 1, 0.15));
      sip.rotation.x = -Math.PI / 2;
      sip.position.y = -R * 0.004;
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(R * 0.0045, R * 0.0045, R * 0.17, 6),
        copper());
      handle.position.set(0, R * 0.055, R * 0.062);
      handle.rotation.x = 0.75;
      spoon.add(cup, sip, handle);

      const pending = [];
      const A = new THREE.Vector3(Lx, Ly + R * 0.115, Lz);
      const B = new THREE.Vector3(0, H * 1.055, R * 0.10);
      let emit = 0;
      const ss = u => u * u * (3 - 2 * u);
      add(spoon, (dt, age) => {
        const T = 4.2, p = age % T;
        let P, tilt = 0;
        if (p < 0.9) {                          // dip into the lota
          const u = ss(Math.min(1, p / 0.9));
          P = A.clone(); P.y -= Math.sin(Math.PI * u) * R * 0.055;
          sip.visible = u > 0.5;
        } else if (p < 1.5) {                   // lift clear
          P = A.clone();
        } else if (p < 2.5) {                   // carry it to the summit
          const u = ss((p - 1.5) / 1.0);
          P = A.clone().lerp(B, u);
          P.y += Math.sin(Math.PI * u) * H * 0.05;
          tilt = -0.15 * u;
        } else if (p < 3.2) {                   // tip it out
          const u = ss((p - 2.5) / 0.7);
          P = B.clone();
          tilt = -0.15 - 1.45 * u;
          emit -= dt;
          if (u > 0.15 && u < 0.9 && emit <= 0) {
            emit = 0.075;
            pending.push({ x: P.x, y: P.y - R * 0.01, z: P.z - R * 0.015 });
          }
          if (u > 0.9) sip.visible = false;
        } else {                                // come back
          const u = ss((p - 3.2) / 1.0);
          P = B.clone().lerp(A, u);
          tilt = -1.6 * (1 - u);
        }
        spoon.position.copy(P);
        spoon.rotation.x = tilt;
      });

      const drops = swarm(geo.drop, [C.water], 24,
        () => ({ x: 0, y: -9, z: 0, v: 0, live: -1,
                 sx: R * 0.009, sy: R * 0.016, sz: R * 0.009, s: undefined }),
        (b, dt) => {
          if (b.live < 0) {
            const q = pending.shift();
            if (!q) return;
            b.x = q.x; b.y = q.y; b.z = q.z; b.v = rnd(0.05, 0.2);
            b.live = 1.4;
            return;
          }
          b.v += dt * 2.4; b.y -= b.v * dt; b.live -= dt;
          if (b.y <= ground(b.x, b.z) + R * 0.008 || b.live <= 0) {
            b.y = -9; b.live = -1;
          }
        });
      add(drops.holder, dt => drops.tick(dt));
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

    { view: [0.7, 1.10, 1.06], hold: 6.0, run() {           // 7 Vastra
      // Cloth is cut and draped, not shrink-wrapped. A skirt is cinched round
      // the drum's upper edge and falls under gravity: pleats deepen on the
      // way down, the hem flares and settles just above the plinth, and the
      // whole sheet breathes. A gold cord with a knot and two tails ties it.
      const NA2 = 220, NV = 26;
      const hemY = (prof && prof.bhupura ? prof.bhupura.z[2] : 0.31) + 0.03;
      const tieY = (tierZ('lotus16') ?? 0.70) - 0.016;
      let rBase = 0;
      if (prof) for (const q of prof.tiers)
        if (q.z <= tieY + 0.02) for (const rr of q.r)
          if (rr > rBase) rBase = rr;
      const rTop = (rBase || Math.SQRT2) + R * 0.020;
      const geom = new THREE.BufferGeometry();
      const pos = new Float32Array((NA2 + 1) * NV * 3);
      const idx = [];
      for (let j = 0; j < NV - 1; j++)
        for (let i = 0; i < NA2; i++) {
          const a0 = j * (NA2 + 1) + i, a1 = a0 + 1;
          const b0 = a0 + (NA2 + 1), b1 = a1 + (NA2 + 1);
          idx.push(a0, b0, b1, a0, b1, a1);
        }
      geom.setIndex(idx);
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const rowQuads = NA2 * 6;
      geom.addGroup(0, rowQuads * (NV - 4), 0);              // the cloth
      geom.addGroup(rowQuads * (NV - 4), rowQuads * 3, 1);   // the zari hem
      const cloth = new THREE.Mesh(geom,
        [matt(C.cloth, 1, 0.9), matt(0xd9a527, 1, 0.55)]);
      const PLEATS = 26;
      function drape(t) {
        let n = 0;
        for (let j = 0; j < NV; j++) {
          const v = j / (NV - 1);
          const fall = v * v * (3 - 2 * v);
          const y = tieY + (hemY - tieY) * v;
          for (let i = 0; i <= NA2; i++) {
            const a = (i / NA2) * Math.PI * 2;
            const pleat = Math.sin(a * PLEATS + Math.sin(t * 0.7)) *
                          R * 0.030 * Math.pow(v, 1.6);
            const belly = Math.sin(Math.PI * v) * R * 0.012;
            const sway = Math.sin(a * 3 + t * 0.9) * R * 0.006 * v;
            const r = rTop + R * 0.055 * fall + belly + pleat + sway;
            pos[n++] = Math.cos(a) * r;
            pos[n++] = y + Math.sin(a * PLEATS + t) * 0.004 * v;
            pos[n++] = Math.sin(a) * r;
          }
        }
        geom.attributes.position.needsUpdate = true;
        geom.computeVertexNormals();
      }
      drape(0);

      // the cord that cinches it, knotted at the front, tails swinging
      const cordY = tieY + R * 0.014;
      const cord = new THREE.Mesh(
        new THREE.TorusGeometry(rTop + R * 0.012, R * 0.012, 8, 96),
        matt(0xd9a527, 1, 0.5));
      cord.rotation.x = Math.PI / 2;
      cord.position.y = cordY;
      const knot = new THREE.Mesh(
        new THREE.SphereGeometry(R * 0.028, 10, 8), matt(0xd9a527, 1, 0.5));
      knot.scale.set(1.3, 0.8, 0.9);
      knot.position.set(0, cordY, rTop + R * 0.016);
      const tails = [];
      for (const sgn of [-1, 1]) {
        const tail = new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(sgn * R * 0.025, -R * 0.10, R * 0.02),
            new THREE.Vector3(sgn * R * 0.05, -R * 0.19, R * 0.005)),
            14, R * 0.008, 6), matt(0xd9a527, 1, 0.5));
        tail.position.set(sgn * R * 0.012, cordY, rTop + R * 0.016);
        tails.push([sgn, tail]);
      }
      // The whole garment arrives FROM ABOVE, formed: lowered onto the drum,
      // pressed, settled - then it just breathes. The mountain narrows with
      // height, so the descent never clips it.
      const robe = new THREE.Group();
      robe.add(cloth, cord, knot, ...tails.map(t => t[1]));
      const dropV = 0.6;
      add(robe, (dt, age) => {
        drape(age);
        const p = Math.min(1, Math.max(0, age - 0.1) / 1.2);
        const pe = p < 0.8 ? (p / 0.8) * 1.03
                           : 1.03 - 0.03 * ((p - 0.8) / 0.2);
        robe.position.y = dropV * (1 - pe);
        for (const [sgn, tail] of tails)
          tail.rotation.z = Math.sin(age * 1.3 + sgn) * 0.10;
      });
    } },

    { view: [0.9, 1.10, 1.02], hold: 4.5, run() {           // 8 Yajnopavita
      // The loop that looked right: three thin strands lying together with a
      // slow twist, riding high over one shoulder and hanging low and a
      // little free on the other. It arrives the way a garland is offered -
      // already formed, lowered on from above, pressed, and settled.
      const N = 300, EPS = R * 0.0062;
      // the shoulder rides the upper triangle tiers, wherever they now are
      const yHigh = ((tierZ('ashtakona') ?? H * 0.78)
                   + (tierZ('antardasara') ?? H * 0.66)) / 2;
      const yLow = H * 0.24;
      const centre = [], tang = [];
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const s = Math.sin(a / 2) ** 2;
        const y = yHigh - (yHigh - yLow) * s - H * 0.02 * Math.sin(Math.PI * s);
        const rad = radiusAt(y, a) + R * 0.050 + R * 0.075 * s * s;
        centre.push(new THREE.Vector3(
          Math.cos(a) * rad, y, Math.sin(a) * rad));
      }
      for (let i = 0; i <= N; i++) {
        tang.push(new THREE.Vector3()
          .subVectors(centre[(i + 1) % N], centre[(i - 1 + N) % N]).normalize());
      }
      const up = new THREE.Vector3(0, 1, 0);
      const shades = [0xf4ecd8, 0xefe5cc, 0xe9dec2];
      const bundle = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const pts = [];
        for (let i = 0; i <= N; i++) {
          const n1 = new THREE.Vector3().crossVectors(tang[i], up).normalize();
          const n2 = new THREE.Vector3().crossVectors(n1, tang[i]).normalize();
          const ph = (k / 3) * Math.PI * 2 + (i / N) * Math.PI * 10;
          pts.push(centre[i].clone()
            .addScaledVector(n1, Math.cos(ph) * EPS)
            .addScaledVector(n2, Math.sin(ph) * EPS));
        }
        bundle.add(new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 340,
            R * 0.0060, 5, true), matt(shades[k], 1, 0.85)));
      }
      // the granthi at the gather point, low on the loop
      const gy = H * 0.24;
      const gr = radiusAt(gy, Math.PI) + R * 0.050 + R * 0.075;
      const knot = new THREE.Mesh(
        new THREE.CylinderGeometry(R * 0.016, R * 0.016, R * 0.036, 8),
        matt(C.thread, 1, 0.8));
      knot.position.set(-gr, gy, 0);
      knot.quaternion.setFromUnitVectors(up, new THREE.Vector3(0, 0, -1));
      knot.scale.setScalar(0.01);
      bundle.add(knot);
      // the fall: dropped vertically onto its own path. Every point of a
      // surface-hugging loop stays clear of the rock on the way down, since
      // the mountain only narrows with height.
      const drop = 0.55;
      add(bundle, (dt, age) => {
        const p = Math.min(1, Math.max(0, age - 0.15) / 1.1);
        const pe = p < 0.8 ? (p / 0.8) * 1.03
                           : 1.03 - 0.03 * ((p - 0.8) / 0.2);
        bundle.position.y = drop * (1 - pe);
        const sxz = 1 + 0.05 * Math.max(0, 1 - pe);
        bundle.scale.set(sxz, 1, sxz);
        knot.scale.setScalar(ease(Math.min(1, Math.max(0, age - 1.5) / 0.45)));
      });
    } },

    { view: [0, 1.02, 0.85], hold: 4.5, run() {             // 9 Gandha
      // Sandal paste the way it is actually worn: three strokes wiped across
      // the front of the drum, and a round kumkum mark above them. Marks,
      // not speckles.
      const drumTop = tierZ('trivritta') ?? 0.39;
      const drumBase = (prof && prof.bhupura ? prof.bhupura.z[2] : 0.27);
      const band = y => drumBase + (drumTop - drumBase) * y;
      const drumR = radiusAt(band(0.5), 0);
      const ARC = 1.05;
      for (let k = 0; k < 3; k++) {
        const stroke = new THREE.Mesh(
          new THREE.TorusGeometry(drumR + R * 0.006, R * 0.008, 8, 72, ARC),
          matt(C.sandal, 1, 0.9));
        // lie flat, then swing the arc's middle round to the front (+z)
        stroke.rotation.set(Math.PI / 2, ARC / 2 - Math.PI / 2, 0, 'YXZ');
        stroke.position.y = band(0.22 + k * 0.25);
        const g0 = stroke.geometry;
        g0.setDrawRange(0, 0);
        add(stroke, (dt, age) => {
          const u = ease(Math.min(1, Math.max(0, age - k * 0.55) / 0.9));
          g0.setDrawRange(0, Math.floor(g0.index.count * u / 6) * 6);
        });
      }
      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(R * 0.030, 24),
        matt(0xb3202c, 1, 0.85));
      dot.position.set(0, band(0.92), drumR + R * 0.010);
      dot.scale.setScalar(0.01);
      add(dot, (dt, age) =>
        dot.scale.setScalar(ease(Math.min(1, Math.max(0, age - 2.1) / 0.5))));

      // and the fragrance: faint motes lifting off the fresh paste and
      // drifting outward on a slight breeze
      const mote = new THREE.SphereGeometry(1, 6, 5);
      const s3 = swarm(mote, [0xf1ead8], 60,
        () => {
          const b = Math.PI / 2 + rnd(-0.55, 0.55);
          return { b, x: Math.cos(b) * (drumR + R * 0.02),
                   y: rnd(0.42, 0.70), z: Math.sin(b) * (drumR + R * 0.02),
                   w: rnd(0, 6.3), s: R * 0.010, live: rnd(0.3, 2.4) };
        },
        (b, dt, age) => {
          b.live -= dt;
          if (b.live <= 0) {
            const bb = Math.PI / 2 + rnd(-0.55, 0.55);
            b.b = bb;
            b.x = Math.cos(bb) * (drumR + R * 0.02);
            b.z = Math.sin(bb) * (drumR + R * 0.02);
            b.y = rnd(0.42, 0.70);
            b.s = R * 0.007; b.live = rnd(1.8, 3.0); b.w = rnd(0, 6.3);
          }
          b.x += dt * (Math.cos(b.b) * R * 0.16 + Math.sin(age * 2 + b.w) * R * 0.03);
          b.z += dt * Math.sin(b.b) * R * 0.16;
          b.y += dt * 0.05;
          b.s += dt * R * 0.012;
        });
      s3.holder.children.forEach(m => {
        m.material.transparent = true;
        m.material.opacity = 0.06;
        m.material.depthWrite = false;
      });
      add(s3.holder, dt => s3.tick(dt));
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

    { view: [0, 1.06, 1.00], hold: 6.0, run() {             // 11 Dhupa
      // Incense is WAVED, not parked: the stick traces slow clockwise circles
      // before the mountain, seen from the front, and the smoke follows the
      // moving ember. The smoke stays spheres - round from every angle, no
      // texture, no gradient - faint and many, growing as they climb.
      const cz = R * 1.05, cy = H * 0.42, rad = R * 0.20;
      const wave = new THREE.Group();
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(R * 0.006, R * 0.008, H * 0.22, 8),
        matt(0x5d4326));
      stick.position.y = -H * 0.11;
      const ember = new THREE.Mesh(
        new THREE.SphereGeometry(R * 0.010, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
      wave.add(stick, ember);
      add(wave, (dt, age) => {
        const a = -age * (Math.PI * 2 / 3.4);
        wave.position.set(Math.cos(a) * rad, cy + Math.sin(a) * rad, cz);
        wave.rotation.z = Math.cos(a) * 0.26;
      });

      const puff = new THREE.SphereGeometry(1, 7, 6);
      const s2 = swarm(puff, [C.smoke], 190,
        () => {
          const t = Math.random();                 // pre-risen, so no cold start
          const a0 = -t * 6;
          return { x: Math.cos(a0) * rad, z: cz,
                   y: cy + Math.sin(a0) * rad + t * H * 0.5,
                   dx: rnd(-0.25, 0.25), dz: rnd(-0.3, 0.1),
                   s: R * (0.014 + t * 0.05), live: rnd(0.2, 2.8) };
        },
        (b, dt) => {
          b.live -= dt;
          if (b.live <= 0) {                       // re-emit at the ember
            b.x = wave.position.x;
            b.y = wave.position.y;
            b.z = wave.position.z;
            b.dx = rnd(-0.25, 0.25); b.dz = rnd(-0.3, 0.1);
            b.s = R * 0.013; b.live = rnd(1.8, 3.2);
          }
          b.y += dt * H * 0.17;
          b.x += dt * R * 0.05 * b.dx;
          b.z += dt * R * 0.05 * b.dz;
          b.s += dt * R * 0.026;
        });
      s2.holder.children.forEach(m => {
        m.material.transparent = true;
        m.material.opacity = 0.085;
        m.material.depthWrite = false;
      });
      add(s2.holder, dt => s2.tick(dt));
    } },

    { view: [0, 1.04, 1.08], hold: 6.5, run() {             // 12 Dipa
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
        new THREE.MeshBasicMaterial({ color: 0xffdd7a }));
      flame.position.set(R * 0.072, R * 0.038, 0);
      core.position.set(R * 0.072, R * 0.040, 0);
      const light = new THREE.PointLight(C.flame, 26, R * 6, 2);
      light.position.set(R * 0.072, R * 0.075, 0);
      // the flame's own halo - the air around a lamp glows; this is light,
      // not decoration
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(R * 0.055, 10, 8),
        new THREE.MeshBasicMaterial({
          color: 0xffb347, transparent: true, opacity: 0.13,
          blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.position.copy(flame.position);
      lamp.add(dish, ghee, wick, flame, core, halo, light);
      // arati: the lamp circles slowly clockwise before the mountain, held
      // the way a lamp is held - flame side toward the deity - and the gold
      // answers it: the point light rides the flame, so the highlight sweeps
      // the terraces as the circle is drawn.
      lamp.rotation.y = Math.PI / 2;               // the lip faces the Meru
      const cz = R * 1.02, cy = H * 0.45, rad = R * 0.26;
      add(lamp, (dt, age) => {
        const a = -age * (Math.PI * 2 / 4.6);
        lamp.position.set(Math.cos(a) * rad, cy + Math.sin(a) * rad, cz);
        lamp.rotation.z = Math.cos(a) * 0.20;
        const f = 0.86 + 0.14 * Math.sin(age * 21) + 0.06 * Math.sin(age * 8.3);
        flame.scale.set(1, f, 1);
        core.scale.set(1, f * 0.96, 1);
        halo.scale.setScalar(0.9 + 0.2 * f);
        light.intensity = 40 * f;
      });
    } },

    { view: [0, 0.66, 1.30], hold: 3.8, run() {             // 13 Naivedya
      // These were half-spheres placed with their centre on the surface, so
      // the bowl was buried and only its dome showed - a ball stuck in the
      // mountain. A lathed katori stands on its own base at ground level.
      const bowlProfile = [
        [0.00, 0.00], [0.30, 0.00], [0.36, 0.06], [0.62, 0.22],
        [0.78, 0.46], [0.82, 0.60], [0.76, 0.60], [0.72, 0.46],
        [0.56, 0.24], [0.28, 0.10], [0.00, 0.08],
      ];
      // The key light comes from one side, so only the offering on that side
      // was lit and the other three sank into a terrace of the same tone. A
      // soft light over the ring shows all four.
      const over = new THREE.PointLight(0xfff0d0, 0, R * 4.5, 2);
      over.position.set(0, H * 0.75, 0);
      add(over, (dt, age) => { over.intensity = 9 * Math.min(1, age / 0.6); });

      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2;
        const x = Math.cos(a) * R * 0.88, z = Math.sin(a) * R * 0.88;   // on the bhupura
        const g = new THREE.Group();
        const n = R * 0.10;                  // katori-sized, not cauldron-sized
        const bowl = new THREE.Mesh(
          new THREE.LatheGeometry(
            bowlProfile.map(([u, v]) => new THREE.Vector2(u * n, v * n)), 26),
          new THREE.MeshStandardMaterial({
            color: 0x7d5a24, metalness: 0.95, roughness: 0.22,
            side: THREE.DoubleSide }));      // darker, so it is not gold on gold
        const heap = new THREE.Mesh(
          new THREE.SphereGeometry(n * 0.62, 18, 12, 0, 6.3, 0, Math.PI / 2),
          matt(0xf6f0e2, 1, 0.95));          // rice
        heap.position.y = n * 0.34;
        g.add(bowl, heap);
        g.position.set(x, ground(x, z), z);     // base on the terrace
        g.scale.setScalar(0.01);
        add(g, (dt, age) =>
          g.scale.setScalar(ease(Math.min(1, Math.max(0, age - k * 0.13) / 0.5))));
      }
    } },

    { view: [0.5, 0.66, 1.30], hold: 3.6, run() {           // 14 Tambula
      const over2 = new THREE.PointLight(0xfff0d0, 0, R * 4.5, 2);
      over2.position.set(0, H * 0.75, 0);
      add(over2, (dt, age) => { over2.intensity = 9 * Math.min(1, age / 0.6); });

      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + Math.PI / 4;
        const x = Math.cos(a) * R * 0.88, z = Math.sin(a) * R * 0.88;
        const g = new THREE.Group();
        for (let j = 0; j < 3; j++) {
          // real paan leaves - glossy, creased, heart-shaped - fanned out
          const leaf = new THREE.Mesh(geo.leaf, matt(0x2e6b30, 1, 0.35));
          leaf.scale.setScalar(R * 0.16);
          leaf.rotation.set(-Math.PI / 2 + 0.08, 0, (j - 1) * 0.5);
          leaf.position.y = R * 0.006 * j;
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

    { view: [0, 1.30, 1.04], hold: 16.0, run() {            // 15 Pradakshina
      // Walking, not orbiting. The camera goes ON the path at eye height,
      // aimed along it with the Meru held on the right - and the path runs
      // BETWEEN two rows of lamps, so they stream past on either side. That
      // parallax is what makes the motion yours.
      const walkR = R * 1.42;
      const cupProfile = [
        [0.00, 0.00], [0.34, 0.00], [0.52, 0.10], [0.56, 0.22],
        [0.50, 0.22], [0.44, 0.11], [0.24, 0.05], [0.00, 0.04],
      ];
      const rows = [[12, R * 1.60, 1.0, true], [8, R * 1.22, 0.7, false]];
      for (const [n, rad, sc, lit] of rows) {
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + (n === 8 ? Math.PI / 8 : 0);
          const g = new THREE.Group();
          const cup = new THREE.Mesh(
            new THREE.LatheGeometry(cupProfile.map(([u, v]) =>
              new THREE.Vector2(u * R * 0.13 * sc, v * R * 0.13 * sc)), 18),
            new THREE.MeshStandardMaterial({
              color: C.brass, metalness: 0.9, roughness: 0.35,
              side: THREE.DoubleSide }));
          const fl = new THREE.Mesh(
            new THREE.SphereGeometry(R * 0.016 * sc, 10, 8),
            new THREE.MeshBasicMaterial({ color: 0xffc25e }));
          fl.scale.set(1, 1.7, 1);
          fl.position.y = R * 0.030 * sc;
          g.add(cup, fl);
          if (lit) {
            const li = new THREE.PointLight(0xffb347, 3.2, R * 1.4, 2);
            li.position.y = R * 0.035;
            g.add(li);
          }
          g.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad);
          g.scale.setScalar(0.01);
          add(g, (dt, age) => {
            g.scale.setScalar(ease(Math.min(1, Math.max(0, age - k * 0.05) / 0.4)));
            fl.scale.set(1, 1.7 * (0.85 + 0.15 * Math.sin(age * 17 + k)), 1);
          });
        }
      }
      // a floor to walk on, so the lamps are standing on something
      const floor = new THREE.Mesh(
        new THREE.RingGeometry(R * 1.05, R * 1.85, 96),
        matt(0x2a251d, 0.9, 0.95));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.002;
      add(floor, () => {});
      later(() => meru.walkCircuit
        ? meru.walkCircuit(13500, walkR, H * 0.335)
        : meru.circumambulate(9200, 1.38, 1.02), 600);
    } },

    { view: null, hold: 5.4, run() { meru.bow(4600); } },              // 16
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
    meru.onPujaProgress?.(st.step < 0 ? 0 : Math.min(1, st.t / st.hold),
                          st.playing);
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
