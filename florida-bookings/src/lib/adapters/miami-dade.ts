import { County } from "@/generated/prisma";
import type { CountyAdapter, NormalizedBooking } from "./types";

/** MDCR inmate search is form-driven; v1 stub — add HTML/API integration after ToS review. */
async function run(): Promise<NormalizedBooking[]> {
  return [];
}

export function createMiamiDadeAdapter(): CountyAdapter {
  return {
    county: County.MIAMI_DADE,
    sourceSystem: "mdcr",
    label: "Miami-Dade MDCR",
    run,
  };
}
