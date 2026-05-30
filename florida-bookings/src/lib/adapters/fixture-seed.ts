import { readFile } from "node:fs/promises";
import path from "node:path";
import { County } from "@/generated/prisma";
import type { CountyAdapter, NormalizedBooking } from "./types";

type SeedRow = {
  county: "ORANGE" | "MIAMI_DADE" | "PALM_BEACH";
  sourceSystem: string;
  externalId: string;
  personName: string;
  bookingDate: string | null;
  chargesText: string | null;
  mugshotUrl: string | null;
  officialSourceUrl: string | null;
};

function parseSeed(data: SeedRow[]): NormalizedBooking[] {
  return data.map((row) => ({
    county: row.county as County,
    sourceSystem: row.sourceSystem,
    externalId: row.externalId,
    personName: row.personName,
    bookingDate: row.bookingDate ? new Date(row.bookingDate) : null,
    chargesText: row.chargesText,
    mugshotUrl: row.mugshotUrl,
    officialSourceUrl: row.officialSourceUrl,
    rawMetadata: { source: "fixture_seed" },
  }));
}

export function createFixtureSeedAdapter(): CountyAdapter {
  return {
    county: County.MULTI_COUNTY_SEED,
    sourceSystem: "demo_seed",
    label: "Demo seed data (set SYNC_USE_FIXTURES=true)",
    async run() {
      const file = path.join(process.cwd(), "src/lib/adapters/fixtures/seed.json");
      const raw = await readFile(file, "utf8");
      const rows = JSON.parse(raw) as SeedRow[];
      return parseSeed(rows);
    },
  };
}
