import { describe, expect, it } from "vitest";
import {
  formatMeshtasticChannelTarget,
  formatMeshtasticNodeId,
  normalizeMeshtasticAllowEntry,
  normalizeMeshtasticMessagingTarget,
  parseMeshtasticChannelIndex,
  parseMeshtasticNodeNum,
  resolveMeshtasticAllowlistMatch,
} from "./normalize.js";

describe("meshtastic normalize", () => {
  it("formats and parses node ids", () => {
    expect(formatMeshtasticNodeId(305419896)).toBe("!12345678");
    expect(parseMeshtasticNodeNum("!12345678")).toBe(305419896);
    expect(parseMeshtasticNodeNum("node:305419896")).toBe(305419896);
    expect(parseMeshtasticNodeNum("305419896")).toBe(305419896);
  });

  it("normalizes messaging targets", () => {
    expect(normalizeMeshtasticMessagingTarget("meshtastic:channel:0")).toBe("channel:0");
    expect(normalizeMeshtasticMessagingTarget("ch:2")).toBe("channel:2");
    expect(normalizeMeshtasticMessagingTarget("broadcast")).toBe("channel:0");
    expect(normalizeMeshtasticMessagingTarget("!00000001")).toBe("!00000001");
    expect(normalizeMeshtasticMessagingTarget("\n")).toBeUndefined();
  });

  it("parses channel indices", () => {
    expect(parseMeshtasticChannelIndex("channel:0")).toBe(0);
    expect(parseMeshtasticChannelIndex("ch:3")).toBe(3);
    expect(formatMeshtasticChannelTarget(1)).toBe("channel:1");
  });

  it("normalizes allowlist entries", () => {
    expect(normalizeMeshtasticAllowEntry("node:1")).toBe("!00000001");
    expect(normalizeMeshtasticAllowEntry("meshtastic:!00000002")).toBe("!00000002");
  });

  it("matches senders by node id or decimal", () => {
    expect(
      resolveMeshtasticAllowlistMatch({
        allowFrom: ["!00000001"],
        senderNodeNum: 1,
      }).allowed,
    ).toBe(true);
    expect(
      resolveMeshtasticAllowlistMatch({
        allowFrom: ["1"],
        senderNodeNum: 1,
      }).allowed,
    ).toBe(true);
  });
});
