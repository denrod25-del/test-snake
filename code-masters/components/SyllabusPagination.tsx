import Link from "next/link";
import styles from "./SyllabusPagination.module.css";

function buildHref(slug: string, pageNum: number, track?: string) {
  const q = new URLSearchParams();
  if (typeof track === "string" && track.length > 0) {
    q.set("track", track);
  }
  if (pageNum > 1) {
    q.set("page", String(pageNum));
  }
  const search = q.toString();
  return search ? `/learn/${slug}?${search}` : `/learn/${slug}`;
}

export function SyllabusPagination({
  slug,
  track,
  page,
  totalPages,
}: {
  slug: string;
  track?: string;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const prevHref = page > 1 ? buildHref(slug, page - 1, track) : null;
  const nextHref =
    page < totalPages ? buildHref(slug, page + 1, track) : null;

  return (
    <nav className={styles.nav} aria-label="Syllabus pages">
      {prevHref ? (
        <Link href={prevHref} className={styles.jump}>
          ← Previous
        </Link>
      ) : (
        <span className={styles.disabled}>← Previous</span>
      )}

      <span className={styles.indicator} aria-live="polite">
        Page {page} of {totalPages}
      </span>

      {nextHref ? (
        <Link href={nextHref} className={styles.jump}>
          Next →
        </Link>
      ) : (
        <span className={styles.disabled}>Next →</span>
      )}
    </nav>
  );
}
