"use client";

import { useFormStatus } from "react-dom";
import { useState } from "react";
import { submitComment } from "@/app/records/[id]/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
    >
      {pending ? "Sending…" : "Submit for review"}
    </button>
  );
}

type Props = { bookingRecordId: string };

export function CommentForm({ bookingRecordId }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  return (
    <form
      key={formKey}
      className="space-y-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
      action={async (fd) => {
        setMessage(null);
        const res = await submitComment(bookingRecordId, fd);
        if (res.ok) {
          setMessage("Submitted. A moderator will review it before it appears.");
          setFormKey((k) => k + 1);
        } else {
          setMessage(res.error);
        }
      }}
    >
      <label htmlFor="comment-body" className="block text-sm font-medium">
        Add a comment
      </label>
      <textarea
        id="comment-body"
        name="body"
        required
        rows={4}
        maxLength={2000}
        className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
        placeholder="Plain text only. Be factual and respectful."
      />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton />
        {message ? <span className="text-sm text-zinc-600 dark:text-zinc-400">{message}</span> : null}
      </div>
    </form>
  );
}
