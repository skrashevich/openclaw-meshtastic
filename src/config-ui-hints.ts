import type { ChannelConfigUiHint } from "openclaw/plugin-sdk/core";

export const meshtasticChannelConfigUiHints = {
  "": {
    label: "Meshtastic",
    help: "Meshtastic mesh channel via the node HTTP API (port 4433 by default). Connect OpenClaw to a Meshtastic device exposing /api/v1/fromradio and /api/v1/toradio.",
  },
  host: {
    label: "Meshtastic Host",
    help: "Hostname or IP of the Meshtastic node running the HTTP API. Optional port suffix (host:4433) is supported.",
  },
  port: {
    label: "Meshtastic Port",
    help: "HTTP API port (default 4433). Ignored when host includes a port.",
  },
  tls: {
    label: "Meshtastic TLS",
    help: "Use HTTPS for the Meshtastic HTTP API (default false).",
  },
  channels: {
    label: "Meshtastic Mesh Channels",
    help: "Mesh channel indices (0-7) to listen for broadcast messages.",
  },
  dmPolicy: {
    label: "Meshtastic DM Policy",
    help: 'Direct message access control ("pairing" recommended). "open" requires channels.meshtastic.allowFrom=["*"].',
  },
  groupPolicy: {
    label: "Meshtastic Group Policy",
    help: 'Broadcast channel access control. "allowlist" requires channels.meshtastic.groups keys such as "channel:0".',
  },
  textChunkLimit: {
    label: "Meshtastic Text Chunk Limit",
    help: "Maximum characters per outbound mesh text message (default ~200). Long replies are split into chunks.",
  },
} satisfies Record<string, ChannelConfigUiHint>;
