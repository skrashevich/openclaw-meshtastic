import { sanitizeForPlainText } from "openclaw/plugin-sdk/outbound-runtime";
import { chunkTextForOutbound } from "./channel-api.js";

export const meshtasticOutboundBaseAdapter = {
  deliveryMode: "direct" as const,
  chunker: chunkTextForOutbound,
  chunkerMode: "length" as const,
  textChunkLimit: 200,
  sanitizeText: ({ text }: { text: string }) => sanitizeForPlainText(text),
};
