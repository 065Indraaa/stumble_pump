// ============================================================
// STUMBLE PUMP — Tokenomics Landing Modal
// The trust-building centerpiece: full $SP economy breakdown with
// How It Works, earn rates, creator-fee prize pool transparency,
// tournament schedule, token distribution docs, and FAQ.
//
// Shown on first open after login (if onboarding unseen) and via
// the SEASON button. Premium, professional, no overlap — works on
// mobile portrait and desktop.
// ============================================================
import {
  SP,
  WITHDRAW_THRESHOLD,
  SEASON1_CAP,
  SP_WIN_REWARD,
  SP_QUALIFY_REWARD,
  SP_ELIM_REWARD,
  COIN_WIN_REWARD,
  PRIZE_POOL_SEASON1,
  CREATOR_FEE_PCT,
} from '../store/tokenomics.js';
import { SFX } from '../core/AudioManager.js';

let _el = null;
let _keyHandler = null;
let _unsubSP = null;
let _activeTab = 'overview';

const TABS = [
  { id: 'overview',    label: 'Overview' },
  { id: 'how',         label: 'How It Works' },
  { id: 'rewards',     label: 'Rewards' },
  { id: 'pool',        label: 'Prize Pool' },
  { id: 'tournaments', label: 'Tournaments' },
  { id: 'docs',        label: 'Tokenomics' },
  { id: 'faq',         label: 'FAQ' },
];

function _build() {
  if (_el) return;
  _el = document.createElement('div');
  _el.id = 'tokenomics-modal';
  _el.setAttribute('role', 'dialog');
  _el.setAttribute('aria-modal', 'true');
  _el.setAttribute('aria-label', '$SP Tokenomics');
  _el.innerHTML = `
    <div class="tm-backdrop" id="tm-backdrop"></div>
    <div class="tm-shell">
      <button class="tm-close" id="tm-close" aria-label="Close">✕</button>

      <!-- HERO -->
      <header class="tm-hero">
        <div class="tm-hero-bg"></div>
        <div class="tm-hero-content">
          <div class="tm-badge">SEASON 1 · LIVE</div>
          <div class="tm-hero-logo">
            <span class="tm-logo-glyph">$SP</span>
            <div class="tm-logo-info">
              <h1 class="tm-hero-title">STUMBLE PUMP TOKEN</h1>
              <p class="tm-hero-sub">PLAY · EARN · HOLD · WITHDRAW</p>
            </div>
          </div>
          <div class="tm-hero-tagline">
            A fully-transparent reward economy funded by creator fees.
            <strong>100% of rewards</strong> flow to players from a real prize pool.
          </div>
          <div class="tm-hero-stats" id="tm-hero-stats"></div>
        </div>
      </header>

      <!-- TAB BAR (scrollable on mobile) -->
      <nav class="tm-tabs" id="tm-tabs"></nav>

      <!-- SCROLLABLE BODY -->
      <div class="tm-body" id="tm-body"></div>

      <!-- FOOTER CTA -->
      <footer class="tm-footer">
        <button class="tm-btn tm-btn-ghost" id="tm-open-wallet">💰 OPEN WALLET</button>
        <button class="tm-btn tm-btn-primary" id="tm-got-it">LET'S PUMP 🚀</button>
      </footer>
    </div>
  `;
  document.body.appendChild(_el);

  // Tab buttons
  const tabsEl = _el.querySelector('#tm-tabs');
  TABS.forEach((t) => {
    const b = document.createElement('button');
    b.className = 'tm-tab';
    b.dataset.tab = t.id;
    b.textContent = t.label;
    b.onclick = () => _switchTab(t.id);
    tabsEl.appendChild(b);
  });

  // Events
  _el.querySelector('#tm-close').onclick = () => TokenomicsModal.hide();
  _el.querySelector('#tm-backdrop').onclick = () => TokenomicsModal.hide();
  _el.querySelector('#tm-got-it').onclick = () => TokenomicsModal.hide();
  _el.querySelector('#tm-open-wallet').onclick = () => {
    TokenomicsModal.hide();
    // Defer so this modal closes first
    setTimeout(() => {
      try {
        const evt = new CustomEvent('sp_open_wallet');
        window.dispatchEvent(evt);
      } catch (e) {}
    }, 340);
  };
}

function _switchTab(id) {
  if (!TABS.find((t) => t.id === id)) return;
  _activeTab = id;
  try { SFX.click(); } catch {}
  _el.querySelectorAll('.tm-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
  _renderBody();
}

// ---- Renderers per tab ----
function _renderHeroStats() {
  const el = _el.querySelector('#tm-hero-stats');
  if (!el) return;
  const season = SP.season();
  const pool = SP.prizePool();
  const stats = [
    { label: 'Your Balance',   value: SP.balance().toLocaleString(), unit: '$SP', accent: 'mint' },
    { label: 'Prize Pool',     value: pool.total.toLocaleString(),    unit: '$SP', accent: 'yellow' },
    { label: 'Season Supply',  value: (SEASON1_CAP / 1000) + 'K',     unit: '$SP', accent: 'blue' },
    { label: 'Win Reward',     value: '+' + SP_WIN_REWARD,            unit: '$SP', accent: 'lime' },
  ];
  el.innerHTML = stats.map((s) => `
    <div class="tm-hstat tm-hstat-${s.accent}">
      <div class="tm-hstat-val">${s.value}<span class="tm-hstat-unit">${s.unit}</span></div>
      <div class="tm-hstat-label">${s.label}</div>
    </div>
  `).join('');
}

function _renderBody() {
  const body = _el.querySelector('#tm-body');
  if (!body) return;
  body.scrollTop = 0;
  switch (_activeTab) {
    case 'overview':    body.innerHTML = _overviewHTML(); break;
    case 'how':         body.innerHTML = _howHTML(); break;
    case 'rewards':     body.innerHTML = _rewardsHTML(); break;
    case 'pool':        body.innerHTML = _poolHTML(); break;
    case 'tournaments': body.innerHTML = _tournamentsHTML(); break;
    case 'docs':        body.innerHTML = _docsHTML(); break;
    case 'faq':         body.innerHTML = _faqHTML(); break;
  }
}

function _overviewHTML() {
  const season = SP.season();
  const pool = SP.prizePool();
  const pct = SP.progressPct();
  const steps = SP.howItWorks().slice(0, 4);
  return `
    <section class="tm-card">
      <h2 class="tm-card-title">🚀 The Pump Begins</h2>
      <p class="tm-card-lead">
        Season 1 of STUMBLE PUMP introduces <strong>$SP</strong> — a real, withdrawable reward
        token for the world's most degen party royale. Win matches, stack $SP, and convert
        it to Solana SPL tokens. Simple, transparent, and funded by a real prize pool.
      </p>
      <div class="tm-feature-grid">
        <div class="tm-feature">
          <div class="tm-feature-ico mint">🎮</div>
          <div class="tm-feature-title">Play to Earn</div>
          <div class="tm-feature-body">Win matches for <strong>+${SP_WIN_REWARD} $SP</strong> + <strong>${COIN_WIN_REWARD} coins</strong></div>
        </div>
        <div class="tm-feature">
          <div class="tm-feature-ico yellow">🔒</div>
          <div class="tm-feature-title">Hold to Unlock</div>
          <div class="tm-feature-body">Reach <strong>${WITHDRAW_THRESHOLD.toLocaleString()} $SP</strong> to unlock withdrawals</div>
        </div>
        <div class="tm-feature">
          <div class="tm-feature-ico blue">⚡</div>
          <div class="tm-feature-title">Withdraw to SPL</div>
          <div class="tm-feature-body">Convert $SP → Solana SPL token in your wallet</div>
        </div>
        <div class="tm-feature">
          <div class="tm-feature-ico orange">🏆</div>
          <div class="tm-feature-title">Tournaments</div>
          <div class="tm-feature-body">Scheduled prize rooms on the official @stumble account</div>
        </div>
      </div>
    </section>

    <section class="tm-card">
      <h2 class="tm-card-title">📈 Your Progress</h2>
      <div class="tm-progress-block">
        <div class="tm-progress-row">
          <span>Withdrawal threshold</span>
          <span class="tm-progress-num">${SP.balance().toLocaleString()} / ${WITHDRAW_THRESHOLD.toLocaleString()} $SP</span>
        </div>
        <div class="tm-bar-track"><div class="tm-bar-fill" style="width:${pct}%"></div></div>
        <div class="tm-progress-foot">${pct}% toward unlock · win ${Math.max(0, Math.ceil((WITHDRAW_THRESHOLD - SP.balance()) / SP_WIN_REWARD))} more matches to withdraw</div>
      </div>
    </section>

    <section class="tm-card">
      <h2 class="tm-card-title">🔁 How It Works</h2>
      <div class="tm-how-mini">
        ${steps.map((s) => `
          <div class="tm-how-step-mini">
            <div class="tm-how-num">${s.step}</div>
            <div class="tm-how-ico">${s.icon}</div>
            <div class="tm-how-text"><strong>${s.title}</strong><span>${s.body}</span></div>
          </div>
        `).join('')}
      </div>
      <button class="tm-link-btn" data-goto="how">See full breakdown →</button>
    </section>
  `;
}

function _howHTML() {
  const steps = SP.howItWorks();
  return `
    <section class="tm-card">
      <h2 class="tm-card-title">How $SP Works</h2>
      <p class="tm-card-lead">A 4-step loop designed to reward skill and commitment. Every step is on-chain transparent.</p>
      <div class="tm-timeline">
        ${steps.map((s, i) => `
          <div class="tm-tl-item">
            <div class="tm-tl-rail"><div class="tm-tl-dot">${s.step}</div>${i < steps.length - 1 ? '<div class="tm-tl-line"></div>' : ''}</div>
            <div class="tm-tl-content">
              <div class="tm-tl-head"><span class="tm-tl-ico">${s.icon}</span><h3>${s.title}</h3></div>
              <p>${s.body}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </section>

    <section class="tm-card tm-trust">
      <h2 class="tm-card-title">🛡️ Why You Can Trust This</h2>
      <ul class="tm-trust-list">
        <li><span class="tm-check">✓</span> Rewards are funded by a <strong>${CREATOR_FEE_PCT}% creator fee</strong> routed to a real prize pool.</li>
        <li><span class="tm-check">✓</span> Prize pool is <strong>${PRIZE_POOL_SEASON1.toLocaleString()} $SP</strong>, distributed publicly to winners.</li>
        <li><span class="tm-check">✓</span> Anti-exploit rate limits prevent bot farming (max 500 $SP/hour, 20s cooldown).</li>
        <li><span class="tm-check">✓</span> Hard season cap of <strong>${SEASON1_CAP.toLocaleString()} $SP</strong> — no infinite minting.</li>
        <li><span class="tm-check">✓</span> Withdrawals are SPL on-chain — your keys, your coins, no custodian.</li>
      </ul>
    </section>
  `;
}

function _rewardsHTML() {
  const rows = [
    { icon: '🏆', label: 'Match Win',        sp: '+' + SP_WIN_REWARD,      coin: '+' + COIN_WIN_REWARD,    note: 'Final-round champion of a 3-round match', accent: 'yellow' },
    { icon: '✅', label: 'Round Qualified',  sp: '+' + SP_QUALIFY_REWARD,  coin: '+' + COIN_QUALIFY_REWARD, note: 'Each non-final round cleared', accent: 'mint' },
    { icon: '🎮', label: 'Participation',    sp: '+' + SP_ELIM_REWARD,     coin: '+' + COIN_ELIM_REWARD,    note: 'Even when you get rekt', accent: 'blue' },
  ];
  const season = SP.season();
  return `
    <section class="tm-card">
      <h2 class="tm-card-title">💰 Earn Rates</h2>
      <p class="tm-card-lead">Every outcome rewards both in-game coins (for skins/cosmetics) and $SP (the withdrawable token).</p>
      <div class="tm-reward-table">
        <div class="tm-rt-head">
          <span></span><span>Outcome</span><span>$SP</span><span>Coins</span>
        </div>
        ${rows.map((r) => `
          <div class="tm-rt-row">
            <span class="tm-rt-ico">${r.icon}</span>
            <span class="tm-rt-label">${r.label}<small>${r.note}</small></span>
            <span class="tm-rt-sp">${r.sp}</span>
            <span class="tm-rt-coin">${r.coin}</span>
          </div>
        `).join('')}
      </div>
    </section>

    <section class="tm-card">
      <h2 class="tm-card-title">📊 Season Status</h2>
      <div class="tm-stat-grid">
        <div class="tm-stat"><div class="tm-stat-val">${season.circulating.toLocaleString()}</div><div class="tm-stat-lbl">$SP Circulating</div></div>
        <div class="tm-stat"><div class="tm-stat-val">${season.remaining.toLocaleString()}</div><div class="tm-stat-lbl">$SP Remaining</div></div>
        <div class="tm-stat"><div class="tm-stat-val">${SP.totalEarned().toLocaleString()}</div><div class="tm-stat-lbl">You've Earned</div></div>
        <div class="tm-stat"><div class="tm-stat-val">${(season.cap / 1000)}K</div><div class="tm-stat-lbl">Season Cap</div></div>
      </div>
    </section>

    <section class="tm-card tm-note">
      <div class="tm-note-ico">💡</div>
      <div class="tm-note-text">
        <strong>No daily earn limits.</strong> Play as much as you want — the more you win, the more you stack.
        Anti-farm rate limits (20s cooldown, 500 $SP/hour) only stop bots, not real players.
      </div>
    </section>
  `;
}

function _poolHTML() {
  const pool = SP.prizePool();
  return `
    <section class="tm-card">
      <h2 class="tm-card-title">🏆 Creator-Fee Prize Pool</h2>
      <p class="tm-card-lead">
        This is the heart of $SP's trust model. <strong>100% of the platform creator fee
        (${CREATOR_FEE_PCT}%)</strong> is routed into this pool and paid out to winning players.
        Rewards are never minted from nothing — they come from here.
      </p>
      <div class="tm-pool-hero">
        <div class="tm-pool-amount">${pool.total.toLocaleString()}<span>$SP</span></div>
        <div class="tm-pool-label">TOTAL SEASON 1 PRIZE POOL</div>
        <div class="tm-pool-bar">
          <div class="tm-pool-bar-fill" style="width:${Math.round((pool.distributed / pool.total) * 100)}%"></div>
        </div>
        <div class="tm-pool-bar-meta">
          <span>Distributed: <strong>${pool.distributed.toLocaleString()}</strong></span>
          <span>Remaining: <strong>${pool.remaining.toLocaleString()}</strong></span>
        </div>
      </div>
    </section>

    <section class="tm-card">
      <h2 class="tm-card-title">📐 Distribution Split</h2>
      <div class="tm-split">
        ${pool.split.map((s) => `
          <div class="tm-split-row">
            <span class="tm-split-dot" style="background:${s.color}"></span>
            <span class="tm-split-label">${s.label}</span>
            <div class="tm-split-bar"><div class="tm-split-bar-fill" style="width:${s.pct * 100}%;background:${s.color}"></div></div>
            <span class="tm-split-pct">${Math.round(s.pct * 100)}%</span>
          </div>
        `).join('')}
      </div>
      <div class="tm-pool-math">
        <div class="tm-pool-math-row"><span>Match Winners (50%)</span><strong>${Math.round(pool.total * 0.50).toLocaleString()} $SP</strong></div>
        <div class="tm-pool-math-row"><span>Tournaments (35%)</span><strong>${Math.round(pool.total * 0.35).toLocaleString()} $SP</strong></div>
        <div class="tm-pool-math-row"><span>Airdrops (10%)</span><strong>${Math.round(pool.total * 0.10).toLocaleString()} $SP</strong></div>
        <div class="tm-pool-math-row"><span>Reserve (5%)</span><strong>${Math.round(pool.total * 0.05).toLocaleString()} $SP</strong></div>
      </div>
    </section>
  `;
}

function _tournamentsHTML() {
  const info = SP.tournamentInfo();
  return `
    <section class="tm-card">
      <h2 class="tm-card-title">🏟️ Tournament Rooms</h2>
      <p class="tm-card-lead">
        Scheduled weekly tournaments hosted on the official <strong>@stumble</strong> X account.
        Real prize pools, real competition, public results.
      </p>
      ${info.eligible
        ? `<div class="tm-eligible">✅ You're eligible — you hold ≥ ${info.minHold.toLocaleString()} $SP</div>`
        : `<div class="tm-ineligible">🔒 Hold ${info.minHold.toLocaleString()} $SP (you have ${SP.balance().toLocaleString()}) to enter tournaments</div>`}
      <div class="tm-tour-list">
        ${info.schedule.map((t) => `
          <div class="tm-tour-card">
            <div class="tm-tour-left">
              <div class="tm-tour-day">${t.day}</div>
              <div class="tm-tour-time">${t.time}</div>
            </div>
            <div class="tm-tour-mid">
              <div class="tm-tour-name">${t.name}</div>
              <div class="tm-tour-meta">${t.players} players · entry ${info.entryFee.toLocaleString()} $SP</div>
            </div>
            <div class="tm-tour-prize">
              <div class="tm-tour-prize-val">${t.prize.toLocaleString()}</div>
              <div class="tm-tour-prize-lbl">$SP PRIZE</div>
            </div>
          </div>
        `).join('')}
      </div>
    </section>

    <section class="tm-card tm-note">
      <div class="tm-note-ico">📱</div>
      <div class="tm-note-text">
        Follow <strong>@stumble</strong> on X for tournament announcements, bonus codes, and live
        prize updates. Tournament results are recorded to game history for full transparency.
      </div>
    </section>
  `;
}

function _docsHTML() {
  const dist = SP.distribution();
  return `
    <section class="tm-card">
      <h2 class="tm-card-title">📜 Token Distribution</h2>
      <p class="tm-card-lead">Season 1 total supply: <strong>${SEASON1_CAP.toLocaleString()} $SP</strong>. Allocated as follows:</p>
      <div class="tm-dist">
        ${dist.map((d) => `
          <div class="tm-dist-row">
            <span class="tm-dist-dot" style="background:${d.color}"></span>
            <div class="tm-dist-info">
              <div class="tm-dist-top"><strong>${d.label}</strong><span>${d.pct}%</span></div>
              <div class="tm-dist-bar"><div class="tm-dist-bar-fill" style="width:${d.pct}%;background:${d.color}"></div></div>
              <div class="tm-dist-note">${d.note} · ${(SEASON1_CAP * d.pct / 100).toLocaleString()} $SP</div>
            </div>
          </div>
        `).join('')}
      </div>
    </section>

    <section class="tm-card">
      <h2 class="tm-card-title">🔢 Key Numbers</h2>
      <div class="tm-kv">
        <div class="tm-kv-row"><span>Total Supply</span><strong>${SEASON1_CAP.toLocaleString()} $SP</strong></div>
        <div class="tm-kv-row"><span>Prize Pool</span><strong>${PRIZE_POOL_SEASON1.toLocaleString()} $SP</strong></div>
        <div class="tm-kv-row"><span>Creator Fee to Pool</span><strong>${CREATOR_FEE_PCT}%</strong></div>
        <div class="tm-kv-row"><span>Withdraw Threshold</span><strong>${WITHDRAW_THRESHOLD.toLocaleString()} $SP</strong></div>
        <div class="tm-kv-row"><span>Win Reward</span><strong>+${SP_WIN_REWARD} $SP</strong></div>
        <div class="tm-kv-row"><span>Chain</span><strong>Solana (SPL)</strong></div>
        <div class="tm-kv-row"><span>Season</span><strong>1 · The Pump Begins</strong></div>
      </div>
    </section>
  `;
}

function _faqHTML() {
  const faq = SP.faq();
  return `
    <section class="tm-card">
      <h2 class="tm-card-title">❓ Frequently Asked</h2>
      <div class="tm-faq">
        ${faq.map((f, i) => `
          <details class="tm-faq-item"${i === 0 ? ' open' : ''}>
            <summary class="tm-faq-q">${f.q}<span class="tm-faq-chev">▾</span></summary>
            <div class="tm-faq-a"><p>${f.a}</p></div>
          </details>
        `).join('')}
      </div>
    </section>
  `;
}

// ---- Public API ----
export const TokenomicsModal = {
  /** Show the tokenomics landing. Defaults to Overview tab. */
  show(tab = 'overview') {
    _build();
    _activeTab = TABS.find((t) => t.id === tab) ? tab : 'overview';
    _el.querySelectorAll('.tm-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === _activeTab));
    _renderHeroStats();
    _renderBody();
    _el.classList.remove('hidden');
    _el.classList.add('visible');
    document.body.classList.add('modal-open');
    const canvas = document.getElementById('game-canvas');
    if (canvas) canvas.style.filter = 'blur(6px) brightness(0.7)';
    _keyHandler = (e) => {
      if (e.key === 'Escape') TokenomicsModal.hide();
      if (e.key === 'ArrowRight') { const i = TABS.findIndex((t) => t.id === _activeTab); if (i < TABS.length - 1) _switchTab(TABS[i + 1].id); }
      if (e.key === 'ArrowLeft')  { const i = TABS.findIndex((t) => t.id === _activeTab); if (i > 0) _switchTab(TABS[i - 1].id); }
    };
    document.addEventListener('keydown', _keyHandler);
    // delegate for "data-goto" links inside body
    _el.querySelector('#tm-body').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-goto]');
      if (btn) _switchTab(btn.dataset.goto);
    });
    _unsubSP = SP.onUpdate(() => { _renderHeroStats(); if (_el.classList.contains('visible')) _renderBody(); });
  },

  hide() {
    if (!_el) return;
    _el.classList.remove('visible');
    _el.classList.add('hiding');
    document.body.classList.remove('modal-open');
    const canvas = document.getElementById('game-canvas');
    if (canvas) canvas.style.filter = '';
    if (_keyHandler) { document.removeEventListener('keydown', _keyHandler); _keyHandler = null; }
    if (_unsubSP) { _unsubSP(); _unsubSP = null; }
    setTimeout(() => { if (_el) { _el.classList.add('hidden'); _el.classList.remove('hiding'); } }, 300);
    try { SP.markOnboardingSeen(); } catch (e) {}
  },

  /** Auto-show on first login if onboarding hasn't been seen. */
  checkAndShow() {
    if (!SP.hasSeenOnboarding()) setTimeout(() => this.show('overview'), 600);
  },
};
