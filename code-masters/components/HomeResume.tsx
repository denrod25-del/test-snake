"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  readProgress,
  subscribeProgress,
} from "@/lib/lesson-progress";
import styles from "./HomeResume.module.css";

type ResumeRow = {
  slug: string;
  stage: number;
  title: string;
};

/** Cache snapshot identity — useSyncExternalStore requires stable references when data is unchanged. */
let resumeSnapshotCache: {
  digest: string;
  data: ResumeRow | null;
} = { digest: "__init__", data: null };

function getResumeSnapshot(titleBySlug: Record<string, string>): ResumeRow | null {
  const visit = readProgress().lastVisit;

  let digest: string;
  let row: ResumeRow | null;

  if (
    visit &&
    visit.slug in titleBySlug &&
    typeof visit.stage === "number" &&
    visit.stage >= 1
  ) {
    const title = titleBySlug[visit.slug] ?? visit.slug;
    digest = `${visit.slug}:${visit.stage}:${title}`;
    row = { slug: visit.slug, stage: visit.stage, title };
  } else {
    digest = "";
    row = null;
  }

  if (resumeSnapshotCache.digest === digest) {
    return resumeSnapshotCache.data;
  }

  resumeSnapshotCache = { digest, data: row };
  return row;
}

export function HomeResume({
  titleBySlug,
}: {
  titleBySlug: Record<string, string>;
}) {
  const last = useSyncExternalStore(
    subscribeProgress,
    () => getResumeSnapshot(titleBySlug),
    () => null,
  );

  if (!last) return null;

  return (
    <section className={styles.banner} aria-label="Resume lesson">
      <div className={styles.row}>
        <div>
          <p className={styles.kicker}>Resume</p>
          <p className={styles.title}>{last.title}</p>
          <p className={styles.meta}>Last opened · Stage {last.stage}</p>
        </div>
        <div className={styles.actions}>
          <Link className={styles.primary} href={`/learn/${last.slug}/${last.stage}`}>
            Continue lesson
          </Link>
          <Link className={styles.subtle} href={`/learn/${last.slug}`}>
            Syllabus
          </Link>
        </div>
      </div>
    </section>
  );
}
