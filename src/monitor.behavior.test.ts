import { afterEach, describe, expect, it } from "vitest";
import { clearOutboundEchoCache, isOutboundEcho, rememberOutboundEcho } from "./echo-dedupe.js";
import { buildInboundMessage, formatInboundLogLine } from "./monitor.js";
import type { MeshtasticInboundMessage } from "./types.js";

describe("echo dedupe", () => {
  afterEach(() => {
    clearOutboundEchoCache();
  });

  it("suppresses recently sent outbound text", () => {
    rememberOutboundEcho("hello mesh");
    expect(isOutboundEcho("hello mesh")).toBe(true);
    expect(isOutboundEcho("other")).toBe(false);
  });
});

describe("formatInboundLogLine", () => {
  const message: MeshtasticInboundMessage = {
    messageId: "42",
    target: "channel:0",
    senderNodeNum: 1,
    senderId: "!aabbccdd",
    text: "secret mesh payload",
    timestamp: 1,
    isGroup: true,
    meshChannel: 0,
  };

  it("omits message body by default", () => {
    const line = formatInboundLogLine({
      accountId: "default",
      message,
      logMessageContent: false,
    });
    expect(line).toContain("from !aabbccdd on channel:0 id=42");
    expect(line).toContain("(19 chars)");
    expect(line).not.toContain("secret");
  });

  it("includes excerpt when explicitly enabled", () => {
    const line = formatInboundLogLine({
      accountId: "default",
      message,
      logMessageContent: true,
    });
    expect(line).toContain(": secret mesh payload");
  });
});

describe("buildInboundMessage", () => {
  afterEach(() => {
    clearOutboundEchoCache();
  });

  const basePacket = {
    id: 1,
    rxTime: new Date(),
    type: "broadcast" as const,
    from: 2864434397,
    to: 4294967295,
    channel: 3,
    data: "Багли, привет",
  };

  it("accepts broadcast on configured channel", () => {
    const message = buildInboundMessage({ packet: basePacket, myNodeNum: 123 });
    expect(message).toMatchObject({
      target: "channel:3",
      senderId: "!aabbccdd",
      isGroup: true,
      meshChannel: 3,
    });
  });

  it("drops from=0 protobuf default echoes", () => {
    expect(
      buildInboundMessage({
        packet: { ...basePacket, from: 0, data: "*️⃣" },
        myNodeNum: 123,
      }),
    ).toBeNull();
  });

  it("drops own node messages", () => {
    expect(
      buildInboundMessage({
        packet: { ...basePacket, from: 123 },
        myNodeNum: 123,
      }),
    ).toBeNull();
  });

  it("drops outbound echo text", () => {
    rememberOutboundEcho("Багли, привет");
    expect(buildInboundMessage({ packet: basePacket, myNodeNum: 999 })).toBeNull();
  });
});
