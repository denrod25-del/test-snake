import type { LessonTopicBlock } from "../types";

export const VCS_CORE: Record<string, LessonTopicBlock> = {
  "Blob objects": {
    paragraphs: [
      "Git-style systems store snapshots as blobs: raw bytes hashed with SHA-1 (here, mimic the naming with your course’s mandated algorithm). Objects live in `.git/objects/xx/yy…` keyed by hex digest—your job is canonical serialization exactly as tests describe (header format, NUL separator, zlib if required).",
      "Implement blob write: accept file path or stdin, compute ID, refuse overwrites silently if object exists already (same as plumbing `git hash-object`). Expose helpers your tree layer will call later.",
      "Tests will diff bytes verbatim; avoid platform-specific line endings on stored contents unless instructed. Log errors to stderr, keep stdout for printed hashes only.",
    ],
    lapParagraphs: [
      ["Add streaming reads for huge files so RAM stays bounded.", "Expose a `--stdin` parity flag even if unused in early tests—they often appear stage-by-stage."],
    ],
    objectives: [
      "Serialize a blob with the exact header + body layout the suite expects and compress if spec says so.",
      "Return the same object ID twice when given identical input (idempotent writes).",
      "Explain why blob storage deduplicates identical file versions across commits.",
    ],
  },
  "Tree objects": {
    paragraphs: [
      "Trees map path segments to blobs or subtree trees—each tree entry packs mode, SHA, and basename. Unlike POSIX directories, filenames are opaque bytes with fixed encoding rules spelled out by tests.",
      "Implement `write-tree`-like plumbing: recursively walk staged paths (or synthesized tree lines in tests), sort entries lexically by filename (critical for stable hashes), reuse existing blob hashes from prior stage.",
      "Modes matter: executable bit vs regular files must round-trip deterministically.",
    ],
    lapParagraphs: [
      ["Handle nested folders without assuming depth limits.", "Reject duplicate names in same tree with the error message format tests assert."],
    ],
    objectives: [
      "Construct a deterministic tree serialization given a defined directory fixture.",
      "Prove stable ordering: two builds on same input produce identical tree IDs.",
      "Walk from tree ID to list (mode, name, object-id) per entry for diff/status later.",
    ],
  },
  Commits: {
    paragraphs: [
      "Commits point to exactly one tree and zero or more parent commits, plus metadata: author/committer timestamps, timezone, multi-line messages with blank line separators.",
      "Format matches git’s loose object conventions: concat headers, NULs where required. Parent ordering affects hash—follow spec when merge commits introduce multiple parents.",
      "Expose read-path: peel commit headers for parent chain & tree link so log works later.",
    ],
    lapParagraphs: [
      ["Support both single-parent and octopus-style placeholders if harness injects merges.", "Validate that missing tree hashes fail loudly before writing commit."],
    ],
    objectives: [
      "Create a commit object linking HEAD’s tree hash with correct parent ancestry.",
      "Parse commit blobs back into structured fields usable by CLI commands.",
      "Describe how commit hash immutably captures parent graph + snapshot reference.",
    ],
  },
  "Refs & HEAD": {
    paragraphs: [
      "Refs are movable pointers (`refs/heads/main`, tags). HEAD may be symbolic (points to branch ref) or detached (stores raw SHA). Persist updates atomically; tests simulate concurrent writers sometimes via temp files.",
      "Implement `update-ref`-style semantics: refusal on non-fast-forward when asked, hash validation before write.",
      "Branch creation should default off current HEAD symbolic target unless staged otherwise.",
    ],
    lapParagraphs: [
      ["Support packed-refs ingestion if starter template enables it—they often sneak it mid-course.", "Detect corrupt ref files and surface stderr guidance required by tests."],
    ],
    objectives: [
      "Read/write refs with deterministic ordering on directory scans.",
      "Toggle HEAD symbolic vs detached while preserving reflog stubs if mandated.",
      "Explain fast-forward moves vs merges at ref layer only.",
    ],
  },
  "Status command": {
    paragraphs: [
      "Status aggregates three views: HEAD tree vs index, index vs working tree (untracked/modified/deleted). Keep performance secondary to correctness.",
      "Map paths relative to repo root; honor ignore rules precisely as simplified glob subsets from tests—not full gitignore semantics unless specified.",
      "Output columns (XY path) mimic porcelain enough for scripted diffing.",
    ],
    lapParagraphs: [
      ["Add rename detection stubs only if flagged—avoid changing stable output otherwise.", "Cache stat() results sparingly—hidden tests compare syscall counts loosely."],
    ],
    objectives: [
      "List staged/unstaged/untracked buckets without false positives.",
      "Report mode changes distinctly from content changes.",
      "Document assumptions about line-ending normalization impacting status classification.",
    ],
  },
  "Diff heuristics": {
    paragraphs: [
      "Diff pairs blobs or trees; produce unified hunks with context lines count per spec. Keep hunks stable: prefer minimal edit scripts when ties occur.",
      "Tree diff recurses symmetrically comparing sorted entry lists short-circuiting identical subtrees by hash.",
      "Binary files should emit placeholder token instead of pretending text.",
    ],
    lapParagraphs: [
      ["Implement patience diff option only if flagged by env var.", "Cap context lines configurable via CLI parity."],
    ],
    objectives: [
      "Emit byte-identical unified diff patches for sample fixtures.",
      "Short-circuit identical blob IDs without scanning bytes.",
      "Explain when tree diff skips descent into matching subtrees.",
    ],
  },
  "Branch & merge": {
    paragraphs: [
      "Branch operations create refs pointing at commits; merges materialize synthetic merge commits honoring first-parent ordering for readability when tests introspect graphs.",
      "Detect diverged histories needing explicit merge commits vs fast-forwardable linear moves.",
      "Conflict markers mimic standard `<<<<<<<` format if working tree merges appear—often simplified to always-resolvable merges in early courses.",
    ],
    lapParagraphs: [
      ["Support `-m \"msg\"` shorthand for merges with parents >1.", "Surface merge-base calculation via recursive or simplified three-way rules from spec."],
    ],
    objectives: [
      "Perform fast-forward updates without creating extra commits when allowed.",
      "Create merge commits recording two parents with correct tree hash resolution.",
      "Walk recent branch tips to verify parent pointers after operations.",
    ],
  },
  "Fast-forward rules": {
    paragraphs: [
      "Fast-forward only when target branch ancestor is reachable from source tip without divergence. Guard against overwriting remote tracking assumptions if stubs exist.",
      "Tests often script two commits on feature then fast-forward main—verify HEAD movement leaves ref logs consistent when fake reflogs enabled.",
      "Keep hook points (pre-commit stubs) untouched unless stage demands.",
    ],
    lapParagraphs: [
      ["Add `--no-ff` reversal path if parity requires explicit merge bubbles.", "Document safety checks preventing detached HEAD surprises during FF."],
    ],
    objectives: [
      "Refuse merges that would silently drop reachable commits without flags.",
      "Verify branch pointers after sequential fast-forward pushes in fixtures.",
      "Summarize semantic difference between fast-forward and merging two tips.",
    ],
  },
};

export const EMBEDDED_SQL: Record<string, LessonTopicBlock> = {
  "Pager & pages": {
    paragraphs: [
      "SQLite-ish engines page the file in fixed blocks (typically 4 KiB multiples). Maintain a pager abstraction: fetch page N from disk cache, bump pin counts, recycle LRU frames under memory caps.",
      "Header page stores magic, page size, free-list root. Byte order and version fields must match spec—tests read raw files byte-for-byte.",
      "Handle partial writes: fsync policy may be relaxed in tests but API must expose explicit flush.",
    ],
    lapParagraphs: [
      ["Simulate I/O failures with injectable backend for robustness tests.", "Add debugging checksums per page if later stages enable corruption detection."],
    ],
    objectives: [
      "Read/write integer fields at correct offsets with bounds checks.",
      "Implement page cache eviction without corrupting dirty pages until flush.",
      "Explain how page size choice affects B-tree fanout and file growth.",
    ],
  },
  "B-tree insert": {
    paragraphs: [
      "Leaf pages pack cells sorted by key with overflow payload rules from spec. Internal pages store child pointers plus separator keys—duplicates policy may forbid or allow with rules.",
      "Insertion locates leaf by descent, shifts cells, splits when capacity exceeded producing new right sibling and promoting middle key up the tree.",
      "Track height invariants: all leaves same depth after splits; root special-cases when splitting reduces height changes.",
    ],
    lapParagraphs: [
      ["Instrument split ratio (50/50 vs 60/40) exactly as tests assert balance properties.", "Handle duplicate keys per stage contract (replace vs error)."],
    ],
    objectives: [
      "Insert keys in random order while maintaining sorted order within each page.",
      "Split leaves and propagate promotions without losing keys.",
      "Dump page hex for golden tests when corruption occurs.",
    ],
  },
  "B-tree search": {
    paragraphs: [
      "Search walks from root using binary search within page cell arrays. Micro-optimizations (sentinel keys) are optional; correctness first.",
      "Return both found flag and rowid/payload pointer for upper layers to fetch row bytes.",
      "Handle empty tree sentinel page without panicking.",
    ],
    lapParagraphs: [
      ["Support prefix scans when upper layer requests range cursors.", "Validate pointer child page numbers never exceed file size / page size."],
    ],
    objectives: [
      "Fetch values for existing keys and detect missing keys distinctly.",
      "Trace parent stack for future deletion implementation.",
      "Analyze worst-case page visits relative to tree height.",
    ],
  },
  "Leaf splits": {
    paragraphs: [
      "Splits redistribute cells plus possibly overflow chains. When internal node splits, update left child’s rightmost pointer carefully—classic off-by-one bug zone.",
      "Parent may itself overflow; recursion bubbles until new root allocated.",
      "Maintain sibling linked list if course uses leaves chained for scans.",
    ],
    lapParagraphs: [
      ["Stress sequential inserts producing maximum-height tree under tiny page size.", "Corrupt-and-repair exercise if optional stage introduces checksum rebuild."],
    ],
    objectives: [
      "Guarantee no key appears twice across siblings post-split.",
      "Update parent separator keys preserving search correctness.",
      "Describe balancing actions after asymmetric inserts.",
    ],
  },
  "SQL lexer": {
    paragraphs: [
      "Tokenizer recognizes keywords case-insensitively per SQL rules, identifiers (quoted/unquoted), string literals with escape rules subset, numeric tokens, punctuation.",
      "Emit positional errors with 1-based line/col if tests inspect diagnostics.",
      "Strip comments (-- and /* */) consistently.",
    ],
    lapParagraphs: [
      ["Add scientific notation literals only when grammar extends.", "Handle UTF-8 identifiers if collation stage unlocks—it’s usually ASCII-only initially."],
    ],
    objectives: [
      "Tokenize snapshot queries failing fast on stray characters.",
      "Differentiate ambiguous minus vs unary negative contexts per grammar hints.",
      "Feed tokens into recursive descent parser without allocations explosion.",
    ],
  },
  "SELECT planner": {
    paragraphs: [
      "Planner translates AST into physical ops: sequential scan vs index probe if indexes exist yet. Starter courses fake cost model—always prefer index path when usable.",
      "Project columns in SELECT list order; carry aliases forward for ORDER BY referencing ordinals/errors per SQL mode.",
      "FROM clause resolves single table first; joins arrive later stages.",
    ],
    lapParagraphs: [
      ["Push simple predicates into scan iterator when beneficial.", "Add EXPLAIN TEXT output when harness toggles verbosity."],
    ],
    objectives: [
      "Build iterator pipeline returning rows lazily.",
      "Apply column pruning so large unused columns aren’t deserialized.",
      "Contrast logical vs physical plan representations in logs.",
    ],
  },
  "WHERE filtering": {
    paragraphs: [
      "Evaluate boolean expressions with short-circuit AND/OR semantics. Type coercion subset is usually strict equality only until typing stage expands.",
      "NULL comparisons follow three-valued logic basics or simplified rules per tests.",
      "Bind parameter indices if placeholders appear (`?`).",
    ],
    lapParagraphs: [
      ["Optimize conjunct ordering for cheap checks first.", "Expose truth tables in tests verifying UNKNOWN handling."],
    ],
    objectives: [
      "Filter row streams deterministically respecting operator precedence.",
      "Reject mismatched operand types when strict mode flagged.",
      "Trace evaluation path for debugging failing predicates.",
    ],
  },
  "JOINs (nested loop)": {
    paragraphs: [
      "Implement inner join via nested loop iterators; OUTER semantics may be phased in later.",
      "Join condition parsed from ON clause referencing qualified columns.",
      "Memory: avoid materializing Cartesian products when possible using pipelining.",
    ],
    lapParagraphs: [
      ["Swap driving table when cardinality hints mocked via table stats stubs.", "Detect ambiguous column names shared across JOIN inputs."],
    ],
    objectives: [
      "Emit joined rows respecting column binding order.",
      "Handle zero-row inputs without dangling NULL assumptions unless outer join.",
      "Profile tuple counts against naive cross-product upper bound.",
    ],
  },
  "Persistence guarantees": {
    paragraphs: [
      "Ensure crash safety at defined boundaries: WAL or rollback journal stubs per spec commit calls. Teach ordering: journal write before modifying main pages.",
      "Expose transaction API boundaries used by INSERT/DDL layers later.",
      "Recovery replays redo log verifying checksum sequences.",
    ],
    lapParagraphs: [
      ["Simulate abrupt exit between journal phases to assert recovery restores prior committed state.", "Add fsync checkpoints tunable via pragma stub."],
    ],
    objectives: [
      "Make commit atomic visible after successful return regardless of simulated crash timeline.",
      "Explain difference between rollback journal vs WAL approaches at high level.",
      "Enumerate failure modes testers inject (missing tail page, corrupt length).",
    ],
  },
};

export const RESOLVER: Record<string, LessonTopicBlock> = {
  "UDP socket basics": {
    paragraphs: [
      "DNS historically rides UDP/TCP port 53. Start by binding ephemeral port or privileged 53 as tests allow and receiving datagram payloads up to UDP size assumptions (512-ish unless EDNS stubs).",
      "Parse question section without assuming single query per packet—authority courses may add multiples later.",
      "Validate length field against actual datagram truncation before allocating.",
    ],
    lapParagraphs: [
      ["Add IPv6 dual-stack socket parity if scaffolding supplies addresses.", "Log parse depth for malformed packets deterministically."],
    ],
    objectives: [
      "Echo minimal NOERROR NXDOMAIN responses per stub authority table.",
      "Reject packets below header length cleanly without panics.",
      "Describe why UDP suits hot cache paths before TCP fallback discussion.",
    ],
  },
  "Packet layout": {
    paragraphs: [
      "RFC 1035 framing: Header (ID flags counts), Questions (QNAME compressed labels), Answers (NAME TYPE CLASS TTL RDLENGTH RDATA).",
      "Implement name compression pointers with loop detection guard (max hops). Expansion must produce dotted labels lowercased unless case preservation tests say otherwise.",
      "Serialize responses with identical compression strategy as harness golden bytes.",
    ],
    lapParagraphs: [
      ["Support extended RCODE/TCP length prefix from RFC 6891 subset if flagged.", "Fuzz decompress edge cases respecting 63-char label limits."],
    ],
    objectives: [
      "Round-trip decompress/recompress curated wire samples.",
      "Compute QNAME lengths without speculative malloc loops.",
      "Explain pointer chasing failure modes (loops, truncation).",
    ],
  },
  "Questions & answers": {
    paragraphs: [
      "Match QUESTION RR type/class to authoritative zone RRsets. Preserve query ID bitwise in replies unless rewriting per spec anomaly tests.",
      "AA bit set when authoritative data returned; recurse stub may clear bits differently.",
      "Additional section glue records appear when apex NS requires AAAA/A glue.",
    ],
    lapParagraphs: [
      ["Support multiple question sections sequentially if staged.", "Honor DO bit for DNSSEC placeholders without breaking non-DNSSEC tests."],
    ],
    objectives: [
      "Produce answer RRs matching TTL truncation rules harness applies.",
      "Populate authority/additional minimally but deterministically.",
      "Trace QUESTION iteration without sharing mutable offsets across parses.",
    ],
  },
  "A & AAAA records": {
    paragraphs: [
      "RDATA for A is 4 bytes IPv4 network order; AAAA sixteen bytes IPv6.",
      "Validate synthesized answers against zone file fixtures; malformed zone lines should refuse startup per tests.",
      "Handle dual-stack duplication (two RRsets sharing owner).",
    ],
    lapParagraphs: [
      ["Emit wire errors for malformed numeric quads forgivingly?", "Prefer canonical ordering when multiple RR types share owner."],
    ],
    objectives: [
      "Encode/decode RRsets for sample domains identically harness expects.",
      "Differentiate authoritative vs glue A/AAAA placements.",
      "Enumerate TTL clamping semantics if expiry stage appears.",
    ],
  },
  "CNAME chains": {
    paragraphs: [
      "Follow chained CNAMEs within max hop count enforcing loop detection identical to iterative stub rules.",
      "Return last terminal type (A vs another CNAME dangling) respecting NOERROR NXDOMAIN distinctions.",
      "Synth additional records may prune duplicates after chain collapse.",
    ],
    lapParagraphs: [
      ["Support DNAME rewriting edge cases only if syllabus adds them.", "Short-circuit when intermediate CNAME cached negative TTL quirks appear."],
    ],
    objectives: [
      "Resolve multi-hop aliases within iteration budget.",
      "Surface partial chains with appropriate RCODE harness expects.",
      "Explain difference between synthesizing CNAME in answer vs authority sections.",
    ],
  },
  "Negative caching": {
    paragraphs: [
      "Serve NXDOMAIN with SOA authoritative record proving negative existential; NODATA (NOERROR zero answers) for existing name missing type differs.",
      "Include minimal TTL from SOA MINIMUM unless harness overrides.",
      "Cache negatives in optional exercise—memory map keyed by tuple (name,QTYPE).",
    ],
    lapParagraphs: [
      ["Implement aggressive stale negative reuse only when tests enable caching layer.", "Propagate ECS client hints stubs if adventurous."],
    ],
    objectives: [
      "Contrast NXDOMAIN vs NODATA wire outputs on shared fixtures.",
      "Populate authority section negatives with SOA as required.",
      "Describe TTL implications on resolver retry storms.",
    ],
  },
  "TTL handling": {
    paragraphs: [
      "Subtract elapsed time whenever serving cached positives/negatives; clamp at zero yielding DO NOT CACHE semantics per spec subset.",
      "Original TTL field in answer may rewrite to capped values when authority caps stubbed.",
      "Serialize remaining TTL deterministically rounding floor vs ceil consistently.",
    ],
    lapParagraphs: [
      ["Simulate time jumps injectable clock for flaky windows tests.", "Expose manual purge API for TTL test harness resets."],
    ],
    objectives: [
      "Decrement TTL deterministically tick-by-tick in synthetic clock tests.",
      "Reject overflow when TTL addition exceeds wire width.",
      "Summarize interplay between TTL and prefetch strategies conceptually.",
    ],
  },
  "Recursive stub": {
    paragraphs: [
      "Optional culminating stage wires iterative recursion to authoritative stub: pick nameserver glue, chase referrals, enforce max hops.",
      "Maintain separate sockets or reuse ephemeral—tests often mock upstream server socket pairs.",
      "Detect lame delegations flagged by harness injecting broken NS sets.",
    ],
    lapParagraphs: [
      ["Add parallel query fan-out only behind feature flag;", "Honor qname minimization placeholders if coursework references RFC 7816 subsets."],
    ],
    objectives: [
      "Complete resolution path from fictional root hints to authoritative answer.",
      "Handle timeouts with SERVFAIL escalation after retry budget exhaustion.",
      "Document differences between iterative vs recursive resolver behavior.",
    ],
  },
};
