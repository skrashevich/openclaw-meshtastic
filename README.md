# @openclaw/meshtastic

Standalone OpenClaw channel plugin for Meshtastic mesh networks via the node HTTP API.

## Overview

Connects OpenClaw to a Meshtastic device that exposes the HTTP API
(`/api/v1/fromradio`, `/api/v1/toradio`) via `@meshtastic/transport-http`.

Supported:

- Direct messages (DM)
- Mesh broadcast channels
- Reply-to threading
- Pairing, allowlist, and group policy controls
- Outbound text chunking for mesh size limits

## Requirements

- OpenClaw **>= 2026.5.26**
- A Meshtastic node with the HTTP API enabled

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

```json5
{
  channels: {
    meshtastic: {
      enabled: true,
      host: "192.168.1.10",
      tls: false,
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

Environment variables (default account):

- `MESHTASTIC_HOST` — node host or `host:port`
- `MESHTASTIC_PORT` — HTTP API port (default 4433)
- `MESHTASTIC_TLS` — set to `true` for HTTPS

See [docs/meshtastic.md](./docs/meshtastic.md) for full configuration reference.

## Development

```bash
npm install
npm test
npm run build
```

After changing `src/config-schema.ts` or `src/config-ui-hints.ts`, regenerate manifest metadata:

```bash
npm run sync-manifest
```

## License boundary

Plugin scaffolding: MIT. This plugin depends on `@meshtastic/core` and
`@meshtastic/transport-http`, which are **GPL-3.0-only**. Review GPL obligations
before redistribution.
