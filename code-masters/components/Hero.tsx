import Link from "next/link";
import styles from "./Hero.module.css";

export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="challenges-heading">
      <div className={styles.eyebrow}>Build systems from first principles</div>
      <h1 id="challenges-heading" className={styles.title}>
        Challenges
      </h1>
      <p className={styles.lead}>
        New here?{" "}
        <Link href="#catalog" className={styles.inlineStrong}>
          Start here
        </Link>{" "}
        to see how stages, tests, and guided milestones fit together.
      </p>
    </section>
  );
}
