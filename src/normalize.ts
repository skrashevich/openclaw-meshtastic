import { normalizeLowercaseStringOrEmpty } from "openclaw/plugin-sdk/string-coerce-runtime";

const NODE_ID_PATTERN = /^![0-9a-f]{8}$/i;
const NODE_PREFIX = "node:";
const CHANNEL_PREFIX = "channel:";
const CH_PREFIX = "ch:";

export function formatMeshtasticNodeId(nodeNum: number): string {
  return `!${nodeNum.toString(16).padStart(8, "0")}`;
}

export function parseMeshtasticNodeNum(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  let value = trimmed;
  const lowered = normalizeLowercaseStringOrEmpty(value);
  if (lowered.startsWith("meshtastic:")) {
    value = value.slice("meshtastic:".length).trim();
  }
  if (normalizeLowercaseStringOrEmpty(value).startsWith(NODE_PREFIX)) {
    const decimal = value.slice(NODE_PREFIX.length).trim();
    const parsed = Number.parseInt(decimal, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }
  if (value.startsWith("!")) {
    const hex = value.slice(1).trim();
    if (!/^[0-9a-f]+$/i.test(hex)) {
      return undefined;
    }
    const parsed = Number.parseInt(hex, 16);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }
  if (/^\d+$/.test(value)) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }
  return undefined;
}

export function formatMeshtasticChannelTarget(channelIndex: number): string {
  return `${CHANNEL_PREFIX}${channelIndex}`;
}

export function parseMeshtasticChannelIndex(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  let value = trimmed;
  const lowered = normalizeLowercaseStringOrEmpty(value);
  if (lowered.startsWith("meshtastic:")) {
    value = value.slice("meshtastic:".length).trim();
  }
  if (lowered === "broadcast") {
    return 0;
  }
  if (lowered.startsWith(CHANNEL_PREFIX)) {
    value = value.slice(CHANNEL_PREFIX.length).trim();
  } else if (lowered.startsWith(CH_PREFIX)) {
    value = value.slice(CH_PREFIX.length).trim();
  } else {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 7) {
    return undefined;
  }
  return parsed;
}

export function isMeshtasticGroupTarget(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }
  const lowered = normalizeLowercaseStringOrEmpty(trimmed);
  return (
    lowered === "broadcast" ||
    lowered.startsWith(CHANNEL_PREFIX) ||
    lowered.startsWith(CH_PREFIX) ||
    lowered.startsWith(`meshtastic:${CHANNEL_PREFIX}`) ||
    lowered.startsWith(`meshtastic:${CH_PREFIX}`) ||
    lowered === "meshtastic:broadcast"
  );
}

export function normalizeMeshtasticMessagingTarget(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  let value = trimmed;
  const lowered = normalizeLowercaseStringOrEmpty(value);
  if (lowered.startsWith("meshtastic:")) {
    value = value.slice("meshtastic:".length).trim();
  }
  if (normalizeLowercaseStringOrEmpty(value) === "broadcast") {
    return formatMeshtasticChannelTarget(0);
  }
  const channelIndex = parseMeshtasticChannelIndex(value);
  if (channelIndex !== undefined) {
    return formatMeshtasticChannelTarget(channelIndex);
  }
  const nodeNum = parseMeshtasticNodeNum(value);
  if (nodeNum !== undefined) {
    return formatMeshtasticNodeId(nodeNum);
  }
  return undefined;
}

export function looksLikeMeshtasticTargetId(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }
  return normalizeMeshtasticMessagingTarget(trimmed) !== undefined;
}

export function normalizeMeshtasticAllowEntry(raw: string | number): string {
  if (typeof raw === "number") {
    return formatMeshtasticNodeId(raw);
  }
  let value = normalizeLowercaseStringOrEmpty(String(raw));
  if (!value) {
    return "";
  }
  if (value.startsWith("meshtastic:")) {
    value = value.slice("meshtastic:".length);
  }
  if (value.startsWith(NODE_PREFIX)) {
    const nodeNum = parseMeshtasticNodeNum(value);
    return nodeNum !== undefined ? formatMeshtasticNodeId(nodeNum) : value.trim();
  }
  if (value.startsWith("!")) {
    const nodeNum = parseMeshtasticNodeNum(value);
    return nodeNum !== undefined ? formatMeshtasticNodeId(nodeNum) : value.trim();
  }
  if (/^\d+$/.test(value)) {
    const nodeNum = parseMeshtasticNodeNum(value);
    return nodeNum !== undefined ? formatMeshtasticNodeId(nodeNum) : value.trim();
  }
  return value.trim();
}

export function normalizeMeshtasticAllowlist(entries?: Array<string | number>): string[] {
  return (entries ?? []).map((entry) => normalizeMeshtasticAllowEntry(entry)).filter(Boolean);
}

export function buildMeshtasticAllowlistCandidates(senderNodeNum: number): string[] {
  const nodeId = formatMeshtasticNodeId(senderNodeNum);
  return [nodeId, String(senderNodeNum)];
}

export function resolveMeshtasticAllowlistMatch(params: {
  allowFrom: string[];
  senderNodeNum: number;
}): { allowed: boolean; source?: string } {
  const allowFrom = new Set(
    params.allowFrom.map((entry) => normalizeMeshtasticAllowEntry(entry)).filter(Boolean),
  );
  if (allowFrom.has("*")) {
    return { allowed: true, source: "wildcard" };
  }
  for (const candidate of buildMeshtasticAllowlistCandidates(params.senderNodeNum)) {
    if (allowFrom.has(candidate)) {
      return { allowed: true, source: candidate };
    }
  }
  return { allowed: false };
}

export function isMeshtasticNodeId(raw: string): boolean {
  return NODE_ID_PATTERN.test(raw.trim());
}
