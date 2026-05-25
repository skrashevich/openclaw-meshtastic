---
summary: "Meshtastic mesh channel via node HTTP API"
read_when:
  - You want OpenClaw on a Meshtastic LoRa mesh network
  - You are configuring a Meshtastic node HTTP API connection
title: "Meshtastic"
---

**Status:** External official plugin (install via `openclaw plugins install`).

Meshtastic is a LoRa mesh networking platform. This plugin connects OpenClaw to a
Meshtastic device that exposes the HTTP API (`/api/v1/fromradio`, `/api/v1/toradio`)
using `@meshtastic/transport-http`.

## Install

```bash
openclaw plugins install @openclaw/meshtastic
```

Git checkout:

```bash
git clone https://github.com/skrashevich/openclaw-meshtastic.git
openclaw plugins install --link /path/to/openclaw-meshtastic
```

Restart the Gateway after installing or enabling plugins.

## GPL dependency note

This plugin depends on `@meshtastic/core` and `@meshtastic/transport-http`, which are
**GPL-3.0-only**. The plugin package isolates that dependency; review GPL obligations
before redistribution.

## Quick setup

1. Enable the HTTP API on your Meshtastic node (default port **4433**).
2. Add config:

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

3. Restart the Gateway.

Environment variables (default account):

- `MESHTASTIC_HOST` — node host or `host:port`
- `MESHTASTIC_PORT` — HTTP API port (default 4433)
- `MESHTASTIC_TLS` — set to `true` for HTTPS

## Target grammar

| Target               | Send behavior               | Chat type |
| -------------------- | --------------------------- | --------- |
| `!12345678`          | DM to node id               | direct    |
| `node:305419896`     | DM by decimal node number   | direct    |
| `channel:0` / `ch:0` | Broadcast on mesh channel 0 | group     |
| `broadcast`          | Alias for primary channel   | group     |

OpenClaw `to` values and session ids use the same grammar with an optional `meshtastic:` prefix.

## Access control

### DM policies

- **pairing** (default): unknown senders receive a pairing code
- **allowlist**: only node ids in `allowFrom` can DM the bot
- **open**: any sender can DM (requires `allowFrom: ["*"]`)
- **disabled**: DMs are dropped

Allowlist entries accept `!hex` node ids or decimal `node:` / numeric forms.

### Group / broadcast policy

- **allowlist** (default): only keys in `groups` receive inbound broadcast traffic
- **open**: all configured mesh channels are accepted (mention rules may still apply)
- **disabled**: broadcast messages are dropped

Example group config:

```json5
{
  channels: {
    meshtastic: {
      groupPolicy: "allowlist",
      channels: [0, 1],
      groups: {
        "channel:0": { requireMention: false },
        "channel:1": { requireMention: true },
      },
    },
  },
}
```

## Reply-to

Inbound mesh text messages expose `packet.id`. Outbound replies can pass `replyId` to
`sendText` so clients show threaded replies when supported.

## Outbound chunking

Meshtastic mesh text has a practical size limit (~200 characters). OpenClaw splits long
agent replies into chunks (`textChunkLimit`, default 200).

## Probe and status

`openclaw channels status --probe` checks HTTP reachability via `/api/v1/toradio` OPTIONS
and a short `@meshtastic/transport-http` connect.

## Troubleshooting

### Probe fails / no inbound messages

1. Verify the node HTTP API is enabled and reachable on the configured host/port.
2. Confirm `tls` matches the node (most LAN setups use plain HTTP on 4433).
3. Check firewall rules between the Gateway host and the node.

### HTTP vs TCP confusion

This plugin uses the **HTTP API** on port 4433. Meshtastic TCP transport is not used in v1.

### Live verify gaps

Mesh latency, multi-hop routing, TLS with self-signed certificates, and ack timing are
environment-dependent and are best verified on real hardware outside CI.

## Configuration reference

| Key              | Type     | Default       | Description                            |
| ---------------- | -------- | ------------- | -------------------------------------- |
| `host`           | string   | required      | Meshtastic node host/IP                |
| `port`           | number   | `4433`        | HTTP API port                          |
| `tls`            | boolean  | `false`       | Use HTTPS                              |
| `enabled`        | boolean  | `true`        | Enable channel                         |
| `channels`       | number[] | `[0]`         | Mesh channel indices to listen (0-7)   |
| `dmPolicy`       | string   | `"pairing"`   | DM access policy                       |
| `allowFrom`      | array    | `[]`          | Allowed DM senders                     |
| `groupPolicy`    | string   | `"allowlist"` | Broadcast access policy                |
| `groupAllowFrom` | array    | `[]`          | Allowed broadcast senders              |
| `groups`         | object   | `{}`          | Per-channel policy (`channel:0`, etc.) |
| `textChunkLimit` | number   | `200`         | Outbound chunk size                    |
| `defaultTo`      | string   | —             | Default outbound target                |

Multi-account scaffolding uses `channels.meshtastic.accounts` like other channels.
