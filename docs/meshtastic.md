---
summary: "Meshtastic mesh channel via official protobuf transports"
read_when:
  - You want OpenClaw on a Meshtastic LoRa mesh network
  - You are configuring HTTP, TCP, or serial access to a Meshtastic node
title: "Meshtastic"
---

**Status:** External official plugin (install via `openclaw plugins install`).

Meshtastic is a LoRa mesh networking platform. This plugin connects OpenClaw using the
official Meshtastic JavaScript stack (`@meshtastic/core` + transports), which speaks the
same **protobuf** protocol as the Python CLI and Android app — not a custom wire format.

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

This plugin depends on `@meshtastic/core` and official transport packages, which are
**GPL-3.0-only**. The plugin package isolates that dependency; review GPL obligations
before redistribution.

## Transport modes

| `transport` | Package | Typical use |
| ----------- | ------- | ----------- |
| `http` (default) | `@meshtastic/transport-http` | Node firmware HTTP API on port **4433** |
| `tcp` | `@meshtastic/transport-node` | Native protobuf TCP on port **4403** (firmware Wi‑Fi, or [go-meshtastic-serial2tcp](https://github.com/skrashevich/go-meshtastic-serial2tcp)) |
| `serial` | `@meshtastic/transport-node-serial` | USB serial on the Gateway host (`/dev/ttyUSB0`, etc.) |

All modes use `@meshtastic/core` `MeshDevice` with the shared Meshtastic protobuf definitions.

### HTTP (`transport: "http"`)

Enable the HTTP API on your Meshtastic node (default port **4433**).

```json5
{
  channels: {
    meshtastic: {
      enabled: true,
      transport: "http",
      host: "192.168.1.10",
      port: 4433,
      tls: false,
    },
  },
}
```

### TCP (`transport: "tcp"`)

Use when the radio exposes Meshtastic’s **native TCP protobuf** endpoint (port **4403**),
including bridges such as [go-meshtastic-serial2tcp](https://github.com/skrashevich/go-meshtastic-serial2tcp)
that forward a USB serial device to TCP.

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

### Serial (`transport: "serial"`)

Connect the Gateway machine directly to the radio over USB serial.

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

## Environment variables (default account)

| Variable | Description |
| -------- | ----------- |
| `MESHTASTIC_TRANSPORT` | `http`, `tcp`, or `serial` |
| `MESHTASTIC_HOST` | Host for http/tcp (`host:port` suffix allowed) |
| `MESHTASTIC_PORT` | Override port |
| `MESHTASTIC_TLS` | `true` for HTTPS (http only) |
| `MESHTASTIC_SERIAL` | Serial device path (`transport=serial`) |

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

`openclaw channels status --probe` checks reachability for the configured transport:

- **http**: `/api/v1/toradio` OPTIONS + short `@meshtastic/transport-http` connect
- **tcp**: `@meshtastic/transport-node` connect to `host:4403`
- **serial**: `@meshtastic/transport-node-serial` open on `serialPath`

## Troubleshooting

### Probe fails / no inbound messages

1. Confirm `transport` matches how the device is exposed (HTTP vs TCP vs serial).
2. For **tcp**, verify port **4403** and that a serial2tcp bridge is running if used.
3. For **http**, confirm the node HTTP API is enabled and `tls` matches the node.
4. For **serial**, check device permissions and the correct `/dev/*` path.

### HTTP vs TCP

- **HTTP** (`4433`): request/response API wrapping protobuf (`/api/v1/fromradio`, `/api/v1/toradio`).
- **TCP** (`4403`): continuous protobuf stream — same as Meshtastic Python `TCPInterface`.

This plugin supports both via official transports; you are not limited to a single HTTP wrapper.

## Configuration reference

| Key              | Type     | Default       | Description                            |
| ---------------- | -------- | ------------- | -------------------------------------- |
| `transport`      | string   | `"http"`      | `http`, `tcp`, or `serial`             |
| `host`           | string   | required*     | Host for http/tcp                      |
| `port`           | number   | transport dep.| 4433 (http) or 4403 (tcp)              |
| `tls`            | boolean  | `false`       | HTTPS for `transport=http` only        |
| `serialPath`     | string   | required*     | Device path for `transport=serial`     |
| `baudRate`       | number   | `115200`      | Serial baud rate                       |
| `enabled`        | boolean  | `true`        | Enable channel                         |
| `channels`       | number[] | `[0]`         | Mesh channel indices to listen (0-7)   |
| `dmPolicy`       | string   | `"pairing"`   | DM access policy                       |
| `allowFrom`      | array    | `[]`          | Allowed DM senders                     |
| `groupPolicy`    | string   | `"allowlist"` | Broadcast access policy                |
| `groupAllowFrom` | array    | `[]`          | Allowed broadcast senders              |
| `groups`         | object   | `{}`          | Per-channel policy (`channel:0`, etc.) |
| `textChunkLimit` | number   | `200`         | Outbound chunk size                    |
| `defaultTo`      | string   | —             | Default outbound target                |

\* `host` for http/tcp; `serialPath` for serial.

Multi-account scaffolding uses `channels.meshtastic.accounts` like other channels.
