import Link from "next/link";
import type { LanguageTrack } from "@/data/catalog";
import styles from "./LanguageTracks.module.css";

export function LanguageTracks({ items }: { items: LanguageTrack[] }) {
  return (
    <section
      className={styles.section}
      aria-labelledby="languages-heading"
      id="languages"
    >
      <div className={styles.head}>
        <h2 id="languages-heading" className={styles.heading}>
          Language tracks
        </h2>
        <p className={styles.sub}>
          Pick a runtime you already love—or try a new one—with the same challenge
          spine across every track.
        </p>
      </div>

      <ul className={styles.grid}>
        {items.map((lang) => (
          <li key={lang.slug}>
            <article className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.langName}>
                  {lang.name}
                  {lang.popular && <span className={styles.popular}>Popular</span>}
                </div>
                <div className={styles.meta}>
                  {lang.stages} <span className={styles.stagesWord}>stages</span>
                </div>
              </div>
              <div className={styles.actions}>
                <Link href={`/tracks/${lang.slug}`} className={styles.start}>
                  Start
                </Link>
              </div>
            </article>
          </li>
        ))}
      </ul>

      <p id="pricing" className={styles.anchorNote}>
        <strong>Pricing:</strong> wire your plans page here when you are ready—this
        route is a static shell you can extend anytime.
      </p>
      <p id="roadmap" className={styles.anchorNote}>
        <strong>Roadmap:</strong> drop release notes or a public board link in place
        of this placeholder.
      </p>
      <p id="feedback" className={styles.feedback}>
        <strong>Feedback:</strong> send notes from your team chat or open an issue in
        your own repository—this demo route is static.
      </p>
    </section>
  );
}
