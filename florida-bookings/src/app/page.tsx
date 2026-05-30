import Link from "next/link";
import { Disclaimer } from "@/components/disclaimer";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Florida booking records
        </h1>
        <p className="mt-2 max-w-2xl text-pretty text-zinc-600 dark:text-zinc-400">
          v1 aggregates adapters for Orange County, Miami-Dade, and Palm Beach public portals.
          County parsers ship as stubs until each site’s terms and technical access are validated.
          Enable demo data with{" "}
          <code className="rounded bg-zinc-200 px-1 text-sm dark:bg-zinc-800">SYNC_USE_FIXTURES=true</code>{" "}
          and run a sync.
        </p>
      </div>
      <Disclaimer />
      <Link
        href="/records"
        className="inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Browse records
      </Link>
    </div>
  );
}
