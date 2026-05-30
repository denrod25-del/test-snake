import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { countyLabel } from "@/lib/county-label";
import { Disclaimer } from "@/components/disclaimer";
import { CommentForm } from "@/components/comment-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function RecordDetailPage({ params }: Props) {
  const { id } = await params;
  const record = await prisma.bookingRecord.findUnique({
    where: { id },
    include: {
      comments: {
        where: { status: "approved" },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!record) notFound();

  const session = await auth();

  return (
    <div className="space-y-6">
      <Link href="/records" className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
        ← Records
      </Link>
      <Disclaimer />

      <div className="grid gap-6 md:grid-cols-[140px_1fr]">
        <div className="aspect-[4/5] w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
          {record.mugshotUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={record.mugshotUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center p-2 text-center text-xs text-zinc-500">
              No photo URL on file
            </div>
          )}
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">{record.personName}</h1>
          <dl className="grid gap-1 text-sm text-zinc-600 dark:text-zinc-400">
            <div>
              <dt className="inline font-medium text-zinc-800 dark:text-zinc-200">County: </dt>
              <dd className="inline">{countyLabel(record.county)}</dd>
            </div>
            {record.bookingDate ? (
              <div>
                <dt className="inline font-medium text-zinc-800 dark:text-zinc-200">Booking: </dt>
                <dd className="inline">{record.bookingDate.toLocaleString()}</dd>
              </div>
            ) : null}
            <div>
              <dt className="inline font-medium text-zinc-800 dark:text-zinc-200">Source: </dt>
              <dd className="inline">{record.sourceSystem}</dd>
            </div>
          </dl>
          {record.chargesText ? (
            <div className="rounded-md border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-medium text-zinc-500">Charges (as provided)</p>
              <p className="mt-1 whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">{record.chargesText}</p>
            </div>
          ) : null}
          {record.officialSourceUrl ? (
            <p>
              <a
                href={record.officialSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-600 underline hover:text-blue-800 dark:text-blue-400"
              >
                Open official source
              </a>
            </p>
          ) : null}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Comments</h2>
        {record.comments.length === 0 ? (
          <p className="text-sm text-zinc-500">No approved comments yet.</p>
        ) : (
          <ul className="space-y-3">
            {record.comments.map((c) => (
              <li key={c.id} className="rounded-md border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                <p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">{c.body}</p>
                <p className="mt-2 text-xs text-zinc-500">{c.createdAt.toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}

        {session?.user?.id ? (
          <CommentForm bookingRecordId={record.id} />
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Sign in to submit a comment. New comments are reviewed before they appear.
          </p>
        )}
      </section>
    </div>
  );
}
