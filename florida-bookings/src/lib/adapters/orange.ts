import { County } from "@/generated/prisma";
import type { CountyAdapter, NormalizedBooking } from "./types";

/**
 * Orange County Corrections BestJail listings require interactive search / form POST.
 * Live automation belongs behind a policy review + dedicated parser. v1 returns no rows.
 */
async function run(): Promise<NormalizedBooking[]> {
  return [];
}

export function createOrangeAdapter(): CountyAdapter {
  return {
    county: County.ORANGE,
    sourceSystem: "ocfl_bestjail",
    label: "Orange County (BestJail)",
    run,
  };
}
