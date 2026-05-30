import type { LessonTopicBlock } from "../types";

export const KV_STORE: Record<string, LessonTopicBlock> = {
  "TCP listener & accept loop": {
    paragraphs: [
      "Bind a TCP port, set SO_REUSEADDR if the harness expects fast restarts, and accept connections in a loop. Each peer should get its own buffered reader/writer so partial frames never corrupt another client’s parse state.",
      "Decide early whether you multiplex clients on one thread with non-blocking sockets or dedicate a thread/task per connection—stay consistent with the course’s deadlock and fairness tests.",
      "Propagate shutdown cleanly: when the listener closes, in-flight handlers should flush or abort per spec so CI does not hang on open sockets.",
    ],
    lapParagraphs: [
      [
        "Cap the accept backlog and document how overloaded arrival bursts behave versus silent kernel drops.",
        "Add a deterministic connection-id counter for logs without leaking OS handles in test output.",
      ],
    ],
    objectives: [
      "Demonstrate orderly accept → serve → teardown for scripted multi-client probes.",
      "Explain how buffering hides or exposes TCP’s byte-stream nature versus message boundaries.",
      "Relate backlog, kernel queues, and user-space read readiness to observable latency spikes.",
    ],
  },
  "Framing & request parsing": {
    paragraphs: [
      "Redis-style textual protocols thrive on deterministic delimiters—often CRLF-terminated lines plus quoted bulk strings whose length prefixes must be verified before slicing payload bytes.",
      "Reject oversized frames eagerly: track a max argument count, bulk length, and total buffer growth so a malicious peer cannot force unbounded allocations.",
      "Parse errors belong on the wire exactly as fixtures demand; stray bytes after a failed frame should not leave the codec in an undefined recovery state.",
    ],
    lapParagraphs: [
      [
        "Fuzz-ish tests may interleave LF-only and CRLF—normalize only if syllabus explicitly permits.",
        "Unit-test tokenizer edge cases independently from TCP glue to isolate regressions.",
      ],
    ],
    objectives: [
      "Recover synchronously after a bad frame without desynchronizing subsequent commands on the same connection.",
      "Contrast length-prefixed bulk strings versus simple inline tokens pedagogically.",
      "Measure parser throughput sensitivity to memcpy boundaries on large payloads.",
    ],
  },
  "Ping / handshake": {
    paragraphs: [
      "Most toy servers start with AUTH/ECHO/PING pairs to prove encoding symmetry and versioning. Returning +PONG or structured OK frames teaches clients that serialization matches expectations.",
      "If multi-step handshakes exist, stash negotiated capabilities (timeouts, eviction policies) immutably for the lifetime of that connection.",
      "Handshake failures must not leak partially initialized shards—reset command tables and buffers on error paths.",
    ],
    lapParagraphs: [
      [
        "Backward-compat flags can be gated behind optional argv when replication stages arrive later.",
        "Emit structured telemetry only when tests opt in — keep default transcripts byte-stable.",
      ],
    ],
    objectives: [
      "Produce golden transcripts proving command echo and capability advertisement.",
      "Describe why naive echo servers skip validation but real stores pin protocol revisions.",
      "Enumerate failure modes: wrong arity, unsupported verb, malformed inline argument.",
    ],
  },
  "String values": {
    paragraphs: [
      "Associate opaque byte keys with opaque byte values at minimum; layering UTF-8 validation is syllabus-specific.",
      "SET should replace atomically—readers observing either prior or new snapshot, never torn writes. NX/XX/ex/TTL knobs appear stage-by-stage; ignore flags until unlocked.",
      "GET misses return nil-like sentinels, not exceptions, unless specs demand error bursts for missing keys.",
    ],
    lapParagraphs: [
      [
        "Preallocate small-string buffers for microbench stages when vectorized copies shave microseconds.",
        "Track memory high-water internally even before persistence enforces quotas.",
      ],
    ],
    objectives: [
      "Prove linearizability against single-threaded reference traces for overlapping SET/GET.",
      "Contrast logical DELETE versus tombstone TTL representations before expiry stages merge.",
      "Document endianness-neutral value storage if numeric casts appear only in lectures.",
    ],
  },
  "Keyspace & expiry": {
    paragraphs: [
      "Model passive expiry: TTL fields stored with each slot, evaluated lazily on access and actively via periodic sweeps depending on SLA tests.",
      "Eviction policies—volatile-LRU-ish vs TTL-first—impact harness timing; codify deterministic tie-breaking when timestamps collide.",
      "Flushing subsets (DB index selection) interacts with iterators; traversal must resist concurrent mutation per spec.",
    ],
    lapParagraphs: [
      [
        "Adaptive sampling for sweeping reduces CPU chatter when workloads are sparse.",
        "Freeze wall-clock stubs in CI so flaky timing tests become reproducible.",
      ],
    ],
    objectives: [
      "Assert post-expiry reads behave identically regardless of eviction schedule ordering.",
      "Explain memory freed eagerly vs resurrected phantom keys when clocks jump backward.",
      "Trace iterator consistency when keys disappear mid-scan.",
    ],
  },
  "Lists & queues": {
    paragraphs: [
      "Implement deque semantics for LPUSH/RPOP-style pairs with O(1) ends; random access edits may be staged later.",
      "Blocking pop operations require wait queues and handshake with connection shutdown—wake waiters unconditionally on peer close.",
      "Empty lists should serialize distinctly from missing keys depending on syllabus nuance.",
    ],
    lapParagraphs: [
      [
        "Coalesce wakeup storms when producers burst—optional batch notify behind feature flag.",
        "Cap blocking waiters to avoid memory leaks from abandoned TCP sessions.",
      ],
    ],
    objectives: [
      "Demonstrate fairness or FIFO waiter ordering spelled out by tests.",
      "Differentiate transactional vs non-transactional multi-push atomicity milestones.",
      "Summarize deadlock risks when chaining blocking primitives across shards.",
    ],
  },
  Hashes: {
    paragraphs: [
      "Maps inside a logical key emulate field→value dictionaries; HSET/HGET should share memory layout optimizations with primary string maps when sensible.",
      "Partial updates must not reshape unrelated fields; deleting the last field may remove outer key per policy.",
      "Serialization for persistence often walks fields in deterministic sort order—decide lexical vs insertion order upfront.",
    ],
    lapParagraphs: [
      [
        "Bloom-filter style presence checks premature for scope—defer until probabilistic elective.",
        "Track average field cardinality to choose array vs chained bucket representation.",
      ],
    ],
    objectives: [
      "Maintain hash-specific and top-level TTL semantics consistently across nested structures.",
      "Compare pointer-chasing overhead vs inlined small-hash arrays on micro-fixtures.",
      "Validate round-trip symmetry with RESP-style multi-bulk payloads if applicable.",
    ],
  },
  Transactions: {
    paragraphs: [
      "MULTI/EXEC wrappers queue commands deterministically until commit; queued failures should abort cleanly with rolled-back side effects.",
      "WATCH-style optimistic checks pin versions of keys; implement compare-and-swap semantics before accepting EXEC.",
      "Nested transactions rarely exist—reject or flatten per reference implementation expectations.",
    ],
    lapParagraphs: [
      [
        "Log command journals for future AOF stages even if append-only replay stays disabled.",
        "Stress cross-key conflicts to prove serializability within the single-server model.",
      ],
    ],
    objectives: [
      "Prove all-or-nothing batches against interleaved single commands in harness timelines.",
      "Explain why naive locking without version checks breaks WATCH-style tests.",
      "Enumerate timeout interactions when EXEC never arrives after MULTI.",
    ],
  },
  "Replication sketch": {
    paragraphs: [
      "Primary streams a logical append log to secondaries; minimum viable replica applies operations idempotently with monotonic sequence numbers.",
      "Lag metrics and partial sync belong in observability stages—start with full resync on reconnect if tests allow.",
      "Split-brain is out of scope unless leader election toy appears in log-broker pairing—document assumptions.",
    ],
    lapParagraphs: [
      [
        "Checksum each payload chunk to catch truncated writes on flaky loopback tests.",
        "Throttle replica catch-up to avoid starving interactive clients if fairness tests appear.",
      ],
    ],
    objectives: [
      "Demonstrate deterministic convergence after primary restarts with preserved log.",
      "Contrast logical op replays versus state snapshot shipping trade-offs.",
      "Identify single points of failure remaining in the sketch architecture.",
    ],
  },
  "Persistence snapshot": {
    paragraphs: [
      "Fork-on-write or stop-the-world dumps capture keyspace into versioned files; streaming writers must flush headers before body to detect partial files on crash.",
      "Compression and checksum sections may be optional—honor magic bytes and backward-compatible version fields even if v1 is only reader.",
      "Recovery replays snapshot then optional journal if combined mode unlocks later.",
    ],
    lapParagraphs: [
      [
        "Memory-map read paths accelerate huge reloads on supported platforms behind cfg flags.",
        "Parallelize serialization only if determinism tests permit sorted key output.",
      ],
    ],
    objectives: [
      "Reload identical keyspace after SIGKILL-simulated crash mid-write when tests provide fault injection hooks.",
      "Explain trade-offs between snapshot frequency and durability windows.",
      "Verify integrity checks reject corrupted tail segments with actionable errors.",
    ],
  },
  "Failure injection": {
    paragraphs: [
      "Testing harnesses may drop writes, delay flushes, or corrupt files—wrap IO behind interfaces you can stub.",
      "Partial reads should surface retriable errors distinct from protocol violations.",
      "On restart, reconcile in-memory caches with recovered durable state atomically.",
    ],
    lapParagraphs: [
      [
        "Chaos sleeps inject races between compaction and foreground SET operations.",
        "Record seedable PRNG timelines for flaky reproduction bundles.",
      ],
    ],
    objectives: [
      "Pass fault suites without leaking file descriptors after simulated ENOSPC.",
      "Describe crash-consistency journaling versus write-ahead log pedagogy succinctly README.",
      "Compare user-visible error codes when disk paths fail versus network paths.",
    ],
  },
  "Performance guardrails": {
    paragraphs: [
      "Batch syscall-heavy paths: vectorized reads/writes where safe, amortized hashing, minimally contended locking when moving beyond single-threaded cores.",
      "Instrument p50/p99 stage metrics only behind flags—silent hot loops should stay deterministic for golden perf thresholds if provided.",
      "Guard against algorithmic regressions—O(N) scans on dictionaries where O(1) expected must fail benchmarks loudly.",
    ],
    lapParagraphs: [
      [
        "Adaptive thread pools premature—profile before parallelizing serializer.",
        "Optional jemalloc/tcmalloc notes belong in appendix not blocking tests.",
      ],
    ],
    objectives: [
      "Meet ceiling harness limits while preserving correctness properties from earlier milestones.",
      "Justify structural sharing vs duplication with measured wins on provided workloads.",
      "Document tunables (bucket count, slab size) influencing steady-state throughput.",
    ],
  },
};

export const INTERPRETER: Record<string, LessonTopicBlock> = {
  "Lexer & tokens": {
    paragraphs: [
      "Scan UTF-8 or byte streams into token kinds covering keywords, literals, punctuation, identifiers, template chunks—whatever gram the syllabus freezes.",
      "Attach source spans (line/col offsets) eagerly; downstream errors without locations frustrate debugger stages.",
      "Handle tricky lexemes early: nested comments, string escapes, ambiguous `/` divides vs regex contexts if staged.",
    ],
    lapParagraphs: [
      [
        "Backoff strategies for indentation-sensitive languages appear later—keep indentation tokens virtualized only when tests flip flags.",
        "Cache keyword trie matches to shave nanoseconds optional micro elective.",
      ],
    ],
    objectives: [
      "Emit golden token streams for provided fixtures byte-for-byte including trivia policy.",
      "Explain maximal munch vs contextual keywords with concrete counterexamples.",
      "Differentiate lexer errors from parse errors in stderr messaging.",
    ],
  },
  "Recursive descent parsing": {
    paragraphs: [
      "Map each nonterminal to a function; use lookahead tables or single-token peek to disambiguate alternates per LL(1)-ish constraints the course sets.",
      "Left recursion must be refactored into loops or pruned—direct recursive calls will stack overflow on stress inputs.",
      "Synchronize error recovery on statement boundaries only if syllabus demands resilient REPL behavior.",
    ],
    lapParagraphs: [
      [
        "Pratt parsing alternative path may appear for expression precedence—switch implementations behind trait when tests branch.",
        "Trace parse stack depth to catch accidental quadratic behaviour on degenerate nests.",
      ],
    ],
    objectives: [
      "Produce AST snapshots matching reference dumps for ambiguity regression packs.",
      "Diagram call graph from start symbol to leaf literals for a miniature grammar.",
      "Enumerate grammar conflicts discovered during FIRST/FOLLOW audits.",
    ],
  },
  "AST nodes": {
    paragraphs: [
      "Freeze a small algebraic hierarchy covering expressions, statements, declarations; tag variants explicitly rather than shoehorning booleans everywhere.",
      "Keep nodes immutable beyond construction when analyses rely on structural sharing caches.",
      "Pretty-print walkers double as sanity checkers ensuring spans cover children ranges.",
    ],
    lapParagraphs: [
      [
        "Arena allocation optional—measure before ripping out naive Box-per-node.",
        "Visitor vs fold patterns: pick one codebase-wide convention early.",
      ],
    ],
    objectives: [
      "Navigate AST for sample programs without resorting to string round-trips.",
      "Contrast fat nodes carrying types vs skinny nodes plus side tables pedagogically.",
      "Validate serializers preserve structural equality modulo source trivia.",
    ],
  },
  "Symbols & blocks": {
    paragraphs: [
      "Scope chains link environments; introduce/resolve lookups walk outward until global sentinel.",
      "Block scopes shadow outer names cleanly; uninitialized bindings flagged per temporal dead-zone rules syllabus copies from JS/Python subset.",
      "Module vs function vs script top-level distinctions matter once imports staged.",
    ],
    lapParagraphs: [
      [
        "Defer hoisting quirks until flagged tests cite them explicitly.",
        "Intern identifiers to dedupe strcmp hot paths optionally.",
      ],
    ],
    objectives: [
      "Resolve lexical vs dynamic scoping misconceptions with traceable diagrams.",
      "Demonstrate forbidden redeclaration cases with deterministic diagnostics.",
      "Explain environment extension when entering function bodies versus plain blocks.",
    ],
  },
  Expressions: {
    paragraphs: [
      "Encode precedence via layered parsers or Pratt loops; mirror language tables exactly—off-by-one level flips associative semantics.",
      "Short-circuit `&&`, `||`, `?:` hinges on visitation order in evaluator later—AST shape must expose branches distinctly.",
      "Literals coerce per spec; avoid prematurely constant-folding floats if tests introspect midway forms.",
    ],
    lapParagraphs: [
      [
        "Overload resolution placeholder nodes may defer decisions until typing stage intersects.",
        "Guard against unary/binary mixups with exhaustive token-pattern tests.",
      ],
    ],
    objectives: [
      "Evaluate sample trees to expected constants without executing via bytecode prematurely.",
      "Illustrate left vs right associativity with parentheses-free examples.",
      "Trace failure points when mixing postfix increment-like sugar if introduced.",
    ],
  },
  Statements: {
    paragraphs: [
      "Control-flow nodes include loops, branching, jumps; each must carry spans for labelled break simulations if syllabus hints at JVM-like constructs.",
      "Variable declarations intertwine initializer visibility—decide sequential vs simultaneous binding models per language subset.",
      "Return statements exit nearest function; disallow top-level stray returns unless scripted REPL forbids.",
    ],
    lapParagraphs: [
      [
        "Desugar for-of iterations into iterators when lowering pipeline unlocks.",
        "Emit unstructured-control warnings locally without failing parse unless severity demands.",
      ],
    ],
    objectives: [
      "Construct CFG sketches for looping programs without executing them.",
      "Differentiate expressions used as statements from pure expression grammar.",
      "Enumerate definite-assignment checkpoints if Boolean short-circuit affects locals.",
    ],
  },
  "Functions & calls": {
    paragraphs: [
      "Parameters bind positionally early; defaults/rest/spread arrive as incremental unlocks respecting arity mismatch errors verbatim.",
      "Call nodes reference callee expressions—allow higher-order invokes without restricting to identifiers only.",
      "Tail-call posture may influence frame layout downstream; annotate calls when optimization stage activates.",
    ],
    lapParagraphs: [
      [
        "Variadic bridging to native stubs optional extension—guard behind FFI flag.",
        "Inline candidate detection belongs to optimizer—not parser—avoid eager rewrite.",
      ],
    ],
    objectives: [
      "Illustrate call stack growth on nested recursion harness programs.",
      "Describe strict vs lazy evaluation of arguments per language choice.",
      "Verify `this`/receiver binding quirks if OO subset lands mid-course.",
    ],
  },
  Closures: {
    paragraphs: [
      "Capture environments by copying vs cells—Rust-like moves differ from GC language shared pointers; obey syllabus memory story.",
      "Upvalue indices should stabilize through closure conversion passes before codegen.",
      "Escaping closures extend lifetime of captured locals—lifetime errors vs runtime leaks differ by track.",
    ],
    lapParagraphs: [
      [
        "Flatten nested functions to anonymous structs when lowering to flat bytecode.",
      ],
    ],
    objectives: [
      "Execute counter-style closure tests yielding independent accumulators.",
      "Explain stale closure pitfalls with loop-bound lambdas textbook example.",
      "Compare flat closure environments against map-based slow paths performance-wise.",
    ],
  },
  "Errors & stack traces": {
    paragraphs: [
      "Standardize error types: syntax, runtime, assertion; each carries message + span list for multi-primary highlights.",
      "Stack frames record function names, instruction pointers, optional locals snapshot when verbose mode on.",
      "Cause chaining surfaces inner interpreter failures distinct from userland throws.",
    ],
    lapParagraphs: [
      [
        "Source map round-trips optional—embed filename + line only when tests assert.",
        "Cap stack depth printing to avoid pathological recursion blowups in logs.",
      ],
    ],
    objectives: [
      "Match golden stderr traces line-for-line including caret alignment.",
      "Differentiate catchable vs fatal runtime errors per spec matrix.",
      "Teach students to read frame translation back to original source.",
    ],
  },
  "Standard library hooks": {
    paragraphs: [
      "Expose builtins table mapping names to native callbacks with arity validators shared across embedders.",
      "Sandboxes may forbid IO—gate file/network primitives behind capability tokens when security stage lands.",
      "Version the std surface; deprecations warn but remain callable until removal milestone.",
    ],
    lapParagraphs: [
      [
        "FFI dynamic loading deferred—statically link reference natives for reproducibility.",
      ],
    ],
    objectives: [
      "Demonstrate round-trip print/read of values through minimal std coverage.",
      "Document host injection points for tests replacing clock/random sources.",
      "Enumerate idempotency requirements for repeatable REPL transcripts.",
    ],
  },
  "Garbage collection sketch": {
    paragraphs: [
      "Trace roots from globals, stacks, natives; traverse object graphs marking reachable nodes.",
      "Sweep or copy collections depend on moving vs non-moving policy—moving needs pointer fixups in stacks.",
      "Generational hypothesis optional elective—stick to naive mark-sweep until perf tasks demand.",
    ],
    lapParagraphs: [
      [
        "Finalizers mostly absent until OOM stages—explicitly forbid resurrection initial passes.",
      ],
    ],
    objectives: [
      "Reclaim cycles only if marks sweep whole heap—not reference counting naive path.",
      "Explain stop-the-world pauses qualitative impact versus incremental sketches.",
      "Relate rooting strategy to FFI objects handed to host runtime.",
    ],
  },
  "Bytecode shortcut (optional)": {
    paragraphs: [
      "Lower AST to compact opcodes—constants pooled, jumps patch forward labels in two-pass assembly.",
      "Stack depth analysis validates balanced push/pop before executing hostile inputs.",
      "Disassembler pretty-prints aligning opcodes with source spans for debugging.",
    ],
    lapParagraphs: [
      [
        "Peephole optimization window tiny—constant folding safe ops only.",
        "Interpreter loop switch-based vs threaded dispatch benchmarking optional.",
      ],
    ],
    objectives: [
      "Execute reference programs yielding identical observable IO vs tree interpreter path.",
      "Map opcode budget to asymptotic slowdown factors vs naive AST walking.",
      "Plan extension opcode slots without breaking backwards compatibility snapshots.",
    ],
  },
};
