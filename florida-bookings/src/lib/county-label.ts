import { County } from "@/generated/prisma";

const LABELS: Record<County, string> = {
  [County.ORANGE]: "Orange",
  [County.MIAMI_DADE]: "Miami-Dade",
  [County.PALM_BEACH]: "Palm Beach",
  [County.MULTI_COUNTY_SEED]: "Demo / seed",
};

export function countyLabel(c: County): string {
  return LABELS[c] ?? c;
}

/** Counties shown in public search (excludes internal seed run label for filter). */
export const SEARCHABLE_COUNTIES: County[] = [
  County.ORANGE,
  County.MIAMI_DADE,
  County.PALM_BEACH,
];
