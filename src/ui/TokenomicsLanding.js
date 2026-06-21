// ============================================================
// STUMBLE PUMP — Tokenomics Landing (pre-boot)
// Full-screen premium landing shown BEFORE the loading screen, right after
// the health gate passes. Its "ENTER GAME →" button starts the real boot.
//
// Design: bright pump.fun palette (navy + mint + yellow), never flat black.
// Hero: a live-captured frame of the 3D character on its showcase stage
// (graceful fallback to logo.jpeg if capture isn't possible yet).
// ============================================================
import * as THREE from 'three';
import {
  SP, SEASON1_CAP, PRIZE_POOL_SEASON1, WITHDRAW_THRESHOLD,
  SP_WIN_REWARD, SP_QUALIFY_REWARD, SP_ELIM_REWARD,
  COIN_WIN_REWARD, CREATOR_FEE_PCT, TOURNAMENT_ENTRY_FEE,
  TOKEN_NAME, TOKEN_SYMBOL, CONTRACT_ADDRESS, CHAIN,
  TOKEN_DISTRIBUTION, TOURNAMENTS,
} from '../store/tokenomics.js';

let _el = null;
let _offscreen = null;   // { scene, camera, renderer, rig, char } for hero capture

// ---- off-screen hero capture ----
// Spin up a tiny dedicated WebGLRenderer + scene, spawn the shiller character
// on a hex stage, render one frame, and grab it as a data URL. This guarantees
// the hero always matches the actual in-game character look. If anything fails
// (no WebGL, OOM, etc.), we fall back to the logo.
function captureHero() {
  try {
    const W = 360, H = 480;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const gl = cv.getContext('webgl2', { alpha: true, antialias: true, preserveDrawingBuffer: true })
            || cv.getContext('webgl', { alpha: true, antialias: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error('no webgl');
    const renderer = new THREE.WebGLRenderer({ canvas: cv, context: gl, alpha: true, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    // Bright pump.fun sky gradient as the hero backdrop (navy→mint glow)
    scene.background = new THREE.Color(0x1B2A4E);

    const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
    camera.position.set(0, 2.4, 6.5);
    camera.lookAt(0, 1.4, 0);

    // Lighting rig (cheerful sunny day)
    scene.add(new THREE.HemisphereLight(0xFFFFFF, 0x4466AA, 1.1));
    const sun = new THREE.DirectionalLight(0xFFF4E0, 2.4);
    sun.position.set(4, 8, 6); scene.add(sun);
    const rim = new THREE.DirectionalLight(0xFFEECC, 0.7);
    rim.position.set(-6, 4, -4); scene.add(rim);

    // Hex showcase stage (matches buildPreview proportions)
    const mint = 0x5FCB88, mintDk = 0x2FAE6A, yellow = 0xFFD23F, edge = 0xFF8A3D;
    const stage = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 3.2, 1.2, 6),
      new THREE.MeshStandardMaterial({ color: mint, roughness: 0.5 })
    );
    stage.position.y = -0.6; stage.receiveShadow = true;
    scene.add(stage);
    const trim = new THREE.Mesh(
      new THREE.TorusGeometry(3, 0.11, 8, 6),
      new THREE.MeshStandardMaterial({ color: yellow, roughness: 0.4 })
    );
    trim.rotation.x = -Math.PI / 2; trim.position.y = 0.02; scene.add(trim);

    // Character — use CharacterRig (no animation system needed for a still frame)
    import('../character/CharacterRig.js').then(({ CharacterRig }) => {
      try {
        const rig = new CharacterRig('shiller', true);
        rig.root.position.set(0, 0.4, 0);
        scene.add(rig.root);
        renderer.render(scene, camera);
        _applyHero(cv.toDataURL('image/png'));
      } catch (e) {
        console.warn('[landing] character capture failed, using logo', e);
        _applyHeroLogo();
      }
    }).catch(() => _applyHeroLogo());

    // Even before the character resolves, render the stage+sky as a base
    renderer.render(scene, camera);
    _offscreen = { scene, camera, renderer };
  } catch (e) {
    console.warn('[landing] hero capture init failed', e);
    _applyHeroLogo();
  }
}

function _applyHero(dataUrl) {
  const img = _el?.querySelector('#tl-hero-img');
  if (img && dataUrl) { img.src = dataUrl; img.classList.remove('hidden'); }
  const logo = _el?.querySelector('#tl-hero-logo-fallback');
  if (logo) logo.classList.add('hidden');
}

function _applyHeroLogo() {
  // Keep the logo fallback visible (set in HTML by default)
  const img = _el?.querySelector('#tl-hero-img');
  if (img) img.classList.add('hidden');
  const logo = _el?.querySelector('#tl-hero-logo-fallback');
  if (logo) logo.classList.remove('hidden');
}

// ---- format helpers ----
const fmt = (n) => n.toLocaleString();
const fmtK = (n) => n >= 1_000_000 ? (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M' : (n >= 1000 ? (n / 1000).toFixed(0) + 'K' : '' + n);

// ---- build DOM ----
function _build(onEnter) {
  if (_el) return;
  _el = document.createElement('div');
  _el.id = 'tokenomics-landing';
  _el.innerHTML = `
    <div class="tl-scroll">
      <!-- HERO -->
      <section class="tl-hero">
        <div class="tl-hero-bg"></div>
        <div class="tl-hero-inner">
          <div class="tl-hero-left">
            <div class="tl-badge"><span class="tl-badge-dot"></span> SEASON 1 · LIVE</div>
            <h1 class="tl-hero-title">STUMBLE <span class="tl-accent">PUMP</span></h1>
            <div class="tl-hero-sub">${TOKEN_SYMBOL} · PLAY-TO-EARN PARTY ROYALE</div>
            <p class="tl-hero-tagline">
              Win matches, stack <strong>$SP</strong>, and withdraw to your Solana wallet.
              <strong>100% creator-fee funded</strong> — every reward comes from a real, auditable prize pool.
            </p>
            <div class="tl-hero-stats">
              <div class="tl-hs"><div class="tl-hs-v tl-mint">${fmtK(PRIZE_POOL_SEASON1)}</div><div class="tl-hs-l">Prize Pool</div></div>
              <div class="tl-hs"><div class="tl-hs-v tl-yellow">${fmtK(SEASON1_CAP)}</div><div class="tl-hs-l">Total Supply</div></div>
              <div class="tl-hs"><div class="tl-hs-v tl-blue">${CHAIN.split(' ')[0]}</div><div class="tl-hs-l">Chain</div></div>
              <div class="tl-hs"><div class="tl-hs-v tl-lime">+${SP_WIN_REWARD}</div><div class="tl-hs-l">Per Win</div></div>
            </div>
            <button class="tl-enter-btn" id="tl-enter">ENTER GAME →</button>
            <div class="tl-ca">CA: <span class="tl-ca-val">${CONTRACT_ADDRESS}</span></div>
          </div>
          <div class="tl-hero-right">
            <div class="tl-hero-frame">
              <img id="tl-hero-img" class="hidden" alt="" />
              <img id="tl-hero-logo-fallback" src="/textures/logo.jpeg" alt="STUMBLE PUMP" />
              <div class="tl-hero-glow"></div>
            </div>
            <div class="tl-hero-card">
              <div class="tl-hc-row"><span>🎮 Win</span><strong>+${SP_WIN_REWARD} $SP · ${COIN_WIN_REWARD} coins</strong></div>
              <div class="tl-hc-row"><span>✅ Qualify</span><strong>+${SP_QUALIFY_REWARD} $SP</strong></div>
              <div class="tl-hc-row"><span>🎮 Participate</span><strong>+${SP_ELIM_REWARD} $SP</strong></div>
            </div>
          </div>
        </div>
      </section>

      <!-- HOW IT WORKS -->
      <section class="tl-section">
        <h2 class="tl-section-title">How It Works</h2>
        <div class="tl-steps">
          ${SP.howItWorks().map((s) => `
            <div class="tl-step">
              <div class="tl-step-num">${s.step}</div>
              <div class="tl-step-ico">${s.icon}</div>
              <div class="tl-step-body"><strong>${s.title}</strong><p>${s.body}</p></div>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- PRIZE POOL -->
      <section class="tl-section tl-section-pool">
        <h2 class="tl-section-title">🏆 Creator-Fee Prize Pool</h2>
        <div class="tl-pool-hero">
          <div class="tl-pool-amount">${fmt(PRIZE_POOL_SEASON1)}<span>$SP</span></div>
          <div class="tl-pool-label">FUNDED BY ${CREATOR_FEE_PCT}% CREATOR FEE · NO AIRDROPS</div>
          <div class="tl-split">
            ${SP.prizePool().split.map((s) => `
              <div class="tl-split-row">
                <span class="tl-split-dot" style="background:${s.color}"></span>
                <span class="tl-split-label">${s.label}</span>
                <div class="tl-split-bar"><div class="tl-split-fill" style="width:${s.pct * 100}%;background:${s.color}"></div></div>
                <span class="tl-split-pct">${Math.round(s.pct * 100)}%</span>
              </div>
            `).join('')}
          </div>
        </div>
      </section>

      <!-- TOURNAMENTS -->
      <section class="tl-section">
        <h2 class="tl-section-title">🏟️ Weekly Tournaments</h2>
        <div class="tl-tour-grid">
          ${TOURNAMENTS.map((t) => `
            <div class="tl-tour">
              <div class="tl-tour-day">${t.day}<small>${t.time}</small></div>
              <div class="tl-tour-mid"><strong>${t.name}</strong><span>${t.players} players · entry ${fmt(TOURNAMENT_ENTRY_FEE)} $SP</span></div>
              <div class="tl-tour-prize">${fmtK(t.prize)}<small>$SP</small></div>
            </div>
          `).join('')}
        </div>
        <p class="tl-note">Hosted on the official <strong>@stumble</strong> X account. Public results, transparent splits.</p>
      </section>

      <!-- TOKEN DOCS -->
      <section class="tl-section">
        <h2 class="tl-section-title">📜 Tokenomics</h2>
        <div class="tl-dist">
          ${TOKEN_DISTRIBUTION.map((d) => `
            <div class="tl-dist-row">
              <span class="tl-dist-dot" style="background:${d.color}"></span>
              <div class="tl-dist-info">
                <div class="tl-dist-top"><strong>${d.label}</strong><span>${d.pct}%</span></div>
                <div class="tl-dist-bar"><div class="tl-dist-fill" style="width:${d.pct}%;background:${d.color}"></div></div>
                <div class="tl-dist-note">${d.note} · ${fmt(Math.round(SEASON1_CAP * d.pct / 100))} $SP</div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="tl-kv">
          <div class="tl-kv-row"><span>Token</span><strong>${TOKEN_NAME} (${TOKEN_SYMBOL})</strong></div>
          <div class="tl-kv-row"><span>Total Supply</span><strong>${fmt(SEASON1_CAP)} $SP</strong></div>
          <div class="tl-kv-row"><span>Prize Pool</span><strong>${fmt(PRIZE_POOL_SEASON1)} $SP</strong></div>
          <div class="tl-kv-row"><span>Withdraw Threshold</span><strong>${fmt(WITHDRAW_THRESHOLD)} $SP</strong></div>
          <div class="tl-kv-row"><span>Chain</span><strong>${CHAIN}</strong></div>
          <div class="tl-kv-row"><span>Contract Address</span><strong class="tl-ca-val">${CONTRACT_ADDRESS}</strong></div>
        </div>
      </section>

      <!-- FAQ -->
      <section class="tl-section">
        <h2 class="tl-section-title">❓ FAQ</h2>
        <div class="tl-faq">
          ${SP.faq().map((f, i) => `
            <details class="tl-faq-item"${i === 0 ? ' open' : ''}>
              <summary>${f.q}<span class="tl-chev">▾</span></summary>
              <p>${f.a}</p>
            </details>
          `).join('')}
        </div>
      </section>

      <!-- FOOTER CTA -->
      <section class="tl-footer">
        <button class="tl-enter-btn tl-enter-footer" id="tl-enter-foot">ENTER GAME →</button>
        <div class="tl-footer-note">By entering you agree to play fair. Anti-cheat rate limits apply.</div>
      </section>
    </div>
  `;
  document.body.appendChild(_el);
  _el.querySelector('#tl-enter').onclick = onEnter;
  _el.querySelector('#tl-enter-foot').onclick = onEnter;
}

export const TokenomicsLanding = {
  /** Show the landing. onEnter() is called when the user clicks ENTER GAME. */
  show(onEnter) {
    _build(() => {
      TokenomicsLanding.hide();
      // Defer one frame so the DOM removal settles before the heavy boot starts
      requestAnimationFrame(() => { try { onEnter(); } catch (e) { console.error('[landing] onEnter failed', e); } });
    });
    _el.classList.add('visible');
    document.body.classList.add('modal-open');
    // Attempt the live hero capture (async, non-blocking)
    captureHero();
  },

  hide() {
    if (!_el) return;
    _el.classList.remove('visible');
    document.body.classList.remove('modal-open');
    // Dispose the off-screen WebGL context if we made one
    if (_offscreen) {
      try { _offscreen.renderer.dispose(); } catch {}
      _offscreen = null;
    }
    // Remove from DOM after the exit animation so the game gets full focus
    setTimeout(() => { if (_el) { _el.remove(); _el = null; } }, 400);
  },
};
