import { prisma } from "@/lib/prisma";

export async function ensureProfile(userId: string) {
  return prisma.profile.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}
