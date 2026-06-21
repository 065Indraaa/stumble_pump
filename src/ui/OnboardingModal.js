// ============================================================
// STUMBLE PUMP — Season 1 Onboarding Modal
// 5-slide interactive intro for new Season 1 players.
// Auto-triggers on first login; accessible via "SEASON" button.
// Background: existing Three.js canvas blurred via CSS.
// Swipe (touch) + keyboard + click navigation.
// ============================================================
import { SP } from '../store/tokenomics.js';
import { SFX } from '../core/AudioManager.js';

const SLIDES = [
  {
    icon: '🚀',
    label: 'SEASON 1',
    title: 'The Pump Begins',
    body: 'Season 1 is live. Race, survive, and climb the leaderboard across 4 crypto-themed arenas. Exclusive skins, $SP tokens, and glory await the champions.',
    accent: 'var(--mint)',
    bg: 'linear-gradient(135deg,rgba(47,174,106,0.18),rgba(163,230,53,0.10))',
  },
  {
    icon: '💰',
    label: 'EARN $SP',
    title: 'Win Matches, Stack Coins',
    body: 'Every match victory rewards you with <strong>+100 $SP</strong>. Qualify each round for bonus $SP. No daily limits — play more, earn more. Stack your bags.',
    accent: 'var(--yellow)',
    bg: 'linear-gradient(135deg,rgba(255,210,63,0.15),rgba(255,138,61,0.10))',
  },
  {
    icon: '🔒',
    label: 'HOLD TO WITHDRAW',
    title: 'Build Your Stack',
    body: 'Withdrawals unlock at a minimum of <strong>10,000 $SP</strong> in your in-game balance. Apes who sell too early never make it. Diamond hands get rewarded.',
    accent: 'var(--blue)',
    bg: 'linear-gradient(135deg,rgba(79,140,255,0.15),rgba(167,123,255,0.10))',
  },
  {
    icon: '⚡',
    label: 'WITHDRAW',
    title: 'Convert $SP to SPL Token',
    body: 'Once you hit 10,000 $SP, convert your earnings to $SP SPL tokens directly into your Solana wallet. No bridge, no middleman. Your keys, your coins.',
    accent: 'var(--lime)',
    bg: 'linear-gradient(135deg,rgba(163,230,53,0.15),rgba(95,203,136,0.10))',
  },
  {
    icon: '🏆',
    label: 'SEASONS & EVENTS',
    title: 'Season 1 Is Just the Start',
    body: 'Limited-time events, airdrop campaigns, and season rank rewards are coming. Season 1 is your earliest entry point. First movers get the best drops.',
    accent: 'var(--pink)',
    bg: 'linear-gradient(135deg,rgba(255,92,168,0.15),rgba(167,123,255,0.10))',
  },
];

let _el = null;
let _current = 0;
let _touchStartX = 0;
let _keyHandler = null;

// ---- Build DOM once ----
function _build() {
  if (_el) return;
  _el = document.createElement('div');
  _el.id = 'onboarding-modal';
  _el.setAttribute('role', 'dialog');
  _el.setAttribute('aria-modal', 'true');
  _el.setAttribute('aria-label', 'Season 1 Onboarding');
  _el.innerHTML = `
    <div class="ob-backdrop" id="ob-backdrop"></div>
    <div class="ob-card" id="ob-card">
      <button class="ob-close" id="ob-close" aria-label="Close">✕</button>
      <div class="ob-slides" id="ob-slides">
        ${SLIDES.map((s, i) => `
          <div class="ob-slide" data-index="${i}" aria-hidden="${i !== 0}">
            <div class="ob-slide-icon" style="color:${s.accent}">${s.icon}</div>
            <div class="ob-slide-label" style="color:${s.accent}">${s.label}</div>
            <div class="ob-slide-title">${s.title}</div>
            <div class="ob-slide-body">${s.body}</div>
          </div>
        `).join('')}
      </div>
      <div class="ob-progress" id="ob-progress">
        ${SLIDES.map((_, i) => `<button class="ob-dot ${i === 0 ? 'active' : ''}" data-dot="${i}" aria-label="Slide ${i + 1}"></button>`).join('')}
      </div>
      <div class="ob-actions">
        <button class="ob-btn ob-btn-prev" id="ob-prev" aria-label="Previous slide">← PREV</button>
        <button class="ob-btn ob-btn-next" id="ob-next" aria-label="Next slide">NEXT →</button>
        <button class="ob-btn ob-btn-start hidden" id="ob-start">🎮 LET'S PUMP</button>
      </div>
    </div>
  `;
  document.body.appendChild(_el);

  // Wire events
  _el.querySelector('#ob-close').onclick = () => OnboardingModal.hide();
  _el.querySelector('#ob-backdrop').onclick = () => OnboardingModal.hide();
  _el.querySelector('#ob-prev').onclick = () => _goTo(_current - 1);
  _el.querySelector('#ob-next').onclick = () => _goTo(_current + 1);
  _el.querySelector('#ob-start').onclick = () => OnboardingModal.hide();

  // Dot navigation
  _el.querySelectorAll('.ob-dot').forEach(btn => {
    btn.onclick = () => _goTo(+btn.dataset.dot);
  });

  // Touch swipe
  _el.querySelector('#ob-card').addEventListener('touchstart', e => {
    _touchStartX = e.touches[0].clientX;
  }, { passive: true });
  _el.querySelector('#ob-card').addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - _touchStartX;
    if (Math.abs(dx) > 40) _goTo(_current + (dx < 0 ? 1 : -1));
  }, { passive: true });

  // Set initial slide background
  _applySlideStyle(0);
}

function _goTo(idx) {
  const n = SLIDES.length;
  if (idx < 0 || idx >= n) return;
  try { SFX.click(); } catch {}
  const prev = _current;
  _current = idx;

  // Update slide visibility
  _el.querySelectorAll('.ob-slide').forEach((s, i) => {
    s.classList.toggle('active', i === idx);
    s.setAttribute('aria-hidden', String(i !== idx));
    // animate in/out direction
    if (i === idx) {
      s.style.animation = idx > prev
        ? 'ob-slide-in-right 0.32s cubic-bezier(.2,1.1,.3,1) forwards'
        : 'ob-slide-in-left 0.32s cubic-bezier(.2,1.1,.3,1) forwards';
    } else if (i === prev && prev !== -1) {
      s.style.animation = idx > prev
        ? 'ob-slide-out-left 0.32s cubic-bezier(.2,1.1,.3,1) forwards'
        : 'ob-slide-out-right 0.32s cubic-bezier(.2,1.1,.3,1) forwards';
    } else {
      s.style.animation = 'none';
    }
  });

  // Update dots
  _el.querySelectorAll('.ob-dot').forEach((d, i) => d.classList.toggle('active', i === idx));

  // Button state
  const prevBtn = _el.querySelector('#ob-prev');
  const nextBtn = _el.querySelector('#ob-next');
  const startBtn = _el.querySelector('#ob-start');
  const isFinal = idx === n - 1;
  prevBtn.classList.toggle('hidden', idx === 0);
  nextBtn.classList.toggle('hidden', isFinal);
  startBtn.classList.toggle('hidden', !isFinal);

  _applySlideStyle(idx);
}

function _applySlideStyle(idx) {
  const slide = SLIDES[idx];
  const card = _el.querySelector('#ob-card');
  card.style.setProperty('--ob-accent', slide.accent);
  card.style.background = `rgba(255,255,255,0.97)`;
  // Subtle bg tint via ::before using CSS variable (set inline won't work for pseudo — use data attr)
  card.dataset.slideBg = slide.bg;
}

// Keyboard navigation
function _addKeyHandler() {
  _keyHandler = e => {
    if (!_el || _el.classList.contains('hidden')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); _goTo(_current + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); _goTo(_current - 1); }
    if (e.key === 'Escape') { e.preventDefault(); OnboardingModal.hide(); }
  };
  document.addEventListener('keydown', _keyHandler);
}

function _removeKeyHandler() {
  if (_keyHandler) { document.removeEventListener('keydown', _keyHandler); _keyHandler = null; }
}

// ---- Public API ----
export const OnboardingModal = {
  /** Show the onboarding modal. Resets to slide 1. */
  show() {
    _build();
    _current = -1; // force _goTo to animate
    _goTo(0);
    _el.classList.remove('hidden');
    _el.classList.add('visible');
    _addKeyHandler();
    document.body.classList.add('modal-open');
    // Blur canvas
    const canvas = document.getElementById('game-canvas');
    if (canvas) canvas.style.filter = 'blur(6px) brightness(0.7)';
  },

  /** Hide and mark as seen */
  hide() {
    if (!_el) return;
    _el.classList.remove('visible');
    _el.classList.add('hiding');
    _removeKeyHandler();
    document.body.classList.remove('modal-open');
    const canvas = document.getElementById('game-canvas');
    if (canvas) canvas.style.filter = '';
    setTimeout(() => {
      if (_el) { _el.classList.add('hidden'); _el.classList.remove('hiding'); }
    }, 300);
    SP.markOnboardingSeen();
  },

  /** Auto-show if not seen yet for this account */
  checkAndShow() {
    if (!SP.hasSeenOnboarding()) {
      // Slight delay so the main menu is fully rendered first
      setTimeout(() => this.show(), 600);
    }
  },
};
