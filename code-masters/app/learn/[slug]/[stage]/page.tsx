import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonProgressRecorder } from "@/components/LessonProgressRecorder";
import { buildLessonCopy } from "@/data/lesson-copy";
import { getChallengeBySlug } from "@/data/catalog";
import styles from "./page.module.css";

type PageProps = {
  params: Promise<{ slug: string; stage: string }>;
  searchParams: Promise<{ track?: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { slug, stage } = await params;
  const challenge = getChallengeBySlug(slug);
  const n = Number.parseInt(stage, 10);
  if (!challenge || !Number.isFinite(n)) return { title: "Lesson" };
  const copy = buildLessonCopy(challenge, n);
  return {
    title: `${copy.title} | Code Masters`,
    description: copy.paragraphs[0],
  };
}

export default async function LessonPage({ params, searchParams }: PageProps) {
  const { slug, stage: stageParam } = await params;
  const { track: trackSlug } = await searchParams;
  const challenge = getChallengeBySlug(slug);
  const stage = Number.parseInt(stageParam, 10);

  if (!challenge || !Number.isFinite(stage) || stage < 1 || stage > challenge.stages) {
    notFound();
  }

  const copy = buildLessonCopy(challenge, stage);
  const qs = trackSlug ? `?track=${encodeURIComponent(trackSlug)}` : "";
  const baseLearn = `/learn/${challenge.slug}`;
  const prev = stage > 1 ? `${baseLearn}/${stage - 1}${qs}` : null;
  const next = stage < challenge.stages ? `${baseLearn}/${stage + 1}${qs}` : null;

  return (
    <main className={styles.main}>
      <LessonProgressRecorder slug={challenge.slug} stage={stage} />

      <article className={styles.article}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className={styles.crumbSep} aria-hidden>
            /
          </span>
          <Link href={`${baseLearn}${qs}`}>{challenge.title}</Link>
          <span className={styles.crumbSep} aria-hidden>
            /
          </span>
          <span>Stage {stage}</span>
        </nav>

        {trackSlug && (
          <p className={styles.trackBanner}>
            Language track: <strong>{trackSlug}</strong>
          </p>
        )}

        <header className={styles.header}>
          <p className={styles.kicker}>Lesson</p>
          <h1 className={styles.title}>{copy.title}</h1>
        </header>

        <section className={styles.section} aria-labelledby="objectives">
          <h2 id="objectives" className={styles.h2}>
            Objectives
          </h2>
          <ul className={styles.list}>
            {copy.objectives.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="overview">
          <h2 id="overview" className={styles.h2}>
            Overview
          </h2>
          {copy.paragraphs.map((p, i) => (
            <p key={i} className={styles.p}>
              {p}
            </p>
          ))}
        </section>

        <nav className={styles.lessonNav} aria-label="Lesson pagination">
          {prev ? (
            <Link href={prev} className={styles.navBtn}>
              ← Previous stage
            </Link>
          ) : (
            <span className={styles.navSpacer} />
          )}
          <Link href={`${baseLearn}${qs}`} className={styles.navOutline}>
            All stages
          </Link>
          {next ? (
            <Link href={next} className={styles.navBtn}>
              Next stage →
            </Link>
          ) : (
            <span className={styles.navSpacer} />
          )}
        </nav>
      </article>
    </main>
  );
}
