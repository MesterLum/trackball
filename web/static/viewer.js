// Three.js viewer for the printed parts. Exposes window.viewer for Alpine.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

const el = document.getElementById('viewer');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 1, 4000);
camera.up.set(0, 0, 1);                                     // OpenSCAD is Z-up
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
el.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = Math.PI * 0.95;

scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.9));
const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(90, -140, 180);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = key.shadow.camera.bottom = -160; key.shadow.camera.right = key.shadow.camera.top = 160;
key.shadow.camera.near = 10; key.shadow.camera.far = 600; key.shadow.bias = -0.0005;
scene.add(key);
const fill = new THREE.DirectionalLight(0xdde8ff, 0.5); fill.position.set(-120, 90, 80); scene.add(fill);

// desk: a soft shadow-catcher plus a fine grid
const desk = new THREE.Mesh(new THREE.CircleGeometry(400, 64), new THREE.ShadowMaterial({ opacity: 0.18 }));
desk.receiveShadow = true; scene.add(desk);
const grid = new THREE.GridHelper(400, 40, 0x9aa3ad, 0xcfd5db); grid.rotateX(Math.PI / 2);
grid.material.transparent = true; grid.material.opacity = 0.35; scene.add(grid);

const ball = new THREE.Mesh(new THREE.SphereGeometry(17, 64, 40),
  new THREE.MeshPhysicalMaterial({ color: 0xc81e3c, transparent: true, opacity: 0.5, roughness: 0.25, clearcoat: 0.6 }));
ball.castShadow = true; scene.add(ball);

const loader = new STLLoader();
const meshes = {};
let frame = { tilt: 0, tent: 0, ball_r: 17, floor_z: -37 };
let explode = 0, framed = false, dark = false;

function themeColors() {
  dark = document.documentElement.dataset.theme === 'night';
  scene.background = new THREE.Color(dark ? 0x111827 : 0xf3f4f6);
  grid.material.color.set(dark ? 0x475569 : 0x9aa3ad);
}
themeColors();
new MutationObserver(themeColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

function resize() {
  const w = el.clientWidth, h = el.clientHeight || Math.round(w * 0.6);
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(el); resize();
(function loop() { requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); })();

function place() {
  const t = THREE.MathUtils.degToRad(frame.tilt), a = THREE.MathUtils.degToRad(frame.tent);
  for (const m of Object.values(meshes)) {
    if (m.userData.frame === 'deck') { m.rotation.order = 'YXZ'; m.rotation.x = t; m.rotation.y = a; }
    m.position.set(0, 0, m.userData.lift * explode);
  }
  ball.position.z = 2 * explode;
  ball.scale.setScalar(frame.ball_r / 17);
  grid.position.z = frame.floor_z; desk.position.z = frame.floor_z - 0.05;
}

function fit() {
  const box = new THREE.Box3();
  for (const m of Object.values(meshes)) if (m.visible) box.expandByObject(m);
  if (box.isEmpty()) box.setFromObject(ball);
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z, 40);
  camera.position.set(c.x + r * 0.85, c.y - r * 1.25, c.z + r * 0.8);
  controls.target.copy(c); camera.near = r / 100; camera.far = r * 30; camera.updateProjectionMatrix();
  framed = true;
}

window.viewer = {
  setFrame(f) { frame = { ...frame, ...f }; place(); },
  setExplode(e) { explode = e; place(); },
  setVisible(name, v) { if (name === 'ball') ball.visible = v; else if (meshes[name]) meshes[name].visible = v; },
  /** fade parts that are about to be replaced */
  markStale(names) { for (const n of names) if (meshes[n]) { meshes[n].material.transparent = true; meshes[n].material.opacity = 0.3; } },
  clear(keep) {
    for (const [n, m] of Object.entries(meshes)) if (!keep.includes(n)) { scene.remove(m); m.geometry.dispose(); delete meshes[n]; }
  },
  async load(name, url, color, fr, lift) {
    const geo = await loader.loadAsync(url); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness: 0.65 }));
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData = { frame: fr, lift };
    if (meshes[name]) { mesh.visible = meshes[name].visible; scene.remove(meshes[name]); meshes[name].geometry.dispose(); }
    meshes[name] = mesh; scene.add(mesh); place();
    if (!framed || name === 'tray') fit();
  },
  fit,
  snapshot() {
    const a = document.createElement('a');
    a.download = 'trackball.png'; a.href = renderer.domElement.toDataURL('image/png'); a.click();
  },
};
place(); fit();
