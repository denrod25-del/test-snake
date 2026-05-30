export const LESSON_PROGRESS_KEY = "code-masters:lesson-progress:v1";
export const PROGRESS_EVENT_NAME = "code-masters:progress";

export type ProgressPayload = {
  bySlug: Record<string, { stage: number; updatedAt: number }>;
  lastVisit: { slug: string; stage: number; updatedAt: number } | null;
};

const emptyPayload: ProgressPayload = { bySlug: {}, lastVisit: null };

export function normalizeProgress(parsed: unknown): ProgressPayload {
  if (!parsed || typeof parsed !== "object") return { ...emptyPayload };
  const o = parsed as Record<string, unknown>;
  const bySlug: ProgressPayload["bySlug"] = {};
  if (o.bySlug && typeof o.bySlug === "object") {
    for (const [key, raw] of Object.entries(o.bySlug)) {
      if (!raw || typeof raw !== "object") continue;
      const v = raw as Record<string, unknown>;
      const stage = Number(v.stage);
      const updatedAt = Number(v.updatedAt);
      if (
        typeof key === "string" &&
        Number.isFinite(stage) &&
        stage >= 1 &&
        Number.isFinite(updatedAt)
      ) {
        bySlug[key] = { stage: Math.floor(stage), updatedAt };
      }
    }
  }
  let lastVisit: ProgressPayload["lastVisit"] = null;
  if (o.lastVisit && typeof o.lastVisit === "object") {
    const v = o.lastVisit as Record<string, unknown>;
    const slug = typeof v.slug === "string" ? v.slug : "";
    const stage = Number(v.stage);
    const updatedAt = Number(v.updatedAt);
    if (slug && Number.isFinite(stage) && stage >= 1 && Number.isFinite(updatedAt)) {
      lastVisit = { slug, stage: Math.floor(stage), updatedAt };
    }
  }
  return { bySlug, lastVisit };
}

export function readProgress(): ProgressPayload {
  if (typeof window === "undefined") return { ...emptyPayload };
  try {
    const raw = window.localStorage.getItem(LESSON_PROGRESS_KEY);
    if (!raw) return { ...emptyPayload };
    const parsed = JSON.parse(raw) as unknown;
    return normalizeProgress(parsed);
  } catch {
    return { ...emptyPayload };
  }
}

export function persistStageVisited(slug: string, stage: number): void {
  if (typeof window === "undefined") return;
  try {
    const data = readProgress();
    const now = Date.now();
    data.bySlug[slug] = { stage, updatedAt: now };
    data.lastVisit = { slug, stage, updatedAt: now };
    window.localStorage.setItem(LESSON_PROGRESS_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event(PROGRESS_EVENT_NAME));
  } catch {
    /* ignore quota / privacy mode */
  }
}

export function subscribeProgress(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const run = () => callback();
  window.addEventListener(PROGRESS_EVENT_NAME, run);
  window.addEventListener("storage", run);
  return () => {
    window.removeEventListener(PROGRESS_EVENT_NAME, run);
    window.removeEventListener("storage", run);
  };
}
