/** Normalize free-text drill answers: trim + lowercase. */
export function normalizeDrillAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\/+$/, "");
}

export function blankMatches(
  input: string,
  blank: { blank: string; accept?: string[] },
): boolean {
  const n = normalizeDrillAnswer(input);
  const primary = normalizeDrillAnswer(blank.blank);
  if (n === primary) return true;
  if (blank.accept?.length) {
    return blank.accept.some((a) => normalizeDrillAnswer(a) === n);
  }
  return false;
}

/** Fisher–Yates shuffle; ensures result !== avoid when possible (n > 1). */
export function shuffledOrder(
  correctOrder: number[],
): { order: number[] } {
  const n = correctOrder.length;
  const base = [...correctOrder];
  if (n <= 1) return { order: [...base] };

  let order: number[];
  let guard = 0;
  do {
    order = [...base];
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    guard++;
  } while (
    guard < 80 &&
    order.length === correctOrder.length &&
    order.every((v, i) => v === correctOrder[i])
  );

  return { order };
}
