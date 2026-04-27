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
import { RingRush } from './game/RingRush.js';
import { RingRushUI } from './game/RingRushUI.js';
import { NestQuest } from './game/NestQuest.js';
import { NestQuestUI } from './game/NestQuestUI.js';
import { getBiomeForLevel, applyBiome } from './world/Biomes.js';
import { SoundFX } from './audio/SoundFX.js';
// Mobile imports — MobileInput class stays lazy, but detect mobile synchronously
// so desktop-only init (ringRush.start, initWebcam) doesn't fire on iPhones.
let MobileInput, MobileUI;
const isMobileDevice = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  || navigator.maxTouchPoints > 1
  || 'ontouchstart' in window;
import {
  CAMERA_FOV, CAMERA_NEAR, CAMERA_FAR,
  FOG_NEAR, FOG_FAR,
  FLIGHT_MODE,
} from './constants.js';

// --- Renderer & Scene ---
// createRenderer() is async (WebGPURenderer needs init()); top-level await
// works under Vite's ES-modules target.
const renderer = await createRenderer();
const scene = await createScene(renderer);

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
// ?seed=N makes the world deterministic (same terrain + tree/house placement
// for everyone using that seed). Useful for debugging ("look at ?seed=42 and
// tell me what you see") and for sharing a specific scenic spot. Without the
// param, worlds are random per browser and cached in localStorage.
/**
 * Reload the page with a fresh procedural seed and an updated `level`
 * URL param. Used by Nest Quest's level-transition flow so each level
 * is a genuinely new world rather than a re-skin of the same terrain.
 * Preserves all other URL params (renderer, ocean, etc.).
 */
function _reloadWithNewSeed({ level }) {
  const next = new URLSearchParams(location.search);
  next.set('seed', String(Math.floor(Math.random() * 1e9)));
  next.set('level', String(level));
  next.set('game', 'nest');
  location.href = `${location.pathname}?${next.toString()}`;
}

const seedParam = new URLSearchParams(location.search).get('seed');
let restoreRandom = null;
if (seedParam !== null) {
  const seed = parseInt(seedParam, 10);
  if (Number.isFinite(seed)) {
    const { installSeededRandom } = await import('./utils/seeded-random.js');
    restoreRandom = installSeededRandom(seed);
    // Bypass the world cache so the seeded world is actually regenerated —
    // otherwise a previously-cached random world would shadow the seeded one.
    localStorage.removeItem('world_arcs');
    localStorage.removeItem('world_heightmap');
    localStorage.removeItem('world_version');
    console.log(`World seed: ${seed} (deterministic)`);
  }
}
const world = await buildWorld(scene, renderer);
if (restoreRandom) restoreRandom();

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
// Initial forward velocity. Without this the bird spawns at altitude with
// velocity=0 → immediately stalls → falls → transitions to LANDING →
// GROUNDED before the player figures out the flap gesture. Phil reported
// exactly this on his iPhone test: "bird standing vertically, could only
// spin". A gliding-speed starting velocity gives the player ~10-15s of
// airtime to learn the controls.
const defaultSpawnSpeed = urlParams.has('speed')
  ? parseFloat(urlParams.get('speed'))
  : 18; // m/s ≈ 65 km/h — gentle glide
flightState.velocity.set(
  -Math.sin(flightState.yaw) * defaultSpawnSpeed,
  0,
  -Math.cos(flightState.yaw) * defaultSpawnSpeed,
);
if (urlParams.has('mode')) flightState.mode = parseInt(urlParams.get('mode'));
flightState.altitude = flightState.position.y;
const flightPhysics = new FlightPhysics(flightState);
const cameraRig = new CameraRig(camera, flightState);
const birdModel = new BirdModel(scene);

// Water effects
const waterSpray = new WaterSpray(scene);
const fishCatcher = new FishCatcher(scene);

// Flock — enabled on all devices now (mobile can handle it).
const flock = new Flock(scene, 24);
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
const isMobile = isMobileDevice(); // synchronous — see top of file

(async () => {
  const mod = await import('./core/MobileInput.js');
  MobileInput = mod.MobileInput;

  if (isMobile) {
    const uiMod = await import('./ui/MobileUI.js');
    MobileUI = uiMod.MobileUI;
    mobileInput = new MobileInput();
    mobileUI = new MobileUI(mobileInput);
    hud.hint.style.display = 'none';
    mobileUI.onStart(() => {
      console.log('Mobile game started');
      if (nestQuest) nestQuest.start();
      // PickupSpawner has no start() — only RingRush does. Guard the call.
      if (ringRush && typeof ringRush.start === 'function') ringRush.start();
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

// --- Audio ---
const sfx = new SoundFX();
window.__sfx = sfx;
// Unlock audio context on first user gesture (iOS Safari requirement)
const unlockAudio = () => {
  sfx.unlock();
  document.removeEventListener('pointerdown', unlockAudio);
  document.removeEventListener('touchstart', unlockAudio);
  document.removeEventListener('keydown', unlockAudio);
};
document.addEventListener('pointerdown', unlockAudio);
document.addEventListener('touchstart', unlockAudio);
document.addEventListener('keydown', unlockAudio);

// --- Game mode selection ---
// ?game=nest (default) | ringrush | free
const gameMode = urlParams.get('game') || 'nest';

let ringRush = null;
let ringRushUI = null;
let nestQuest = null;
let nestQuestUI = null;

if (gameMode === 'ringrush') {
  // Classic timer-reset ring-collection mode with biome progression
  const rrOptions = {};
  if (urlParams.has('level')) rrOptions.startLevel = parseInt(urlParams.get('level'), 10) || 1;
  if (urlParams.has('ringsperlevel')) rrOptions.ringsPerLevel = parseInt(urlParams.get('ringsperlevel'), 10) || 100;

  ringRush = new RingRush(scene, world, flightState, rrOptions);
  ringRushUI = new RingRushUI(ringRush, () => ringRush.restart());
  ringRush.onRingCollected = () => { if (flock) flock.triggerVisit(); };
  ringRush.onLevelUp = (level) => {
    const biome = getBiomeForLevel(level);
    ringRushUI.showLevelUp(level, biome.name);
    if (navigator.vibrate) navigator.vibrate([40, 80, 40]);
    setTimeout(() => {
      applyBiome(scene, biome, renderer);
      if (biome.forest && world.regenerateForest) world.regenerateForest(biome.forest);
      if (world.regenerateLandmark) world.regenerateLandmark(biome);
    }, 500);
  };
  window.__ringRush = ringRush;

  if (ringRush.level > 1) {
    const biome = getBiomeForLevel(ringRush.level);
    setTimeout(() => {
      applyBiome(scene, biome, renderer);
      if (biome.forest && world.regenerateForest) world.regenerateForest(biome.forest);
      if (world.regenerateLandmark) world.regenerateLandmark(biome);
    }, 0);
  }
} else if (gameMode === 'nest') {
  // Nest Quest: find a stick + a worm, return to the nest. Rings on the side.
  const nqOptions = {};
  if (urlParams.has('level')) nqOptions.startLevel = parseInt(urlParams.get('level'), 10) || 1;
  // Restore accumulated run-score across the level→reload boundary.
  // Cleared by NestQuest.restart(); also implicitly cleared on level 1
  // since startLevel defaults to 1 with no saved score.
  const runScoreSaved = parseInt(localStorage.getItem('birdybird.nestquest.runScore'), 10);
  if (Number.isFinite(runScoreSaved) && nqOptions.startLevel > 1) {
    nqOptions.startTotalScore = runScoreSaved;
  }
  nestQuest = new NestQuest(scene, world, flightState, nqOptions);
  nestQuestUI = new NestQuestUI(
    nestQuest,
    () => {
      // Restart from level 1: clear saved run state and reload with a
      // fresh seed so the new run gets a brand-new world, not the same
      // one the player just lost on.
      localStorage.removeItem('birdybird.nestquest.runScore');
      _reloadWithNewSeed({ level: 1 });
    },
    () => {
      // "Next level →" — persist totalScore, reload with new seed +
      // bumped level. Option A: full reload with new ?seed= so the
      // procedural world is genuinely fresh each level.
      localStorage.setItem('birdybird.nestquest.runScore', String(nestQuest.totalScore));
      _reloadWithNewSeed({ level: nestQuest.level + 1 });
    },
  );
  nestQuest.onStickCollected = () => { if (flock) flock.triggerVisit(); sfx.stickPickup(); };
  nestQuest.onWormCollected = () => { if (flock) flock.triggerVisit(); sfx.wormPickup(); };
  nestQuest.onQuestComplete = () => { nestQuestUI.flashQuestComplete(); sfx.questComplete(); };
  nestQuest.onChirp = (volumeScale) => sfx.chirp(volumeScale);
  nestQuest.onGameOver = (won) => {
    if (won) sfx.winFanfare();
    else sfx.loseToot();
  };
  nestQuest.onLevelUp = (level) => {
    const biome = getBiomeForLevel(level);
    applyBiome(scene, biome, renderer);
    if (biome.forest && world.regenerateForest) world.regenerateForest(biome.forest);
    if (navigator.vibrate) navigator.vibrate([40, 80, 40]);
  };
  nestQuest.onRingRecharge = (sec) => nestQuestUI.flashTimerRecharge(sec);
  window.__nestQuest = nestQuest;

  // If entering via ?level=N URL, apply the matching biome immediately
  if (nestQuest.level > 1) {
    const biome = getBiomeForLevel(nestQuest.level);
    setTimeout(() => {
      applyBiome(scene, biome, renderer);
      if (biome.forest && world.regenerateForest) world.regenerateForest(biome.forest);
    }, 0);
  }

  // Side pickups for Nest Quest: clocks (+30s) and speed arrows (2×
  // speed for 30s). Sparser than Ring-Rush rings so each find feels
  // like a discovery rather than a guaranteed quota.
  const { PickupSpawner } = await import('./game/PickupSpawner.js');
  const pickupSpawner = new PickupSpawner(scene, world, flightState);
  pickupSpawner.onClockPickup = () => {
    nestQuest.registerClockPickup();
    if (flock) flock.triggerVisit();
    sfx.ringDing();
  };
  pickupSpawner.onSpeedPickup = () => {
    nestQuest.registerSpeedPickup();
    if (flock) flock.triggerVisit();
    sfx.ringDing();
  };
  nestQuest.onSpeedBoost = (sec, mult) => nestQuestUI.flashSpeedBoost(sec, mult);
  window.__pickupSpawner = pickupSpawner;
  ringRush = pickupSpawner; // reuse the update-loop slot (only needs .update(dt))

  // Nest mode doesn't need a separate landmark — the nest IS the landmark.
  // Remove the default Sunny-Islands lighthouse so we don't end up with
  // a lighthouse randomly stuck on a mountain peak.
  const oldLandmark = scene.getObjectByName('landmark');
  if (oldLandmark) {
    scene.remove(oldLandmark);
    oldLandmark.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry?.dispose?.();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material?.dispose?.();
      }
    });
  }
}

// --- Autopilot ---
const autopilot = new Autopilot();
// Expose scene + autopilot for Playwright/external control
window.__scene = scene;
window.__flightState = flightState;
window.__flightPhysics = flightPhysics;
window.__renderer = renderer;
window.__cameraRig = cameraRig;
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
      // Ground controls: desktop = arrows/WASD, mobile = tilt (pitch/roll) + shake-to-takeoff
      const mobileTilt = (mobileInput && mobileInput.active)
        ? { pitch: mobileInput.pitch, roll: mobileInput.roll }
        : null;
      groundInput = input.getGroundInput(mobileTilt);
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

    // Nest Quest (primary mode — runs before ring-loop so ring pickups can register)
    if (nestQuest) {
      nestQuest.update(dt);
      nestQuestUI.update();
    }
    // Ring Rush (or side-rings for nest quest)
    if (ringRush) {
      ringRush.update(dt);
      if (ringRushUI) ringRushUI.update();
    }
  } else {
    controls.update();
  }

  renderer.render(scene, camera);
});
loop.start();

// Init webcam in background (desktop only — mobile uses gyroscope)
if (!isMobile) {
  initWebcam();
  // On desktop we auto-start — no calibration wizard to wait for
  if (nestQuest) nestQuest.start();
  if (ringRush && typeof ringRush.start === 'function') ringRush.start();
}
