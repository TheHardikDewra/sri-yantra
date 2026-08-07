// The Maha Meru, loaded from the GLB the solver writes.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// How far the plan view stops short of straight down. See minPolarAngle below.
const TOP_PHI = 0.035;

// A metal is almost entirely reflection, so without an environment to reflect
// it renders nearly black however many lamps are pointed at it. The scene gets
// a generated room environment for that; the lights below only shape it.
// Metalness near 1 goes further and makes the surface almost pure reflection,
// which turns muddy brown whatever the base colour is, so these sit at about
// half metal: it reads as metal and keeps the terraces legible.
export const MATERIALS = {
  gold:  { color: 0xd9a527, metalness: 0.62, roughness: 0.28,
           envMapIntensity: 0.95 },
  brass: { color: 0xd8ac52, metalness: 0.45, roughness: 0.34,
           envMapIntensity: 1.1 },
  stone: { color: 0xcac2b2, metalness: 0.0, roughness: 0.9,
           envMapIntensity: 0.9 },
  ink:   { color: 0x46433c, metalness: 0.2, roughness: 0.6,
           envMapIntensity: 0.9 },
};

export function mount(canvas, url) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 200);
  camera.position.set(4.4, 3.0, 5.4);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 2.2;
  controls.maxDistance = 22;
  // Never let the camera drop below the horizon. An inverted Sri Yantra is a
  // different figure entirely - the Shiva yantra of kapalika practice - so the
  // Meru is only ever seen the way up it is meant to stand. Straight down is
  // fine and wanted: that is how the flat yantra is read.
  controls.maxPolarAngle = Math.PI * 0.47;
  // Not exactly zero. At the pole the azimuth is undefined and lookAt with a
  // vertical up-vector degenerates, so the plan view stops two degrees short -
  // far too little to see, enough to keep the maths well behaved.
  controls.minPolarAngle = TOP_PHI;
  controls.autoRotateSpeed = 0.6;
  controls.autoRotate = false;   // off unless the viewer asks for it

  // The wheel belongs to the page. Zoom only on ctrl/cmd + wheel, the way maps
  // do it, so scrolling past the Meru never drags the camera around.
  //
  // The step has to follow the size of the delta, not just its sign: a trackpad
  // pinch is one gesture but arrives as a burst of dozens of small events, so a
  // fixed step per event runs away and the zoom feels wild.
  controls.enableZoom = false;
  canvas.addEventListener('wheel', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const step = Math.exp(Math.max(-40, Math.min(40, e.deltaY)) * 0.0022);
    const v = camera.position.clone().sub(controls.target);
    const d = Math.min(controls.maxDistance,
                       Math.max(controls.minDistance, v.length() * step));
    camera.position.copy(controls.target).add(v.setLength(d));
  }, { passive: false });

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // a key and a rim on top of the environment, to keep the terraces reading
  const key = new THREE.DirectionalLight(0xfff3e0, 2.2);
  key.position.set(4, 7, 5);
  const rim = new THREE.DirectionalLight(0x9fc4e8, 1.1);
  rim.position.set(-6, 3, -4);
  scene.add(key, rim);
  const KEY0 = key.intensity, RIM0 = rim.intensity, ENV0 = 1;

  const state = {
    scene, camera, renderer, controls,
    mesh: null, edges: null, material: 'gold', ready: false,
    home: null, glide: null,
  };

  // ---- orientation ------------------------------------------------------
  // The figure is mirror-symmetric about one plane only, so exactly two
  // azimuths show it dead square: 0 and pi. Stopping the turn anywhere else
  // leaves it a degree or two off true, which on a figure whose whole point is
  // symmetry reads as broken. So stopping, or resetting, eases back to the
  // nearer of those two.

  const here = () => new THREE.Spherical()
    .setFromVector3(camera.position.clone().sub(controls.target));

  function place(s) {
    camera.position.copy(controls.target)
      .add(new THREE.Vector3().setFromSpherical(s));
    camera.lookAt(controls.target);
  }

  // `wrap` folds the azimuth onto the shortest way round, which is what you
  // want for every jump between two views. It is exactly wrong for a full
  // circuit: a turn of -2pi folds to 0 and the move silently does nothing.
  function glideTo(theta, phi, radius, ms = 650, wrap = true) {
    const from = here();
    let d = theta - from.theta;
    if (wrap) {
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
    }
    state.glide = {
      from, to: { theta: from.theta + d, phi, radius },
      t0: performance.now(), ms,
    };
  }

  function squareUp() {
    if (!state.home) return;
    const s = here();
    const theta = Math.abs(((s.theta % (2 * Math.PI)) + 2 * Math.PI)
                           % (2 * Math.PI) - Math.PI) < Math.PI / 2
      ? Math.PI : 0;                            // nearer of the two true faces
    glideTo(theta, s.phi, s.radius);
  }

  canvas.addEventListener('pointerdown', () => {
    state.glide = null;
    state.touched = true;      // stop reframing once they have taken the wheel
  });

  new GLTFLoader().load(url, gltf => {
    const mesh = gltf.scene.getObjectByProperty('type', 'Mesh');
    const geo = mesh.geometry;
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const c = bb.getCenter(new THREE.Vector3());
    // sit the base on the ground plane and centre it horizontally
    geo.translate(-c.x, -bb.min.y, -c.z);

    // The crease lines sit exactly on the surface they trace. Seen from an
    // angle that is fine, but looking straight down they are coplanar with the
    // terrace tops and z-fighting swallows them, which is precisely the view
    // where they carry the whole read. Push the solid back a hair so the lines
    // always win.
    mesh.material = new THREE.MeshStandardMaterial(
      Object.assign({
        flatShading: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }, MATERIALS.gold));
    scene.add(mesh);
    state.mesh = mesh;

    // Frame the mountain from its own size. The home view looks straight down
    // the figure's mirror plane, so the Meru reads dead square rather than at
    // some arbitrary angle.
    const size = bb.getSize(new THREE.Vector3());
    const reach = Math.max(size.x, size.z) * 0.5;
    controls.target.set(0, size.y * 0.38, 0);

    // Distance has to come from the viewport, not a constant: the field of
    // view is vertical, so a tall narrow canvas crops the mountain sideways
    // while a wide one leaves it swimming. Fit both axes and take the looser.
    state.fit = () => {
      const t = Math.tan((camera.fov * Math.PI / 180) / 2);
      const dV = size.y * 0.60 / t;
      const dH = reach * 1.08 / (t * Math.max(0.2, camera.aspect));
      return Math.max(dV, dH) * 1.16;
    };
    state.home = new THREE.Spherical(state.fit(), Math.PI * 0.335, 0);
    place(state.home);
    controls.update();
    state.ready = true;
    window.__meru = state;                    // handy for tuning in devtools
    canvas.dispatchEvent(new CustomEvent('meru:ready', { bubbles: true }));

    // The crease lines cost far more than everything else here: finding which
    // of 59,200 facets meet at a real corner takes tens of seconds, and doing
    // it before the first frame leaves the viewer staring at a blank box. Show
    // the mountain first, then add the lines a couple of frames later.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo, 24),
        new THREE.LineBasicMaterial({
          color: state.material === 'ink' ? 0xbbb1a0 : 0x000000,
          transparent: true,
          opacity: state.material === 'ink' ? 0.45 : 0.42,
        }));
      edges.visible = state.edgesWanted !== false;
      scene.add(edges);
      state.edges = edges;
    }));
  });

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== w * renderer.getPixelRatio()) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (state.fit) {
        state.home.radius = state.fit();
        controls.minDistance = state.home.radius * 0.45;
        controls.maxDistance = state.home.radius * 2.10;
        // reframe only while the viewer has left the camera alone
        if (!state.touched && !state.glide) place(state.home);
      }
    }
  }

  (function loop() {
    requestAnimationFrame(loop);
    resize();
    if (state.glide) {
      const g = state.glide;
      const k = Math.min(1, (performance.now() - g.t0) / g.ms);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      place(new THREE.Spherical(
        g.from.radius + (g.to.radius - g.from.radius) * e,
        g.from.phi + (g.to.phi - g.from.phi) * e,
        g.from.theta + (g.to.theta - g.from.theta) * e));
      if (k >= 1) state.glide = null;
    }
    state.puja?.tick();
    controls.update();
    renderer.render(scene, camera);
  })();

  state.setMaterial = name => {
    state.material = name;
    if (!state.mesh) return;
    Object.assign(state.mesh.material, MATERIALS[name]);
    state.mesh.material.color = new THREE.Color(MATERIALS[name].color);
    state.mesh.material.envMapIntensity = MATERIALS[name].envMapIntensity;
    state.mesh.material.needsUpdate = true;
    if (!state.edges) return;
    state.edges.material.color = new THREE.Color(
      name === 'ink' ? 0xbbb1a0 : 0x000000);
    state.edges.material.opacity = name === 'ink' ? 0.45 : 0.42;
  };
  state.setWireframe = on => {
    if (state.mesh) state.mesh.material.wireframe = on;
  };
  state.setEdges = on => {
    state.edgesWanted = on;                   // may arrive before the lines do
    if (state.edges) state.edges.visible = on;
  };
  state.setSpin = on => {
    controls.autoRotate = on;
    if (!on) squareUp();          // never leave it a degree off true
  };
  // Two ways of standing in front of it, both dead square on the mirror plane:
  // the three-quarter view it is framed at, and the plan view that reads the
  // yantra the way the flat figure is read.
  state.view = which => {
    if (!state.home) return;
    state.touched = false;
    const top = which === 'top';
    // Seen from above the footprint is square and the framing that suits the
    // three-quarter view crops it, so the plan view stands further back.
    glideTo(state.home.theta,
            top ? TOP_PHI : state.home.phi,
            state.home.radius * (top ? 1.42 : 1), 750);
  };
  // A free look, for the puja: theta and phi absolute, radius as a multiple of
  // the framed distance.
  state.look = (theta, phi, mul = 1, ms = 900) => {
    if (!state.home) return;
    state.touched = false;
    glideTo(theta, phi, state.home.radius * mul, ms);
  };
  state.homeSpherical = () => state.home;

  // Dim the room so a flame can be the thing lighting the mountain.
  state.setKeyLight = k => {
    key.intensity = KEY0 * k;
    rim.intensity = RIM0 * k;
    if (state.mesh) {
      state.mesh.material.envMapIntensity =
        MATERIALS[state.material].envMapIntensity * (0.25 + 0.75 * k);
      state.mesh.material.needsUpdate = true;
    }
  };

  state.reset = () => state.view('front');
  state.squareUp = squareUp;

  // Pradakshina: one full turn, kept to the right. Clockwise seen from above
  // means the figure stays on the walker's right, which is the whole point of
  // the rite, so the azimuth decreases.
  // phi is passed rather than read: the circuit starts while the move into
  // position is still gliding, and here() would catch it half way and walk the
  // circle at whatever angle it happened to be passing through.
  state.circumambulate = (ms = 9000, phi = null, mul = null) => {
    const s0 = here();
    glideTo(s0.theta - 2 * Math.PI,
            phi === null ? s0.phi : phi,
            mul === null ? s0.radius : state.home.radius * mul, ms, false);
  };
  // Namaskara: down to the ground and back up.
  state.bow = (ms = 3400) => {
    const s0 = here();
    glideTo(s0.theta, controls.maxPolarAngle, s0.radius, ms / 2);
    setTimeout(() => glideTo(state.home.theta, state.home.phi,
                             state.home.radius, ms / 2), ms / 2);
  };
  return state;
}
