import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import styles from "./layout.module.css";
import type { ReactNode } from "react";

export default function TracksLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.wrap}>
      <Header />
      {children}
      <Footer />
    </div>
  );
}
