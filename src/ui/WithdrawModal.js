// ============================================================
// STUMBLE PUMP — Withdraw Modal (D1-backed)
// Shows $SP balance, progress toward the 10,000 $SP threshold,
// pending withdraw requests, tx log, and the withdraw flow.
// Withdrawals are recorded to D1 for manual admin review; the on-chain
// SPL transfer happens after the admin approves.
// ============================================================
import {
  SP, WITHDRAW_THRESHOLD, SP_WIN_REWARD,
  CREATOR_FEE_PCT, PRIZE_POOL_SEASON1,
} from '../store/tokenomics.js';
import { API } from '../store/api.js';
import { SFX } from '../core/AudioManager.js';

let _el = null;
let _keyHandler = null;
let _unsubSP = null;

function _build() {
  if (_el) return;
  _el = document.createElement('div');
  _el.id = 'withdraw-modal';
  _el.setAttribute('role', 'dialog');
  _el.setAttribute('aria-modal', 'true');
  _el.setAttribute('aria-label', 'Withdraw $SP');
  _el.innerHTML = `
    <div class="wd-backdrop" id="wd-backdrop"></div>
    <div class="wd-card">
      <button class="wd-close" id="wd-close" aria-label="Close">✕</button>

      <!-- Header -->
      <div class="wd-header">
        <div class="wd-logo">$SP</div>
        <div class="wd-header-text">
          <div class="wd-title">Season 1 Wallet</div>
          <div class="wd-sub">STUMBLE PUMP TOKEN</div>
        </div>
        <button class="wd-info-btn" id="wd-info-btn" title="How rewards are funded">ℹ️</button>
      </div>

      <!-- Funding transparency banner -->
      <div class="wd-funding">
        <div class="wd-funding-row">
          <span class="wd-funding-ico">🏆</span>
          <span class="wd-funding-text">
            Rewards funded by a <strong>${CREATOR_FEE_PCT}% creator fee</strong> ·
            <strong>${PRIZE_POOL_SEASON1.toLocaleString()} $SP</strong> prize pool
          </span>
        </div>
      </div>

      <!-- Balance display -->
      <div class="wd-balance-wrap">
        <div class="wd-balance-label">YOUR BALANCE</div>
        <div class="wd-balance" id="wd-balance">0</div>
        <div class="wd-balance-sp">$SP</div>
      </div>

      <!-- Progress toward threshold -->
      <div class="wd-progress-wrap" id="wd-progress-section">
        <div class="wd-progress-row">
          <span class="wd-progress-label" id="wd-prog-label">Progress to withdraw unlock</span>
          <span class="wd-progress-pct" id="wd-prog-pct">0%</span>
        </div>
        <div class="wd-bar-track">
          <div class="wd-bar-fill" id="wd-bar-fill"></div>
          <div class="wd-bar-milestone"></div>
        </div>
        <div class="wd-threshold-hint" id="wd-thresh-hint">
          Need <strong id="wd-needed">10,000</strong> $SP to unlock withdrawal · Win matches to earn +${SP_WIN_REWARD} $SP each
        </div>
      </div>

      <!-- Withdraw section (shown when eligible) -->
      <div class="wd-withdraw-section hidden" id="wd-withdraw-section">
        <div class="wd-eligible-badge">✅ WITHDRAWAL UNLOCKED</div>
        <div class="wd-address-wrap">
          <label class="wd-address-label" for="wd-address">Solana Wallet Address</label>
          <input class="wd-address-input" id="wd-address" type="text" placeholder="Enter your Solana wallet address" maxlength="44" spellcheck="false" autocomplete="off" />
        </div>
        <button class="wd-btn wd-btn-withdraw" id="wd-submit">WITHDRAW ${WITHDRAW_THRESHOLD.toLocaleString()} $SP</button>
        <div class="wd-withdraw-note">
          Minimum withdrawal: ${WITHDRAW_THRESHOLD.toLocaleString()} $SP · Your full balance will be converted to SPL tokens and sent to your wallet. This action is irreversible.
        </div>
      </div>

      <!-- Pending withdraw notification -->
      <div class="wd-pending-wrap hidden" id="wd-pending-section">
        <div class="wd-pending-badge">⏳ WITHDRAW PENDING</div>
        <div class="wd-pending-text">Your withdraw request is queued. SPL tokens will be sent to your wallet once the backend processes the transaction.</div>
        <div class="wd-pending-list" id="wd-pending-list"></div>
      </div>

      <!-- Transaction history -->
      <div class="wd-txlog-wrap" id="wd-txlog-wrap">
        <div class="wd-section-title">RECENT EARNINGS</div>
        <div class="wd-txlog" id="wd-txlog"></div>
      </div>

      <!-- Season stats -->
      <div class="wd-season-wrap">
        <div class="wd-season-row">
          <span class="wd-season-label">Season</span>
          <span class="wd-season-val">Season 1 · The Pump Begins</span>
        </div>
        <div class="wd-season-row">
          <span class="wd-season-label">Total Earned</span>
          <span class="wd-season-val" id="wd-total-earned">0 $SP</span>
        </div>
        <div class="wd-season-row">
          <span class="wd-season-label">Season Cap</span>
          <span class="wd-season-val" id="wd-season-cap">1,000,000 $SP</span>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(_el);

  // Close buttons
  _el.querySelector('#wd-close').onclick = () => WithdrawModal.hide();
  _el.querySelector('#wd-backdrop').onclick = () => WithdrawModal.hide();

  // Withdraw submit
  _el.querySelector('#wd-submit').onclick = () => _submitWithdraw();

  // Info button → open TokenomicsModal on the Prize Pool tab
  const infoBtn = _el.querySelector('#wd-info-btn');
  if (infoBtn) infoBtn.onclick = () => {
    WithdrawModal.hide();
    setTimeout(() => {
      try {
        window.dispatchEvent(new CustomEvent('sp_open_tokenomics_pool'));
      } catch (e) {}
    }, 320);
  };
}

function _refresh() {
  if (!_el) return;
  const balance = SP.balance();
  const pct = SP.progressPct();
  const eligible = SP.canWithdraw();

  // Balance
  _el.querySelector('#wd-balance').textContent = balance.toLocaleString();

  // Progress bar
  const fill = _el.querySelector('#wd-bar-fill');
  if (fill) fill.style.width = pct + '%';
  const pctEl = _el.querySelector('#wd-prog-pct');
  if (pctEl) pctEl.textContent = pct + '%';

  // Threshold hint
  const needed = _el.querySelector('#wd-needed');
  if (needed) {
    const rem = Math.max(0, WITHDRAW_THRESHOLD - balance);
    needed.textContent = rem > 0 ? rem.toLocaleString() : '0';
  }

  // Total earned
  const earned = _el.querySelector('#wd-total-earned');
  if (earned) earned.textContent = SP.totalEarned().toLocaleString() + ' $SP';

  // ---- async bits: pending withdraws + tx log (from D1) ----
  API.me().then((r) => {
    if (!_el || !r.ok) return;
    const pending = (r.withdraw_history || []).filter((w) => w.status === 'pending');
    // Toggle sections
    const progSection = _el.querySelector('#wd-progress-section');
    const withdrawSection = _el.querySelector('#wd-withdraw-section');
    const pendingSection = _el.querySelector('#wd-pending-section');

    if (pending.length > 0) {
      if (progSection) progSection.classList.add('hidden');
      if (withdrawSection) withdrawSection.classList.add('hidden');
      if (pendingSection) {
        pendingSection.classList.remove('hidden');
        const list = _el.querySelector('#wd-pending-list');
        if (list) {
          list.innerHTML = pending.map(p => `
            <div class="wd-pending-item">
              <span class="wd-pending-amount">${p.amount.toLocaleString()} $SP</span>
              <span class="wd-pending-addr">${p.sol_address ? p.sol_address.slice(0, 8) + '…' + p.sol_address.slice(-4) : ''}</span>
              <span class="wd-pending-status">${(p.status || 'pending').toUpperCase()}</span>
            </div>
          `).join('');
        }
      }
    } else if (eligible) {
      if (progSection) progSection.classList.add('hidden');
      if (withdrawSection) withdrawSection.classList.remove('hidden');
      if (pendingSection) pendingSection.classList.add('hidden');
    } else {
      if (progSection) progSection.classList.remove('hidden');
      if (withdrawSection) withdrawSection.classList.add('hidden');
      if (pendingSection) pendingSection.classList.add('hidden');
    }
  }).catch(() => {});

  // TX log (async)
  SP.txLog().then((txs) => {
    const txLog = _el.querySelector('#wd-txlog');
    if (!txLog) return;
    const recent = (txs || []).slice(0, 8);
    txLog.innerHTML = recent.length === 0
      ? '<div class="wd-tx-empty">No earnings yet. Win your first match!</div>'
      : recent.map(tx => `
        <div class="wd-tx-row">
          <span class="wd-tx-icon">${tx.reason === 'win' ? '🏆' : tx.reason === 'qualify' ? '✅' : '🎮'}</span>
          <span class="wd-tx-reason">${_reasonLabel(tx.reason)}</span>
          <span class="wd-tx-amount">${tx.amount >= 0 ? '+' : ''}${tx.amount} $SP</span>
          <span class="wd-tx-date">${_relTime(tx.ts)}</span>
        </div>
      `).join('');
  });
}

function _reasonLabel(r) {
  return { win: 'Match Win', qualify: 'Round Qualified', participate: 'Participation', withdraw: 'Withdrawal', tournament_entry: 'Tournament Entry', refund: 'Refund' }[r] || r;
}

function _relTime(ts) {
  const s = Math.floor((Date.now() - (ts || Date.now())) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

async function _submitWithdraw() {
  const input = _el.querySelector('#wd-address');
  const addr = (input?.value || '').trim();
  if (!addr || addr.length < 32 || addr.length > 44) {
    _showError('Enter a valid Solana wallet address (32–44 characters).');
    return;
  }
  const btn = _el.querySelector('#wd-submit');
  if (btn) btn.disabled = true;
  try {
    const result = await SP.withdrawRequest(addr);
    if (!result.ok) {
      _showError(result.reason === 'below_threshold'
        ? `You need at least ${WITHDRAW_THRESHOLD.toLocaleString()} $SP to withdraw.`
        : (result.err || 'Withdrawal failed. Please try again.'));
      return;
    }
    try { SFX.qualify(); } catch {}
    _showSuccess(`Withdraw request submitted! ${result.amount.toLocaleString()} $SP → ${addr.slice(0, 6)}…${addr.slice(-4)}. An admin will review it.`);
    _refresh();
  } catch (e) {
    _showError('Network error — please retry.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function _showError(msg) {
  let toast = _el.querySelector('.wd-toast');
  if (!toast) { toast = document.createElement('div'); toast.className = 'wd-toast wd-toast-err'; _el.querySelector('.wd-card').appendChild(toast); }
  toast.textContent = msg;
  toast.className = 'wd-toast wd-toast-err visible';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('visible'), 3000);
}

function _showSuccess(msg) {
  let toast = _el.querySelector('.wd-toast');
  if (!toast) { toast = document.createElement('div'); toast.className = 'wd-toast wd-toast-ok'; _el.querySelector('.wd-card').appendChild(toast); }
  toast.textContent = msg;
  toast.className = 'wd-toast wd-toast-ok visible';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('visible'), 4000);
}

export const WithdrawModal = {
  show() {
    _build();
    _el.classList.remove('hidden');
    _el.classList.add('visible');
    _refresh();
    document.body.classList.add('modal-open');
    const canvas = document.getElementById('game-canvas');
    if (canvas) canvas.style.filter = 'blur(6px) brightness(0.7)';
    _keyHandler = e => { if (e.key === 'Escape') WithdrawModal.hide(); };
    document.addEventListener('keydown', _keyHandler);
    // Live balance updates
    _unsubSP = SP.onUpdate(() => _refresh());
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
    setTimeout(() => {
      if (_el) { _el.classList.add('hidden'); _el.classList.remove('hiding'); }
    }, 300);
  },

  /** Refresh displayed balance without opening the modal */
  refreshIfOpen() {
    if (_el && _el.classList.contains('visible')) _refresh();
  },
};
