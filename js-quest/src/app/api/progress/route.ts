import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  applyXpAndLevel,
  bumpStreak,
  gameConstants,
} from "@/lib/game";
import { lessonUnlocked } from "@/lib/unlock";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("lessonSlug" in body) ||
    !("action" in body) ||
    typeof (body as { lessonSlug: unknown }).lessonSlug !== "string" ||
    (body as { action: unknown }).action !== "complete"
  ) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { lessonSlug } = body as { lessonSlug: string };

  const lesson = await prisma.lesson.findFirst({
    where: { slug: lessonSlug, isAvailable: true },
  });
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const allLessons = await prisma.lesson.findMany({
    where: { isAvailable: true },
    orderBy: { order: "asc" },
    select: { slug: true, order: true },
  });

  const completed = await prisma.userLessonProgress.findMany({
    where: { userId, completedAt: { not: null } },
    select: { lesson: { select: { slug: true } } },
  });
  const done = new Set(completed.map((p) => p.lesson.slug));
  if (!lessonUnlocked(lesson.slug, allLessons, done)) {
    return NextResponse.json(
      { error: "Complete the previous lesson first" },
      { status: 403 },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const profile = await tx.profile.findUnique({ where: { userId } });
    if (!profile) {
      await tx.profile.create({ data: { userId } });
    }
    const p = await tx.profile.findUniqueOrThrow({ where: { userId } });

    const existing = await tx.userLessonProgress.findUnique({
      where: {
        userId_lessonId: { userId, lessonId: lesson.id },
      },
    });

    if (existing?.completedAt) {
      const streak = bumpStreak(p);
      await tx.profile.update({
        where: { userId },
        data: {
          streakCount: streak.streakCount,
          lastActiveDate: streak.lastActiveDate,
        },
      });
      return { xpGained: 0, alreadyComplete: true };
    }

    const xpDelta = gameConstants.XP_LESSON_COMPLETE;
    const streak = bumpStreak(p);
    const { xp, level } = applyXpAndLevel(p, xpDelta);

    await tx.profile.update({
      where: { userId },
      data: {
        xp,
        level,
        streakCount: streak.streakCount,
        lastActiveDate: streak.lastActiveDate,
      },
    });

    await tx.userLessonProgress.upsert({
      where: {
        userId_lessonId: { userId, lessonId: lesson.id },
      },
      create: {
        userId,
        lessonId: lesson.id,
        completedAt: new Date(),
      },
      update: { completedAt: new Date() },
    });

    return { xpGained: xpDelta, alreadyComplete: false };
  });

  return NextResponse.json(result);
}
