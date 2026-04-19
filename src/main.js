import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRenderer } from './core/Renderer.js';
import { createScene } from './core/Scene.js';
import { GameLoop } from './core/GameLoop.js';
import { InputManager } from './core/InputManager.js';
// Debug panel removed — webcam overlay serves as debug view
import { HUD } from './ui/HUD.js';
import { WebcamOverlay } from './ui/WebcamOverlay.js';
import { buildWorld } from './world/WorldBuilder.js';
import { getTerrainHeight } from './world/Terrain.js';
import { FlightState } from './flight/FlightState.js';
import { FlightPhysics } from './flight/FlightPhysics.js';
import { CameraRig } from './flight/CameraRig.js';
import { BirdModel } from './flight/BirdModel.js';
import { Flock } from './flight/Flock.js';
import { WaterSpray } from './world/WaterSpray.js';
import { FishCatcher } from './world/FishCatcher.js';
import { WebcamManager } from './pose/WebcamManager.js';
import { PoseDetector } from './pose/PoseDetector.js';
import { ArmAnalyzer } from './pose/ArmAnalyzer.js';
import { Autopilot, DEMO_SEQUENCE } from './core/Autopilot.js';
// Mobile imports — loaded lazily to avoid init issues on iOS
let MobileInput, isMobileDevice, MobileUI;
import {
  CAMERA_FOV, CAMERA_NEAR, CAMERA_FAR,
  FOG_NEAR, FOG_FAR,
  FLIGHT_MODE,
} from './constants.js';

// --- Renderer & Scene ---
const renderer = createRenderer();
const scene = createScene(renderer);

// --- Camera ---
const camera = new THREE.PerspectiveCamera(
  CAMERA_FOV,
  window.innerWidth / window.innerHeight,
  CAMERA_NEAR,
  CAMERA_FAR,
);
camera.position.set(0, 80, 150);
window.__camera = camera; // for Renderer.js resize handler

// --- OrbitControls (debug mode) ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 20, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.1;

// --- Build the world ---
const world = buildWorld(scene, renderer);

// --- Flight system ---
const flightState = new FlightState();
// Start well above terrain — sample a grid to find max height nearby
let maxH = 0;
for (let sx = -200; sx <= 200; sx += 50) {
  for (let sz = -200; sz <= 200; sz += 50) {
    maxH = Math.max(maxH, getTerrainHeight(sx, sz, world.arcs));
  }
}
flightState.position.y = maxH + 80;
flightState.altitude = flightState.position.y;
console.log(`Spawn height: ${flightState.position.y.toFixed(0)}m (terrain max nearby: ${maxH.toFixed(0)}m)`);

// --- URL parameters for testing/debugging ---
// ?x=100&z=200&y=20&yaw=1.5 → positions bird
// ?skipcalib=1 → auto-applies default mobile calibration (bypass wizard)
const urlParams = new URLSearchParams(location.search);
if (urlParams.has('x')) flightState.position.x = parseFloat(urlParams.get('x'));
if (urlParams.has('y')) flightState.position.y = parseFloat(urlParams.get('y'));
if (urlParams.has('z')) flightState.position.z = parseFloat(urlParams.get('z'));
if (urlParams.has('yaw')) flightState.yaw = parseFloat(urlParams.get('yaw'));
if (urlParams.has('pitch')) flightState.pitch = parseFloat(urlParams.get('pitch'));
if (urlParams.has('speed')) {
  const s = parseFloat(urlParams.get('speed'));
  flightState.velocity.set(
    -Math.sin(flightState.yaw) * s,
    0,
    -Math.cos(flightState.yaw) * s,
  );
}
if (urlParams.has('mode')) flightState.mode = parseInt(urlParams.get('mode'));
flightState.altitude = flightState.position.y;
const flightPhysics = new FlightPhysics(flightState);
const cameraRig = new CameraRig(camera, flightState);
const birdModel = new BirdModel(scene);

// Water effects
const waterSpray = new WaterSpray(scene);
const fishCatcher = new FishCatcher(scene);

// Flock — desktop only (too heavy for mobile)
let flock = null;
if (!('ontouchstart' in window) && navigator.maxTouchPoints <= 1) {
  flock = new Flock(scene, 24);
}
const input = new InputManager();
// Toggle webcam overlay when input mode changes
input.onModeChange = (isKeyboard) => {
  if (webcamOverlay) {
    isKeyboard ? webcamOverlay.hide() : webcamOverlay.show();
  }
};

// --- Mobile input (lazy init) ---
let mobileInput = null;
let mobileUI = null;
let isMobile = false;

(async () => {
  const mod = await import('./core/MobileInput.js');
  MobileInput = mod.MobileInput;
  isMobileDevice = mod.isMobileDevice;
  isMobile = isMobileDevice();

  if (isMobile) {
    const uiMod = await import('./ui/MobileUI.js');
    MobileUI = uiMod.MobileUI;
    mobileInput = new MobileInput();
    mobileUI = new MobileUI(mobileInput);
    hud.hint.style.display = 'none';
    mobileUI.onStart(() => {
      console.log('Mobile game started');
      let lastTap = 0;
      document.addEventListener('touchend', () => {
        const now = Date.now();
        if (now - lastTap < 300) {
          mobileInput.calibrate();
          console.log('Recalibrated');
        }
        lastTap = now;
      });
    });
  }
})();
const hud = new HUD();

// --- Autopilot ---
const autopilot = new Autopilot();
// Expose scene + autopilot for Playwright/external control
window.__scene = scene;
window.__flightState = flightState;
window.__flightPhysics = flightPhysics;
window.__startAutopilot = (seq) => {
  if (!flightMode) {
    // Auto-enter flight mode
    flightMode = true;
    controls.enabled = false;
    hud.el.style.display = 'block';
    hud.flapIndicator.style.display = 'flex';
  }
  autopilot.start(seq || DEMO_SEQUENCE);
};
window.__stopAutopilot = () => autopilot.stop();

// --- Pose detection ---
const webcamManager = new WebcamManager();
const poseDetector = new PoseDetector();
const armAnalyzer = new ArmAnalyzer();
let webcamOverlay = null;
let poseActive = false;

// --- Flight mode toggle ---
let flightMode = true; // start in flight mode

async function initWebcam() {
  // Double-check: never init webcam on mobile/touch devices
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    console.log('Touch device detected — skipping webcam init');
    return;
  }
  const video = await webcamManager.init();
  if (!video) {
    console.warn('Webcam not available, using keyboard only.');
    return;
  }

  await poseDetector.init();
  if (!poseDetector.ready) {
    console.warn('Pose detection not available, using keyboard only.');
    return;
  }

  webcamOverlay = new WebcamOverlay(video);
  poseActive = true;
  input.poseAvailable = true;

  // Show overlay if in webcam mode, hide if keyboard
  if (!input.forceKeyboard) {
    webcamOverlay.show();
  } else {
    webcamOverlay.hide();
  }

  // Auto-calibrate after a short delay
  setTimeout(() => {
    const landmarks = poseDetector.detect(webcamManager.video);
    if (landmarks) {
      armAnalyzer.calibrate(landmarks);
      console.log('Pose calibrated! Raise and lower arms to fly.');
    }
  }, 2000);
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyF') {
    flightMode = !flightMode;
    controls.enabled = !flightMode;
    hud.el.style.display = flightMode ? 'block' : 'none';
    hud.flapIndicator.style.display = flightMode ? 'flex' : 'none';

    if (flightMode && webcamOverlay) {
      webcamOverlay.show();
    } else if (webcamOverlay) {
      webcamOverlay.hide();
    }

    hud.hint.innerHTML = flightMode
      ? 'SPACE = Flap &nbsp;|&nbsp; A/D = Turn &nbsp;|&nbsp; W = Dive &nbsp;|&nbsp; S = Climb &nbsp;|&nbsp; T = Toggle Webcam/Keys &nbsp;|&nbsp; F = Debug Cam &nbsp;|&nbsp; C = Recalibrate'
      : 'F = Enter Flight Mode &nbsp;|&nbsp; Mouse = Orbit Camera';
  }

  // P = start autopilot demo
  if (e.code === 'KeyP') {
    if (autopilot.active) {
      autopilot.stop();
    } else {
      window.__startAutopilot();
    }
  }

  // R = regenerate world (clear cache, reload)
  if (e.code === 'KeyR' && !flightMode) {
    localStorage.removeItem('world_arcs');
    localStorage.removeItem('world_heightmap');
    localStorage.removeItem('world_resolution');
    localStorage.removeItem('world_version');
    console.log('World cache cleared — reloading...');
    location.reload();
  }

  // Recalibrate pose
  if (e.code === 'KeyC' && flightMode && poseActive) {
    const landmarks = poseDetector.detect(webcamManager.video);
    if (landmarks) {
      armAnalyzer.calibrate(landmarks);
      console.log('Recalibrated!');
    }
  }
});

// Start in flight mode
controls.enabled = false;
hud.hint.innerHTML = 'SPACE = Flap &nbsp;|&nbsp; A/D = Turn &nbsp;|&nbsp; W = Dive &nbsp;|&nbsp; S = Climb &nbsp;|&nbsp; T = Toggle Webcam/Keys &nbsp;|&nbsp; F = Debug Cam &nbsp;|&nbsp; P = Autopilot';

// Debug panel removed — use webcam overlay for pose debugging

// --- Game Loop ---
const loop = new GameLoop();
loop.onUpdate((dt) => {
  world.update(dt, camera, flightState.altitude);

  if (flightMode) {
    // Pose detection
    if (poseActive && webcamManager.ready) {
      const landmarks = poseDetector.detect(webcamManager.video);
      const poseData = armAnalyzer.analyze(landmarks);
      input.setPoseInput(poseData);

      if (webcamOverlay) {
        webcamOverlay.drawSkeleton(landmarks);
        webcamOverlay.showGesture(armAnalyzer.gesture);
      }
    }

    // Update input (autopilot overrides if active)
    input.update(dt);
    autopilot.update(dt, input);

    // Mobile gyro input overrides when active
    if (mobileInput && mobileInput.active) {
      mobileInput.update(dt);
      input.source = 'mobile';
      input.pitch = mobileInput.pitch;
      input.roll = mobileInput.roll;
      input.lift = mobileInput.lift;
      input.wingSpread = mobileInput.wingSpread;
    }

    // Terrain height at current position (needed for physics + collision)
    const groundY = getTerrainHeight(
      flightState.position.x,
      flightState.position.z,
      world.arcs,
    );

    // Apply controls to physics (mode-dependent)
    const mode = flightState.mode;
    let groundInput = null;

    if (mode === FLIGHT_MODE.GROUNDED) {
      // Ground controls: WASD movement, arrows turn, space jump, shift sprint
      groundInput = input.getGroundInput();
      // Flap (Space / shake / gesture) → takeoff
      if (input.lift > 0.5) {
        flightPhysics.takeoff();
      }
    } else {
      // Flying/Landing/Takeoff: normal controls
      flightState.wingSpread = input.wingSpread;
      flightPhysics.flap(input.lift);
      flightPhysics.applyRoll(input.roll, dt);
      flightPhysics.applyPitch(input.pitch, dt);
    }

    flightPhysics.update(dt, groundY, groundInput);
    flightPhysics.enforceGround(groundY);

    // Camera follow
    cameraRig.update(dt);
    birdModel.update(flightState, dt, camera);
    if (flock) flock.update(flightState, dt);

    // Water effects
    waterSpray.update(flightState, dt);
    fishCatcher.update(flightState, dt);

    // HUD
    hud.update(flightState, input.lift > 0, input.source);
  } else {
    controls.update();
  }

  renderer.render(scene, camera);
});
loop.start();

// Init webcam in background (desktop only — mobile uses gyroscope)
if (!isMobile) {
  initWebcam();
}
