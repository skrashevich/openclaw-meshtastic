import { afterEach, describe, expect, it } from "vitest";
import { clearOutboundEchoCache, isOutboundEcho, rememberOutboundEcho } from "./echo-dedupe.js";
import { buildInboundMessage } from "./monitor.js";

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

describe("buildInboundMessage", () => {
  afterEach(() => {
    clearOutboundEchoCache();
  });

  const basePacket = {
    id: 1,
    rxTime: new Date(),
    type: "broadcast" as const,
    from: 3740243670,
    to: 4294967295,
    channel: 3,
    data: "Багли, привет",
  };

  it("accepts broadcast on configured channel", () => {
    const message = buildInboundMessage({ packet: basePacket, myNodeNum: 123 });
    expect(message).toMatchObject({
      target: "channel:3",
      senderId: "!deef96d6",
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
