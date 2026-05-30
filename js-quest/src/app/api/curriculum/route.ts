import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const lessons = await prisma.lesson.findMany({
    where: { isAvailable: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      part: true,
      chapter: true,
      order: true,
      officialUrl: true,
      summary: true,
    },
  });

  return NextResponse.json({ lessons });
}
