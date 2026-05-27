import { describe, expect, it } from "vitest";
import { resolveMeshtasticAccount } from "./accounts.js";
import type { CoreConfig } from "./types.js";

describe("resolveMeshtasticAccount transport", () => {
  it("defaults to tcp with port 4403", () => {
    const account = resolveMeshtasticAccount({
      cfg: {
        channels: {
          meshtastic: {
            host: "192.168.1.5",
          },
        },
      } as CoreConfig,
    });
    expect(account.transport).toBe("tcp");
    expect(account.port).toBe(4403);
    expect(account.configured).toBe(true);
  });

  it("resolves tcp with default port 4403", () => {
    const account = resolveMeshtasticAccount({
      cfg: {
        channels: {
          meshtastic: {
            transport: "tcp",
            host: "10.0.0.2",
          },
        },
      } as CoreConfig,
    });
    expect(account.transport).toBe("tcp");
    expect(account.port).toBe(4403);
  });

  it("resolves serial without host", () => {
    const account = resolveMeshtasticAccount({
      cfg: {
        channels: {
          meshtastic: {
            transport: "serial",
            serialPath: "/dev/ttyUSB0",
          },
        },
      } as CoreConfig,
    });
    expect(account.transport).toBe("serial");
    expect(account.serialPath).toBe("/dev/ttyUSB0");
    expect(account.configured).toBe(true);
    expect(account.host).toBe("");
  });
});
