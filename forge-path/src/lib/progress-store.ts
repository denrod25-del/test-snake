import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addDaysYmd, localYmd } from "./date";

export const LESSON_COMPLETE_XP = 50;
export const QUIZ_XP = 15;

export type ProgressSnapshot = {
  xp: number;
  streak: number;
  lastActiveDate: string | null;
  lastLessonPath: string | null;
  completedLessons: Record<string, boolean>;
  quizBonusClaimed: Record<string, boolean>;
};

type ProgressState = ProgressSnapshot & {
  touchStreak: () => void;
  addXp: (n: number) => void;
  setLastLessonPath: (path: string) => void;
  completeLesson: (moduleId: string, lessonId: string) => void;
  claimQuizBonus: (moduleId: string, lessonId: string) => void;
  isLessonComplete: (moduleId: string, lessonId: string) => boolean;
  lessonKey: (moduleId: string, lessonId: string) => string;
  reset: () => void;
  importSnapshot: (data: unknown) => void;
  exportSnapshot: () => ProgressSnapshot;
};

const initial: ProgressSnapshot = {
  xp: 0,
  streak: 0,
  lastActiveDate: null,
  lastLessonPath: null,
  completedLessons: {},
  quizBonusClaimed: {},
};

function isSnapshot(v: unknown): v is ProgressSnapshot {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  const qb = o.quizBonusClaimed;
  return (
    typeof o.xp === "number" &&
    typeof o.streak === "number" &&
    (o.lastActiveDate === null || typeof o.lastActiveDate === "string") &&
    (o.lastLessonPath === null || typeof o.lastLessonPath === "string") &&
    typeof o.completedLessons === "object" &&
    o.completedLessons !== null &&
    (qb === undefined ||
      (typeof qb === "object" && qb !== null && !Array.isArray(qb)))
  );
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      ...initial,

      lessonKey: (moduleId, lessonId) => `${moduleId}:${lessonId}`,

      touchStreak: () => {
        const today = localYmd();
        const last = get().lastActiveDate;
        if (!last) {
          set({ lastActiveDate: today, streak: 1 });
          return;
        }
        if (last === today) return;
        const yesterday = addDaysYmd(today, -1);
        if (last === yesterday) {
          set({ lastActiveDate: today, streak: get().streak + 1 });
        } else {
          set({ lastActiveDate: today, streak: 1 });
        }
      },

      addXp: (n) => set({ xp: get().xp + n }),

      setLastLessonPath: (path) => set({ lastLessonPath: path }),

      completeLesson: (moduleId, lessonId) => {
        const key = get().lessonKey(moduleId, lessonId);
        if (get().completedLessons[key]) return;
        set({
          completedLessons: { ...get().completedLessons, [key]: true },
          xp: get().xp + LESSON_COMPLETE_XP,
        });
        get().touchStreak();
      },

      claimQuizBonus: (moduleId, lessonId) => {
        const key = get().lessonKey(moduleId, lessonId);
        if (get().quizBonusClaimed[key]) return;
        set({
          quizBonusClaimed: { ...get().quizBonusClaimed, [key]: true },
          xp: get().xp + QUIZ_XP,
        });
        get().touchStreak();
      },

      isLessonComplete: (moduleId, lessonId) => {
        const key = get().lessonKey(moduleId, lessonId);
        return !!get().completedLessons[key];
      },

      reset: () => set({ ...initial }),

      importSnapshot: (data) => {
        if (!isSnapshot(data)) return;
        const raw = data as ProgressSnapshot;
        set({
          xp: raw.xp,
          streak: raw.streak,
          lastActiveDate: raw.lastActiveDate,
          lastLessonPath: raw.lastLessonPath,
          completedLessons: { ...raw.completedLessons },
          quizBonusClaimed: { ...(raw.quizBonusClaimed ?? {}) },
        });
      },

      exportSnapshot: () => ({
        xp: get().xp,
        streak: get().streak,
        lastActiveDate: get().lastActiveDate,
        lastLessonPath: get().lastLessonPath,
        completedLessons: { ...get().completedLessons },
        quizBonusClaimed: { ...get().quizBonusClaimed },
      }),
    }),
    { name: "forge-path-progress-v1" },
  ),
);
