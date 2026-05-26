import { TransportHTTP } from "@meshtastic/transport-http";
import { resolveMeshtasticAccount } from "./accounts.js";
import { buildMeshtasticTransportAddress } from "./device-client.js";
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
    host: account.host,
    port: account.port,
    tls: account.tls,
  };

  if (!account.configured) {
    return {
      ...base,
      error: "missing host",
    };
  }

  const started = Date.now();
  const timeoutMs = opts?.timeoutMs ?? 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const address = buildMeshtasticTransportAddress(account.host, account.port);
    const url = `${account.tls ? "https" : "http"}://${address}`;
    const probeCandidates: Array<{ method: "OPTIONS" | "GET"; path: string }> = [
      { method: "OPTIONS", path: "/api/v1/toradio" },
      { method: "GET", path: "/api/v1/fromradio?all=false" },
    ];
    let probeResponse: Response | null = null;
    for (const candidate of probeCandidates) {
      const response = await fetch(`${url}${candidate.path}`, {
        method: candidate.method,
        signal: controller.signal,
      });
      // Some bridges (including serial2tcp wrappers) do not implement OPTIONS.
      // Treat 404/405 as endpoint-method mismatch and try the next candidate.
      if (response.status === 404 || response.status === 405) {
        continue;
      }
      probeResponse = response;
      break;
    }
    if (!probeResponse) {
      return {
        ...base,
        error: "HTTP probe endpoints unavailable (received 404/405)",
      };
    }
    if (!probeResponse.ok) {
      return {
        ...base,
        error: `HTTP ${probeResponse.status} ${probeResponse.statusText}`,
      };
    }
    await TransportHTTP.create(address, account.tls);
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
