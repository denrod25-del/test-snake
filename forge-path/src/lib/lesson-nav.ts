import { CURRICULUM } from "@/curriculum";

export type LessonRef = { moduleId: string; lessonId: string };

export function allLessonsInOrder(): LessonRef[] {
  const out: LessonRef[] = [];
  for (const m of CURRICULUM) {
    for (const l of m.lessons) {
      out.push({ moduleId: m.id, lessonId: l.id });
    }
  }
  return out;
}

export function adjacentLessonPaths(
  moduleId: string,
  lessonId: string,
): { prev: string | null; next: string | null } {
  const order = allLessonsInOrder();
  const i = order.findIndex(
    (r) => r.moduleId === moduleId && r.lessonId === lessonId,
  );
  if (i < 0) return { prev: null, next: null };
  const prev = i > 0 ? order[i - 1] : null;
  const next = i < order.length - 1 ? order[i + 1] : null;
  return {
    prev: prev ? `/learn/${prev.moduleId}/${prev.lessonId}` : null,
    next: next ? `/learn/${next.moduleId}/${next.lessonId}` : null,
  };
}
