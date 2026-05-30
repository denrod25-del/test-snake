import { prisma } from "@/lib/db";
import { getCountyAdapters } from "@/lib/adapters";
import { upsertBooking } from "./upsert";

export type CountySyncResult = {
  county: string;
  sourceSystem: string;
  label: string;
  upserted: number;
  status: "ok" | "error";
  error?: string;
};

export async function runAllSyncs(): Promise<CountySyncResult[]> {
  const adapters = getCountyAdapters();
  const results: CountySyncResult[] = [];
  const syncedAt = new Date();

  for (const adapter of adapters) {
    const run = await prisma.syncRun.create({
      data: {
        county: adapter.county,
        status: "running",
      },
    });

    try {
      const rows = await adapter.run();
      for (const row of rows) {
        await upsertBooking(row, syncedAt);
      }
      await prisma.syncRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          status: "ok",
          recordsUpserted: rows.length,
        },
      });
      results.push({
        county: adapter.county,
        sourceSystem: adapter.sourceSystem,
        label: adapter.label,
        upserted: rows.length,
        status: "ok",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await prisma.syncRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          status: "error",
          errorMessage: message,
          recordsUpserted: 0,
        },
      });
      results.push({
        county: adapter.county,
        sourceSystem: adapter.sourceSystem,
        label: adapter.label,
        upserted: 0,
        status: "error",
        error: message,
      });
    }
  }

  return results;
}
