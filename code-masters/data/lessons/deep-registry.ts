import type { LessonTopicBlock } from "./types";
import {
  AGENT_CLI,
  HTTP_STACK,
  LOG_BROKER,
  TORRENT,
} from "./content/http-torrent-log-agent";
import { KV_STORE, INTERPRETER } from "./content/kv-interpreter";
import { PATTERN_MATCHER_CONTENT, SHELL_CONTENT } from "./content/shell-pattern";
import {
  EMBEDDED_SQL,
  RESOLVER,
  VCS_CORE,
} from "./content/vcs-embedded-resolver";

/**
 * Registered challenge slug → topic label (exactly as in lesson-topics) → lesson block.
 */
export const DEEP_REGISTRY: Record<
  string,
  Record<string, LessonTopicBlock>
> = {
  shell: SHELL_CONTENT,
  "kv-store": KV_STORE,
  "pattern-matcher": PATTERN_MATCHER_CONTENT,
  interpreter: INTERPRETER,
  torrent: TORRENT,
  "log-broker": LOG_BROKER,
  "vcs-core": VCS_CORE,
  "embedded-sql": EMBEDDED_SQL,
  resolver: RESOLVER,
  "http-stack": HTTP_STACK,
  "agent-cli": AGENT_CLI,
};
