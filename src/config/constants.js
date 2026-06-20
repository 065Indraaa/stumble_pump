// ============================================================
// STUMBLE PUMP — Global game constants & tunables
// ============================================================

// --- Physics (matched to legacy feel; Rapier uses same numbers) ---
export const GRAVITY = 23.0;            // world gravity along -Y (slightly lower than 26 legacy to feel floaty/cartoon)
export const MOVE_SPEED = 7.5;          // max horizontal speed (units/s)
export const ACCEL = 60.0;              // horizontal acceleration toward wish dir
export const FRICTION = 12.0;           // deceleration when no input
export const JUMP_VELOCITY = 9.5;       // initial jump velocity (up)
export const DIVE_SPEED = 13.0;         // horizontal dive impulse
export const DIVE_LOCK = 0.5;           // dive lockout (s)
export const COYOTE_TIME = 0.10;        // grace period after leaving ledge
export const JUMP_BUFFER = 0.12;        // jump press buffer
export const CHARACTER_RADIUS = 0.42;
export const CHARACTER_HEIGHT = 1.0;    // capsule half-height-ish for collider
export const FIXED_DT = 1 / 60;         // Rapier fixed timestep
export const MAX_SUBSTEPS = 5;          // safety clamp on accumulator

// --- Match / rounds ---
export const MAX_PLAYERS = 32;
export const TOTAL_ROUNDS = 3;
export const MAX_ROOM = 32;
export const ROOM_TIMEOUT = 12000;      // ms
export const QUALIFY_HALF = 0.5;        // top half qualify each round

// --- Net ---
export const MQTT_URL = 'wss://broker.emqx.io:8084/mqtt';
export const TOPIC_PRESENCE = 'stumblepump/v4/global/presence';
export const TOPIC_ROOM_JOIN = 'stumblepump/v4/rooms/join';
export const TOPIC_ROOM_LEAVE = 'stumblepump/v4/rooms/leave';
export const TOPIC_ROOM_START = 'stumblepump/v4/rooms/start';

// --- Camera ---
export const CAM_FOV = 70;
export const CAM_FOLLOW_LERP = 0.12;
export const CAM_HEIGHT = 3.0;
export const CAM_DIST = 6.0;
export const CAM_LOOKAHEAD = 2.0;

// --- localStorage keys ---
export const LS_USERS = 'stumblePump_users_v2';
export const LS_SESSION = 'stumblePump_session_v2';
export const LS_ROOMS = 'stumblePump_rooms_v2';
export const LS_HISTORY = 'stumblePump_history_v2';
export const LS_MUTE = 'stumblePump_mute';
export const LS_QUALITY = 'stumblePump_quality';

// --- Asset paths ---
export const ARENA_BG = {
  bonding: '/textures/bonding_bg.png',
  rugpull: '/textures/rugpull_bg.png',
  moon: '/textures/moon_bg.png',
  liquidation: '/textures/liquidation_bg.png',
  menu_bg: '/textures/menu_bg.png',
};
export const LOGO_URL = '/textures/logo.jpeg';

// --- Color palette (design system tokens shared with CSS) ---
export const COLORS = {
  orange: 0xFF6B35, orangeDk: 0xE0531C,
  blue: 0x3B82F6, sky: 0x5BC0F8,
  green: 0x22C55E, pink: 0xEC4899,
  yellow: 0xFBBF24, purple: 0x8B5CF6,
  red: 0xEF4444, gold: 0xffd700,
};
export const CONFETTI_COLORS = [0xEF4444, 0xFBBF24, 0x22C55E, 0x3B82F6, 0xFF6B35, 0x8B5CF6];

export function isMobile() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}
