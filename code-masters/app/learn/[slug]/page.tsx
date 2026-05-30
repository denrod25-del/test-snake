import Link from "next/link";
import { notFound } from "next/navigation";
import { SyllabusPagination } from "@/components/SyllabusPagination";
import { SyllabusResume } from "@/components/SyllabusResume";
import { buildLessonCopy } from "@/data/lesson-copy";
import { getChallengeBySlug } from "@/data/catalog";
import {
  SYLLABUS_PAGE_SIZE,
  parsePageParam,
  syllabusPageSlice,
} from "@/lib/pagination";
import styles from "./page.module.css";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ track?: string; page?: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const challenge = getChallengeBySlug(slug);
  if (!challenge) return { title: "Challenge" };
  return {
    title: `${challenge.title} — lessons | Code Masters`,
    description: challenge.description,
  };
}

export default async function ChallengeSyllabusPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const trackSlug = query.track;
  const challenge = getChallengeBySlug(slug);
  if (!challenge) notFound();

  const qs = trackSlug ? `?track=${encodeURIComponent(trackSlug)}` : "";
  const rawPage = parsePageParam(query.page);
  const { page, totalPages, startStage, endStage } = syllabusPageSlice(
    challenge.stages,
    rawPage,
    SYLLABUS_PAGE_SIZE,
  );

  return (
    <main className={styles.main}>
      <div className={styles.inner}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className={styles.crumbSep} aria-hidden>
            /
          </span>
          <span>{challenge.title}</span>
        </nav>

        <header className={styles.header}>
          <h1 className={styles.title}>{challenge.title}</h1>
          <p className={styles.desc}>{challenge.description}</p>
          <p className={styles.meta}>
            {challenge.stages} stages
            {trackSlug && (
              <>
                {" · "}
                <span>
                  Track: <strong>{trackSlug}</strong>
                </span>
              </>
            )}
          </p>
          <p className={styles.hint}>
            Open any stage to read the lesson narrative. Earlier stages unlock context
            for later ones, but you can jump around—your runner is the source of truth.
          </p>
        </header>

        <SyllabusResume slug={challenge.slug} maxStage={challenge.stages} qsSuffix={qs} />

        <section aria-labelledby="syllabus-heading">
          <h2 id="syllabus-heading" className={styles.syllabusTitle}>
            Syllabus
          </h2>
          <p className={styles.sliceNote}>
            Stages{" "}
            <strong>{startStage}</strong>–<strong>{endStage}</strong>{" "}
            {totalPages > 1 && <>of {challenge.stages}</>}
          </p>
          <ol className={styles.stageList}>
            {Array.from(
              { length: endStage - startStage + 1 },
              (_, i) => startStage + i,
            ).map((stage) => {
              const preview = buildLessonCopy(challenge, stage);
              return (
                <li key={stage}>
                  <Link
                    href={`/learn/${challenge.slug}/${stage}${qs}`}
                    className={styles.stageLink}
                  >
                    <span className={styles.stageNum}>Stage {stage}</span>
                    <span className={styles.stageTitle}>{preview.focus}</span>
                  </Link>
                </li>
              );
            })}
          </ol>

          <SyllabusPagination
            slug={challenge.slug}
            track={trackSlug}
            page={page}
            totalPages={totalPages}
          />
        </section>
      </div>
    </main>
  );
}
