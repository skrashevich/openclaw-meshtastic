import { afterEach, describe, expect, it, vi } from "vitest";
import { probeMeshtastic } from "./probe.js";
import type { CoreConfig } from "./types.js";

const { createTransportMock } = vi.hoisted(() => ({
  createTransportMock: vi.fn(),
}));

vi.mock("@meshtastic/transport-http", () => ({
  TransportHTTP: {
    create: createTransportMock,
  },
}));

function createConfig(): CoreConfig {
  return {
    channels: {
      meshtastic: {
        host: "127.0.0.1",
        port: 4433,
        tls: false,
      },
    },
  } as CoreConfig;
}

describe("probeMeshtastic", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("falls back to GET probe when OPTIONS is not supported", async () => {
    createTransportMock.mockResolvedValue({});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 405 }))
      .mockResolvedValueOnce(new Response(new Uint8Array(), { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    const result = await probeMeshtastic(createConfig(), { timeoutMs: 1000 });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:4433/api/v1/toradio",
      expect.objectContaining({ method: "OPTIONS" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:4433/api/v1/fromradio?all=false",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
