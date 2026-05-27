import { TransportHTTP } from "@meshtastic/transport-http";
import { resolveMeshtasticAccount } from "./accounts.js";
import { buildMeshtasticTransportAddress } from "./device-client.js";
import { formatMeshtasticEndpoint } from "./transport.js";
import type { CoreConfig, MeshtasticProbe } from "./types.js";

function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return typeof err === "string" ? err : JSON.stringify(err);
}

export async function probeMeshtastic(
  cfg: CoreConfig,
  opts?: { accountId?: string; timeoutMs?: number },
): Promise<MeshtasticProbe> {
  const account = resolveMeshtasticAccount({ cfg, accountId: opts?.accountId });
  const base: MeshtasticProbe = {
    ok: false,
    transport: account.transport,
    host: account.host,
    port: account.port,
    tls: account.tls,
    serialPath: account.serialPath || undefined,
  };

  if (!account.configured) {
    return {
      ...base,
      error:
        account.transport === "serial"
          ? "missing serialPath"
          : "missing host",
    };
  }

  const started = Date.now();
  const timeoutMs = opts?.timeoutMs ?? 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (account.transport === "tcp") {
      const { TransportNode } = await import("@meshtastic/transport-node");
      const transport = await TransportNode.create(account.host, account.port, timeoutMs);
      await transport.disconnect();
    } else if (account.transport === "serial") {
      const { TransportNodeSerial } = await import("@meshtastic/transport-node-serial");
      const transport = await TransportNodeSerial.create(account.serialPath, account.baudRate);
      await transport.disconnect();
    } else {
      const address = buildMeshtasticTransportAddress(account.host, account.port);
      const url = `${account.tls ? "https" : "http"}://${address}`;
      const response = await fetch(`${url}/api/v1/toradio`, {
        method: "OPTIONS",
        signal: controller.signal,
      });
      if (!response.ok) {
        return {
          ...base,
          error: `HTTP ${response.status} ${response.statusText}`,
        };
      }
      const httpTransport = await TransportHTTP.create(address, account.tls);
      await httpTransport.disconnect();
    }

    const elapsed = Date.now() - started;
    return {
      ...base,
      ok: true,
      latencyMs: elapsed,
    };
  } catch (err) {
    return {
      ...base,
      error: formatError(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

export function describeMeshtasticProbeTarget(account: {
  transport: MeshtasticProbe["transport"];
  host: string;
  port: number;
  tls: boolean;
  serialPath: string;
}): string {
  return formatMeshtasticEndpoint(account);
}
