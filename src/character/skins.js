// ============================================================
// STUMBLE PUMP — Skins
// 13 degen-archetype skins. Same rig, different material/accessory overrides.
// 4 default-owned + 9 unlockable (Solana KOL caricatures).
// ============================================================

export const SKINS = {
  // ---- default-owned ----
  shiller:   { name: 'THE SHILLER',   rarity: 'common',    emoji: '📢', body: 0x1a3a8f, accent: 0x3a6fd8, owned: true,  cost: 0 },
  devsus:    { name: 'DEV (SUS)',     rarity: 'rare',      emoji: '🥷', body: 0x111111, accent: 0x00ff88, owned: true,  cost: 0 },
  trojan:    { name: 'TROJAN BOT',    rarity: 'epic',      emoji: '🤖', body: 0xc0c0c0, accent: 0xff0000, owned: true,  metal: true, cost: 0 },
  paperhand: { name: 'PAPERHAND',     rarity: 'legendary', emoji: '🧻', body: 0xf5deb3, accent: 0xffffff, owned: true,  cost: 0 },
  // ---- unlockable Solana KOL caricatures ----
  whale:     { name: 'BLUE WHALE',    rarity: 'legendary', emoji: '🐳', body: 0x1b4fd8, accent: 0x35d6ff, owned: false, cost: 1200, kol: 'Ansem-inspired' },
  cigarchad: { name: 'CIGAR CHAD',    rarity: 'epic',      emoji: '🚬', body: 0x2a2a33, accent: 0xffd700, owned: false, cost: 800,  kol: 'Mitch-inspired' },
  orange:    { name: 'ORANGE PILLED', rarity: 'rare',      emoji: '🟠', body: 0xff7a18, accent: 0xffffff, owned: false, cost: 400,  kol: 'Orangie-inspired' },
  cupsey:    { name: 'THE CUP',       rarity: 'epic',      emoji: '🥤', body: 0xe8e8f0, accent: 0x18c0b0, owned: false, cost: 800,  kol: 'Cupsey-inspired' },
  percent:   { name: 'PERCENT',       rarity: 'rare',      emoji: '📊', body: 0x16c060, accent: 0x0a2a18, owned: false, cost: 450,  kol: 'Cented-inspired' },
  validator: { name: 'VALIDATOR',     rarity: 'legendary', emoji: '🟣', body: 0x9945ff, accent: 0x14f195, owned: false, cost: 1500, kol: 'Toly-inspired' },
  rpcwiz:    { name: 'RPC WIZARD',    rarity: 'epic',      emoji: '🧙', body: 0x3a2a70, accent: 0xffd24a, owned: false, cost: 900,  kol: 'Mert-inspired' },
  frogdegen: { name: 'FROG DEGEN',    rarity: 'rare',      emoji: '🐸', body: 0x4caf50, accent: 0x1f5f24, owned: false, cost: 350,  kol: 'mr.frog-inspired' },
  diamond:   { name: 'DIAMOND HANDS', rarity: 'legendary', emoji: '💎', body: 0xb3e5fc, accent: 0x0288d1, owned: false, cost: 2000, kol: 'DiamondHands-inspired' },
};

export const EMOTES = [
  { k: 'moon',    n: 'MOON POINT',   e: '🌙', r: 'common' },
  { k: 'rug',     n: 'RUG DANCE',    e: '🪅', r: 'rare' },
  { k: 'hodl',    n: 'HODL STANCE',  e: '💎', r: 'epic' },
  { k: 'escape',  n: 'DEV ESCAPE',   e: '🏃', r: 'legendary' },
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
