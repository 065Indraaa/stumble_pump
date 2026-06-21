// ============================================================
// STUMBLE PUMP — History store (D1-backed)
// Match results are recorded to + read from the Cloudflare D1 backend
// (functions/api/history). All methods are async.
// ============================================================
import { API } from './api.js';

export const History = {
  /** Fetch the current user's match history (newest first, last 50). */
  async all() {
    const r = await API.getHistory();
    return r.ok ? (r.history || []) : [];
  },

  /** Record a finished match. Returns the new match id. */
  async add(entry) {
    const r = await API.addHistory({
      ...entry,
      date: entry.date || new Date().toISOString(),
    });
    return r;
  },
};
