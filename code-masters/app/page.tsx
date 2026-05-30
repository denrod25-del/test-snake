import { ChallengeGrid } from "@/components/ChallengeGrid";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { HomeResume } from "@/components/HomeResume";
import { LanguageTracks } from "@/components/LanguageTracks";
import { challenges, languageTracks } from "@/data/catalog";
import styles from "./page.module.css";

const challengeTitles = Object.fromEntries(
  challenges.map((c) => [c.slug, c.title]),
);

export default function Home() {
  return (
    <div className={styles.shell}>
      <Header />
      <main>
        <HomeResume titleBySlug={challengeTitles} />
        <Hero />
        <ChallengeGrid items={challenges} />
        <LanguageTracks items={languageTracks} />
      </main>
      <Footer />
    </div>
  );
}
