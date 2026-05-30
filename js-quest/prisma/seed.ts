import { PrismaClient } from "@prisma/client";
import { seedLessons } from "./seed-data";

const prisma = new PrismaClient();

async function main() {
  for (const row of seedLessons) {
    const { questions, ...lesson } = row;
    const rec = await prisma.lesson.upsert({
      where: { slug: lesson.slug },
      create: {
        slug: lesson.slug,
        title: lesson.title,
        part: lesson.part,
        chapter: lesson.chapter,
        order: lesson.order,
        officialUrl: lesson.officialUrl,
        summary: lesson.summary,
        isAvailable: true,
      },
      update: {
        title: lesson.title,
        part: lesson.part,
        chapter: lesson.chapter,
        order: lesson.order,
        officialUrl: lesson.officialUrl,
        summary: lesson.summary,
        isAvailable: true,
      },
    });

    await prisma.quizQuestion.deleteMany({ where: { lessonId: rec.id } });
    await prisma.quizQuestion.createMany({
      data: questions.map((q, i) => ({
        lessonId: rec.id,
        order: i,
        prompt: q.prompt,
        choices: q.choices,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      })),
    });
  }

  console.log(`Seeded ${seedLessons.length} lessons with quizzes.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
