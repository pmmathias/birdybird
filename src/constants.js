// World dimensions
export const WORLD_SIZE = 6000;
export const WORLD_HALF = WORLD_SIZE / 2;
export const TERRAIN_SEGMENTS = 256;
export const CHUNK_COUNT = 8; // NxN grid of terrain chunks
export const CHUNK_SIZE = WORLD_SIZE / CHUNK_COUNT;

// Terrain generation
export const ARC_COUNT = 900;
export const ARC_MIN_RADIUS = 60;
export const ARC_MAX_RADIUS = 600;
export const ARC_MIN_HEIGHT = 3;
export const ARC_MAX_HEIGHT = 50;
export const VALLEY_ARC_RATIO = 0.3;
export const VALLEY_MIN_DEPTH = -15;
export const VALLEY_MAX_DEPTH = -50;
export const VALLEY_MAX_RADIUS = 400;

// Water
export const WATER_LEVEL = 15;

// Clouds
export const CLOUD_HEIGHT = 200;
export const CLOUD_COUNT = 150;

// Trees
export const TREE_CLUSTER_COUNT = 4000;
export const TREES_PER_CLUSTER_MIN = 20;
export const TREES_PER_CLUSTER_MAX = 80;
export const TREE_MIN_HEIGHT = 8;
export const TREE_MAX_HEIGHT = 22;

// Flight physics — aerodynamic model
export const GRAVITY = -9.81;

// Wing properties (loosely modeled on a large soaring bird)
export const WING_AREA = 0.7;            // m² effective wing area
export const AIR_DENSITY = 1.225;        // kg/m³
export const BIRD_MASS = 3.5;            // kg

// Lift
export const WING_INCIDENCE = 0.08;      // ~4.5° baseline AoA from wing mounting angle
export const CL_MAX = 1.6;              // max lift coefficient before stall
export const CL_SLOPE = 2 * Math.PI;    // lift curve slope per radian
export const STALL_ANGLE = 0.28;         // (unused, stall removed)
export const STALL_SHARPNESS = 8;        // (unused, stall removed)

// Drag
export const CD_PARASITIC = 0.025;       // zero-lift drag coefficient
export const CD_INDUCED_K = 0.08;        // induced drag factor (K in CD = CD0 + K·CL²)

// Flapping
export const FLAP_THRUST = 60;           // Newtons peak thrust per flap
export const FLAP_DURATION = 0.3;        // seconds for one downstroke
export const FLAP_COOLDOWN = 0.25;       // minimum seconds between flaps
export const FLAP_LIFT_BONUS = 0.6;      // extra CL added during downstroke

// Speed limits (safety clamps)
export const MAX_SPEED = 100;
export const TERMINAL_VELOCITY = -80;
export const MIN_FLIGHT_SPEED = 4;

// Control authority
export const BANK_RATE = 2.0;
export const PITCH_RATE = 2.5;
export const ROLL_RATE = 3.5;
export const MAX_ROLL = 1.0;             // ~57° max bank
export const MAX_PITCH = 0.7;            // ~40° max pitch

// Flight modes
export const FLIGHT_MODE = { FLYING: 0, LANDING: 1, GROUNDED: 2, TAKEOFF: 3 };
export const WALK_SPEED = 2.0;              // m/s max walking speed
export const LANDING_SPEED_THRESHOLD = 14;  // m/s — below this + near ground → land
export const LANDING_ALTITUDE_MARGIN = 4.0; // meters above terrain to trigger landing
export const TAKEOFF_IMPULSE = 15;          // m/s upward kick on takeoff
export const TAKEOFF_DURATION = 0.5;        // seconds of takeoff animation
export const GROUND_OFFSET = 3.0;           // meters above terrain when grounded
export const WALK_SPRINT_SPEED = 5.0;       // m/s sprint speed
export const JUMP_IMPULSE = 6.0;            // m/s upward kick for ground jump
export const GROUND_EFFECT_HEIGHT = 5.0;    // meters — ground effect zone

// Camera
export const FOG_NEAR = 600;
export const FOG_FAR = 5000;
export const CAMERA_FOV = 60;
export const CAMERA_NEAR = 2.0;
export const CAMERA_FAR = 8000;          // far enough for water horizon
export const CHASE_DISTANCE = 15;
export const CHASE_HEIGHT = 5;

// Rendering
export const GRASS_TEXTURE_REPEAT = 128;
