// ============================================================
// STUMBLE PUMP — main.js (entry point)
// Robust boot: loading bar ALWAYS completes (graceful degradation
// if physics WASM fails), per-stage logging, defensive error handling
// so a single bad element never freezes the boot screen.
// ============================================================
import { init as initPhysics, isReady as physicsReady } from './core/PhysicsWorld.js';
import { setFrameCallback, startLoop, setQuality } from './core/Engine.js';
import { initMobileControls, mobileJumpBtn, mobileDiveBtn, mobileEmoteBtn } from './core/InputManager.js';
import { isMobile } from './config/constants.js';
import * as Auth from './store/auth.js';
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
    .then(() => {
      loader.finish();
      log('hiding loading screen…');
      if (!physicsReady()) {
        // physics failed to init — Actor bodies will be null but game can still
        // show menu screens (which only need rendering, not simulation).
        console.warn('[boot] physics NOT ready — entering screens in degraded mode');
      }
      hideLoadingScreen(() => {
        const prof = Auth.session();
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

boot();
