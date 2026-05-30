import { notFound } from "next/navigation";
import { getLesson } from "@/curriculum";
import { LessonRunner } from "@/components/LessonRunner";
import { adjacentLessonPaths } from "@/lib/lesson-nav";

type Props = { params: Promise<{ moduleId: string; lessonId: string }> };

export default async function LessonPage({ params }: Props) {
  const { moduleId, lessonId } = await params;
  const lesson = getLesson(moduleId, lessonId);
  if (!lesson) notFound();

  const { prev, next } = adjacentLessonPaths(moduleId, lessonId);

  return (
    <LessonRunner
      key={`${moduleId}-${lessonId}`}
      moduleId={moduleId}
      lesson={lesson}
      prevPath={prev}
      nextPath={next}
    />
  );
}
