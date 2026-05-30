/** Local calendar date YYYY-MM-DD (for streaks). */
export function localYmd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, day] = ymd.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  d.setDate(d.getDate() + delta);
  return localYmd(d);
}
