# 🚀 STUMBLE PUMP

> **32 DEGENS enter. 1 PUMP KING leaves.**
> A WebGL party-royale game — a *Stumble Guys*-style clone reskinned with a **Solana / Pump.fun degen** theme. Built with **Three.js r165 + Rapier3D (WASM) + Vite**.

[![Stack](https://img.shields.io/badge/Three.js-r165-000000?logo=threedotjs&logoColor=white)]()
[![Rapier3D](https://img.shields.io/badge/Physics-Rapier3D%20WASM-3178C6)]()
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)]()
[![License](https://img.shields.io/badge/License-MIT-green)]()

---

## 📑 Daftar Isi

1. [Tentang Game](#-tentang-game)
2. [Quick Start](#-quick-start)
3. [Kontrol](#-kontrol)
4. [Cara Bermain](#-cara-bermain)
5. [Maps](#-maps)
6. [Karakter & Skins](#-karakter--skins)
7. [Arsitektur Proyek](#-arsitektur-proyek)
8. [Sistem Teknis](#-sistem-teknis)
9. [Development](#-development)
10. [Credits & Disclaimer](#-credits--disclaimer)

---

## 🎮 Tentang Game

**STUMBLE PUMP** adalah *party royale* kompetitif untuk 32 pemain dalam 3 ronde berturut-turut. Setiap ronde, setengah pemain tereliminasi — yang tersisa bertarung sampai hanya 1 **PUMP KING** tersisa.

| Fitur | Detail |
|---|---|
| **Mode** | Single-player vs 31 bot + matchmaking multiplayer via MQTT |
| **Ronde** | 3 ronde (32 → 16 → 8 → 1) |
| **Tipe Map** | Race to Finish + Survival (Don't Fall) |
| **Tema** | Crypto degen — bonding curves, rugpulls, moon missions, liquidations |
| **Rendering** | Three.js dengan **clean bright look** (tanpa neon/bloom — by design) |
| **Physics** | Rapier3D WASM, fixed-step 60Hz |
| **Persistensi** | 100% localStorage (tanpa backend server) |

---

## ⚡ Quick Start

### Prasyarat
- **Node.js** v18+ (dites di v24)
- **npm** v9+

### Install & Jalankan
```bash
# 1. Install dependencies
npm install

# 2. Jalankan dev server (hot reload)
npm run dev
# → buka http://localhost:5188

# 3. Build untuk produksi
npm run build

# 4. Preview build produksi
npm run preview
```

### Akun
- **Register** untuk simpan progres (username + password + opsional alamat Solana)
- **Play as Guest** untuk main instan tanpa simpanan
- Semua data tersimpan di `localStorage` browser Anda — tidak ada server

---

## 🎯 Kontrol

### Desktop
| Tombol | Aksi |
|---|---|
| `W` `A` `S` `D` / Arrow keys | Bergerak (relatif kamera) |
| `SPACE` | Lompat |
| `SHIFT` atau `CTRL` | Dive / Slide (dorong horizontal, lock 0.5s) |
| `E` | Emote |
| Mouse drag (klik tahan) | Orbit kamera |

### Mobile (landscape)
- **Joystick virtual** kiri → gerak
- **JUMP** / **DIVE** / **😎 EMOTE** tombol kanan
- Swipe dengan thumb kanan → rotate kamera

> 💡 Mobile: putar perangkat ke landscape untuk pengalaman terbaik.

---

## 🏆 Cara Bermain

1. **Main Menu** → klik **▶ PLAY** untuk masuk lobby
2. **Lobby** → tunggu 32 degen terisi (atau tekan **START WITH BOTS**)
3. **Roulette** → slot machine memilih map secara random
4. **Match** → ikuti tujuan map (reach finish atau survive)
5. **Result** → kualifikasi ke ronde berikutnya atau tereliminasi
6. **Winner** → pemenang terakhir dinobatkan **PUMP KING** 👑

### Ekonomi
- 🪙 **Coins**: reward setiap match (60 kualifikasi, 300 menang, 20 kalah)
- 💎 **Gems**: mata uang premium
- Gunakan coins di **LOCKER** untuk unlock skin KOL legendaris

---

## 🗺️ Maps

| Map | Tipe | Tujuan | Tantangan |
|---|---|---|---|
| 📈 **Bonding Curve Climb** | Race | 16 pertama ke puncak | Red candles, trampolines, 5 sweepers, 3 wrecking balls, 1 pit+mover |
| 🕳️ **Rugpull Roulette** | Survival | Bertahan 60 detik | Grid 7×7 platform yang jatuh progresif (permanent, no respawn) |
| 🌙 **Moon Mission** | Race | 16 pertama sampai bulan | 4 pit+mover, 4 wrecking balls, terrain curam |
| 💀 **Liquidation Lane** | Race | 16 pertama turun canyon | Sempit, 5 pit, lava, sweeper tercepat |

### Obstacles
- 🔴 **Red Candle** — rolling box, knock → ragdoll
- 🟢 **Green Trampoline** — bounce vertikal tinggi
- ⚙️ **Sweeper** — bar berputar, knock di ujung
- 🟣 **Pendulum** — wrecking ball ayun
- 🔵 **Mover Platform** — platform oscillating menjembatani pit
- ⬡ **Hex Platform** — platform survival (warn → fall → gone)

---

## 🦍 Karakter & Skins

Rig prosedural chibi humanoid (kepala besar, proporsi Stumble Guys) dibangun **100% dari kode Three.js** — tanpa file GLTF eksternal.

### Default Skins (free)
| Skin | Rarity | Ciri |
|---|---|---|
| 📢 **THE SHILLER** | Common | Jas biru + sunglasses + megaphone |
| 🥷 **DEV (SUS)** | Rare | Hoodie hitam + mask + mata hijau glow + laptop |
| 🤖 **TROJAN BOT** | Epic | Metal silver + visor merah + exhaust pipes |
| 🧻 **PAPERHAND** | Legendary | Krem + keringat animasi + tremble panic |

### KOL Caricature Skins (unlockable)
Karikatur prosedural dari tokoh crypto Solana, dibuat dari ciri visual khas mereka:

| Skin | Rarity | Cost | Karikatur |
|---|---|---|---|
| 🐳 **BLUE WHALE** | Legendary | 1200🪙 | Ansem (@blknoiz06) — cap + gold chain + skin tone warm |
| 🟣 **VALIDATOR** | Legendary | 1500🪙 | Toly (Anatoly Yakovenko) — bald + beard + glasses |
| 🧙 **RPC WIZARD** | Epic | 900🪙 | Mert (@ummtqt) — hoodie + round glasses + wizard hat |
| 🟠 **ORANGE PILLED** | Rare | 400🪙 | Orangie — all-orange + cap |
| 🚬 **CIGAR CHAD** | Epic | 800🪙 | Dark suit + gold tie + cigar + chain |
| 🥤 **THE CUP** | Epic | 800🪙 | Paper cup costume + straw |
| 📊 **PERCENT** | Rare | 450🪙 | Cented |
| 🐸 **FROG DEGEN** | Rare | 350🪙 | mr.frog |
| 💎 **DIAMOND HANDS** | Legendary | 2000🪙 | DiamondHands |

> Lihat bagian [Credits & Disclaimer](#-credits--disclaimer) untuk catatan penting tentang karikatur.

---

## 🏗️ Arsitektur Proyek

```
stumble-pump/
├── index.html                  # HTML overlay (semua screen DOM)
├── package.json                # three@0.165, rapier3d-compat, vite
├── vite.config.js              # config + rapier WASM exclude
├── /public/
│   ├── mqtt.min.js             # networking broker
│   └── /textures/logo.jpeg     # logo
├── /legacy/                    # backup versi lama single-file (app.js asli)
└── /src/
    ├── main.js                 # entry: init physics, boot loading, start loop
    ├── GameController.js       # orchestrator: mode hooks + camera + HUD + UI wiring
    ├── /core/
    │   ├── Engine.js           # renderer, scene, camera, lights, render loop, shake
    │   ├── PhysicsWorld.js     # Rapier3D WASM wrapper (fixed-step accumulator)
    │   ├── SceneManager.js     # FSM mode transitions + DOM screen show/hide
    │   ├── InputManager.js     # keyboard + touch joystick + mouse drag
    │   ├── AudioManager.js     # procedural Web Audio (SFX + ambient drone)
    │   ├── AssetFactory.js     # material lib, toon gradient, sky textures, billboards
    │   └── FX.js               # object-pooled particles (spark/dust/confetti)
    ├── /character/
    │   ├── CharacterRig.js     # procedural chibi bone rig + 9 skin variants
    │   ├── AnimationController.js  # 8-state bone tween (idle/run/jump/dive/...)
    │   ├── RagdollController.js    # procedural tumble + recover
    │   ├── Actor.js            # kinematic capsule + movement + collision
    │   ├── BotController.js    # bot spawn/skill helpers
    │   └── skins.js            # SKINS/EMOTES/TRAILS data
    ├── /levels/
    │   ├── env.js              # clearScene, grid floor, orbs, buildings, candles
    │   ├── raceCourse.js       # factory: build full race map from config
    │   ├── bondingCurve.js     # config: sigmoid uphill
    │   ├── moonMission.js      # config: linear uphill + 4 pits
    │   ├── liquidationLane.js  # config: downhill canyon + lava
    │   ├── rugpullRoulette.js  # survival: hex grid + rugpull mechanic
    │   └── lobby.js            # waiting platform (order-book floor)
    ├── /entities/
    │   ├── RedCandle.js        # rolling knock obstacle
    │   ├── GreenTrampoline.js  # bounce pad + squash
    │   ├── Sweeper.js          # rotating bar
    │   ├── Pendulum.js         # swinging wrecking ball
    │   ├── MoverPlatform.js    # oscillating bridge
    │   └── HexPlatform.js      # survival platform state machine
    ├── /net/
    │   └── NetManager.js       # MQTT presence + room matchmaking
    ├── /store/
    │   ├── auth.js             # localStorage profile
    │   ├── rooms.js            # room CRUD
    │   └── history.js          # match result log
    ├── /ui/
    │   └── ui.css              # design system + all screens
    └── /config/
        └── constants.js        # physics/match/net/camera/storage tunables
```

### State Machine (Game Flow)
```
boot → auth → menu ⇄ customize
                ↓ PLAY
              lobby → roulette → match → result → (roulette lagi | winner)
                                                  ↑_______↓
              rooms ⇄ room-waiting ──────────────┘
```

### Update Order (per frame)
```
input → fixed physics step (Rapier 60Hz) → mode update (FSM)
       → FX particles → camera follow → HUD update → render
```

---

## ⚙️ Sistem Teknis

### Physics (Rapier3D)
- **Engine**: `@dimforge/rapier3d-compat` v0.14 (WASM)
- **Timestep**: fixed 1/60s dengan accumulator (max 5 substeps)
- **Player/Bots**: kinematic-position-based capsule (radius 0.42) — movement code-driven untuk preserve feel
- **Terrain**: heightfield via `groundHeightAt(x,z)` (presisi pit/mover)
- **Collision**: ray cast untuk ground, sensor untuk obstacle triggers
- **Ragdoll**: procedural tumble (visual-only, duration 1.5s) — knock impulse + recover

### Rendering
- **Clean bright look** — ACES tone mapping, exposure 1.05, PCFSoft shadows 2048
- **NO post-processing/bloom** — by design (user preference: no neon)
- **3-light rig**: key DirectionalLight + Ambient + Hemisphere + rim
- **Toon shading**: 3-step gradient ramp untuk karakter
- **Pixel ratio**: capped 2 (desktop) / 1.5 (mobile)

### Networking
- **Broker**: public EMQX WebSocket (`wss://broker.emqx.io:8084/mqtt`)
- **Topics**: presence + room join/leave/start
- **Fallback**: jika MQTT gagal, game fully playable dengan bot saja
- ⚠️ Public broker = untuk prototyping, bukan produksi (no auth)

### Performance
- Object-pooled particles (200 spark / 120 dust / 400 confetti)
- Frustum culling default Three.js
- Dispose penuh geometry/material/body saat ganti map
- Shadow hanya 1 directional source

---

## 🛠️ Development

### Tuning Constants
Edit `src/config/constants.js`:
```js
GRAVITY = 23.0        // world gravity
MOVE_SPEED = 7.5      // max horizontal speed
JUMP_VELOCITY = 9.5   // jump impulse
DIVE_SPEED = 13.0     // dive horizontal impulse
```

### Tambah Map Baru
1. Buat config di `src/levels/myMap.js` (lihat `bondingCurve.js` sebagai template)
2. Untuk race: panggil `buildRaceCourse(cfg)` dengan obstacle configs
3. Untuk custom: tulis builder sendiri yang return map contract
4. Daftarkan di array `MAPS` di `GameController.js`

### Tambah Skin Baru
1. Tambah entry di `src/character/skins.js`
2. Tambah method `_mySkinExtras(s)` di `CharacterRig.js` dengan accessories
3. Daftarkan di `_applySkin(s)` switch

### Map Contract (untuk custom builder)
Setiap map harus return object dengan:
```js
{
  type: 'race' | 'survival',
  group: THREE.Group,
  killY: number,
  finishZ: number,              // race only
  qualifyTarget: number,
  spawnPoints: THREE.Vector3[],
  solidObstacles: [{x,z,y,r,h}],
  groundHeightAt(x, z): number | null,
  isWall(x, z): boolean,
  onFell(actor): void,
  checkActor(actor): void,
  update(dt, t): void,
  dispose(): void,
  // optional: solidGroundAt, isPitAt, safeTargetFor, surviveTime, length
}
```

### Debug
- Buka DevTools → Console untuk error capture
- `window` error overlay otomatis muncul jika ada script error
- Renderer info: `renderer.info` di console

---

## 📜 Credits & Disclaimer

### Tech Stack
- [Three.js](https://threejs.org/) r165 — 3D engine
- [Rapier3D](https://rapier.rs/) — physics engine (WASM)
- [Vite](https://vitejs.dev/) — build tool
- [MQTT.js](https://github.com/mqttjs/MQTT.js) — networking
- Fonts: Fredoka One, Inter (Google Fonts)

### Karikatur KOL
Skin karakter KOL adalah **karikatur parodi** berdasarkan persona publik tokoh crypto. Ciri visual (cap, beard, hoodie, dll) diimplementasikan prosedural sebagai **homage karikatural**, bukan reproduksi foto. Nama asli tidak digunakan — hanya archetype tema.

- **BLUE WHALE** terinspirasi Ansem (@blknoiz06) — trader Solana
- **VALIDATOR** terinspirasi Anatoly "Toly" Yakovenko — co-founder Solana
- **RPC WIZARD** terinspirasi Mert (@ummtqt) — Helius
- Karikatur lain berbasis archetype degen culture umum

### Disclaimer
> Game ini adalah **projek edukasi/portofolio** bertema parodi crypto culture. **Bukan** produk afiliasi resmi Stumble Guys, Solana, Pump.fun, atau tokoh yang diparodikan. Tidak ada transaksi keuangan nyata — "Solana wallet address" hanya field profil kosmetik. Networking pakai public broker untuk demo.

### Lisensi
MIT — bebas pakai, modifikasi, distribusi.

---

<p align="center">
  <b>🚀 WAGMI · 💎 HODL · 🌙 TO THE MOON</b><br>
  <sub>Made with Three.js + Rapier + too much cope</sub>
</p>
