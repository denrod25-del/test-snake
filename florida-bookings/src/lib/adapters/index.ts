import { createFixtureSeedAdapter } from "./fixture-seed";
import { createMiamiDadeAdapter } from "./miami-dade";
import { createOrangeAdapter } from "./orange";
import { createPalmBeachAdapter } from "./palm-beach";
import type { CountyAdapter } from "./types";

export type { CountyAdapter, NormalizedBooking } from "./types";

export function getCountyAdapters(): CountyAdapter[] {
  const adapters: CountyAdapter[] = [
    createOrangeAdapter(),
    createMiamiDadeAdapter(),
    createPalmBeachAdapter(),
  ];
  if (process.env.SYNC_USE_FIXTURES === "true") {
    adapters.push(createFixtureSeedAdapter());
  }
  return adapters;
}
