import { advancedModules } from "./modules/advanced";
import { backendModule } from "./modules/backend";
import { capstoneModule } from "./modules/capstone";
import { craftModule } from "./modules/craft";
import { dataModule } from "./modules/data";
import { frontendModule } from "./modules/frontend";
import { jsFoundationsModule } from "./modules/js-foundations";
import { reactNextModule } from "./modules/react-next";
import { webBasicsModule } from "./modules/web-basics";
import type { CourseModule, Lesson } from "./types";

export const CURRICULUM: CourseModule[] = [
  craftModule,
  webBasicsModule,
  jsFoundationsModule,
  frontendModule,
  reactNextModule,
  backendModule,
  dataModule,
  ...advancedModules,
  capstoneModule,
];

export type { CourseModule, Lesson, LessonBlock } from "./types";

export function getModule(moduleId: string): CourseModule | undefined {
  return CURRICULUM.find((m) => m.id === moduleId);
}

export function getLesson(
  moduleId: string,
  lessonId: string,
): Lesson | undefined {
  const mod = getModule(moduleId);
  return mod?.lessons.find((l) => l.id === lessonId);
}

export function moduleCompletionFraction(
  module: CourseModule,
  isComplete: (mid: string, lid: string) => boolean,
): number {
  if (module.lessons.length === 0) return 0;
  const done = module.lessons.filter((l) =>
    isComplete(module.id, l.id),
  ).length;
  return done / module.lessons.length;
}

export function overallCompletionFraction(
  isComplete: (mid: string, lid: string) => boolean,
): number {
  let total = 0;
  let done = 0;
  for (const m of CURRICULUM) {
    for (const l of m.lessons) {
      total += 1;
      if (isComplete(m.id, l.id)) done += 1;
    }
  }
  return total === 0 ? 0 : done / total;
}

export function firstIncompleteLessonPath(
  isComplete: (mid: string, lid: string) => boolean,
): string | null {
  for (const m of CURRICULUM) {
    for (const l of m.lessons) {
      if (!isComplete(m.id, l.id)) {
        return `/learn/${m.id}/${l.id}`;
      }
    }
  }
  return null;
}
