export type ChallengeBadge = "free" | "beta" | "new";

export type Challenge = {
  slug: string;
  title: string;
  description: string;
  stages: number;
  badge?: ChallengeBadge;
  badgeLabel?: string;
};

export type LanguageTrack = {
  slug: string;
  name: string;
  stages: number;
  popular?: boolean;
};

export const challenges: Challenge[] = [
  {
    slug: "shell",
    title: "Craft your own shell",
    description:
      "Parse commands, spawn processes, and wire up pipelines—like a miniature terminal.",
    stages: 42,
    badge: "free",
    badgeLabel: "Free this month",
  },
  {
    slug: "kv-store",
    title: "Build a Redis-style server",
    description:
      "Learn TCP framing, a compact binary protocol, and in-memory data structures.",
    stages: 115,
  },
  {
    slug: "pattern-matcher",
    title: "Implement a grep-style searcher",
    description:
      "Regex fundamentals: character classes, quantifiers, and efficient matching.",
    stages: 33,
  },
  {
    slug: "interpreter",
    title: "Write a small language runtime",
    description:
      "Tokenize source, build an AST, and evaluate programs with a tree-walking VM.",
    stages: 84,
  },
  {
    slug: "torrent",
    title: "Peer-to-peer file sharing",
    description:
      "Decode metainfo files, speak the peer wire protocol, and swap pieces reliably.",
    stages: 19,
  },
  {
    slug: "log-broker",
    title: "Distributed commit log",
    description:
      "Model partitions, replicas, and a wire format for fast streams over TCP.",
    stages: 25,
  },
  {
    slug: "vcs-core",
    title: "Version control from scratch",
    description:
      "Store blobs and trees, walk history, and implement plumbing-style commands.",
    stages: 7,
  },
  {
    slug: "embedded-sql",
    title: "Miniature SQL engine",
    description:
      "SQL parsing, B-trees on disk, and the moving pieces behind a simple database.",
    stages: 9,
  },
  {
    slug: "resolver",
    title: "Authoritative-style DNS",
    description:
      "Packets, record types, and how resolvers answer questions on the wire.",
    stages: 8,
  },
  {
    slug: "http-stack",
    title: "HTTP/1.1 from the socket up",
    description:
      "Line-oriented headers, chunked bodies, and keeping connections orderly.",
    stages: 14,
  },
  {
    slug: "agent-cli",
    title: "Agentic coding assistant",
    description:
      "Call model APIs, describe tools, and loop until tasks complete—or fail clearly.",
    stages: 28,
    badge: "beta",
    badgeLabel: "Free during beta",
  },
];

export const languageTracks: LanguageTrack[] = [
  { slug: "rust", name: "Rust", stages: 396, popular: true },
  { slug: "go", name: "Go", stages: 396, popular: true },
  { slug: "python", name: "Python", stages: 396, popular: true },
  { slug: "c", name: "C", stages: 396 },
  { slug: "csharp", name: "C#", stages: 396 },
  { slug: "cpp", name: "C++", stages: 396 },
  { slug: "clojure", name: "Clojure", stages: 222 },
  { slug: "crystal", name: "Crystal", stages: 115 },
  { slug: "dart", name: "Dart", stages: 90 },
  { slug: "elixir", name: "Elixir", stages: 350 },
  { slug: "gleam", name: "Gleam", stages: 356 },
  { slug: "haskell", name: "Haskell", stages: 348 },
  { slug: "java", name: "Java", stages: 396 },
  { slug: "javascript", name: "JavaScript", stages: 396, popular: true },
  { slug: "kotlin", name: "Kotlin", stages: 390 },
  { slug: "ocaml", name: "OCaml", stages: 296 },
  { slug: "odin", name: "Odin", stages: 322 },
  { slug: "php", name: "PHP", stages: 337 },
  { slug: "ruby", name: "Ruby", stages: 365 },
  { slug: "scala", name: "Scala", stages: 333 },
  { slug: "typescript", name: "TypeScript", stages: 396, popular: true },
  { slug: "zig", name: "Zig", stages: 396 },
];

export function getChallengeBySlug(slug: string): Challenge | undefined {
  return challenges.find((c) => c.slug === slug);
}

export function getLanguageBySlug(slug: string): LanguageTrack | undefined {
  return languageTracks.find((l) => l.slug === slug);
}
