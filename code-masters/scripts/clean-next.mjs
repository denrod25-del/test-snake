import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const target = join(process.cwd(), ".next");
if (existsSync(target)) {
  rmSync(target, { recursive: true, force: true });
}
