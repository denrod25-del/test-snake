export function lessonUnlocked(
  slug: string,
  lessons: { slug: string; order: number }[],
  completedSlugs: Set<string>,
): boolean {
  const sorted = [...lessons].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((l) => l.slug === slug);
  if (idx <= 0) return true;
  const prev = sorted[idx - 1];
  return prev ? completedSlugs.has(prev.slug) : true;
}
