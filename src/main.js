import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 150, 600);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1500
);
camera.position.set(20, 18, 30);

scene.add(new THREE.AmbientLight(0xffffff, 0.45));

const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(80, 120, 60);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(800, 800),
  new THREE.MeshStandardMaterial({ color: 0x4a7c3a, roughness: 0.9 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

for (let i = 0; i < 40; i++) {
  const tree = new THREE.Mesh(
    new THREE.ConeGeometry(1.5 + Math.random() * 1.5, 5 + Math.random() * 4, 6),
    new THREE.MeshStandardMaterial({ color: 0x2d5a27 })
  );
  tree.position.set(
    (Math.random() - 0.5) * 400,
    3,
    (Math.random() - 0.5) * 400
  );
  scene.add(tree);
}

const birdGroup = new THREE.Group();
const birdBody = new THREE.Mesh(
  new THREE.ConeGeometry(0.6, 2.5, 8),
  new THREE.MeshStandardMaterial({ color: 0xffaa44, roughness: 0.6 })
);
birdBody.rotation.x = Math.PI / 2;
birdGroup.add(birdBody);

const wingL = new THREE.Mesh(
  new THREE.BoxGeometry(2.5, 0.1, 0.8),
  new THREE.MeshStandardMaterial({ color: 0xcc7733 })
);
wingL.position.set(-1.4, 0, 0);
birdGroup.add(wingL);

const wingR = wingL.clone();
wingR.position.x = 1.4;
birdGroup.add(wingR);

birdGroup.position.set(0, 15, 0);
scene.add(birdGroup);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(birdGroup.position);
controls.enableDamping = true;
controls.minDistance = 10;
controls.maxDistance = 200;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const fpsEl = document.getElementById('fps');
let lastFpsUpdate = performance.now();
let frames = 0;

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  birdGroup.position.y = 15 + Math.sin(t * 1.5) * 1.2;
  const flap = Math.sin(t * 8) * 0.3;
  wingL.rotation.z = flap;
  wingR.rotation.z = -flap;

  controls.update();
  renderer.render(scene, camera);

  frames++;
  const now = performance.now();
  if (now - lastFpsUpdate > 500) {
    const fps = (frames * 1000) / (now - lastFpsUpdate);
    if (fpsEl) fpsEl.textContent = fps.toFixed(0) + ' fps';
    frames = 0;
    lastFpsUpdate = now;
  }
}
animate();
