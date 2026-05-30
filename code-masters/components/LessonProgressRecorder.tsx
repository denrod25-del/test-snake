"use client";

import { useEffect } from "react";
import { persistStageVisited } from "@/lib/lesson-progress";

export function LessonProgressRecorder({
  slug,
  stage,
}: {
  slug: string;
  stage: number;
}) {
  useEffect(() => {
    persistStageVisited(slug, stage);
  }, [slug, stage]);
  return null;
}
