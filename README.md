# openclaw-meshtastic

Standalone OpenClaw channel plugin for Meshtastic mesh networks using the **official Meshtastic protobuf stack**.

## Overview

Connects OpenClaw to a Meshtastic device via `@meshtastic/core` and official transports:

| Transport | When to use |
| --------- | ----------- |
| **tcp** (default) | Native protobuf TCP (port 4403) — firmware Wi‑Fi or [go-meshtastic-serial2tcp](https://github.com/skrashevich/go-meshtastic-serial2tcp) |
| **http** | Node firmware HTTP API (`/api/v1/fromradio`, `/api/v1/toradio`, port 4433) |
| **serial** | USB serial on the Gateway host |

Supported:

- Direct messages (DM) with pairing, allowlist, and open policies
- Mesh broadcast channels with per-channel group policy
- Reply-to threading
- Client-side AES-CTR decryption for TCP/serial transports
- Outbound text chunking for mesh size limits
- Multi-agent binding (separate agent for mesh traffic)

## Requirements

- OpenClaw **>= 2026.5.26**
- A Meshtastic node reachable by HTTP, TCP (4403), or USB serial

## Privacy and logging

Inbound mesh traffic can include personal or operational content. By default this plugin logs **metadata only** (account, DM vs group, sender id, target, message id, text length) — not message bodies.

To include up to 80 characters of inbound text in Gateway logs (debugging only), set:

```json5
{
  channels: {
    meshtastic: {
      logInboundMessageContent: true,
    },
  },
}
```

Review who can read Gateway logs and how long they are retained before enabling this. OpenClaw verbose logging (`shouldLogVerbose`) does not change this behavior.

## Install

From a git checkout (development):

```bash
git clone https://github.com/skrashevich/openclaw-meshtastic.git
openclaw plugins install --link /path/to/openclaw-meshtastic
```

From npm (when published):

```bash
openclaw plugins install openclaw-meshtastic
```

Restart the Gateway after installing or enabling the plugin.

## Quick setup

### 1. Enable the plugin

```json5
{
  plugins: {
    allow: ["meshtastic"],
    entries: {
      meshtastic: { enabled: true },
    },
  },
}
```

For local development, add the plugin path:

```json5
{
  plugins: {
    allow: ["meshtastic"],
    load: {
      paths: ["/path/to/openclaw-meshtastic"],
    },
    entries: {
      meshtastic: { enabled: true },
    },
  },
}
```

### 2. Configure the channel

#### HTTP (node API)

```json5
{
  channels: {
    meshtastic: {
      enabled: true,
      transport: "http",
      host: "192.168.1.10",
      port: 4433,
      dmPolicy: "pairing",
      groupPolicy: "allowlist",
      channels: [0],
      groups: {
        "channel:0": { requireMention: false },
      },
    },
  },
}
```

#### TCP (protobuf stream, e.g. serial2tcp)

```json5
{
  channels: {
    meshtastic: {
      enabled: true,
      transport: "tcp",
      host: "127.0.0.1",
      port: 4403,
      dmPolicy: "pairing",
      groupPolicy: "allowlist",
      channels: [3],
      groups: {
        "channel:3": { requireMention: false },
      },
    },
  },
}
```

#### Serial (USB)

```json5
{
  channels: {
    meshtastic: {
      enabled: true,
      transport: "serial",
      serialPath: "/dev/ttyUSB0",
      baudRate: 115200,
    },
  },
}
```

### 3. Optional: dedicate an agent to mesh traffic

To route Meshtastic messages to a separate agent (different model, workspace, or personality):

```json5
{
  agents: {
    list: [
      { id: "main", workspace: "~/.openclaw/workspace" },
      {
        id: "meshtastic",
        workspace: "~/.openclaw/workspace-meshtastic",
        model: { primary: "openrouter/deepseek/deepseek-v4-flash" },
        tools: { profile: "messaging" },
      },
    ],
  },
  bindings: [
    { agentId: "main", match: { channel: "telegram", accountId: "default" } },
    { agentId: "meshtastic", match: { channel: "meshtastic", accountId: "default" } },
  ],
}
```

Without a binding, Meshtastic traffic goes to the default agent.

### 4. Environment variables (default account)

- `MESHTASTIC_TRANSPORT` — `http`, `tcp`, or `serial`
- `MESHTASTIC_HOST` — host for http/tcp (`host:port` allowed)
- `MESHTASTIC_PORT` — override port
- `MESHTASTIC_TLS` — `true` for HTTPS (http only)
- `MESHTASTIC_SERIAL` — serial device path

See [docs/meshtastic.md](./docs/meshtastic.md) for the full configuration reference.

## Encryption (TCP / serial)

The HTTP transport decrypts packets server-side on the Meshtastic node. TCP and serial transports receive **encrypted** payloads (`payloadVariant.case === "encrypted"`) that `@meshtastic/core` does not decrypt natively.

This plugin handles client-side decryption automatically for non-HTTP transports:

1. On connect, the plugin collects per-channel PSKs from the device's channel settings via `onChannelPacket`.
2. When an encrypted `MeshPacket` arrives, it is decrypted with AES-CTR (128 or 256 bit, depending on PSK length) using the nonce layout from the Meshtastic protocol spec.
3. The decrypted payload is dispatched through the normal inbound message pipeline — DM policy, group policy, allowlist checks, and agent delivery all work as with HTTP.

No extra configuration is needed; decryption is transparent.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

After changing `src/config-schema.ts` or `src/config-ui-hints.ts`, regenerate manifest metadata:

```bash
npm run sync-manifest
```

## License boundary

Plugin scaffolding: MIT. This plugin depends on `@meshtastic/core` and official transport
packages, which are **GPL-3.0-only**. Review GPL obligations before redistribution.
