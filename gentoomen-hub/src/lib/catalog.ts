import { readFile } from "node:fs/promises";
import path from "node:path";

export type PdfRecord = {
  title: string;
  path: string;
  url: string;
  topCategory: string;
};

export type LibraryIndex = {
  generatedAt: string;
  source: string;
  attribution: string;
  stats: {
    directoriesVisited: number;
    pdfCount: number;
    categories: number;
    truncatedByMaxDirs?: number;
  };
  categoryCounts: Record<string, number>;
  pdfs: PdfRecord[];
};

let cache: LibraryIndex | null = null;

export async function getLibraryIndex(): Promise<LibraryIndex> {
  if (cache) return cache;
  const file = path.join(
    process.cwd(),
    "public",
    "data",
    "library-index.json"
  );
  const raw = await readFile(file, "utf8");
  cache = JSON.parse(raw) as LibraryIndex;
  return cache;
}
