// ============================================================
// STUMBLE PUMP — History store (match result log)
// ============================================================
import { LS_HISTORY } from '../config/constants.js';

export const History = {
  all() { try { return JSON.parse(localStorage.getItem(LS_HISTORY)) || []; } catch (e) { return []; } },
  add(entry) {
    const list = this.all();
    list.unshift({ ...entry, date: entry.date || new Date().toISOString() });
    localStorage.setItem(LS_HISTORY, JSON.stringify(list.slice(0, 50)));
  },
};
