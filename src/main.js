import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TiltInput, TILT_STATE } from './input/TiltInput.js';

// --- Three.js scene ------------------------------------------------------

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
  tree.position.set((Math.random() - 0.5) * 400, 3, (Math.random() - 0.5) * 400);
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

// --- Tilt input + start overlay ------------------------------------------

const tilt = new TiltInput();

const overlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-btn');
const skipBtn = document.getElementById('skip-btn');
const note = document.getElementById('start-note');
const calibrateBtn = document.getElementById('calibrate-btn');
const modePill = document.querySelector('#topbar .pill');
const modeDot = modePill.querySelector('.dot');

function setNote(text, isError = false) {
  note.textContent = text;
  note.classList.toggle('err', !!isError);
}

function closeOverlay() {
  overlay.classList.add('hidden');
  setTimeout(() => { overlay.style.display = 'none'; }, 300);
}

startBtn.addEventListener('click', async () => {
  if (tilt.state === TILT_STATE.UNSUPPORTED) {
    setNote('Dieses Gerät hat keinen Gyroskop-Sensor. Nutze Desktop-Modus.', true);
    return;
  }
  setNote('Permission angefragt...');
  const result = await tilt.requestPermission();

  if (result === TILT_STATE.GRANTED) {
    setTimeout(() => {
      if (tilt.eventCount === 0) {
        setNote('Permission erteilt, aber keine Events. Neigen funktioniert nicht?', true);
      }
    }, 1500);
    modeDot.classList.add('ok');
    modePill.innerHTML = '<span class="dot ok"></span>tilt · live';
    calibrateBtn.classList.add('visible');
    closeOverlay();
  } else if (result === TILT_STATE.DENIED) {
    setNote('Permission abgelehnt. Neu laden oder Desktop-Modus.', true);
  } else if (result === TILT_STATE.ERROR) {
    setNote('Fehler beim Permission-Request.', true);
  }
});

skipBtn.addEventListener('click', () => {
  modePill.innerHTML = '<span class="dot"></span>desktop · maus-drag';
  closeOverlay();
});

calibrateBtn.addEventListener('click', () => {
  tilt.calibrate();
  calibrateBtn.textContent = 'Calibrated ✓';
  setTimeout(() => { calibrateBtn.textContent = 'Recalibrate'; }, 1200);
});

// --- Animate -------------------------------------------------------------

const MAX_BANK = Math.PI / 4;   // 45°
const MAX_PITCH = Math.PI / 6;  // 30°
const ROTATION_LERP = 0.18;

const hudRoll = document.getElementById('hud-roll');
const hudPitch = document.getElementById('hud-pitch');
const fpsEl = document.getElementById('fps');

let lastFpsUpdate = performance.now();
let frames = 0;
let targetRoll = 0;
let targetPitch = 0;
let currentRoll = 0;
let currentPitch = 0;

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  tilt.update();

  if (tilt.active) {
    targetRoll = -tilt.roll * MAX_BANK;
    targetPitch = tilt.pitch * MAX_PITCH;
  } else {
    targetRoll = 0;
    targetPitch = 0;
  }

  currentRoll += (targetRoll - currentRoll) * ROTATION_LERP;
  currentPitch += (targetPitch - currentPitch) * ROTATION_LERP;

  birdGroup.rotation.z = currentRoll;
  birdGroup.rotation.x = currentPitch;

  birdGroup.position.y = 15 + Math.sin(t * 1.5) * 1.2;
  const flap = Math.sin(t * 8) * 0.3;
  wingL.rotation.z = flap;
  wingR.rotation.z = -flap;

  if (hudRoll && hudPitch) {
    hudRoll.textContent = 'roll ' + (tilt.roll * 100 | 0).toString().padStart(4, ' ');
    hudPitch.textContent = 'pitch ' + (tilt.pitch * 100 | 0).toString().padStart(4, ' ');
  }

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
