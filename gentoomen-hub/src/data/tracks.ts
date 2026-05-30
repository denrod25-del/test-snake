/** Curated journeys that stitch together categories from the Gentoomen mirror. */
export type TrackStep = {
  title: string;
  caption: string;
  category: string;
};

export type Track = {
  id: string;
  title: string;
  summary: string;
  steps: TrackStep[];
};

export const TRACKS: Track[] = [
  {
    id: "classic-cs",
    title: "Classic computer science core",
    summary:
      "Ground yourself in proofs, discrete structures, and the limits of computation before diving into shipping software.",
    steps: [
      {
        title: "Discrete backbone",
        caption: "Set theory, proofs, and structures that recur everywhere.",
        category: "Maths",
      },
      {
        title: "Formal models",
        caption: "Automata, grammars, and complexity classifications.",
        category: "Theory Of Computation",
      },
      {
        title: "Practical algorithms",
        caption: "Classical algo references with runnable intuition.",
        category: "Algorithms",
      },
      {
        title: "Structural thinking",
        caption: "How data is arranged, queried, and reasoned about at scale.",
        category: "Data Structures",
      },
    ],
  },
  {
    id: "builder-to-ship",
    title: "From bare metal to maintainable releases",
    summary:
      "Trace the stack downwards (hardware-ish) then back up through OS, languages, and team practices.",
    steps: [
      {
        title: "How machines execute",
        caption: "Architectures that explain performance cliffs.",
        category: "Computer Architecture",
      },
      {
        title: "Processes & kernels",
        caption: "Virtual memory, scheduling, and systems glue.",
        category: "Operating Systems",
      },
      {
        title: "Languages & tooling",
        caption: "Breadth-first tour across paradigms and ecosystems.",
        category: "Programming",
      },
      {
        title: "Shipping sustainably",
        caption: "Design, review, reliability, and long-term velocity.",
        category: "Software Engineering",
      },
    ],
  },
  {
    id: "intelligent-systems",
    title: "Intelligent applications",
    summary:
      "Blend foundations in AI, NLP, retrieval, and data mining before specializing.",
    steps: [
      {
        title: "Core AI coursework",
        caption: "Search, probabilistic reasoning, statistical learning.",
        category: "Artificial Intelligence",
      },
      {
        title: "Language technologies",
        caption: "Linguistics meet ML for text-heavy products.",
        category: "Computational Linguistics",
      },
      {
        title: "Retrieval architectures",
        caption: "How systems find needles in planetary haystacks.",
        category: "Information Retrieval",
      },
      {
        title: "Pattern discovery",
        caption: "From exploratory analysis to repeatable pipelines.",
        category: "Data Mining",
      },
    ],
  },
  {
    id: "realtime-worlds",
    title: "Graphics, games, and signal paths",
    summary:
      "Follow the mediums that emphasize latency, fidelity, and human perception.",
    steps: [
      {
        title: "Visual foundations",
        caption: "Rendering, geometry, and interactive imagery.",
        category: "Computer Graphics",
      },
      {
        title: "Shippable worlds",
        caption: "Engine patterns, authoring, multiplayer glue.",
        category: "Game Development",
      },
      {
        title: "Analog-to-bits",
        caption: "Filters, spectra, DSP intuition for multimodal UX.",
        category: "DSP-Collection",
      },
      {
        title: "Information limits",
        caption: "Entropy, compression, and communication trade-offs.",
        category: "Information Theory",
      },
    ],
  },
  {
    id: "defense-depth",
    title: "Security engineering lab",
    summary:
      "Pair offensive insight with cryptography and pragmatic hardening disciplines.",
    steps: [
      {
        title: "Modern crypto",
        caption: "Protocols, constructions, failure modes.",
        category: "Cryptography",
      },
      {
        title: "System-level attacks",
        caption: "From memory safety to networked exploitation.",
        category: "Security",
      },
      {
        title: "Data fortress",
        caption: "Storage engines, correctness, confidentiality controls.",
        category: "Databases",
      },
      {
        title: "Network mechanics",
        caption: "How packets propagate and defend perimeters.",
        category: "Networking",
      },
    ],
  },
];
