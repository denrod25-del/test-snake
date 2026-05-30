import Link from "next/link";
import type { Challenge } from "@/data/catalog";
import styles from "./ChallengeGrid.module.css";

const badgeClassName: Record<NonNullable<Challenge["badge"]>, string> = {
  free: styles.badge_free,
  beta: styles.badge_beta,
  new: styles.badge_new,
};

function Badge({
  type,
  children,
}: {
  type: NonNullable<Challenge["badge"]>;
  children: React.ReactNode;
}) {
  return (
    <span className={`${styles.badge} ${badgeClassName[type]}`}>{children}</span>
  );
}

export function ChallengeGrid({ items }: { items: Challenge[] }) {
  return (
    <section id="catalog" className={styles.section} aria-labelledby="catalog-title">
      <div className={styles.head}>
        <h2 id="catalog-title" className={styles.heading}>
          Featured builds
        </h2>
        <p className={styles.sub}>
          Deep, stage-by-stage courses with automated checks—ship bite-sized commits
          until the protocol clicks.
        </p>
      </div>

      <ul className={styles.grid}>
        {items.map((item) => (
          <li key={item.slug}>
            <Link href={`/learn/${item.slug}`} className={styles.cardLink}>
              <article className={styles.card}>
                <div className={styles.cardTop}>
                  <h3 className={styles.cardTitle}>{item.title}</h3>
                  {(item.badge && item.badgeLabel) && (
                    <Badge type={item.badge}>{item.badgeLabel}</Badge>
                  )}
                </div>
                <p className={styles.cardBody}>{item.description}</p>
                <div className={styles.cardMeta}>
                  <span className={styles.stages}>{item.stages} stages</span>
                  <span className={styles.start}>Open lessons</span>
                </div>
              </article>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
