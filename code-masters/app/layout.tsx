import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Code Masters — Hands-on systems challenges",
  description:
    "Guided, stage-by-stage builds for serious developers. Pick a challenge and a language track, then ship incremental milestones.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
