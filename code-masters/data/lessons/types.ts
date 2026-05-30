export type LessonTopicBlock = {
  /** Always three teaching paragraphs */
  paragraphs: readonly [string, string, string];
  /** deepening 2 → index 0, deepening 3 → index 1, … */
  lapParagraphs?: readonly (readonly string[])[];
  objectives: readonly [string, string, string];
};
