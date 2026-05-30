"use client";

import { useEffect } from "react";
import { useProgressStore } from "@/lib/progress-store";

/** Counts a visit toward streak when the shell mounts (client). */
export function StreakBoot() {
  const touchStreak = useProgressStore((s) => s.touchStreak);

  useEffect(() => {
    touchStreak();
  }, [touchStreak]);

  return null;
}
