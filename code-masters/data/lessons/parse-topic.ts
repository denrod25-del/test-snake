/** Topic labels like `Foo (deepening 2)` come from `topicForStage`. */
export function parseTopicLabel(full: string): {
  base: string;
  deepeningLevel: number;
} {
  const m = /\s+\(deepening (\d+)\)\s*$/.exec(full);
  if (!m) return { base: full.trim(), deepeningLevel: 0 };
  return {
    base: full.slice(0, m.index).trim(),
    deepeningLevel: Number.parseInt(m[1], 10),
  };
}
