import type { LessonTopicBlock } from "../types";

export const HTTP_STACK: Record<string, LessonTopicBlock> = {
  "Listen & parse request line": {
    paragraphs: [
      "Spawn TCP listener accepting connections; read until CRLF-terminated request line METHOD SP PATH SP HTTP/x.y CRLF.",
      "Reject malformed lines with 400 BEFORE header phase per harness expectations.",
      "Support METHOD case sensitivity rules (uppercase canonical; accept lower only if syllabus allows tolerant mode).",
    ],
    lapParagraphs: [
      ["Add backlog tuning SO_REUSEADDR parity where tests script rapid reconnects.", "Instrument max request line bytes early to thwart slowloris-style abuse in benchmarks."],
    ],
    objectives: [
      "Parse absolute-form targets when proxies inject them.",
      "Differentiate malformed methods vs unsupported methods distinctly if spec demands.",
      "Diagram state machine from accept → first line validated.",
    ],
  },
  "Headers & connection reuse": {
    paragraphs: [
      "Fold header field names case-insensitively; concatenate duplicate fields per RFC 7230 rules unless forbidded subset.",
      "Detect Connection: close vs keep-alive to decide linger after response.",
      "Limit header block size/timeouts before body read.",
    ],
    lapParagraphs: [
      ["Emit Date header consistent with deterministic clock stub.", "Treat hop-by-hop headers list per minimal proxy subset if tests pass trailer fields."],
    ],
    objectives: [
      "Store headers deterministically sorted for echoed debug responses.",
      "Teardown sockets exactly when reuse forbidden.",
      "Validate obs-fold handling per allowed subset.",
    ],
  },
  "Body: content-length": {
    paragraphs: [
      "Read precise byte count matching Content-Length decimal; forbid negative or duplicate Content-Length combos per tests.",
      "Guard against truncation mid-body—fail connection if EOF early.",
      "Bridge to handlers only after buffering or streaming thresholds course chooses.",
    ],
    lapParagraphs: [
      ["Support Expect: 100-continue acknowledgment before reading body.", "Allow zero-length POST semantics."],
    ],
    objectives: [
      "Parse integer Content-Length reliably with overflow rejection.",
      "Differentiate chunked vs explicit length clashes early.",
      "Explain interaction with persistent connections draining unread bytes.",
    ],
  },
  "Chunked encoding": {
    paragraphs: [
      "Decode chunked frames: hex size CRLF payload CRLF extensions ignored unless tests parse trailers.",
      "Terminal zero chunk ends body; afterward optional trailers until blank line.",
      "Reject impossible sizes vs remaining socket budget.",
    ],
    lapParagraphs: [
      ["Forward chunk extensions conservatively stripping unknown tokens.", "Handle chunk-size line obs-fold absence strictly."],
    ],
    objectives: [
      "Reassemble chunked payloads equal to CONTENT_LENGTH-equivalent hashing golden bodies.",
      "Surface errors on missing terminating chunk succinctly.",
      "Compare chunked vs buffered memory trade-offs.",
    ],
  },
  "Status codes": {
    paragraphs: [
      "Emit status line STATUS_CODE SP ReasonPhrase adhering to taboo characters rules on phrase.",
      "Map router outcomes to statuses: static 304 with validators, POST 201 requiring Location sometimes.",
      "Always send Server header if tests snapshot headers.",
    ],
    lapParagraphs: [
      ["Support custom reason phrases differing from canonical text when allowed.", "Translate uncaught exceptions to 500 safely without leaking internals."],
    ],
    objectives: [
      "Return correct subsets of statuses implemented at this stage baseline.",
      "Attach WWW-Authenticate only when syllabus adds auth scaffolding.",
      "Summarize semantic classes 2xx vs 4xx vs 5xx applicability.",
    ],
  },
  "Keep-alive limits": {
    paragraphs: [
      "Track idle timers per connection; decrement max request counter optional.",
      "Pipeline detection: backlog multiple requests sequentially without requiring parallel workers unless specified.",
      "Half-close semantics: STOP reading upon client FIN while finishing response writes.",
    ],
    lapParagraphs: [
      ["Simulate jittery timers with injectable clock to avoid flaky sleeps.", "Add max header bytes across entire connection lifetime quotas."],
    ],
    objectives: [
      "Close idle keep-alive sockets at harness-configured timeouts.",
      "Honor Connection: Upgrade vs keep-alive interplay when HTTP/2 upgrade stubs skipped.",
      "Explain resource exhaustion vectors when pipelining unbounded POSTs.",
    ],
  },
  "Date & host validation": {
    paragraphs: [
      "Generate IMF-fixdate timestamps in GMT per RFC 7231 examples used by graders.",
      "Validate Host header presence on HTTP/1.1 requests; tolerate absolute-form Host equivalents.",
      "Respond 400 duplicates Host conflicts if tests insist.",
    ],
    lapParagraphs: [
      ["Parse If-Modified-Since for static assets when conditional stage overlaps.", "Support Host: port stripping canonicalization edge cases."],
    ],
    objectives: [
      "Reject missing Host matching HTTP/1.1 strict mode.",
      "Compare Date vs Last-Modified generation paths.",
      "Trace clock skew pitfalls in caching discussions.",
    ],
  },
  "Static file handler": {
    paragraphs: [
      "Map SAFE URL path traversal attempts to jail under document root symlink policy per tests.",
      "Derive MIME from extension table; default application/octet-stream.",
      "Return Content-Length accurately for mmap vs readFile strategies.",
    ],
    lapParagraphs: [
      ["Emit directory listing forbiddance as 403 or 404 per spec quirks.", "Handle Range requests minimally if syllabus subset appears."],
    ],
    objectives: [
      "Serve sample fixtures byte-identical hashed by harness.",
      "Normalize percent-encoded paths rejecting overlong sequences.",
      "Enumerate security pitfalls of forgiving path normalization.",
    ],
  },
  "Error pages": {
    paragraphs: [
      "Consistency: small HTML/text bodies templated deterministically replacing reason tokens.",
      "Include Retry-After for 429/503 when synthetic load tests emulate surge.",
      "Never leak filesystem paths unless tests assert pedagogical echoes.",
    ],
    lapParagraphs: [
      ["Localize stubs via header Accept-Language only if stage unlocks localization tests.", "Add request id header correlation for telemetry stages."],
    ],
    objectives: [
      "Map internal error classes to outward minimal responses.",
      "Verify content-type aligns with negotiated error representation.",
      "Critique verbosity trade-offs for operator vs attacker visibility.",
    ],
  },
  "Pipelining edge cases": {
    paragraphs: [
      "Queue parsed requests sequentially; forbid response interleavings—HTTP/1.1 prohibits.",
      "Drain leftover bytes belonging to malformed mid-pipeline gracefully closing connection.",
      "Measure buffering policy when client sends partial second request prematurely.",
    ],
    lapParagraphs: [
      ["Simulate flaky clients RST mid pipeline ensuring handler cleanup hooks run.", "Add metrics counters REQUEST_PIPELINE_DEPTH for assertions."],
    ],
    objectives: [
      "Handle at least three back-to-back GETs reliably on reused socket.",
      "Abort entire connection on framing error midway pipeline.",
      "Explain why reordering parallel responses violates HTTP/1.1 framing.",
    ],
  },
  "Stress harness": {
    paragraphs: [
      "Throughput vs correctness: saturate with concurrent connections respecting thread pool sizing harness suggests.",
      "Optional zero-copy sends (sendfile) when platform allowed—fallback transparently.",
      "Collect latency histogram stubs without external deps.",
    ],
    lapParagraphs: [
      ["Cap accept queue with SOMAXCONN tweaking instructions from benchmark README.", "Run soak tests resetting ephemeral port exhaustion gracefully."],
    ],
    objectives: [
      "Pass burst load thresholds without deadlock or hysteresis failures.",
      "Profile hot paths distinguishing syscall vs copying costs.",
      "Document tuning knobs surfaced to operators.",
    ],
  },
  "Compatibility checks": {
    paragraphs: [
      "Smoke against popular clients quirks: newline-only vs CRLF, uppercase methods, bogus whitespace—choose strict profile course assigns.",
      "Final audit ensures compliance statements documented in README with known deviations.",
      "Optional TLS termination stub bridging if TCP-only stage evolves.",
    ],
    lapParagraphs: [
      ["Replay historical bug traffic captures anonymized verifying no regressions.", "Cross-run golden diff ensures stable textual error bodies."],
    ],
    objectives: [
      "Freeze behavior matrix vs earlier stages regression suite.",
      "Enumerate unsupported features consciously deferred.",
      "Summarize pragmatic HTTP/1.1 subset mastered end-to-end.",
    ],
  },
};

export const TORRENT: Record<string, LessonTopicBlock> = {
  "Bencode parsing": {
    paragraphs: [
      "Bencoding nests integers `i<e>E`, lists `l...e`, dicts `d...e`, byte strings `<len>:payload`. Parsing must recurse with depth guard against zip bombs shaped by malignant nesting.",
      "Ints accept optional minus but ban leading zeros besides zero literal when tests strict.",
      "Dict ordering affects canonical hash for `.torrent` rewriting—preserve original order reads even if logically unordered.",
    ],
    lapParagraphs: [
      ["Stream-parse gigantic strings using bounded accumulator when harness feeds chunked inputs.", "Surface offset metadata for downstream error attribution."],
    ],
    objectives: [
      "Round-trip canonical encode equals input bytes fixture set.",
      "Reject premature EOF distinctly from syntax errors.",
      "Explain why dict key ordering ambiguity matters for cryptographic checks later.",
    ],
  },
  "Metainfo validation": {
    paragraphs: [
      "Validate mandatory keys (`announce`, `info` dict hashing later). Announce may be HTTP/HTTPS; reject unknown protocols if tests define subset.",
      "Compute info_hash as SHA1 over bencoded info dict substring exactly as spec—even one spacing change invalidates swarm.",
      "Multi-file layouts include `files` arrays with lengths and paths respecting UTF-8 path joining rules harness documents.",
    ],
    lapParagraphs: [
      ["Cross-check lengths sum versus single-file length field mutual exclusivity.", "Accept magnet link metadata fragments if bridging stage appears."],
    ],
    objectives: [
      "Surface precise error when announce URL malformed.",
      "Derive piece length and count sanity bounds before allocating buffers.",
      "Walk metainfo translating to runtime piece schedule representation.",
    ],
  },
  "Peer handshake": {
    paragraphs: [
      "Handshake: <pstrlen><pstr><reserved><info_hash><peer_id>. pstr historically BitTorrent.",
      "Verify remote info_hash matches ours before accepting reciprocation handshake extension bits reserved—usually zero starter.",
      "Timeout half-open peers aggressively freeing buffers.",
    ],
    lapParagraphs: [
      ["Support extension protocol reserved bit negotiation when tests flip bit.", "Fingerprint client id realistically per spoofing guard expectations."],
    ],
    objectives: [
      "Complete handshake validating peer_id length always 20 bytes.",
      "Discard trailing garbage bytes after handshake if pipelining attempted.",
      "Describe transition to peer wire message framing post-handshake.",
    ],
  },
  "Piece picking": {
    paragraphs: [
      "Rarest-first heuristic approximates reciprocation fairness starter courses teach; prioritize pieces least replicated among peers you know completed map for.",
      "Endgame swaps strategy (random among pending)—stage later reinforces.",
      "Maintain bitfield bookkeeping synchronized with HAVE messages increments.",
    ],
    lapParagraphs: [
      ["Inject seeding preference bias when download-only heuristic toggles;", "Adaptive switch when seeding_ratio crosses threshold mocks."],
    ],
    objectives: [
      "Update internal availability counts as peers broadcast HAVE.",
      "Detect completion transition to seeding upload-only scheduling.",
      "Analyze starvation scenarios naive sequential picking causes.",
    ],
  },
  "Block requests": {
    paragraphs: [
      "Piece subdivides into blocks (commonly 16 KiB multiples) requested via REQUEST messages referencing index+begin+length adhering to clamp rules vs piece length tails.",
      "Cancel outstanding requests aggressively on choke reception or timeout jitter.",
      "Pipeline multiple requests respecting max outstanding watermark harness sets.",
    ],
    lapParagraphs: [
      ["Simulate asymmetric bandwidth via artificial delay injections verifying fairness.", "Hash-check partial assemblies before admitting completion."],
    ],
    objectives: [
      "Correlate requested ranges with eventual piece assembly buffer writes.",
      "Emit CANCEL cleanly discarding orphaned pipelined expectations.",
      "Estimate memory churn across parallel piece downloads.",
    ],
  },
  "Bitfield &Have": {
    paragraphs: [
      "Bitfields encode completeness snapshot (length = piece count padded to byte). HAVE singles increment counterpart knowledge without resending whole map.",
      "Never trust remote bitfields blindly immediately—fuzz tests flip bits inconsistently detecting malicious peers.",
      "Fast extension bits sometimes piggyback—honor ignore-unknown policy.",
    ],
    lapParagraphs: [
      ["Compress sparse HAVE sequences into repeating bitfield gossip only if compaction stage activates.", "Track counter per piece for rarest aggregator updates."],
    ],
    objectives: [
      "Update local bitfield transitioning to HAVE broadcast etiquette.",
      "Merge remote bitfields into probabilistic completeness model.",
      "Explain bandwidth trade-offs bitfield-first vs sequential HAVE storms.",
    ],
  },
  "Choking & unchoking": {
    paragraphs: [
      "Tit-for-tat: upload slots limited; choke peers not reciprocating uploads fairly using rolling averages harness approximates.",
      "Optimistic unchoke rotates exploring unknown peers—even if cheating initially.",
      "Snub detection flags peers repeatedly ignoring requests allocating slots elsewhere.",
    ],
    lapParagraphs: [
      ["Seed mode adjustments always unchoke thirsty leech nearest completion metrics.", "Add anti-slot-flapping hysteresis window tests quantify."],
    ],
    objectives: [
      "Toggle CHOKE/UNCHOKE respecting max parallel unchoked invariant.",
      "Measure upload/download ledger balancing crude fairness heuristic.",
      "Interpret performance impacts of choke thrashing misconfiguration.",
    ],
  },
  "Endgame mode": {
    paragraphs: [
      "When remaining pieces countable on hands, blast duplicate requests redundantly cancelling extras upon first fulfillment.",
      "Avoid completion race double disk writes guarding with idempotent finalize.",
      "Quietly degrade logging noise endgame bursts avoid disguising anomalies.",
    ],
    lapParagraphs: [
      ["Cap redundant fan-out lest reputation algorithms flag abuse.", "Integrate hashing pipeline verifying piece SHA before acknowledging global completion."],
    ],
    objectives: [
      "Guarantee last blocks finish despite flaky peer disconnect bursts.",
      "Cancel redundant pendings cleanly once fulfilled.",
      "Contrast steady-state picker vs terminal redundancy strategy motivations.",
    ],
  },
  "Integrity checks": {
    paragraphs: [
      "SHA1 per-piece compare against torrent `pieces` concat digest column (20 bytes each). Off-by-one indexer mistakes common.",
      "Ban early completion assertions until entire hash chain passes.",
      "Corruption triggers redownload selectively only offending blocks when tests allow patching.",
    ],
    lapParagraphs: [
      ["Switch to SHA256 hybrids if syllabus updates metadata version mock.", "Log mismatch offsets aiding debugging flaky storage layers."],
    ],
    objectives: [
      "Hash assembled pieces matching golden vectors.",
      "Isolate failing block causing mismatch reports precisely.",
      "Discuss collision resistance implications historically vs contemporary attacks abstractly.",
    ],
  },
  "Rate limiting": {
    paragraphs: [
      "Cap upload/download token buckets aligning polite swarm citizenship numbers harness prints.",
      "Smooth bursts avoiding TCP collapse while still reciprocating minimally.",
      "Differentiate LAN peers exemption policies if hinted.",
    ],
    lapParagraphs: [
      ["Adapt limits dynamically observing global swarm health mocks.", "Coordinate with disk flush scheduling avoiding IO stalls misread as network choke."],
    ],
    objectives: [
      "Enforce configured KB/s ceilings within tolerance margins.",
      "Expose metrics counters totals transferred per peer.",
      "Reason about unintended fairness starvation side-effects.",
    ],
  },
  "Multi-file layout": {
    paragraphs: [
      "Map contiguous piece ranges crossing file boundaries—maintain cumulative offsets table from metainfo lengths.",
      "Create destination directories sanitizing filenames against traversal escapes.",
      "Pad final file aligning piece boundaries using zero fill spec clarifies explicitly.",
    ],
    lapParagraphs: [
      ["Support selective file skipping via user flag parity when tests mimic partial downloads;", "Honor POSIX vs Windows path quirks mapping drive letters."],
    ],
    objectives: [
      "Assemble overlapping piece writes into distinct files reproducibly hashed.",
      "Reject illegal path fragments before touching filesystem.",
      "Explain padding rationale preventing last piece fragmentation confusion.",
    ],
  },
  "Tracker announce": {
    paragraphs: [
      "HTTP GET to announce URL carrying info_hash compact=1 optionally; parse peers list compact 6-byte IPv4 tuples or dictionary models—follow whichever variant tests scaffold.",
      "Report uploaded/downloaded/left bookkeeping fields consistent with handshake accounting.",
      "Handle failure backoff intervals parsing `interval`/`min interval` directives.",
    ],
    lapParagraphs: [
      ["Support UDP tracker parity if supplementary stage merges;", "Honor scrape mini-protocol separately when isolating tests isolate functions."],
    ],
    objectives: [
      "Integrate refreshed peer advertisements into connection scheduler.",
      "Decode failure reason strings escalating user-visible narratives.",
      "Summarize decentralized evolution toward DHT beyond scope but contextualize tracker role.",
    ],
  },
};

export const LOG_BROKER: Record<string, LessonTopicBlock> = {
  "Segmented log format": {
    paragraphs: [
      "Model append-only segments (files or preallocated blobs) naming with monotonic base offsets. Each record packs CRC + length preamble per internal spec course publishes.",
      "Readers scan forward detecting truncated tail vs corruption distinctly.",
      "Rotation closes segment immutably starting fresh file preserving global ordering keys.",
    ],
    lapParagraphs: [
      ["Simulate abrupt power-loss partial writes asserting recovery truncation strategy;", "Expose magic header versions enabling future incompatible upgrades."],
    ],
    objectives: [
      "Serialize arbitrary payload bytes preserving order-stability.",
      "Validate checksum mismatches rejecting poisoned tails.",
      "Discuss trade-offs segment size vs compaction frequency.",
    ],
  },
  "Append path": {
    paragraphs: [
      "Exclusive append concurrency: leader serializes offsets; replicas follow replication stream reorder buffer.",
      "Expose high-water mark consumers bookmark against.",
      "Batch smaller appends amortizing fdatasync intervals when durability modes relax.",
    ],
    lapParagraphs: [
      ["Inject idempotency keys deduping client retries exactly-once illusion.", "Simulate slow disk stalls without blocking unrelated partitions."],
    ],
    objectives: [
      "Guarantee monotonic offsets returned to producers after fsync policy satisfied.",
      "Detect duplicate append attempts using sequence metadata.",
      "Trace critical path from client API call to bytes durable on disk.",
    ],
  },
  "Consumer offsets": {
    paragraphs: [
      "Each consumer group stores committed offset per partition—advance only after successful processing ack unless at-least-once tests say otherwise.",
      "Seek APIs jump boundaries validating offset still present (retention eviction).",
      "Heartbeats purge stale memberships reclaiming dangling locks.",
    ],
    lapParagraphs: [
      ["Support rewind operations subtracting acknowledging duplicates carefully;", "Expose admin commands resetting offsets guarded by ACL stubs."],
    ],
    objectives: [
      "Persist offset metadata transactional with processing side effects mocks.",
      "Differentiate earliest vs latest auto-reset policies.",
      "Analyze failure doubling under at-least-once delivery assumptions.",
    ],
  },
  Partitions: {
    paragraphs: [
      "Sharding key decides partition deterministically hashing string clients supply; enforce sticky ordering per key.",
      "Rebalance stubs move partitions between brokers honoring invariants: no reorder across keys unaffected.",
      "ISR (in-sync replica) quorum acknowledgements gate append visibility configurable.",
    ],
    lapParagraphs: [
      ["Simulate rack awareness placement constraints mocking fault domains;", "Throttle hot partitions shedding load gracefully."],
    ],
    objectives: [
      "Route messages so equal keys consistently hit same shard id.",
      "Visualize ISR shrink causing producer error pathways.",
      "Enumerate consistency implications partition count explosion causes.",
    ],
  },
  "Replication stub": {
    paragraphs: [
      "Leader followers pull or push append batches; watermark tracks highest durable offset cluster-wide minimally.",
      "Catch-up newcomer reads snapshot + incremental delta spec chooses.",
      "Elect not implemented yet—assume static leader simplifying tests.",
    ],
    lapParagraphs: [
      ["Introduce fake network partitions delaying follower visibility;", "Measure replica lag gauges surfacing staleness thresholds."],
    ],
    objectives: [
      "Replicate appended records preserving order per partition.",
      "Handle follower crash mid-stream resuming deterministically.",
      "Explain split-brain danger electing blindly without consensus extension.",
    ],
  },
  "Leader election toy model": {
    paragraphs: [
      "Optional lightweight RAFT-esque term counters electing deterministic winner given scripted peer list—not production safe.",
      "Votes persisted before declaring leadership—prevent flip-flopping on restart.",
      "Step down on higher term discovery messages.",
    ],
    lapParagraphs: [
      ["ChaosMonkey drop messages proving liveness stalls bounded;", "Add joint consensus placeholder comments for future merges."],
    ],
    objectives: [
      "Guarantee at most one proclaimed leader per term in deterministic simulation.",
      "Persist minimal metadata enabling restart safety.",
      "Contrast toy model omissions vs industrial consensus requirements.",
    ],
  },
  Batching: {
    paragraphs: [
      "Accumulate producer records until linger.ms or batch.size triggers flushing compression optional.",
      "Trade latency vs throughput with metrics counters surfaced to tests asserting bounds.",
      "Broken batch partial failures roll back unfinished portion atomically.",
    ],
    lapParagraphs: [
      ["Adapt batch sizing dynamically under backlog pressure mocks;", "Coalesce compression codec toggles zlib vs lz4 stubs."],
    ],
    objectives: [
      "Emit compressed batches decompressing symmetrically validating bytes.",
      "Ensure partial flush retains remainder without reordering violating spec.",
      "Tune default knobs interpreting workload sensitivity.",
    ],
  },
  "Compression hooks": {
    paragraphs: [
      "Negotiate codec per ProduceRequest chunk; decompress before checksum validation sequencing matters.",
      "Detect mismatch between declared compressed size vs actual gracefully.",
      "CPU vs bandwidth trade annotate README expectations.",
    ],
    lapParagraphs: [
      ["Support dictionary training blocks only advanced tests flip;", "Propagate uncompressed size safeguards stopping zip bombs shaped records."],
    ],
    objectives: [
      "Plumb optional compression codecs behind interface swap.",
      "Validate integrity after decompression failures separate from transport errors.",
      "Estimate savings ratio on scripted corpora payloads.",
    ],
  },
  "Retention policies": {
    paragraphs: [
      "Policies delete aged segments respecting minimum consumer lag—never truncate ahead of committed slow group.",
      "Size-based caps interplay with time triggers whichever hits first configurable.",
      " tombstone compaction placeholder optional.",
    ],
    lapParagraphs: [
      ["Simulate clock jumps challenging pure time retention;", "Snapshot segment deletion events idempotently rewriting indexes."],
    ],
    objectives: [
      "Purge obsolete files reclaiming disk while preserving readability for active offsets.",
      "Emit metrics bytes reclaimed per deletion pass.",
      "Discuss compliance implications irreversible deletes pose.",
    ],
  },
  Backpressure: {
    paragraphs: [
      "Throttle producers when replicas lag beyond threshold returning explicit error enabling client retries exponential strategies.",
      "Bounded queues isolate slow consumers exploding memory.",
      "Admission control denies new connections sustaining SLO mocks.",
    ],
    lapParagraphs: [
      ["Prioritize starvation avoidance across partitions fairness policies;", "Cooperative yielding when OS socket buffers saturate."],
    ],
    objectives: [
      "Propagate slowdown signals surfaced to simulated clients faithfully.",
      "Demonstrate stabilization after burst spikes subside.",
      "Map analogous patterns to reactive streams philosophies.",
    ],
  },
  "Wire security": {
    paragraphs: [
      "Sketch TLS wrappers optional; minimally implement API key handshake header tests supply.",
      "Sanitize deserialization limits preventing oversized arrays.",
      "Audit log suspicious opcode sequences.",
    ],
    lapParagraphs: [
      ["Add SASL placeholders without implementing crypto heavy algorithms;", "Propagate authenticated principal annotations into ACL checks future stage."],
    ],
    objectives: [
      "Refuse handshake missing credentials cleanly.",
      "Bound decode work linearly sized to packet length declarations.",
      "Enumerate threat model assumptions versus full enterprise deployment.",
    ],
  },
  Observability: {
    paragraphs: [
      "Emit structured logs with partition, offset, lag fields—correlation ids threading request lifetimes.",
      "Histogram latencies producer→append→ack respecting low cardinality label sets.",
      "Health endpoints aggregate replica states simplifying orchestrator probes.",
    ],
    lapParagraphs: [
      ["Trace sampling probabilistic lowering overhead;", "Export Prometheus text exposition minimal subset mimic."],
    ],
    objectives: [
      "Prove observability additions stay compile-time stripped if feature flag disables.",
      "Wire golden metric snapshots during integration harness runs.",
      "Summarize alerting recommendations lag threshold vs error rate interplay.",
    ],
  },
};

export const AGENT_CLI: Record<string, LessonTopicBlock> = {
  "Tool schema": {
    paragraphs: [
      "Declare tools JSON-schema or OpenAI-compatible function defs: names, descriptions, enums, required arrays. Agents pick among them—precision in descriptions materially changes success rates harness measures indirectly.",
      "Validate model-emitted JSON against schema before dispatch; coerce obvious types cautiously refusing ambiguous shapes.",
      "Version schemas alongside prompts to rollback safely.",
    ],
    lapParagraphs: [
      ["Add strict additionalProperties false unless extension stage relaxes;", "Generate schema fixtures programmatically avoiding drift."],
    ],
    objectives: [
      "Surface validation errors verbatim back into model-visible assistant messages appropriately redacted.",
      "Enumerate tool overlaps causing ambiguous invocation patterns.",
      "Explain why shallow descriptions degrade tool-choice accuracy empirically.",
    ],
  },
  "Prompt templates": {
    paragraphs: [
      "Structure system/developer/user tiers; pin immutable policy lines preventing injection from untrusted retrieved context until sandbox stage.",
      "Parameterize prompts with `{repo_root}`, `{task}` tokens expanded deterministically aiding reproducibility snapshots.",
      "Keep token budget accounting rough—warn when truncation imminent.",
    ],
    lapParagraphs: [
      ["A/B ephemeral toggles hashed by session ids for reproducible experiments;", "Add locale-insensitive normalization for multilingual tasks."],
    ],
    objectives: [
      "Render final prompt transcript logs for auditors without leaking secrets.",
      "Demonstrate refusal behavior on policy conflicts explicitly coded.",
      "Compare few-shot demonstrations vs plain instruction grounding.",
    ],
  },
  "HTTP chat completion": {
    paragraphs: [
      "Call provider REST exchanging API keys securely via env not argv; handle 401 vs 429 differently— backoff vs fatal.",
      "Compose messages array adhering to multimodal stubs if coursework includes attachments metadata only.",
      "Timeout requests protecting CLI snappiness with cancel tokens wired to CTRL+C harness simulates.",
    ],
    lapParagraphs: [
      ["Support Azure-style URL variants via base URL override;", "Record raw response headers aiding debugging ephemeral correlation ids."],
    ],
    objectives: [
      "Parse streaming vs JSON modes distinctly when flags toggle.",
      "Redact bearer tokens appearing in accidental debug dumps.",
      "Summarize SLA expectations cloud vs local model endpoints variance.",
    ],
  },
  "Streaming tokens": {
    paragraphs: [
      "SSE or chunked newline JSON events—accumulate deltas updating UI/console incrementally flushing stdout line-buffer friendly.",
      "Finalize with `[DONE]` or provider sentinel; unify across vendors behind adapter trait.",
      "Measure token throughput simplistic rolling average surfaced as debug footer optional.",
    ],
    lapParagraphs: [
      ["Handle mid-stream error frames aborting cleanly;", "Preserve partial assistant message state for replay when retrying continuation."],
    ],
    objectives: [
      "Guarantee no interleaved token reorder when parallel tools fire—ordering rules explicit.",
      "Detect truncation due to length limit vs natural stop.",
      "Relate UX perceived latency to incremental flush frequency.",
    ],
  },
  "Parsing tool calls": {
    paragraphs: [
      "Models emit tool_calls parallel array—execute serially vs parallel configurable default conservative serial for filesystem safety starter.",
      "Arguments JSON parse tolerant of minor whitespace inconsistencies but log suspicious divergence.",
      "Associate tool_call IDs with corresponding tool outputs message objects round-trip transcripts.",
    ],
    lapParagraphs: [
      ["Validate recursive depth arguments preventing billion-laugh expansions surrogate;", "Coalesce duplicate tool names with deterministic tie-break ordering."],
    ],
    objectives: [
      "Execute tool dispatch loop until model ends turn without dangling calls.",
      "Propagate stderr lines into assistant-visible error scaffolding.",
      "Enumerate hazards arbitrary code execution entails when tools wrap shell escapes.",
    ],
  },
  "Retry with backoff": {
    paragraphs: [
      "Exponential delay with jitter caps prevents thundering herds replays interfering with quotas.",
      "Differentiate transient network blips vs permanent policy violations terminating loop early.",
      "Persist attempt counts across process restarts minimally when possible.",
    ],
    lapParagraphs: [
      ["Respect Retry-After seconds headers faithfully when APIs include them;", "Cap total wall clock spend honoring user patience constants."],
    ],
    objectives: [
      "Graph retry timeline explaining jitter formula constants chosen.",
      "Abort loop surfacing succinct final rationale to stderr.",
      "Compare idempotent vs non-idempotent tool replays interplay.",
    ],
  },
  "Session memory": {
    paragraphs: [
      "Maintain rolling transcript pruning older tool outputs beyond token budget heuristic summarization stub hooks optional.",
      "Persist checkpoints to disk encrypt-at-rest placeholders when secrets appear.",
      "Allow manual /reset slash command wiping volatile scratch variables.",
    ],
    lapParagraphs: [
      ["Segment memory by workspace directory binding conversations;", "Tag memories with TTL expiring ephemeral fetch results caches."],
    ],
    objectives: [
      "Rehydrate resumed sessions continuing tool loop deterministically scripted.",
      "Prove sensitive env strings never echoed back into transcripts.",
      "Discuss long-horizon context drift risks summarization alleviates imperfectly.",
    ],
  },
  "Filesystem sandbox": {
    paragraphs: [
      "Restrict writes underneath workspace roots; disallow symlink escapes using realpath comparisons each operation.",
      "Virtualize reads allowing synthetic fixtures injecting `--dry-run`.",
      "Audit log touches including bytes read thresholds spam detection.",
    ],
    lapParagraphs: [
      ["Optional read-only overlays layering patch sets;", "Throttle massive recursive globs defensive defaults."],
    ],
    objectives: [
      "Reject traversal attempts with stable error taxonomy codes.",
      "Benchmark sandbox overhead negligible vs naive direct FS calls.",
      "Relate sandbox design to WASM WASI philosophies abstractly.",
    ],
  },
  "Git diff integration": {
    paragraphs: [
      "Wrap `git diff` parsing unified hunks into structured hunks powering patch application decisions OR generate patches for model narration.",
      "Handle binary diffs sentinel strings without choking parsers.",
      "Respect CRLF normalization toggles aligning repository settings.",
    ],
    lapParagraphs: [
      ["Surface rename detection summaries optional;", "Colorize minimally when interactive TTY available."],
    ],
    objectives: [
      "Map diff hunks to file path line ranges accurately.",
      "Abort when working tree dirty conditions tests define precodified.",
      "Explain value showing models compact diffs vs whole files latency trade-offs.",
    ],
  },
  "Failure surfacing": {
    paragraphs: [
      "Aggregate non-zero exits into human digest prioritizing actionable first lines stderr.",
      "Categorize errors: toolchain missing vs test failure vs user cancellation.",
      "Return exit codes aligning CLI conventions avoiding generic 1 always.",
    ],
    lapParagraphs: [
      ["Attach doc links heuristically mapping error substrings,", "Quiet mode thresholds suppress repetitive warnings collapsing counts."],
    ],
    objectives: [
      "Present final summary block enumerating failures sorted severity.",
      "Ensure logs remain machine-parseable concurrently pretty for humans minimally.",
      "Reflect on telemetry vs privacy balance error detail exposure.",
    ],
  },
  Telemetry: {
    paragraphs: [
      "Opt-in metrics events timestamped anonymously—hash repo paths salted locally.",
      "Batch uplink respecting offline grace periods buffering disk queue.",
      "Feature flags propagate enabling enterprise disablement compliance.",
    ],
    lapParagraphs: [
      ["Sample high-volume keystroke events rejecting outright ethical stance;", "OpenTelemetry OTLP stubs integration optional labs."],
    ],
    objectives: [
      "Document schema fields emitted transparently README.",
      "Verify no secrets fields included automated scanner tests fuzz.",
      "Reason about observability aiding vendor improvement vs user trust.",
    ],
  },
  "Multi-step plans": {
    paragraphs: [
      "Planner emits ordered steps referencing dependencies DAG—parallelize safely when disjoint files touched modeled.",
      "Re-plan dynamically after failures invalidating successors harness injects perturbations.",
      "Surface plan to user BEFORE execution respecting manual approval gated mode toggle.",
    ],
    lapParagraphs: [
      ["Integrate Monte Carlo rollout scoring speculative branches NOT production;", "Freeze planner seed reproducibility toggles benchmarking."],
    ],
    objectives: [
      "Validate acyclic graphs before execution rejecting user harmful cycles.",
      "Persist executed steps audit trail zipped artifact optional.",
      "Synthesize competencies gained across entire agent challenge narrative.",
    ],
  },
};
