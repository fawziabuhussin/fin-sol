/** Kept so authenticated layouts can await a stable schema hook. */
export function ensureDbSchema() {
  return Promise.resolve();
}
