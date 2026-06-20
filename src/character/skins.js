// ============================================================
// STUMBLE PUMP — Skins
// 13 degen-archetype skins. Same rig, different material/accessory overrides.
// 4 default-owned + 9 unlockable (Solana KOL caricatures).
// ============================================================

export const SKINS = {
  // ---- default-owned (pump.fun palette: mint/navy/lime primary) ----
  shiller:   { name: 'THE SHILLER',   rarity: 'common',    emoji: '📢', body: 0x2F66E0, accent: 0x5FCB88, owned: true,  cost: 0 },
  devsus:    { name: 'DEV (SUS)',     rarity: 'rare',      emoji: '🥷', body: 0x11141F, accent: 0xA3E635, owned: true,  cost: 0 },
  trojan:    { name: 'TROJAN BOT',    rarity: 'epic',      emoji: '🤖', body: 0x6B7387, accent: 0xFF5151, owned: true,  metal: true, cost: 0 },
  paperhand: { name: 'PAPERHAND',     rarity: 'legendary', emoji: '🧻', body: 0xF4F6FB, accent: 0xFFD23F, owned: true,  cost: 0 },
  // ---- unlockable Solana KOL caricatures ----
  whale:     { name: 'BLUE WHALE',    rarity: 'legendary', emoji: '🐳', body: 0x2F66E0, accent: 0x5FCB88, owned: false, cost: 1200, kol: 'Ansem-inspired' },
  cigarchad: { name: 'CIGAR CHAD',    rarity: 'epic',      emoji: '🚬', body: 0x1B1D27, accent: 0xFFD23F, owned: false, cost: 800,  kol: 'Mitch-inspired' },
  orange:    { name: 'ORANGE PILLED', rarity: 'rare',      emoji: '🟠', body: 0xFF8A3D, accent: 0xFFD23F, owned: false, cost: 400,  kol: 'Orangie-inspired' },
  cupsey:    { name: 'THE CUP',       rarity: 'epic',      emoji: '🥤', body: 0xF4F6FB, accent: 0x5FCB88, owned: false, cost: 800,  kol: 'Cupsey-inspired' },
  percent:   { name: 'PERCENT',       rarity: 'rare',      emoji: '📊', body: 0x2FAE6A, accent: 0xFFD23F, owned: false, cost: 450,  kol: 'Cented-inspired' },
  validator: { name: 'VALIDATOR',     rarity: 'legendary', emoji: '🟣', body: 0x9945FF, accent: 0x14F195, owned: false, cost: 1500, kol: 'Toly-inspired' },
  rpcwiz:    { name: 'RPC WIZARD',    rarity: 'epic',      emoji: '🧙', body: 0x2FAE6A, accent: 0xA3E635, owned: false, cost: 900,  kol: 'Mert-inspired' },
  frogdegen: { name: 'FROG DEGEN',    rarity: 'rare',      emoji: '🐸', body: 0x5FCB88, accent: 0x1D3934, owned: false, cost: 350,  kol: 'mr.frog-inspired' },
  diamond:   { name: 'DIAMOND HANDS', rarity: 'legendary', emoji: '💎', body: 0xB3E5FC, accent: 0x4F8CFF, owned: false, cost: 2000, kol: 'DiamondHands-inspired' },
};

export const EMOTES = [
  { k: 'dance',   n: 'DANCE',     e: '🕺', r: 'common' },
  { k: 'wave',    n: 'WAVE',      e: '👋', r: 'common' },
  { k: 'taunt',   n: 'TAUNT',     e: '😤', r: 'rare' },
  { k: 'point',   n: 'POINT',     e: '👉', r: 'rare' },
  { k: 'flex',    n: 'FLEX',      e: '💪', r: 'epic' },
  { k: 'cry',     n: 'CRY',       e: '😭', r: 'legendary' },
];

export const TRAILS = [
  { k: 'rocket',  n: 'ROCKET',  e: '🚀', r: 'common' },
  { k: 'fire',    n: 'FIRE',    e: '🔥', r: 'rare' },
  { k: 'money',   n: 'MONEY',   e: '💸', r: 'epic' },
  { k: 'rainbow', n: 'RAINBOW', e: '🌈', r: 'legendary' },
];

export function randomBotSkin() {
  const k = Object.keys(SKINS);
  return k[Math.floor(Math.random() * k.length)];
}
