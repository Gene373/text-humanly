// Лимит считается по календарному дню в московском времени (UTC+3).
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

export function currentDayKey(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + MSK_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

export function nextDayStartsAt(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + MSK_OFFSET_MS);
  shifted.setUTCHours(24, 0, 0, 0);
  return new Date(shifted.getTime() - MSK_OFFSET_MS);
}
