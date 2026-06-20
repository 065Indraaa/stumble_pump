// ============================================================
// STUMBLE PUMP — Bonding Curve Climb (Race map config)
// Sigmoid uphill terrain. Red candles roll down, green trampolines,
// sweepers, wrecking balls, one pit bridged by a mover platform.
// ============================================================
import { buildRaceCourse } from './raceCourse.js';

export function buildBondingCurve() {
  const L = 280, W = 14, H = 24;
  return buildRaceCourse({
    name: 'BONDING CURVE CLIMB',
    L, W, H,
    clear: 0x7DD3F0, fog: 0xA8E6F5,
    terrainColor: 0x4A90D9, edgeColor: 0xFF6B35, gridColor: 0x88CCEE,
    backdrop: 'bonding',
    heightFn: (z) => {
      const u = z / L;
      return H / (1 + Math.exp(-(u - 0.5) * 11)) + Math.sin(u * Math.PI * 5) * 1.2;
    },
    candles: true, tramps: 7,
    sweepers: [
      { z: L * 0.25, sp: 1.7 }, { z: L * 0.42, sp: -2.1 }, { z: L * 0.58, sp: 2.4 },
      { z: L * 0.72, sp: -2.8 }, { z: L * 0.85, sp: 3.0 },
    ],
    pendulums: [
      { z: L * 0.35, x: 0, amp: 1.0, sp: 1.6 },
      { z: L * 0.65, x: 2, amp: 1.2, sp: 1.9 },
      { z: L * 0.80, x: -2, amp: 1.1, sp: 2.2 },
    ],
    pits: [{ z0: L * 0.50, z1: L * 0.56 }],
    movers: [{ z: L * 0.53, x0: -8, x1: 8, w: 4, d: 5, sp: 0.9, color: 0x3B82F6 }],
    finishText: 'TO THE MOON 🚀', killY: -40,
  });
}
