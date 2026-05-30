import Link from "next/link";
import { notFound } from "next/navigation";
import { challenges, getLanguageBySlug } from "@/data/catalog";
import styles from "./page.module.css";

type PageProps = {
  params: Promise<{ lang: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { lang } = await params;
  const track = getLanguageBySlug(lang);
  if (!track) return { title: "Track" };
  return {
    title: `${track.name} track — Code Masters`,
    description: `Study any challenge with the ${track.name} language track.`,
  };
}

export default async function TrackPage({ params }: PageProps) {
  const { lang } = await params;
  const track = getLanguageBySlug(lang);
  if (!track) notFound();

  const qs = `?track=${encodeURIComponent(track.slug)}`;

  return (
    <main className={styles.main}>
      <div className={styles.inner}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className={styles.crumbSep} aria-hidden>
            /
          </span>
          <span>{track.name}</span>
        </nav>

        <header className={styles.header}>
          <p className={styles.kicker}>Language track</p>
          <h1 className={styles.title}>{track.name}</h1>
          <p className={styles.desc}>
            This track pairs the same challenge spine with {track.name} ergonomics and
            tooling. Pick a challenge to open its syllabus—your track choice is preserved
            as a query string so future lessons can specialize hints later.
          </p>
          <p className={styles.meta}>{track.stages} aggregate stages across catalog</p>
        </header>

        <section aria-labelledby="pick-heading">
          <h2 id="pick-heading" className={styles.h2}>
            Choose a challenge
          </h2>
          <ul className={styles.grid}>
            {challenges.map((c) => (
              <li key={c.slug}>
                <Link href={`/learn/${c.slug}${qs}`} className={styles.card}>
                  <span className={styles.cardTitle}>{c.title}</span>
                  <span className={styles.cardMeta}>{c.stages} stages</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
