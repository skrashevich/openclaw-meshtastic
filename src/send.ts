import {
  createMessageReceiptFromOutboundResults,
  type MessageReceipt,
} from "openclaw/plugin-sdk/channel-message";
import { requireRuntimeConfig } from "openclaw/plugin-sdk/plugin-config-runtime";
import { resolveMeshtasticAccount } from "./accounts.js";
import {
  connectMeshtasticDevice,
  getMeshtasticDevice,
  resolveChannelNumber,
  type MeshtasticDeviceHandle,
} from "./device-client.js";
import { rememberOutboundEcho } from "./echo-dedupe.js";
import {
  formatMeshtasticNodeId,
  isMeshtasticGroupTarget,
  normalizeMeshtasticMessagingTarget,
  parseMeshtasticChannelIndex,
  parseMeshtasticNodeNum,
} from "./normalize.js";
import { getMeshtasticRuntime } from "./runtime.js";
import type { CoreConfig } from "./types.js";

type SendMeshtasticOptions = {
  cfg: CoreConfig;
  accountId?: string;
  replyTo?: string;
  target?: string;
  deviceHandle?: MeshtasticDeviceHandle;
};

type SendMeshtasticResult = {
  messageId: string;
  target: string;
  receipt: MessageReceipt;
};

const DEFAULT_CHUNK_LIMIT = 200;

function recordMeshtasticOutboundActivity(accountId: string): void {
  try {
    getMeshtasticRuntime().channel.activity.record({
      channel: "meshtastic",
      accountId,
      direction: "outbound",
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "Meshtastic runtime not initialized") {
      throw error;
    }
  }
}

function chunkText(text: string, limit: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.length <= limit) {
    return [trimmed];
  }
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < trimmed.length) {
    chunks.push(trimmed.slice(cursor, cursor + limit));
    cursor += limit;
  }
  return chunks;
}

function resolveTarget(to: string, opts?: SendMeshtasticOptions): string {
  const fromArg = normalizeMeshtasticMessagingTarget(to);
  if (fromArg) {
    return fromArg;
  }
  const fromOpt = normalizeMeshtasticMessagingTarget(opts?.target ?? "");
  if (fromOpt) {
    return fromOpt;
  }
  throw new Error(`Invalid Meshtastic target: ${to}`);
}

export async function sendMessageMeshtastic(
  to: string,
  text: string,
  opts: SendMeshtasticOptions,
): Promise<SendMeshtasticResult> {
  const cfg = requireRuntimeConfig(opts.cfg, "Meshtastic send") as CoreConfig;
  const account = resolveMeshtasticAccount({
    cfg,
    accountId: opts.accountId,
  });

  if (!account.configured) {
    throw new Error(
      `Meshtastic is not configured for account "${account.accountId}" (need host in channels.meshtastic).`,
    );
  }

  const target = resolveTarget(to, opts);
  const chunkLimit = account.config.textChunkLimit ?? DEFAULT_CHUNK_LIMIT;
  const chunks = chunkText(text, chunkLimit);
  if (chunks.length === 0) {
    throw new Error("Message must be non-empty for Meshtastic sends");
  }

  const handle =
    opts.deviceHandle ??
    getMeshtasticDevice(account.accountId) ??
    (await connectMeshtasticDevice({
      accountId: account.accountId,
      host: account.host,
      port: account.port,
      tls: account.tls,
    }));

  const replyId = opts.replyTo ? Number.parseInt(opts.replyTo, 10) : undefined;
  const parsedReplyId = Number.isFinite(replyId) ? replyId : undefined;

  let lastPacketId = 0;
  if (isMeshtasticGroupTarget(target)) {
    const channelIndex = parseMeshtasticChannelIndex(target) ?? 0;
    const channel = resolveChannelNumber(channelIndex);
    for (const chunk of chunks) {
      lastPacketId = await handle.device.sendText(chunk, "broadcast", true, channel, parsedReplyId);
    }
  } else {
    const nodeNum = parseMeshtasticNodeNum(target);
    if (nodeNum === undefined) {
      throw new Error(`Invalid Meshtastic node target: ${target}`);
    }
    for (const chunk of chunks) {
      lastPacketId = await handle.device.sendText(chunk, nodeNum, true, undefined, parsedReplyId);
    }
  }

  recordMeshtasticOutboundActivity(account.accountId);
  rememberOutboundEcho(text);

  const messageId = String(lastPacketId);
  return {
    messageId,
    target,
    receipt: createMessageReceiptFromOutboundResults({
      results: [
        {
          channel: "meshtastic",
          messageId,
          conversationId: isMeshtasticGroupTarget(target)
            ? target
            : formatMeshtasticNodeId(parseMeshtasticNodeNum(target) ?? 0),
        },
      ],
      kind: "text",
      ...(opts.replyTo ? { replyToId: opts.replyTo } : {}),
    }),
  };
}
