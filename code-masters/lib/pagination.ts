/** Stages listed per syllabus page before pagination controls kick in */
export const SYLLABUS_PAGE_SIZE = 24;

export function parsePageParam(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export function syllabusPageSlice(
  totalStages: number,
  page: number,
  pageSize: number,
): { page: number; totalPages: number; startStage: number; endStage: number } {
  const totalPages = Math.max(1, Math.ceil(totalStages / pageSize));
  const normalizedPage = Math.min(Math.max(page, 1), totalPages);
  const startStage = (normalizedPage - 1) * pageSize + 1;
  const endStage = Math.min(normalizedPage * pageSize, totalStages);
  return {
    page: normalizedPage,
    totalPages,
    startStage,
    endStage,
  };
}
