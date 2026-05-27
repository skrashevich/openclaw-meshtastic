import { resolveLoggerBackedRuntime } from "openclaw/plugin-sdk/extension-shared";
import { resolveMeshtasticAccount } from "./accounts.js";
import {
  connectMeshtasticDevice,
  disconnectMeshtasticDevice,
  type MeshtasticDeviceHandle,
} from "./device-client.js";
import { decryptChannelPacket, expandPsk } from "./crypto.js";
import { isOutboundEcho, rememberOutboundEcho } from "./echo-dedupe.js";
import { handleMeshtasticInbound } from "./inbound.js";
import { formatMeshtasticChannelTarget, formatMeshtasticNodeId } from "./normalize.js";
import { formatMeshtasticEndpoint } from "./transport.js";
import type { RuntimeEnv } from "./runtime-api.js";
import { getMeshtasticRuntime } from "./runtime.js";
import type { CoreConfig, MeshtasticInboundMessage } from "./types.js";

type MeshtasticMonitorOptions = {
  accountId?: string;
  config?: CoreConfig;
  runtime?: RuntimeEnv;
  abortSignal?: AbortSignal;
  statusSink?: (patch: {
    lastInboundAt?: number;
    lastOutboundAt?: number;
    lastError?: string;
  }) => void;
  onMessage?: (
    message: MeshtasticInboundMessage,
    handle: MeshtasticDeviceHandle,
  ) => void | Promise<void>;
};

function channelIndexFromPacket(channel: number): number {
  if (Number.isFinite(channel) && channel >= 0 && channel <= 7) {
    return channel;
  }
  return 0;
}

type MeshtasticPacket = {
  id: number;
  rxTime: Date;
  type: "broadcast" | "direct";
  from: number;
  to: number;
  channel: number;
  data: string;
};

export function buildInboundMessage(params: {
  packet: MeshtasticPacket;
  myNodeNum: number | null;
}): MeshtasticInboundMessage | null {
  const text = params.packet.data?.trim() ?? "";
  if (!text) {
    return null;
  }
  // Protobuf omits default from=0; HTTP API surfaces local echoes this way.
  if (params.packet.from === 0) {
    return null;
  }
  if (params.myNodeNum !== null && params.packet.from === params.myNodeNum) {
    return null;
  }
  if (isOutboundEcho(text)) {
    return null;
  }

  const meshChannel = channelIndexFromPacket(params.packet.channel);
  const senderId = formatMeshtasticNodeId(params.packet.from);
  const isGroup = params.packet.type === "broadcast";
  const target = isGroup ? formatMeshtasticChannelTarget(meshChannel) : senderId;

  if (!isGroup && params.myNodeNum !== null && params.packet.to !== params.myNodeNum) {
    return null;
  }

  return {
    messageId: String(params.packet.id),
    target,
    senderNodeNum: params.packet.from,
    senderId,
    text,
    timestamp: params.packet.rxTime?.getTime?.() ?? Date.now(),
    isGroup,
    meshChannel,
    replyToId: String(params.packet.id),
  };
}

export async function monitorMeshtasticProvider(
  opts: MeshtasticMonitorOptions,
): Promise<{ stop: () => void }> {
  const core = getMeshtasticRuntime();
  const cfg = opts.config ?? (core.config.current() as CoreConfig);
  const account = resolveMeshtasticAccount({
    cfg,
    accountId: opts.accountId,
  });

  const runtime: RuntimeEnv = resolveLoggerBackedRuntime(
    opts.runtime,
    core.logging.getChildLogger(),
  );

  if (!account.configured) {
    throw new Error(
      account.transport === "serial"
        ? `Meshtastic is not configured for account "${account.accountId}" (need serialPath in channels.meshtastic).`
        : `Meshtastic is not configured for account "${account.accountId}" (need host in channels.meshtastic).`,
    );
  }

  const logger = core.logging.getChildLogger({
    channel: "meshtastic",
    accountId: account.accountId,
  });

  const handle = await connectMeshtasticDevice({
    accountId: account.accountId,
    transport: account.transport,
    host: account.host,
    port: account.port,
    tls: account.tls,
    serialPath: account.serialPath,
    baudRate: account.baudRate,
  });

  const allowedChannels = new Set(account.config.channels ?? [0]);
  const unsubscribers: Array<() => void> = [];

  // Collect channel PSKs from device config for decrypting encrypted packets
  // (TCP/serial transports receive encrypted payloads that @meshtastic/core won't decrypt)
  const channelPsks = new Map<number, Uint8Array>();

  unsubscribers.push(
    handle.device.events.onChannelPacket.subscribe((channel: { index?: number; settings?: { psk?: Uint8Array } }) => {
      const idx = channel.index ?? 0;
      const rawPsk = channel.settings?.psk;
      if (rawPsk && rawPsk.length > 0) {
        const expanded = expandPsk(rawPsk);
        if (expanded) {
          channelPsks.set(idx, expanded);
        }
      }
    }),
  );

  // For non-HTTP transports: intercept encrypted mesh packets, decrypt with channel PSK,
  // then forward to the normal onMessagePacket handler pipeline.
  if (account.transport !== "http") {
    unsubscribers.push(
      handle.device.events.onMeshPacket.subscribe((meshPacket: {
        id: number;
        from: number;
        to: number;
        channel: number;
        rxTime: number;
        payloadVariant: { case: string; value: unknown };
      }) => {
        if (meshPacket.payloadVariant.case !== "encrypted") {
          return; // decoded packets are handled by onMessagePacket already
        }
        const encrypted = meshPacket.payloadVariant.value as Uint8Array;
        const chIdx = channelIndexFromPacket(meshPacket.channel);
        const psk = channelPsks.get(chIdx);
        if (!psk) {
          logger.debug?.(
            `[${account.accountId}] no PSK for channel ${chIdx}, cannot decrypt packet ${meshPacket.id}`,
          );
          return;
        }
        const decrypted = decryptChannelPacket(encrypted, psk, meshPacket.from, meshPacket.id, chIdx);
        if (!decrypted) {
          logger.debug?.(
            `[${account.accountId}] decrypt failed for packet ${meshPacket.id} on channel ${chIdx}`,
          );
          return;
        }
        // Build a synthetic MeshtasticPacket matching onMessagePacket shape and dispatch
        const syntheticPacket: MeshtasticPacket = {
          id: meshPacket.id,
          rxTime: new Date(meshPacket.rxTime ? meshPacket.rxTime * 1000 : Date.now()),
          type: meshPacket.to === 0xffffffff ? "broadcast" : "direct",
          from: meshPacket.from,
          to: meshPacket.to,
          channel: meshPacket.channel,
          data: new TextDecoder().decode(decrypted),
        };
        void (async () => {
          try {
            const message = buildInboundMessage({ packet: syntheticPacket, myNodeNum: handle.myNodeNum });
            if (!message) {
              return;
            }
            if (message.isGroup && !allowedChannels.has(message.meshChannel)) {
              return;
            }
            logger.info(
              `[${account.accountId}] inbound (decrypted) ${message.isGroup ? "group" : "dm"} from ${message.senderId} on ${message.target}: ${message.text.slice(0, 80)}`,
            );
            core.channel.activity.record({
              channel: "meshtastic",
              accountId: account.accountId,
              direction: "inbound",
              at: message.timestamp,
            });
            if (opts.onMessage) {
              await opts.onMessage(message, handle);
              return;
            }
            await handleMeshtasticInbound({
              message,
              account,
              config: cfg,
              runtime,
              myNodeNum: handle.myNodeNum,
              sendReply: async (target, text, replyToId) => {
                const { sendMessageMeshtastic } = await import("./send.js");
                await sendMessageMeshtastic(target, text, {
                  cfg,
                  accountId: account.accountId,
                  replyTo: replyToId,
                  deviceHandle: handle,
                });
                rememberOutboundEcho(text);
                opts.statusSink?.({ lastOutboundAt: Date.now() });
                core.channel.activity.record({
                  channel: "meshtastic",
                  accountId: account.accountId,
                  direction: "outbound",
                });
              },
              statusSink: opts.statusSink,
            });
          } catch (err) {
            const line = `[${account.accountId}] decrypted inbound handler failed: ${String(err)}`;
            logger.error?.(line);
            runtime.error?.(line);
          }
        })();
      }),
    );
  }

  unsubscribers.push(
    handle.device.events.onMessagePacket.subscribe((packet: MeshtasticPacket) => {
      void (async () => {
        try {
          const message = buildInboundMessage({
            packet,
            myNodeNum: handle.myNodeNum,
          });
          if (!message) {
            return;
          }
          if (message.isGroup && !allowedChannels.has(message.meshChannel)) {
            if (core.logging.shouldLogVerbose()) {
              logger.debug?.(
                `[${account.accountId}] skip mesh channel ${message.meshChannel} (not in allowlist)`,
              );
            }
            return;
          }

          logger.info(
            `[${account.accountId}] inbound ${message.isGroup ? "group" : "dm"} from ${message.senderId} on ${message.target}: ${message.text.slice(0, 80)}`,
          );

          core.channel.activity.record({
            channel: "meshtastic",
            accountId: account.accountId,
            direction: "inbound",
            at: message.timestamp,
          });

          if (opts.onMessage) {
            await opts.onMessage(message, handle);
            return;
          }

          await handleMeshtasticInbound({
            message,
            account,
            config: cfg,
            runtime,
            myNodeNum: handle.myNodeNum,
            sendReply: async (target, text, replyToId) => {
              const { sendMessageMeshtastic } = await import("./send.js");
              await sendMessageMeshtastic(target, text, {
                cfg,
                accountId: account.accountId,
                replyTo: replyToId,
                deviceHandle: handle,
              });
              rememberOutboundEcho(text);
              opts.statusSink?.({ lastOutboundAt: Date.now() });
              core.channel.activity.record({
                channel: "meshtastic",
                accountId: account.accountId,
                direction: "outbound",
              });
            },
            statusSink: opts.statusSink,
          });
        } catch (err) {
          const line = `[${account.accountId}] inbound handler failed: ${String(err)}`;
          logger.error?.(line);
          runtime.error?.(line);
        }
      })();
    }),
  );

  unsubscribers.push(
    handle.device.events.onDeviceStatus.subscribe((status: unknown) => {
      if (core.logging.shouldLogVerbose()) {
        logger.debug?.(`[${account.accountId}] device status: ${String(status)}`);
      }
    }),
  );

  logger.info(
    `[${account.accountId}] connected to Meshtastic (${account.transport}) at ${formatMeshtasticEndpoint(account)}`,
  );

  let stopped = false;
  const cleanup = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    opts.abortSignal?.removeEventListener("abort", abortHandler);
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }
    void disconnectMeshtasticDevice(account.accountId);
  };
  const abortHandler = () => {
    cleanup();
  };
  opts.abortSignal?.addEventListener("abort", abortHandler, { once: true });

  return {
    stop: cleanup,
  };
}
