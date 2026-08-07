// The Maha Meru, loaded from the GLB the solver writes.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// A metal is almost entirely reflection, so without an environment to reflect
// it renders nearly black however many lamps are pointed at it. The scene gets
// a generated room environment for that; the lights below only shape it.
// Metalness near 1 makes the surface almost pure reflection, and with only a
// small generated room to reflect it goes muddy brown whatever the base colour
// is. Half-metal reads as metal and keeps the terraces legible.
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
  // Never let the camera drop below the horizon, and never let it go quite
  // overhead. An inverted Sri Yantra is a different figure entirely - the
  // Shiva yantra of kapalika practice - so the Meru is only ever seen the way
  // up it is meant to stand.
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minPolarAngle = Math.PI * 0.10;
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

  function glideTo(theta, phi, radius, ms = 650) {
    const from = here();
    let d = theta - from.theta;
    while (d > Math.PI) d -= 2 * Math.PI;      // take the short way round
    while (d < -Math.PI) d += 2 * Math.PI;
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

  canvas.addEventListener('pointerdown', () => { state.glide = null; });

  new GLTFLoader().load(url, gltf => {
    const mesh = gltf.scene.getObjectByProperty('type', 'Mesh');
    const geo = mesh.geometry;
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const c = bb.getCenter(new THREE.Vector3());
    // sit the base on the ground plane and centre it horizontally
    geo.translate(-c.x, -bb.min.y, -c.z);

    mesh.material = new THREE.MeshStandardMaterial(
      Object.assign({ flatShading: true }, MATERIALS.gold));
    scene.add(mesh);
    state.mesh = mesh;

    // crease lines: only edges where the surface genuinely turns a corner
    const eg = new THREE.EdgesGeometry(geo, 24);
    const edges = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.30,
    }));
    scene.add(edges);
    state.edges = edges;

    // Frame the mountain from its own size. The home view looks straight down
    // the figure's mirror plane, so the Meru reads dead square rather than at
    // some arbitrary angle.
    const size = bb.getSize(new THREE.Vector3());
    const reach = Math.max(size.x, size.z) * 0.5;
    controls.target.set(0, size.y * 0.38, 0);
    state.home = new THREE.Spherical(reach * 3.05, Math.PI * 0.335, 0);
    controls.minDistance = state.home.radius * 0.45;
    controls.maxDistance = state.home.radius * 2.10;
    place(state.home);
    controls.update();
    state.ready = true;
    window.__meru = state;                    // handy for tuning in devtools
    canvas.dispatchEvent(new CustomEvent('meru:ready', { bubbles: true }));
  });

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== w * renderer.getPixelRatio()) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
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
    state.edges.material.color = new THREE.Color(
      name === 'ink' ? 0xbbb1a0 : 0x000000);
    state.edges.material.opacity = name === 'ink' ? 0.35 : 0.30;
  };
  state.setWireframe = on => {
    if (state.mesh) state.mesh.material.wireframe = on;
  };
  state.setEdges = on => { if (state.edges) state.edges.visible = on; };
  state.setSpin = on => {
    controls.autoRotate = on;
    if (!on) squareUp();          // never leave it a degree off true
  };
  state.reset = () => {
    if (!state.home) return;
    glideTo(state.home.theta, state.home.phi, state.home.radius);
  };
  state.squareUp = squareUp;
  return state;
}
