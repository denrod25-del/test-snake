import type { Profile } from "@prisma/client";

const XP_LESSON_COMPLETE = 40;
const XP_QUIZ_BONUS = 30;
const QUIZ_PASS_PERCENT = 70;

export const gameConstants = {
  XP_LESSON_COMPLETE,
  XP_QUIZ_BONUS,
  QUIZ_PASS_PERCENT,
};

/** Level from XP: gentle curve, cap 99 */
export function levelFromXp(xp: number): number {
  return Math.min(99, Math.floor(Math.sqrt(Math.max(0, xp) / 25)) + 1);
}

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Compare calendar days in UTC */
export function bumpStreak(
  profile: Pick<Profile, "streakCount" | "lastActiveDate">,
  now: Date = new Date(),
): { streakCount: number; lastActiveDate: Date } {
  const today = utcDayStart(now);
  const last = profile.lastActiveDate ? utcDayStart(profile.lastActiveDate) : null;

  if (!last) {
    return { streakCount: 1, lastActiveDate: today };
  }

  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  if (last.getTime() === today.getTime()) {
    return { streakCount: profile.streakCount, lastActiveDate: today };
  }

  if (last.getTime() === yesterday.getTime()) {
    return { streakCount: profile.streakCount + 1, lastActiveDate: today };
  }

  return { streakCount: 1, lastActiveDate: today };
}

export function applyXpAndLevel(
  profile: Pick<Profile, "xp" | "level">,
  delta: number,
): { xp: number; level: number } {
  const xp = profile.xp + delta;
  return { xp, level: levelFromXp(xp) };
}

export function quizScorePercent(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}
