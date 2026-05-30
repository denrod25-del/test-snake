import Link from "next/link";
import { GitHubMark } from "@/components/icons/GitHubMark";
import styles from "./Header.module.css";

const GITHUB_LOGIN = "https://github.com/login";

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden />
          <span className={styles.brandText}>Code Masters</span>
        </Link>

        <nav className={styles.nav} aria-label="Primary">
          <Link href="/#catalog" className={styles.navLink}>
            Catalog
          </Link>
          <Link href="/#pricing" className={styles.navLink}>
            Pricing
          </Link>
          <Link href="/#roadmap" className={styles.navLink}>
            Roadmap
          </Link>        </nav>

        <div className={styles.actions}>
          <Link href="/#feedback" className={styles.feedback}>
            Feedback
          </Link>          <a
            className={styles.github}
            href={GITHUB_LOGIN}
            target="_blank"
            rel="noopener noreferrer"
          >
            <GitHubMark className={styles.githubIcon} />
            Sign in with GitHub
          </a>
        </div>
      </div>
    </header>
  );
}
