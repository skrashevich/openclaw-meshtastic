import type {
  BlockStreamingCoalesceConfig,
  DmConfig,
  DmPolicy,
  GroupPolicy,
  GroupToolPolicyBySenderConfig,
  GroupToolPolicyConfig,
  MarkdownConfig,
  OpenClawConfig,
} from "openclaw/plugin-sdk/config-contracts";
import type { BaseProbeResult } from "openclaw/plugin-sdk/core";

export type MeshtasticGroupConfig = {
  requireMention?: boolean;
  tools?: GroupToolPolicyConfig;
  toolsBySender?: GroupToolPolicyBySenderConfig;
  skills?: string[];
  enabled?: boolean;
  allowFrom?: Array<string | number>;
  systemPrompt?: string;
};

export type MeshtasticAccountConfig = {
  name?: string;
  enabled?: boolean;
  host?: string;
  port?: number;
  tls?: boolean;
  dmPolicy?: DmPolicy;
  allowFrom?: Array<string | number>;
  defaultTo?: string;
  groupPolicy?: GroupPolicy;
  groupAllowFrom?: Array<string | number>;
  groups?: Record<string, MeshtasticGroupConfig>;
  /** Mesh channel indices (0-7) to listen for broadcast messages. */
  channels?: number[];
  mentionPatterns?: string[];
  markdown?: MarkdownConfig;
  historyLimit?: number;
  dmHistoryLimit?: number;
  dms?: Record<string, DmConfig>;
  textChunkLimit?: number;
  chunkMode?: "length" | "newline";
  blockStreaming?: boolean;
  blockStreamingCoalesce?: BlockStreamingCoalesceConfig;
  responsePrefix?: string;
};

type MeshtasticConfig = MeshtasticAccountConfig & {
  accounts?: Record<string, MeshtasticAccountConfig>;
  defaultAccount?: string;
};

export type CoreConfig = OpenClawConfig & {
  channels?: OpenClawConfig["channels"] & {
    meshtastic?: MeshtasticConfig;
  };
};

export type MeshtasticInboundMessage = {
  messageId: string;
  /** Conversation peer: node id for DMs, channel:N for groups. */
  target: string;
  senderNodeNum: number;
  senderId: string;
  text: string;
  timestamp: number;
  isGroup: boolean;
  meshChannel: number;
  replyToId?: string;
};

export type MeshtasticProbe = BaseProbeResult<string> & {
  host: string;
  port: number;
  tls: boolean;
  latencyMs?: number;
};

export type { MeshtasticAccountConfig, MeshtasticConfig };
