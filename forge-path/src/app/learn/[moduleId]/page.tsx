import Link from "next/link";
import { notFound } from "next/navigation";
import { getModule } from "@/curriculum";
import { ModuleLessonList } from "@/components/ModuleLessonList";

type Props = { params: Promise<{ moduleId: string }> };

export default async function ModulePage({ params }: Props) {
  const { moduleId } = await params;
  const mod = getModule(moduleId);
  if (!mod) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/learn"
        className="text-sm text-zinc-500 hover:text-zinc-300"
      >
        ← All modules
      </Link>
      <header className="mt-6 space-y-3">
        <span className="text-3xl" aria-hidden>
          {mod.icon}
        </span>
        <h1 className="text-3xl font-semibold text-zinc-50">{mod.title}</h1>
        <p className="text-zinc-400">{mod.description}</p>
      </header>
      <ModuleLessonList moduleId={mod.id} lessons={mod.lessons} />
    </div>
  );
}
