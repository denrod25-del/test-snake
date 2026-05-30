import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import type { ReactNode } from "react";
import styles from "./layout.module.css";

export default function LearnLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.wrap}>
      <Header />
      {children}
      <Footer />
    </div>
  );
}
