// ============================================================
// STUMBLE PUMP — Moon Mission (Race map config)
// Steady linear uphill to the moon. Gap-and-platform map:
// 4 pits each bridged by alternating-direction mover platforms.
// ============================================================
import { buildRaceCourse } from './raceCourse.js';

export function buildMoonMission() {
  const L = 300, W = 13, H = 30;
  return buildRaceCourse({
    name: 'MOON MISSION',
    L, W, H,
    clear: 0x3B82F6, fog: 0x93C5FD,
    terrainColor: 0x60A5FA, edgeColor: 0xFBBF24, gridColor: 0x88CCEE,
    backdrop: 'moon',
    heightFn: (z) => { const u = z / L; return u * H + Math.sin(u * Math.PI * 4) * 2; },
    candles: false, tramps: 4,
    pits: [
      { z0: L * 0.20, z1: L * 0.28 }, { z0: L * 0.38, z1: L * 0.46 },
      { z0: L * 0.60, z1: L * 0.68 }, { z0: L * 0.78, z1: L * 0.84 },
    ],
    movers: [
      { z: L * 0.24, x0: -7, x1: 7, sp: 0.8, color: 0x3B82F6 },
      { z: L * 0.42, x0: 7, x1: -7, sp: 0.7, color: 0x22C55E },
      { z: L * 0.64, x0: -6, x1: 6, w: 3.5, d: 4, sp: 1.0, color: 0x3B82F6 },
      { z: L * 0.81, x0: 6, x1: -6, w: 3.5, d: 4, sp: 1.1, color: 0x22C55E },
    ],
    pendulums: [
      { z: L * 0.33, amp: 1.0, sp: 1.5 }, { z: L * 0.52, amp: 1.2, sp: 1.8 },
      { z: L * 0.72, amp: 1.1, sp: 2.0 }, { z: L * 0.90, amp: 1.3, sp: 2.4 },
    ],
    sweepers: [{ z: L * 0.15, sp: 2.0 }, { z: L * 0.55, sp: -2.5 }, { z: L * 0.88, sp: 3.0 }],
    finishText: 'MOON LANDED 🌙', killY: -45,
  });
}
