// ============================================================
// STUMBLE PUMP — BotController
// Bot brain helpers. The actual per-frame decision logic lives in
// Actor._decideMove() (raceBot/survivalBot/lobbyBot branches) so it
// shares the same physics path as the player. This module provides
// skill/difficulty config + spawning helpers used by MatchState.
// ============================================================
import { Actor } from './Actor.js';
import { randomBotSkin } from './skins.js';

export const BOT_CONFIG = {
  race:     { brain: 'raceBot',     skillMin: 0.70, skillMax: 1.00, stumbleChance: 0.0006 },
  survival: { brain: 'survivalBot', skillMin: 0.65, skillMax: 0.95, stumbleChance: 0.0004 },
  lobby:    { brain: 'lobbyBot',    skillMin: 0.50, skillMax: 0.65, stumbleChance: 0 },
};

/** Spawn a single bot Actor at a spawn point. */
export function spawnBot(spawnPoint, brain, skinKey) {
  const b = new Actor(skinKey || randomBotSkin(), false, brain);
  b.pos.copy(spawnPoint);
  b.checkpoint.copy(spawnPoint);
  return b;
}

/** Fill N bot slots into an actors array using spawn points + config. */
export function fillBots(actors, spawnPoints, startIndex, count, brain) {
  for (let i = 0; i < count; i++) {
    const sp = spawnPoints[(startIndex + i) % spawnPoints.length];
    const b = spawnBot(sp, brain);
    b.pos.x += (Math.random() - 0.5);
    actors.push(b);
  }
}
