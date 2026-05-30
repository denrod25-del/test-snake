import type { Challenge } from "@/data/catalog";
import { lessonTopicsBySlug } from "@/data/lesson-topics";
import { DEEP_REGISTRY } from "@/data/lessons/deep-registry";
import { parseTopicLabel } from "@/data/lessons/parse-topic";

const genericTopics = [
  "Design note",
  "Regression guard",
  "Test harness tweak",
  "Edge case sweep",
  "Refactor for clarity",
  "Instrumentation",
  "Integration checkpoint",
  "Failure mode",
  "Performance pass",
  "API polish",
  "Documentation & DX",
  "Release readiness",
];

export type LessonCopy = {
  stage: number;
  title: string;
  focus: string;
  paragraphs: string[];
  objectives: string[];
};

function topicForStage(slug: string, stage: number): string {
  const list = lessonTopicsBySlug[slug] ?? genericTopics;
  const idx = (stage - 1) % list.length;
  const cycle = Math.floor((stage - 1) / list.length);
  const base = list[idx]!;
  return cycle === 0 ? base : `${base} (deepening ${cycle + 1})`;
}

export function buildLessonCopy(
  challenge: Challenge,
  stage: number,
): LessonCopy {
  const topic = topicForStage(challenge.slug, stage);
  const title = `Stage ${stage}: ${topic}`;
  const focus = topic;

  const { base, deepeningLevel } = parseTopicLabel(topic);
  const block = DEEP_REGISTRY[challenge.slug]?.[base];

  let paragraphs: string[];
  let objectives: string[];

  if (block) {
    paragraphs = [...block.paragraphs];
    if (
      deepeningLevel >= 2 &&
      block.lapParagraphs &&
      block.lapParagraphs.length > 0
    ) {
      const lapIdx = deepeningLevel - 2;
      const lap =
        block.lapParagraphs[
          lapIdx < block.lapParagraphs.length ? lapIdx : block.lapParagraphs.length - 1
        ];
      if (lap.length) paragraphs = [...paragraphs, ...lap];
    }
    objectives = [...block.objectives];
  } else {
    paragraphs = [
      `You are working on "${challenge.title}". This stage centers on ${base}, keyed to the syllabus topic list rather than filler copy.`,
      `Keep deltas small enough to explain in one commit message: satisfy the failing tests first, then refine structure before advancing.`,
      stage < challenge.stages
        ? `After green: stage ${stage + 1} shifts emphasis again—reuse the discipline of reading failures literally before refactoring.`
        : `Final stage—tighten error messages and docs once the suite stays green.`,
    ];

    objectives = [
      `Map how ${base} connects to neighboring stages in "${challenge.title}".`,
      `Pass automation without weakening assertions or skipping fixtures.`,
      `Capture one maintainer-facing note wherever future regressions are likely.`,
    ];
  }

  return { stage, title, focus, paragraphs, objectives };
}
