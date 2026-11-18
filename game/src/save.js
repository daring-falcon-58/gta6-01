// Save / load through localStorage: cash, story progress, health and
// position. Nothing leaves the browser; a save is a single JSON blob.
const KEY = 'solmar-bay-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({
      cash: state.cash | 0,
      missionIndex: state.missionIndex | 0,
      health: state.health | 0,
      x: +state.x.toFixed(1),
      z: +state.z.toFixed(1),
      savedAt: Date.now(),
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
