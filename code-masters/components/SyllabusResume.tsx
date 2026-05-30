"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { readProgress, subscribeProgress } from "@/lib/lesson-progress";
import styles from "./SyllabusResume.module.css";

function stageForSlug(slug: string, maxStage: number): number | null {
  const saved = readProgress().bySlug[slug]?.stage;
  if (
    typeof saved !== "number" ||
    !Number.isFinite(saved) ||
    saved < 1 ||
    saved > maxStage
  ) {
    return null;
  }
  return saved;
}

export function SyllabusResume({
  slug,
  maxStage,
  qsSuffix,
}: {
  slug: string;
  maxStage: number;
  qsSuffix: string;
}) {
  const stage = useSyncExternalStore(
    subscribeProgress,
    () => stageForSlug(slug, maxStage),
    () => null,
  );

  if (stage == null) return null;

  return (
    <aside className={styles.wrap} aria-label="Saved progress">
      <p className={styles.line}>
        <strong>Continue</strong> where you left off:{" "}
        <Link
          href={`/learn/${slug}/${stage}${qsSuffix}`}
          className={styles.link}
        >
          Stage {stage}
        </Link>
      </p>
    </aside>
  );
}
