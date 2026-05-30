import Link from "next/link";
import { County } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { countyLabel, SEARCHABLE_COUNTIES } from "@/lib/county-label";
import { Disclaimer } from "@/components/disclaimer";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ q?: string; county?: string }>;
};

export default async function RecordsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const countyParam = sp.county as County | undefined;
  const countyFilter =
    countyParam && SEARCHABLE_COUNTIES.includes(countyParam) ? countyParam : undefined;

  let records: Awaited<ReturnType<typeof prisma.bookingRecord.findMany>> = [];
  let dbError: string | null = null;
  try {
    records = await prisma.bookingRecord.findMany({
      where: {
        AND: [
          countyFilter ? { county: countyFilter } : { county: { in: SEARCHABLE_COUNTIES } },
          q
            ? {
                personName: {
                  contains: q,
                  mode: "insensitive",
                },
              }
            : {},
        ],
      },
      orderBy: [{ bookingDate: "desc" }, { lastSyncedAt: "desc" }],
      take: 100,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    dbError =
      msg.includes("ECONNREFUSED") || msg.includes("P1001")
        ? "Cannot reach the database. Start PostgreSQL (or run `npx prisma dev`), set DATABASE_URL in .env, then run `npx prisma migrate deploy`."
        : `Database error: ${msg}`;
  }

  return (
    <div className="space-y-6">
      <Disclaimer />
      <h1 className="text-xl font-semibold">Records</h1>
      {dbError ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          {dbError}
        </div>
      ) : null}
      <form className="flex flex-wrap items-end gap-3" action="/records" method="get">
        <div>
          <label htmlFor="q" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Name contains
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            className="mt-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            placeholder="Last, First"
          />
        </div>
        <div>
          <label htmlFor="county" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            County
          </label>
          <select
            id="county"
            name="county"
            defaultValue={countyFilter ?? ""}
            className="mt-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          >
            <option value="">All (Orange, Miami-Dade, Palm Beach)</option>
            {SEARCHABLE_COUNTIES.map((c) => (
              <option key={c} value={c}>
                {countyLabel(c)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Search
        </button>
      </form>

      <p className="text-sm text-zinc-500">
        Showing up to 100 rows. Demo records use source <code>demo_seed</code> when fixtures sync is enabled.
      </p>

      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
        {records.length === 0 ? (
          <li className="p-4 text-sm text-zinc-500">No records yet. Run sync with fixtures or connect PostgreSQL.</li>
        ) : (
          records.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <div>
                <Link href={`/records/${r.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                  {r.personName}
                </Link>
                <div className="text-xs text-zinc-500">
                  {countyLabel(r.county)}
                  {r.bookingDate ? ` · ${r.bookingDate.toLocaleDateString()}` : ""}
                  {r.sourceSystem ? ` · ${r.sourceSystem}` : ""}
                </div>
              </div>
              <Link
                href={`/records/${r.id}`}
                className="text-xs text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400"
              >
                View
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
