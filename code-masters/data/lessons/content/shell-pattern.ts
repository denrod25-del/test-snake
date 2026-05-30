import type { LessonTopicBlock } from "../types";

/** Craft your own shell — topic-aligned lessons */
export const SHELL_CONTENT: Record<string, LessonTopicBlock> = {
  "Scaffold & harness": {
    paragraphs: [
      "Stand up a runnable binary plus a subprocess-based test harness. Your shell reads stdin whether it’s a TTY or a pipe: early tests usually assert exact transcript bytes, so keep stdout/stderr semantics crisp (prompts belong on stderr if tests say so).",
      "Establish a single event loop iteration: prompt → read line → dispatch → repeat. Deferred signal handling arrives later—first focus on deterministic EOF behavior and nonzero exit propagation from children.",
      "Freeze your module boundaries now: lexer, command table, builtins, executor. Retrofitting seams after parsers exist is slower than carving thin interfaces upfront.",
    ],
    lapParagraphs: [
      [
        "Harden `--help`/version flags synchronously without entering the interactive loop.",
        "Add deterministic seed for RNG if tests fuzz prompt timing—they rarely need real randomness.",
      ],
    ],
    objectives: [
      "Demonstrate reproducible transcripts under the bundled integration runner.",
      "Document how stdin/stdout/stderr relate when the harness spawns your process.",
      "Locate where synchronous vs async I/O differs for piping vs keyboard input.",
    ],
  },
  "Line reading & history": {
    paragraphs: [
      "Implement synchronous line reading buffered by CRLF endings; trim trailing `\r`. Handle Ctrl+D (EOF with partial buffer) distinctly from Ctrl+C (signal staged later when tests enable it).",
      "Maintain an in-memory history ring with configurable max entries; navigating up/down rewrites current buffer without executing until Enter.",
      "Optional: naive readline emulation can wait—don’t preempt tests that only expect plain `read_sync` primitives.",
    ],
    lapParagraphs: [
      [
        "Deduplicate consecutive identical commands if tests assert dedupe policy.",
        "Persist history append-only optional beyond scope unless explicitly introduced.",
      ],
    ],
    objectives: [
      "Verify history ordering & bounds without leaking allocations on long sessions.",
      "Explain semantics of EOF on empty vs non-empty buffered line.",
      "Enumerate edge cases CRLF normalization prevents across OS text modes.",
    ],
  },
  "Tokenizing simple commands": {
    paragraphs: [
      "Split pipelines by `|` first (outer), then subdivide whitespace tokens respecting quotes: single `'...'`, double `\"...\"`, and escapes `\\\"`/`\\n` subsets from spec.",
      "Redirection markers `<`, `>`, `>>` often bind to filenames as separate WORD tokens—design token kinds explicitly now rather than juggling strings downstream.",
      "Reject unterminated quotes early with stderr messages verbatim per harness wording.",
    ],
    lapParagraphs: [
      [
        "Implement here-doc (`<<DELIM`) scaffolding only if syllabus unlocks redirection suite.",
        "Backslash-newline continuation can appear mid-command—defer until tests reference it explicitly.",
      ],
    ],
    objectives: [
      "Produce tokenizer golden vectors aligning byte-for-byte with fixture dumps.",
      "Differentiate EMPTY vs unrecognized operator tokens cleanly.",
      "Trace how token stream feeds future AST vs simple argv builder paths.",
    ],
  },
  "Built-ins: cd and exit": {
    paragraphs: [
      "`cd` mutates logical working directory respecting `-` prior path swap semantics if tests emulate bash-lite. Overflow errors propagate message templates required.",
      "`exit [n]` ends REPL respecting nested subshell stubs if course uses them minimally—typically top-level suffices.",
      "Built-ins bypass execve path search; unify exit code normalization to 8-bit truncation behavior (`256 → 0` etc.) per POSIX expectations harness encodes.",
    ],
    lapParagraphs: [
      [
        "`cd` to nonexistent path must not partially mutate cwd—atomic update after validation.",
        "`exit` with non-numeric arg prints standardized diagnostic & defaults exit 2 when spec demands.",
      ],
    ],
    objectives: [
      "Prove builtins run in-shell without fork overhead measurable via naive counter optional.",
      "Document environment variable `PWD` maintenance policy if syllabus references it.",
      "Compare builtin vs external `cd` impossibilities clarifying rationale.",
    ],
  },
  "External programs & PATH": {
    paragraphs: [
      "Resolve executable via segmented `PATH`; test current directory policy (`./prog` vs insecurity of implicit `.`). Windows vs POSIX exec differences usually abstracted.",
      "Pass argv[0] as program basename unless tests expect full path mirroring parity.",
      "Propagate child exit statuses (including signaled stops) collapsing to `$?`-style ints later stage.",
    ],
    lapParagraphs: [
      [
        "Optimize PATH lookup caching mtime invalidated map only if profiler stage appears.",
        "Shebang detection irrelevant—shell always execs binaries directly harness supplies.",
      ],
    ],
    objectives: [
      "Fail with ENOENT wording matching fixture expectations resolving missing cmds.",
      "Illustrate search order first match wins reproducibly.",
      "Relate ambient environment inheritance across exec boundaries.",
    ],
  },
  "Arguments & quoting": {
    paragraphs: [
      "After tokenization reconstruct argv arrays stripping outer quotes while preserving intentional inner spaces.",
      "Expand `$VAR` minimally when syllabus introduces assignment builtins & export semantics—defer full expansion puzzles until scaffolding lands.",
      "Globbing (`*?[`) optional—assume disabled until wildcard stage activates to avoid regressions.",
    ],
    lapParagraphs: [
      [
        "Support `$?` expansion referencing last foreground status when scripted tests appear.",
        "Escape sequences inside ANSI-C quoted `$'...'` may appear—implement only behind flag.",
      ],
    ],
    objectives: [
      "Pass nested quote scenarios without off-by-one buffer risks.",
      "Differentiate lexical vs runtime expansions pedagogically README note.",
      "Identify injection hazards naive string concat would enable.",
    ],
  },
  Pipelines: {
    paragraphs: [
      "Fork children wiring stdout of left process to stdin of right via `pipe()` (or equivalent). Maintain parent waiting for pipeline job group—all children closing writer FDs avoids deadlocks.",
      "Intermediate processes must dup2 ends before exec; close all superfluous inherited FD harness checks via `/proc`-like introspection mocks.",
      "Exit status policy: POSIX returns last foreground command unless tests define multi-status arrays.",
    ],
    lapParagraphs: [
      [
        "Optimize small-pipeline syscall fan-out only if benchmarking extension unlocks;",
        "Handle pipefail semantics toggling aggregate status when syllabus includes `set`.",
      ],
    ],
    objectives: [
      "Demonstrate deadlock-free chaining for three-stage pipeline harness stress case.",
      "Explain FD inheritance table pre/post dup2 sequencing.",
      "Compare implicit subshell nuances vs shells tracking process groups intricately.",
    ],
  },
  Redirections: {
    paragraphs: [
      "Support `>` truncate, `>>` append, `<` stdin from file descriptors duped before spawning external command. Ordering relative to argv matters when tests reorder tokens.",
      "Apply default FD numbers when omitted (`>foo` ⇒ stdout). Error if ambiguous merges appear unless tests script advanced merge operators later.",
      "Open flags must match O_CREAT|O_TRUNC semantics with default 0666 masked by umask stubs.",
    ],
    lapParagraphs: [
      [
        "Implement `2>&1` merge duplication referencing copied FD ints carefully closing extras.",
        "Here-string variant optional—defer until redirection suite references it explicitly.",
      ],
    ],
    objectives: [
      "Verify truncation vs append bitwise file tail differences hashing outputs.",
      "Trace open file descriptor table across builtin vs external distinctions.",
      "Enumerate failure codes when unreadable `<` paths surface prior exec.",
    ],
  },
  "Job control basics": {
    paragraphs: [
      "Introduce process groups & background `&`: parent doesn’t wait immediately; reap via `waitpid(-1)` loops until harness signals stop. Initially ignore interactive job table UI.",
      "Implement `jobs` builtin listing statuses running/stopped enumerated insertion order simplistic.",
      "Foreground resumes `fg %n` minimally when stubs appear—might be later stage synergy.",
    ],
    lapParagraphs: [
      [
        "Graceful handling SIGTSTP stub simulates terminal stop continuing with SIGCONT scripted.",
        "Track pgid allocations ensuring pipeline shares single group id POSIX pattern.",
      ],
    ],
    objectives: [
      "Demonstrate orphaned background grandchildren re-parented expectations via harness mocking.",
      "Differentiate synchronous wait vs asynchronous notification pathways.",
      "Summarize portability traps job control entails on minimal kernels.",
    ],
  },
  "Signals & subprocess lifetime": {
    paragraphs: [
      "Ensure SIGINT to shell forwards default policy to foreground process group—not entire session. Ignored disposition inheritance rules follow POSIX tables harness encodes selectively.",
      "Reentrancy cautious: signal handlers minimal—set atomic flag processed main loop cooperative.",
      "Zombie avoidance: reap background children opportunistically on each prompt render.",
    ],
    lapParagraphs: [
      [
        "Implement timeout wrapper using alarm or platform analog only if syllabus extends.",
        "Mask signals during critical fork/exec sections narrowing race windows testers hunt.",
      ],
    ],
    objectives: [
      "Produce transcripts showing Ctrl+C terminating running child not shell itself.",
      "Explain difference between ignoring vs default vs custom handlers across exec.",
      "Relate zombie accumulation symptoms tests assert absence of leaking PIDs.",
    ],
  },
  "Working directory edge cases": {
    paragraphs: [
      "Detect removed cwd (`getcwd` failure) gracefully prompting user remediation message consistent with syllabus.",
      "`cd` chain into symlinked dirs: logical vs physical path tracking discrepancies surfaced by tests referencing `-P`.",
      "Normalize redundant `.`/`..` components only when flags demand physical resolution.",
    ],
    lapParagraphs: [
      [
        "Observe platform max path constraints returning structured errno mapping.",
        "Support UNC paths Windows coursework variant may supply separate harness.",
      ],
    ],
    objectives: [
      "Prove reproducible cwd state machine transitions across scripted removal fixtures.",
      "Contrast logical vs physical directory identity scenarios.",
      "Prepare foundation for completions using cwd metadata later optionally.",
    ],
  },
  "Environment inheritance": {
    paragraphs: [
      "Startup snapshot environment as owned map mutation copies only on export-like builtins altering child views without leaking unexpected keys unless tests forbid.",
      "Implement `export NAME=VALUE` merges & removals `unset`; ordering stable iteration printing `env`.",
      "Prefix duplicate keys last-wins aligning with posix spawn expectations harness validates.",
    ],
    lapParagraphs: [
      [
        "Freeze env block hashing snapshot each prompt optional introspection tooling.",
        "Simulate gigantic env payloads measuring spawn overhead truncation policies.",
      ],
    ],
    objectives: [
      "Demonstrate child processes inherit mutated exported vars distinctly from ephemeral shell-only bindings.",
      "Validate unset removes from map & subsequent exec visibility.",
      "Discuss security implications dumping environment into logs verbatim.",
    ],
  },
};

export const PATTERN_MATCHER_CONTENT: Record<string, LessonTopicBlock> = {
  "Reading streams efficiently": {
    paragraphs: [
      "Stream processing avoids loading entire corpus when scanning logs; chunked reads interplay with newline boundaries for incremental matching.",
      "Buffer resizing strategy: amortized doubling vs fixed slab reuse—latency vs memory trade testers may assert rough bounds indirectly.",
      "Binary vs text distinction: NUL handling early exit rules differ from naive regex engines silently scanning bytes.",
    ],
    lapParagraphs: [
      [
        "Add mmap pathway guarded feature flag benchmarking extension.",
        "Simulate slow consumer backpressure cooperating cooperative scheduling hints.",
      ],
    ],
    objectives: [
      "Prove identical match counts vs reference implementation chunked fixture streams.",
      "Explain why partial buffering across chunk edges can duplicate or skip matches wrongly if misaligned.",
      "Enumerate OS read syscall batching amortization motivations.",
    ],
  },
  "Literal & dot patterns": {
    paragraphs: [
      "Literal fragments compile to straightforward substring or single-token NFAs; '.' matches arbitrary byte excluding newline depends on POSIX mode syllabus toggles.",
      "Escape dot as `\\.` and escape metachars generically layering lexer pass—avoid lookahead explosion.",
      "Anchoring interplay begins next stages; still model implicit unanchored scans now.",
    ],
    lapParagraphs: [
      [
        "Treat UTF-8 codepoints atomically vs raw bytes divergence course clarifies;",
        "Add possessive `.++` forbid unless extended regex stage unlocks—not standard POSIX.",
      ],
    ],
    objectives: [
      "Compile literals so repeated scans reuse cached structure amortizing parse cost.",
      "Differentiate dot-all (?s-style) hypothetical vs default single-line semantics.",
      "Trace translation from AST nodes to NFA edges for literals.",
    ],
  },
  "Character classes": {
    paragraphs: [
      "Bracket expressions `[abc]`, ranges `[a-z]`, negation `[^...]`. Collating sequences abstracted—POSIX locale tables ignored unless syllabus supplies fixture subset.",
      "Dash placement rules ambiguous edges `[-^]` escapes—follow harness golden parse decisions.",
      "Character class intersection `&&` not implemented unless expressly introduced.",
    ],
    lapParagraphs: [
      [
        "Optimize bitmap vs sparse set representation toggling cardinality thresholds.",
        "Support Unicode property classes `\p{L}` gated extension tests might skip.",
      ],
    ],
    objectives: [
      "Generate NFAs rejecting empty classes with diagnostic messages tests assert.",
      "Verify range endpoints ordered regardless user input lexical order rewriting internally.",
      "Describe distinction POSIX vs ASCII vs Perl class semantics educationally README.",
    ],
  },
  Quantifiers: {
    paragraphs: [
      "`? * + {m,n}` greediness fundamentals; eventual lazy `*?` support maybe staged harness toggles quantify.",
      "Expand bounded `{m,m}` deterministic unrolling optimizing hot tiny loops optional.",
      "Protect against exponential blowups enumerating dubious nested stars early—emit compile-time limits.",
    ],
    lapParagraphs: [
      [
        "Construct counting DFAs for `{m,n}` pure literal subsequences micro-optimization;",
        "Add possessive repeat parsing erroring if nested lazies conflict policy.",
      ],
    ],
    objectives: [
      "Match catastrophic backtracking stress fixtures within bounded steps or reject at compile.",
      "Explain greedy vs reluctant quantifiers using a tiny concrete trace.",
      "Reject invalid `{m,n}` ranges with a stable parse error.",
    ],
  },
  "Groups & captures": {
    paragraphs: [
      "Parentheses delineate subpatterns for captures and repetition scope. Tracks capture spans as start/end offsets; non-capturing `(?:)` keeps grouping without numbering.",
      "POSIX leftmost-first matching means earlier alternates win ties; greedy quantifiers revisit capture endpoints as they backtrack—keep bookkeeping consistent with your NFA/VM semantics.",
      "Optional named captures/backrefs arrive only when your harness enables them.",
    ],
    lapParagraphs: [
      [
        "Treat nested groups as contiguous capture slots numbered at compile time.",
        "Surface clear errors when `\\99` exceeds capture count.",
      ],
    ],
    objectives: [
      "Return substring indices matching golden transcripts for overlapping capture cases.",
      "Differentiate grouping for precedence vs grouping for extraction.",
      "Demonstrate correctness on alternation inside parentheses with quantifiers.",
    ],
  },
  Alternation: {
    paragraphs: [
      "`|` combines alternatives with lower precedence than concatenation—parse tree shape matters when mixing with anchors and greedy quantifiers.",
      "Preserve deterministic evaluation order; emulate POSIX semantics by trying left alternatives before resolving later ones.",
      "Normalize duplicate branches only as an optimization behind tests that allow behavioural equivalence.",
    ],
    lapParagraphs: [
      [
        "Warn on empty alternatives if your tooling ships diagnostics.",
        "Factor shared prefixes lazily unless it risks changing match boundaries.",
      ],
    ],
    objectives: [
      "Produce identical matches versus reference output on branching fixtures.",
      "Explain why naive alternation exploding works but compiled NFAs amortize scans.",
      "Enumerate interactions between anchors and trailing alternates.",
    ],
  },
  "Anchors & boundaries": {
    paragraphs: [
      "`^` and `$` constrain matches to logical line boundaries (`\\n`-delimited) unless DOTALL/multi-line modifiers change meanings per your syllabus.",
      "Word-boundary escapes (`\\b`) compare categories of adjacent chars—typically ASCII alphanumeric vs not for early stages.",
      "Watch final-newline quirks: `$` semantics differ subtly between implementations; follow your golden files.",
    ],
    lapParagraphs: [
      [
        "Treat UTF-aware boundaries behind an explicit `--unicode` mode if staged.",
        "Fail safe on patterns mixing conflicting anchor modifiers.",
      ],
    ],
    objectives: [
      "Match anchored patterns on CRLF-terminated corpora deterministically.",
      "Differentiate \\A / \\z style anchors if the harness introduces Perl-like extensions.",
      "Trace false positives caused by misunderstanding multiline anchors.",
    ],
  },
  "Backtracking limits": {
    paragraphs: [
      "Bound work per NFA step counter or bytecode VM tick budget so crafted patterns cannot stall indefinitely.",
      "Record where the matcher last made progress (`at` pointer) versus retry depth.",
      "Optionally expose a compile-time recursion/choice-point depth cap rejecting risky patterns eagerly.",
    ],
    lapParagraphs: [
      [
        "Classify overrun as engine abort vs mismatch based on syllabus wording.",
        "Log hottest choice points optionally for debugging regressions locally.",
      ],
    ],
    objectives: [
      "Survive exponential stress strings without exhausting memory under configured caps.",
      "Explain catastrophic backtracking with a minimalist counterexample drawn from coursework.",
      "Compare policy trade-offs silent timeout vs surfaced error.",
    ],
  },
  "Performance: NFA vs naive": {
    paragraphs: [
      "Compiled automata scan inputs in roughly linear time in input length versus naive substring tries that repeatedly rescan prefixes.",
      "Cache compiled programs keyed by normalized pattern strings to amortize parse overhead across many files.",
      "Optional deterministic-subset caching (subset construction DFAs) is an advanced elective; keep NFA interpretation passing tests first.",
    ],
    lapParagraphs: [
      [
        "Microbench scripted comparisons only when extension tasks request quant numbers.",
        "Keep compile caches bounded with LRU eviction in long-lived daemons hypothetical stretch.",
      ],
    ],
    objectives: [
      "Plot scan time scales demonstrating compiled engine superiority on repetitive corpora.",
      "Describe when naive methods remain instructive academically despite poor scaling.",
      "Instrument cache hit ratios to validate reuse across batch greps.",
    ],
  },
  "Unicode edge cases": {
    paragraphs: [
      "UTF-8 multibyte sequences must not slice mid-codepoint when reporting matches; iterators should advance scalar boundaries when Unicode mode engages.",
      "Reject illegal byte sequences eagerly if syllabus injects malformed inputs.",
      "ASCII case folds differ from Unicode case folds—document which regime you adopted.",
    ],
    lapParagraphs: [
      [
        "Normalize to NFC/NFD only behind explicit switches if ever required.",
        "Guard against gigantic combining stacks DoSing canonicalization.",
      ],
    ],
    objectives: [
      "Return stable indices on mixed ASCII/Unicode fixtures matching byte expectations spelled out tests.",
      "Explain why \\uXXXX escapes widen beyond single-byte scanners.",
      "Contrast grapheme-aware vs scalar-aware matchers conceptually.",
    ],
  },
  "CLI glue & flags": {
    paragraphs: [
      "Mirror common grep ergonomics `-i` insensitive, `-n` line prefixes, `-E` extended patterns (if named this way)—exit codes distinguishing no match vs error when specified.",
      "Honor operand ordering: stdin when no operands, sequential files otherwise, consistent column formatting for machine-readable diffs.",
      "Treat binary detection heuristically (NUL sentinel) refusing to corrupt terminals when tests assert binary skip messaging.",
    ],
    lapParagraphs: [
      [
        "Expose `--debug-ast` only for local workflows—keep CI output stable.",
        "Disallow contradictory flag combos with actionable stderr snippets.",
      ],
    ],
    objectives: [
      "Pass CLI snapshot tests asserting argv parsing edge cases verbatim.",
      "Document supported flag matrix vs GNU grep deviations intentionally narrowed scope.",
      "Verify exit codes interoperate cleanly with scripted shell harnesses chaining pipes.",
    ],
  },
  "Golden tests": {
    paragraphs: [
      "Freeze regressions snapshotting stdout/stderr/exit bundles per corpus shard; review diffs rather than blindly regenerating blindly when behaviour shifts.",
      "Whitespace sensitivity may be deliberate—preserve unless guidelines explicitly normalize trailing newlines.",
      "When triaging failures, rerun single shards under verbose compile logging (pattern IR) if your scaffolding supports it.",
    ],
    lapParagraphs: [
      [
        "Add CI job asserting golden directories remain byte-stable across architectures expected environment.",
        "Track snapshot version metadata documenting generator revision when bulk updates unavoidable.",
      ],
    ],
    objectives: [
      "Ship with full golden suite passing after substantive engine refactors validating parity milestone.",
      "Author contributor docs describing regenerating/updating corpus workflow guarded review expectations.",
      "Summarize toolchain coverage tokenization through CLI integration succinctly README closing note.",
    ],
  },
};