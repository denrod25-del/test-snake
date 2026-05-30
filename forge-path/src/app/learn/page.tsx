import Link from "next/link";
import { CURRICULUM } from "@/curriculum";

export default function LearnIndexPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-zinc-50">All modules</h1>
      <p className="mt-2 max-w-2xl text-zinc-400">
        Pick a track or follow order from the home roadmap.
      </p>
      <ul className="mt-10 space-y-3">
        {CURRICULUM.map((m) => (
          <li key={m.id}>
            <Link
              href={`/learn/${m.id}`}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-4 hover:border-white/25"
            >
              <span className="flex items-center gap-3">
                <span className="text-xl">{m.icon}</span>
                <span className="font-medium text-zinc-100">{m.title}</span>
              </span>
              <span className="text-sm text-zinc-500">
                {m.lessons.length} lesson{m.lessons.length === 1 ? "" : "s"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
