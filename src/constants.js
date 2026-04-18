// Flight physics — arcade-tuned clone of VogelSimulator's model.
// Kept in sync where sensible; tuned for mobile forgiveness where not.

export const GRAVITY = -9.81;

// Wing properties
export const WING_AREA = 0.7;
export const AIR_DENSITY = 1.225;
export const BIRD_MASS = 3.5;

// Lift
export const WING_INCIDENCE = 0.12;     // +50% vs VogelSim (0.08) — more baseline lift, easier to stay airborne
export const CL_MAX = 1.6;
export const CL_SLOPE = 2 * Math.PI;

// Drag
export const CD_PARASITIC = 0.025;
export const CD_INDUCED_K = 0.08;

// Flapping
export const FLAP_THRUST = 80;          // +33% (vs 60)
export const FLAP_DURATION = 0.3;
export const FLAP_COOLDOWN = 0.15;      // -40% (vs 0.25) — allows rhythmic flap bursts
export const FLAP_LIFT_BONUS = 0.6;

// Speed limits
export const MAX_SPEED = 80;            // -20% (vs 100) — mobile-friendly cap
export const TERMINAL_VELOCITY = -60;
export const MIN_FLIGHT_SPEED = 3;

// Control authority (tilt mapping)
export const BANK_RATE = 1.5;           // softer turning
export const PITCH_RATE = 2.5;
export const ROLL_RATE = 3.5;
export const MAX_ROLL = 1.0;            // ~57°
export const MAX_PITCH = 0.6;           // ~34°

// Ground effect
export const GROUND_EFFECT_HEIGHT = 5.0;

// Ground collision (flat ground at y=0 for now)
export const GROUND_Y = 0;
export const GROUND_BIRD_OFFSET = 1.5;

// Camera
export const CHASE_DISTANCE = 18;
export const CHASE_HEIGHT = 6;
export const CHASE_LERP = 0.08;
