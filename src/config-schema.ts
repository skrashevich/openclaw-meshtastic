import {
  DmPolicySchema,
  GroupPolicySchema,
  MarkdownConfigSchema,
  ReplyRuntimeConfigSchemaShape,
  ToolPolicySchema,
  buildChannelConfigSchema,
  requireOpenAllowFrom,
} from "openclaw/plugin-sdk/channel-config-schema";
import { z } from "zod";
import { meshtasticChannelConfigUiHints } from "./config-ui-hints.js";

const MeshtasticGroupSchema = z
  .object({
    requireMention: z.boolean().optional(),
    tools: ToolPolicySchema,
    toolsBySender: z.record(z.string(), ToolPolicySchema).optional(),
    skills: z.array(z.string()).optional(),
    enabled: z.boolean().optional(),
    allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    systemPrompt: z.string().optional(),
  })
  .strict();

const MeshtasticAccountSchemaBase = z
  .object({
    name: z.string().optional(),
    enabled: z.boolean().optional(),
    host: z.string().optional(),
    port: z.number().int().min(1).max(65535).optional(),
    tls: z.boolean().optional(),
    dmPolicy: DmPolicySchema.optional().default("pairing"),
    allowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    defaultTo: z.string().optional(),
    groupPolicy: GroupPolicySchema.optional().default("allowlist"),
    groupAllowFrom: z.array(z.union([z.string(), z.number()])).optional(),
    groups: z.record(z.string(), MeshtasticGroupSchema.optional()).optional(),
    channels: z.array(z.number().int().min(0).max(7)).optional(),
    mentionPatterns: z.array(z.string()).optional(),
    markdown: MarkdownConfigSchema,
    textChunkLimit: z.number().int().min(40).max(500).optional(),
    ...ReplyRuntimeConfigSchemaShape,
  })
  .strict();

const MeshtasticAccountSchema = MeshtasticAccountSchemaBase.superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message:
      'channels.meshtastic.dmPolicy="open" requires channels.meshtastic.allowFrom to include "*"',
  });
});

export const MeshtasticConfigSchema = MeshtasticAccountSchemaBase.extend({
  accounts: z.record(z.string(), MeshtasticAccountSchema.optional()).optional(),
  defaultAccount: z.string().optional(),
}).superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message:
      'channels.meshtastic.dmPolicy="open" requires channels.meshtastic.allowFrom to include "*"',
  });
});

export const MeshtasticChannelConfigSchema = buildChannelConfigSchema(MeshtasticConfigSchema, {
  uiHints: meshtasticChannelConfigUiHints,
});
