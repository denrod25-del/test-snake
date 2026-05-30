import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  applyXpAndLevel,
  bumpStreak,
  gameConstants,
  quizScorePercent,
} from "@/lib/game";
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
    !("answers" in body)
  ) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { lessonSlug, answers } = body as {
    lessonSlug: string;
    answers: unknown;
  };

  if (
    typeof lessonSlug !== "string" ||
    !Array.isArray(answers) ||
    !answers.every((a) => typeof a === "number" && Number.isInteger(a))
  ) {
    return NextResponse.json({ error: "Invalid answers" }, { status: 400 });
  }

  const lesson = await prisma.lesson.findFirst({
    where: { slug: lessonSlug, isAvailable: true },
  });
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const questions = await prisma.quizQuestion.findMany({
    where: { lessonId: lesson.id },
    orderBy: { order: "asc" },
  });

  if (questions.length === 0) {
    return NextResponse.json({ error: "No quiz for lesson" }, { status: 404 });
  }

  if (answers.length !== questions.length) {
    return NextResponse.json({ error: "Wrong number of answers" }, { status: 400 });
  }

  let correct = 0;
  for (let i = 0; i < questions.length; i++) {
    if (answers[i] === questions[i].correctIndex) correct += 1;
  }

  const scorePercent = quizScorePercent(correct, questions.length);
  const passed = scorePercent >= gameConstants.QUIZ_PASS_PERCENT;

  const payload = await prisma.$transaction(async (tx) => {
    const profile = await tx.profile.findUnique({ where: { userId } });
    if (!profile) await tx.profile.create({ data: { userId } });
    const p = await tx.profile.findUniqueOrThrow({ where: { userId } });

    const streak = bumpStreak(p);

    const progress = await tx.userLessonProgress.findUnique({
      where: {
        userId_lessonId: { userId, lessonId: lesson.id },
      },
    });

    const prevBest = progress?.quizBestScore ?? 0;
    const nextBest = Math.max(prevBest, scorePercent);

    let xpGained = 0;
    let bonusAwarded = false;

    const shouldBonus =
      passed &&
      !(progress?.quizBonusAwarded);

    const { xp, level } = shouldBonus
      ? applyXpAndLevel(p, gameConstants.XP_QUIZ_BONUS)
      : { xp: p.xp, level: p.level };

    if (shouldBonus) {
      xpGained = gameConstants.XP_QUIZ_BONUS;
      bonusAwarded = true;
    }

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
        quizBestScore: nextBest,
        quizBonusAwarded: bonusAwarded,
      },
      update: {
        quizBestScore: nextBest,
        quizBonusAwarded: progress?.quizBonusAwarded || bonusAwarded,
      },
    });

    const explanations = questions.map((q, i) => ({
      index: i,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      yours: answers[i] as number,
    }));

    return {
      scorePercent,
      correct,
      total: questions.length,
      passed,
      xpGained,
      bonusAwarded,
      explanations,
      profile: { xp, level, streakCount: streak.streakCount },
    };
  });

  return NextResponse.json(payload);
}
