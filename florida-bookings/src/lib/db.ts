import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

/**
 * `@prisma/adapter-pg` uses the `pg` driver, which only accepts postgres:// or postgresql:// URLs.
 * `prisma+postgres://` (from `prisma dev` / Prisma Postgres) must not be passed to `pg`.
 * Use DIRECT_DATABASE_URL for the direct link, or set DATABASE_URL to a normal PostgreSQL URL.
 */
function connectionStringForPgPool(): string {
  const direct = process.env.DIRECT_DATABASE_URL?.trim();
  if (direct) {
    return direct.startsWith("postgres://") ? direct.replace(/^postgres:/, "postgresql:") : direct;
  }

  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    throw new Error("DATABASE_URL is not set");
  }

  if (raw.startsWith("prisma+postgres:")) {
    throw new Error(
      "DATABASE_URL uses prisma+postgres://, which the pg driver cannot use. " +
        "Run `npx prisma dev` and copy the direct Postgres URL into DIRECT_DATABASE_URL in .env, " +
        "or set DATABASE_URL to postgresql://user:pass@host:port/database (see README).",
    );
  }

  return raw.startsWith("postgres://") ? raw.replace(/^postgres:/, "postgresql:") : raw;
}

function createClient(): PrismaClient {
  const url = connectionStringForPgPool();
  const pool = globalForPrisma.pool ?? new Pool({ connectionString: url });
  globalForPrisma.pool = pool;
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter, log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"] });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
