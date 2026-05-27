# @openclaw/meshtastic

Standalone OpenClaw channel plugin for Meshtastic mesh networks using the **official Meshtastic protobuf stack**.

## Overview

Connects OpenClaw to a Meshtastic device via `@meshtastic/core` and official transports:

| Transport | When to use |
| --------- | ----------- |
| **http** (default) | Node firmware HTTP API (`/api/v1/fromradio`, `/api/v1/toradio`, port 4433) |
| **tcp** | Native protobuf TCP (port 4403) — firmware Wi‑Fi or [go-meshtastic-serial2tcp](https://github.com/skrashevich/go-meshtastic-serial2tcp) |
| **serial** | USB serial on the Gateway host |

Supported:

- Direct messages (DM)
- Mesh broadcast channels
- Reply-to threading
- Pairing, allowlist, and group policy controls
- Outbound text chunking for mesh size limits

## Requirements

- OpenClaw **>= 2026.5.26**
- A Meshtastic node reachable by HTTP, TCP (4403), or USB serial

## Install

From npm (when published):

```bash
openclaw plugins install @openclaw/meshtastic
```

From a git checkout:

```bash
git clone https://github.com/skrashevich/openclaw-meshtastic.git
openclaw plugins install --link /path/to/openclaw-meshtastic
```

From a local directory:

```bash
openclaw plugins install --link .
```

Restart the Gateway after installing or enabling the plugin.

Enable in config:

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

## Quick setup

### HTTP (node API)

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

### TCP (protobuf stream, e.g. serial2tcp)

```json5
{
  channels: {
    meshtastic: {
      enabled: true,
      transport: "tcp",
      host: "127.0.0.1",
      port: 4403,
    },
  },
}
```

### Serial (USB)

```json5
{
  channels: {
    meshtastic: {
      enabled: true,
      transport: "serial",
      serialPath: "/dev/ttyUSB0",
    },
  },
}
```

Environment variables (default account):

- `MESHTASTIC_TRANSPORT` — `http`, `tcp`, or `serial`
- `MESHTASTIC_HOST` — host for http/tcp (`host:port` allowed)
- `MESHTASTIC_PORT` — override port
- `MESHTASTIC_TLS` — `true` for HTTPS (http only)
- `MESHTASTIC_SERIAL` — serial device path

See [docs/meshtastic.md](./docs/meshtastic.md) for the full configuration reference.

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
