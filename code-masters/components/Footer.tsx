import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandBlock}>
          <div className={styles.wordmark}>Code Masters</div>
          <p className={styles.tagline}>
            Hands-on systems challenges for developers who like knowing how things
            actually work.
          </p>
        </div>

        <div className={styles.columns}>
          <div>
            <div className={styles.colTitle}>Challenges</div>
            <ul className={styles.links}>
              <li>
                <a href="#catalog">Catalog</a>
              </li>
              <li>
                <a href="#languages">Languages</a>
              </li>
              <li>
                <a href="#pricing">Pricing</a>
              </li>
            </ul>
          </div>
          <div>
            <div className={styles.colTitle}>Support</div>
            <ul className={styles.links}>
              <li>
                <a href="https://nextjs.org/docs" target="_blank" rel="noreferrer">
                  Docs
                </a>
              </li>
              <li>
                <a href="https://vercel-status.com" target="_blank" rel="noreferrer">
                  Status
                </a>
              </li>
            </ul>
          </div>
          <div>
            <div className={styles.colTitle}>Company</div>
            <ul className={styles.links}>
              <li>
                <a href="#roadmap">Roadmap</a>
              </li>
              <li>
                <a href="#feedback">Contact</a>
              </li>
            </ul>
          </div>
          <div>
            <div className={styles.colTitle}>Legal</div>
            <ul className={styles.links}>
              <li>
                <a href="#terms">Terms</a>
              </li>
              <li>
                <a href="#privacy">Privacy</a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className={styles.bottom}>
        <span>© {new Date().getFullYear()} Code Masters</span>
        <span className={styles.credits}>
          Static demo UI — extend with your own backend and content.
        </span>
      </div>
    </footer>
  );
}
