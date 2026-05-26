import { afterEach, describe, expect, it, vi } from "vitest";
import { clearOutboundEchoCache, isOutboundEcho } from "./echo-dedupe.js";
import { sendMessageMeshtastic } from "./send.js";
import type { CoreConfig } from "./types.js";

const { connectMeshtasticDeviceMock, getMeshtasticDeviceMock } = vi.hoisted(() => ({
  connectMeshtasticDeviceMock: vi.fn(),
  getMeshtasticDeviceMock: vi.fn(),
}));

vi.mock("./device-client.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./device-client.js")>();
  return {
    ...actual,
    connectMeshtasticDevice: connectMeshtasticDeviceMock,
    getMeshtasticDevice: getMeshtasticDeviceMock,
  };
});

function createConfig(): CoreConfig {
  return {
    channels: {
      meshtastic: {
        host: "192.168.1.10",
        port: 4433,
      },
    },
  } as CoreConfig;
}

describe("sendMessageMeshtastic", () => {
  afterEach(() => {
    clearOutboundEchoCache();
    vi.clearAllMocks();
  });

  it("does not block on Meshtastic routing ACK when HTTP send is queued", async () => {
    const sendText = vi.fn(() => new Promise<number>(() => undefined));
    const handle = {
      accountId: "default",
      myNodeNum: 123,
      device: {
        sendText,
        queue: {
          getState: () => [{ id: 77, added: new Date() }],
        },
      },
    };
    getMeshtasticDeviceMock.mockReturnValue(handle);

    const result = await sendMessageMeshtastic("channel:3", "hello mesh", {
      cfg: createConfig(),
      ackWaitMs: 1,
    });

    expect(sendText).toHaveBeenCalledWith("hello mesh", "broadcast", true, 3, undefined);
    expect(result.messageId).toBe("77");
    expect(result.target).toBe("channel:3");
  });

  it("uses the ACK packet id when Meshtastic resolves quickly", async () => {
    const sendText = vi.fn(async () => 99);
    const handle = {
      accountId: "default",
      myNodeNum: 123,
      device: {
        sendText,
        queue: {
          getState: () => [{ id: 77, added: new Date() }],
        },
      },
    };
    getMeshtasticDeviceMock.mockReturnValue(handle);

    const result = await sendMessageMeshtastic("!00000002", "hello dm", {
      cfg: createConfig(),
      ackWaitMs: 50,
    });

    expect(sendText).toHaveBeenCalledWith("hello dm", 2, true, undefined, undefined);
    expect(result.messageId).toBe("99");
    expect(result.target).toBe("!00000002");
  });

  it("marks outbound text before sendText can emit a local echo", async () => {
    const sendText = vi.fn(async (text: string) => {
      expect(isOutboundEcho(text)).toBe(true);
      return 101;
    });
    const handle = {
      accountId: "default",
      myNodeNum: 123,
      device: {
        sendText,
        queue: {
          getState: () => [{ id: 101, added: new Date() }],
        },
      },
    };
    getMeshtasticDeviceMock.mockReturnValue(handle);

    await sendMessageMeshtastic("channel:3", "echo me", {
      cfg: createConfig(),
      ackWaitMs: 50,
    });

    expect(sendText).toHaveBeenCalledWith("echo me", "broadcast", true, 3, undefined);
  });
});
