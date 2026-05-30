import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/profile";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  await ensureProfile(userId);

  const [profile, progress, lessons] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.userLessonProgress.findMany({
      where: { userId },
      select: {
        lessonId: true,
        completedAt: true,
        quizBestScore: true,
        quizBonusAwarded: true,
        lesson: { select: { slug: true, order: true } },
      },
    }),
    prisma.lesson.findMany({
      where: { isAvailable: true },
      orderBy: { order: "asc" },
      select: { slug: true, order: true },
    }),
  ]);

  return NextResponse.json({
    user: {
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    },
    profile,
    progress,
    lessons,
  });
}
