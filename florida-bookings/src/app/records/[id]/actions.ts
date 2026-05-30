"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const MAX_LEN = 2000;

export async function submitComment(bookingRecordId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: "Sign in required." };
  }

  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 1 || body.length > MAX_LEN) {
    return { ok: false as const, error: `Comment must be 1–${MAX_LEN} characters.` };
  }

  const record = await prisma.bookingRecord.findUnique({ where: { id: bookingRecordId } });
  if (!record) {
    return { ok: false as const, error: "Record not found." };
  }

  await prisma.comment.create({
    data: {
      bookingRecordId,
      authorUserId: session.user.id,
      body,
      status: "pending",
    },
  });

  revalidatePath(`/records/${bookingRecordId}`);
  return { ok: true as const };
}
