"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";

async function assertAdmin() {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function approveComment(commentId: string) {
  const session = await assertAdmin();
  await prisma.comment.update({
    where: { id: commentId },
    data: {
      status: "approved",
      moderatedAt: new Date(),
      moderatedByUserId: session.user!.id!,
    },
  });
  const c = await prisma.comment.findUnique({ where: { id: commentId } });
  if (c) revalidatePath(`/records/${c.bookingRecordId}`);
  revalidatePath("/admin/comments");
}

export async function rejectComment(commentId: string) {
  const session = await assertAdmin();
  await prisma.comment.update({
    where: { id: commentId },
    data: {
      status: "rejected",
      moderatedAt: new Date(),
      moderatedByUserId: session.user!.id!,
    },
  });
  const c = await prisma.comment.findUnique({ where: { id: commentId } });
  if (c) revalidatePath(`/records/${c.bookingRecordId}`);
  revalidatePath("/admin/comments");
}
