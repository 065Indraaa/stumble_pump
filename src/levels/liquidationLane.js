// ============================================================
// STUMBLE PUMP — Liquidation Lane (Race map config)
// Downhill canyon into lava. Narrowest track (W=11), 5 pits all
// bridged by escalating-speed green mover platforms, fastest sweepers.
// Only map with lava:true.
// ============================================================
import { buildRaceCourse } from './raceCourse.js';

export function buildLiquidationLane() {
  const L = 260, W = 11, H = 16;
  return buildRaceCourse({
    name: 'LIQUIDATION LANE',
    L, W, H,
    clear: 0xFB923C, fog: 0xFED7AA,
    terrainColor: 0xF97316, edgeColor: 0xEF4444, gridColor: 0x88CCEE,
    backdrop: 'liquidation',
    heightFn: (z) => { const u = z / L; return H * (1 - u) + Math.sin(u * Math.PI * 5) * 2.5; },
    candles: true, tramps: 3, lava: true,
    pits: [
      { z0: L * 0.18, z1: L * 0.26 }, { z0: L * 0.35, z1: L * 0.43 },
      { z0: L * 0.52, z1: L * 0.60 }, { z0: L * 0.70, z1: L * 0.78 },
      { z0: L * 0.85, z1: L * 0.92 },
    ],
    movers: [
      { z: L * 0.22, x0: -6, x1: 6, w: 3, d: 3.5, sp: 1.0, color: 0x22C55E },
      { z: L * 0.39, x0: 6, x1: -6, w: 3, d: 3.5, sp: 1.1, color: 0x22C55E },
      { z: L * 0.56, x0: -5, x1: 5, w: 3, d: 3.5, sp: 1.2, color: 0x22C55E },
      { z: L * 0.74, x0: 5, x1: -5, w: 3, d: 3.5, sp: 1.3, color: 0x22C55E },
      { z: L * 0.89, x0: -4, x1: 4, w: 3, d: 3.5, sp: 1.4, color: 0x22C55E },
    ],
    sweepers: [{ z: L * 0.30, sp: 2.6 }, { z: L * 0.48, sp: -3.0 }, { z: L * 0.65, sp: 3.2 }, { z: L * 0.82, sp: -3.5 }],
    pendulums: [{ z: L * 0.45, amp: 1.1, sp: 2.0 }, { z: L * 0.80, amp: 1.2, sp: 2.4 }],
    finishText: 'SURVIVED 💀', killY: -30,
  });
}
