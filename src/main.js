// ============================================================
// STUMBLE PUMP — main.js (entry point)
// Boot sequence (D1-only, no localStorage fallback):
//   1. Health gate — ping /api/health. If it fails, show a persistent
//      "Connecting to server…" overlay (the game does NOT start without D1).
//   2. Tokenomics landing — full-screen premium landing shown FIRST (before
//      the loading screen). The "ENTER GAME →" button starts the real boot.
//   3. Loading bar + physics init (graceful degradation if WASM fails).
//   4. Auth check → menu (if logged in) or auth screen.
// ============================================================
import { init as initPhysics, isReady as physicsReady } from './core/PhysicsWorld.js';
import { setFrameCallback, startLoop, setQuality } from './core/Engine.js';
import { initMobileControls, mobileJumpBtn, mobileDiveBtn, mobileEmoteBtn } from './core/InputManager.js';
import { isMobile } from './config/constants.js';
import * as Auth from './store/auth.js';
import { API } from './store/api.js';
import {
  wireAll, frame, showAuth, enterMenu, applyProfile,
} from './GameController.js';

const MOBILE = isMobile();
const LOAD_TIPS = [
  'Loading degen physics…', 'Calibrating bonding curves…',
  'Charging the green candles…', 'Bribing the dev (sus)…',
  'Inflating the bags…', 'Aping in 3… 2… 1…', 'Summoning 32 degens…',
];

function log(msg) {
  console.log('[boot] ' + msg);
  const dbg = document.getElementById('boot-debug');
  if (dbg) dbg.textContent = msg;
}

// NOTE: The rotate-to-landscape prompt has been intentionally removed.
// The game is fully playable in portrait on mobile (vertical-first layout,
// portrait-friendly HUD + controls). We keep the element in the DOM but
// never force landscape, so users can hold the phone however they like.
function checkOrientation() {
  const rp = document.getElementById('rotate-prompt');
  if (rp) rp.classList.add('hidden');
}
window.addEventListener('orientationchange', () => setTimeout(checkOrientation, 100));
window.addEventListener('resize', checkOrientation);

// ---- loading bar controller (guaranteed to reach 100%) ----
function buildBootChart() {
  const el = document.getElementById('boot-chart');
  if (!el) return;
  const N = 44;
  let html = '';
  for (let i = 0; i < N; i++) {
    const red = Math.random() < 0.42;
    const delay = (i * 0.06).toFixed(2);
    html += `<div class="candle${red ? ' red' : ''}" style="animation-delay:${delay}s"></div>`;
  }
  el.innerHTML = html;
}

function startLoadingBar() {
  buildBootChart();
  const fill = document.getElementById('loader-fill');
  const pctEl = document.getElementById('loader-pct');
  const tipEl = document.getElementById('loader-tip');
  let p = 0, ti = 0;
  const tipIv = setInterval(() => {
    ti = (ti + 1) % LOAD_TIPS.length;
    if (tipEl) tipEl.textContent = LOAD_TIPS[ti];
  }, 700);
  const iv = setInterval(() => {
    p += 8 + Math.random() * 14;
    const capped = Math.min(100, p);
    if (fill) fill.style.width = capped + '%';
    if (pctEl) pctEl.textContent = Math.floor(capped) + '%';
    if (capped >= 100) clearInterval(iv);
  }, 110);
  return {
    finish() {
      clearInterval(iv); clearInterval(tipIv);
      if (fill) fill.style.width = '100%';
      if (pctEl) pctEl.textContent = '100%';
    },
  };
}

function hideLoadingScreen(after) {
  const ls = document.getElementById('loading-screen');
  if (!ls) { after(); return; }
  ls.style.transition = 'opacity .5s ease';
  ls.style.opacity = '0';
  setTimeout(() => {
    ls.classList.add('hidden');
    ls.style.opacity = '';
    after();
  }, 500);
}

// ============================================================
// STEP 1 — Health gate (D1-only requirement)
// ============================================================
async function healthGate() {
  // Try repeatedly for ~30s; the game refuses to start until D1 is reachable.
  for (let attempt = 1; attempt <= 60; attempt++) {
    const r = await API.health();
    if (r.ok) return true;
    setStatus(r.network ? `Connecting to server… (attempt ${attempt})` : `Server error: ${r.err}`);
    await new Promise((res) => setTimeout(res, 500));
  }
  setStatus('Could not reach the game server. Check your connection and reload.');
  return false;
}

function setStatus(msg) {
  const el = document.getElementById('boot-debug');
  if (el) el.textContent = msg;
  const tip = document.getElementById('loader-tip');
  if (tip) tip.textContent = msg;
}

// ============================================================
// STEP 3 — the actual game boot (physics, wiring, loop)
// ============================================================
function boot() {
  log('boot start');
  const loader = startLoadingBar();

  // 1. safe-wire input (must not throw the whole boot)
  try {
    initMobileControls();
    mobileJumpBtn(); mobileDiveBtn(); mobileEmoteBtn();
    log('input wired');
  } catch (e) { console.warn('[boot] input wiring failed (non-fatal)', e); }

  // 2. safe-wire game controller
  try {
    wireAll();
    log('game wired');
  } catch (e) {
    console.error('[boot] game wiring FAILED', e);
    showFatal('Game wiring error: ' + (e?.message || e));
    return;
  }

  checkOrientation();

  // 3. start render loop EARLY so canvas isn't black during physics init
  try {
    setFrameCallback(frame);
    startLoop();
    log('render loop started');
  } catch (e) { console.error('[boot] render loop failed', e); }

  // 4. init physics async — do NOT block loading; degrade gracefully if fails
  const physicsPromise = initPhysics().then(
    () => { log('physics ready'); },
    (e) => { console.error('[boot] physics init FAILED (degrading)', e); }
  );

  // 5. quality setting (deferred, non-blocking)
  try {
    const savedQuality = localStorage.getItem('stumblePump_quality') || 'high';
    setQuality(savedQuality);
  } catch (e) { /* default quality is fine */ }

  // 6. finish loading after min display duration AND physics resolved
  const minDisplay = new Promise((res) => setTimeout(res, 1400));
  Promise.all([physicsPromise, minDisplay])
    .then(async () => {
      loader.finish();
      log('hiding loading screen…');
      if (!physicsReady()) {
        // physics failed to init — Actor bodies will be null but game can still
        // show menu screens (which only need rendering, not simulation).
        console.warn('[boot] physics NOT ready — entering screens in degraded mode');
      }
      // Restore the session from the server (D1 is authoritative). If a token
      // exists in sessionStorage, /api/me rehydrates the profile; otherwise
      // the player lands on the auth screen.
      let prof = null;
      try {
        if (API.getToken?.()) prof = await Auth.me();
      } catch (e) { console.warn('[boot] session rehydrate failed', e); }
      hideLoadingScreen(() => {
        if (prof) {
          try { log('entering menu…'); applyProfile(prof); enterMenu(); }
          catch (e) { console.error('[boot] enterMenu failed', e); showFatal('Menu error: ' + (e?.message || e)); }
        } else {
          log('showing auth…');
          showAuth();
        }
        log('boot complete');
      });
    });
}

function showFatal(msg) {
  const o = document.getElementById('err-overlay');
  if (!o) { alert(msg); return; }
  o.style.display = 'flex';
  const m = document.getElementById('err-msg');
  if (m) m.textContent = msg;
}

window.addEventListener('error', (e) => {
  showFatal((e.message || (e.error && e.error.message) || 'Script error') + (e.filename ? ('\n@ ' + e.filename + ':' + e.lineno) : ''));
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[unhandledrejection]', e.reason);
});

// ============================================================
// ENTRY — health gate → tokenomics landing → ENTER GAME → boot()
// ============================================================
(async function start() {
  log('start: health gate');
  const ok = await healthGate();
  if (!ok) {
    const o = document.getElementById('err-overlay');
    if (o) {
      o.style.display = 'flex';
      const m = document.getElementById('err-msg');
      if (m) m.textContent = 'The game server is unreachable. Please check your connection and reload.';
    }
    return;
  }
  log('health OK — showing tokenomics landing');
  // The landing's "ENTER GAME" button calls window.__spBoot().
  window.__spBoot = boot;
  showTokenomicsLanding();
})();

// Lazy-load the tokenomics landing (kept out of the hot path so first paint
// isn't blocked by its module). Falls back to a direct boot if it fails.
async function showTokenomicsLanding() {
  try {
    const { TokenomicsLanding } = await import('./ui/TokenomicsLanding.js');
    TokenomicsLanding.show(() => {
      try { window.__spBoot(); } catch (e) { showFatal('Boot error: ' + (e?.message || e)); }
    });
  } catch (e) {
    console.warn('[boot] tokenomics landing failed to load, booting directly', e);
    boot();
  }
}
