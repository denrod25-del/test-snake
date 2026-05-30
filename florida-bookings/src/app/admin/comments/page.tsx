import Link from "next/link";
import { prisma } from "@/lib/db";
import { countyLabel } from "@/lib/county-label";
import { ModerationButtons } from "./moderation-buttons";

export const dynamic = "force-dynamic";

export default async function AdminCommentsPage() {
  const pending = await prisma.comment.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    include: {
      bookingRecord: true,
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Comment moderation</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Approve comments before they appear on public record pages.
      </p>

      <ul className="space-y-4">
        {pending.length === 0 ? (
          <li className="text-sm text-zinc-500">No pending comments.</li>
        ) : (
          pending.map((c) => (
            <li key={c.id} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/records/${c.bookingRecordId}`} className="font-medium hover:underline">
                    {c.bookingRecord.personName}
                  </Link>
                  <div className="text-xs text-zinc-500">
                    {countyLabel(c.bookingRecord.county)} · {c.createdAt.toLocaleString()}
                  </div>
                </div>
                <ModerationButtons commentId={c.id} />
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">{c.body}</p>
              <p className="mt-1 text-xs text-zinc-500">Author id: {c.authorUserId}</p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
