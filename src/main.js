import * as THREE from 'three';
import { TiltInput, TILT_STATE } from './input/TiltInput.js';
import { FlightState } from './flight/FlightState.js';
import { FlightPhysics } from './flight/FlightPhysics.js';
import { CameraRig } from './flight/CameraRig.js';

// --- Renderer / scene ----------------------------------------------------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 150, 700);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(80, 120, 60);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(2000, 2000),
  new THREE.MeshStandardMaterial({ color: 0x4a7c3a, roughness: 0.9 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

for (let i = 0; i < 120; i++) {
  const tree = new THREE.Mesh(
    new THREE.ConeGeometry(1.5 + Math.random() * 1.5, 5 + Math.random() * 5, 6),
    new THREE.MeshStandardMaterial({ color: 0x2d5a27 })
  );
  tree.position.set((Math.random() - 0.5) * 1200, 3, (Math.random() - 0.5) * 1200);
  scene.add(tree);
}

// Reference marker at origin so we don't feel lost in a blank world
const marker = new THREE.Mesh(
  new THREE.CylinderGeometry(2, 2, 40, 12),
  new THREE.MeshStandardMaterial({ color: 0xff4444 })
);
marker.position.set(0, 20, 200);
scene.add(marker);

// --- Bird ---------------------------------------------------------------

const bird = new THREE.Group();
bird.rotation.order = 'YXZ';

const birdBody = new THREE.Mesh(
  new THREE.ConeGeometry(0.6, 2.5, 8),
  new THREE.MeshStandardMaterial({ color: 0xffaa44, roughness: 0.6 })
);
birdBody.rotation.x = -Math.PI / 2;
bird.add(birdBody);

const wingL = new THREE.Mesh(
  new THREE.BoxGeometry(2.5, 0.1, 0.8),
  new THREE.MeshStandardMaterial({ color: 0xcc7733 })
);
wingL.position.set(-1.4, 0, 0);
bird.add(wingL);

const wingR = wingL.clone();
wingR.position.x = 1.4;
bird.add(wingR);

scene.add(bird);

// --- Flight --------------------------------------------------------------

const state = new FlightState();
const phys = new FlightPhysics(state);
const cam = new CameraRig(camera);

bird.position.copy(state.position);
cam.snap(state);

// --- Input state ---------------------------------------------------------

const tilt = new TiltInput();
let desktopMode = false;

// --- UI wiring -----------------------------------------------------------

const overlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-btn');
const skipBtn = document.getElementById('skip-btn');
const note = document.getElementById('start-note');
const calibrateBtn = document.getElementById('calibrate-btn');
const modePill = document.querySelector('#topbar .pill');

const setNote = (text, err) => {
  note.textContent = text;
  note.classList.toggle('err', !!err);
};

const closeOverlay = () => {
  overlay.classList.add('hidden');
  setTimeout(() => { overlay.style.display = 'none'; }, 300);
};

startBtn.addEventListener('click', async () => {
  if (tilt.state === TILT_STATE.UNSUPPORTED) {
    setNote('Dieses Gerät hat keinen Gyro-Sensor. Nutze Desktop-Modus.', true);
    return;
  }
  setNote('Permission angefragt...');
  const result = await tilt.requestPermission();
  if (result === TILT_STATE.GRANTED) {
    modePill.innerHTML = '<span class="dot ok"></span>tilt · live';
    calibrateBtn.classList.add('visible');
    closeOverlay();
    setTimeout(() => {
      if (tilt.eventCount === 0) setNote('Permission ok, aber keine Events?', true);
    }, 1500);
  } else if (result === TILT_STATE.DENIED) {
    setNote('Permission abgelehnt. Neu laden oder Desktop-Modus.', true);
  } else if (result === TILT_STATE.ERROR) {
    setNote('Fehler beim Permission-Request.', true);
  }
});

skipBtn.addEventListener('click', () => {
  desktopMode = true;
  modePill.innerHTML = '<span class="dot"></span>desktop · W/S A/D · space flap';
  closeOverlay();
});

calibrateBtn.addEventListener('click', () => {
  tilt.calibrate();
  calibrateBtn.textContent = 'Calibrated ✓';
  setTimeout(() => { calibrateBtn.textContent = 'Recalibrate'; }, 1000);
});

// --- Tap-to-Flap ---------------------------------------------------------

renderer.domElement.addEventListener('pointerdown', () => {
  phys.flap(1.0);
});

// --- Desktop keyboard fallback -------------------------------------------

const keys = { w: 0, s: 0, a: 0, d: 0, space: 0 };
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyW') keys.w = 1;
  if (e.code === 'KeyS') keys.s = 1;
  if (e.code === 'KeyA') keys.a = 1;
  if (e.code === 'KeyD') keys.d = 1;
  if (e.code === 'Space') { keys.space = 1; phys.flap(1.0); }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW') keys.w = 0;
  if (e.code === 'KeyS') keys.s = 0;
  if (e.code === 'KeyA') keys.a = 0;
  if (e.code === 'KeyD') keys.d = 0;
  if (e.code === 'Space') keys.space = 0;
});

// --- Resize --------------------------------------------------------------

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Animate -------------------------------------------------------------

const hudRoll = document.getElementById('hud-roll');
const hudPitch = document.getElementById('hud-pitch');
const fpsEl = document.getElementById('fps');

let lastFpsUpdate = performance.now();
let frames = 0;

const clock = new THREE.Clock();
const MAX_DT = 0.066; // clamp to avoid big jumps after tab switch

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), MAX_DT);

  // --- Input to physics ---
  let rollInput = 0;
  let pitchInput = 0;

  tilt.update();

  if (tilt.active) {
    rollInput = tilt.roll;
    pitchInput = tilt.pitch;
  } else if (desktopMode) {
    rollInput = (keys.d - keys.a);
    pitchInput = (keys.s - keys.w);
  }

  phys.applyRoll(rollInput, dt);
  phys.applyPitch(pitchInput, dt);
  phys.update(dt);

  // --- Bird visual ---
  bird.position.copy(state.position);
  bird.rotation.set(state.pitch, state.yaw, state.roll);

  // Wing flap animation — more pronounced during active flap phase
  const flapIntensity = state.flapPhase > 0 ? 1.0 : 0.3;
  const flap = Math.sin(clock.elapsedTime * (state.flapPhase > 0 ? 20 : 5)) * 0.25 * flapIntensity;
  wingL.rotation.z = flap;
  wingR.rotation.z = -flap;

  // --- Camera ---
  cam.update(state);

  // --- HUD ---
  if (hudRoll) {
    hudRoll.textContent = 'roll ' + ((rollInput * 100) | 0).toString().padStart(4, ' ');
  }
  if (hudPitch) {
    hudPitch.textContent = 'pitch ' + ((pitchInput * 100) | 0).toString().padStart(4, ' ');
  }

  renderer.render(scene, camera);

  frames++;
  const now = performance.now();
  if (now - lastFpsUpdate > 500) {
    const fps = (frames * 1000) / (now - lastFpsUpdate);
    if (fpsEl) fpsEl.textContent = `${fps.toFixed(0)}fps · ${state.speed.toFixed(0)}m/s · ${state.altitude.toFixed(0)}m`;
    frames = 0;
    lastFpsUpdate = now;
  }
}
animate();
