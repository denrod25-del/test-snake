import type { Metadata } from "next";
import LibraryExplorer from "@/components/LibraryExplorer";
import { getLibraryIndex } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Library",
};

export default async function LibraryPage(props: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const spRaw = props.searchParams;
  const sp =
    spRaw && typeof spRaw === "object" && "then" in spRaw
      ? await (spRaw as Promise<Record<string, string | string[] | undefined>>)
      : ((spRaw as Record<string, string | string[] | undefined>) ?? {});
  const catRaw = sp.cat;
  const cat =
    typeof catRaw === "string"
      ? catRaw
      : Array.isArray(catRaw) && typeof catRaw[0] === "string"
        ? catRaw[0]
        : null;
  const data = await getLibraryIndex();

  return (
    <div className="pt-12">
      <LibraryExplorer
        pdfs={data.pdfs}
        initialCategory={cat}
      />
    </div>
  );
}
