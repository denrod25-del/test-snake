import { County } from "@/generated/prisma";
import type { CountyAdapter, NormalizedBooking } from "./types";

/**
 * PBSO booking blotter uses bot challenges; do not bypass. Use fixtures, CSV import,
 * or official channels instead of unattended scraping here.
 */
async function run(): Promise<NormalizedBooking[]> {
  return [];
}

export function createPalmBeachAdapter(): CountyAdapter {
  return {
    county: County.PALM_BEACH,
    sourceSystem: "pbso_blotter",
    label: "Palm Beach PBSO blotter",
    run,
  };
}
