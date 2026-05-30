import Link from "next/link";
import styles from "./not-found.module.css";

export default function LearnNotFound() {
  return (
    <main className={styles.main}>
      <p className={styles.code}>Nothing here</p>
      <h1 className={styles.title}>Lesson or challenge missing</h1>
      <p className={styles.lead}>
        That URL does not match a staged challenge—or the lesson number lives outside
        the syllabus range.
      </p>
      <div className={styles.actions}>
        <Link href="/" className={styles.primary}>
          Back to catalog
        </Link>
        <Link href="/#languages" className={styles.subtle}>
          Language tracks
        </Link>
      </div>
    </main>
  );
}
