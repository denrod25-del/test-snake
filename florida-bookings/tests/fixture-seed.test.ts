import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { County } from "@/generated/prisma";

describe("fixture seed", () => {
  it("parses seed.json with valid counties", () => {
    const file = path.join(process.cwd(), "src/lib/adapters/fixtures/seed.json");
    const rows = JSON.parse(readFileSync(file, "utf8")) as { county: string }[];
    expect(rows.length).toBeGreaterThan(0);
    const allowed = new Set(Object.values(County).filter((c) => c !== County.MULTI_COUNTY_SEED));
    for (const row of rows) {
      expect(allowed.has(row.county as County)).toBe(true);
    }
  });
});
