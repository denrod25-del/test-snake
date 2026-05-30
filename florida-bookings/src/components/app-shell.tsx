"use client";

import { SiteHeader } from "@/components/site-header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</div>
    </>
  );
}
