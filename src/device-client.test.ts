import { describe, expect, it } from "vitest";
import { MeshtasticChannel, resolveChannelNumber } from "./device-client.js";

describe("resolveChannelNumber", () => {
  it("maps channel indices to Meshtastic channel numbers", () => {
    expect(resolveChannelNumber(0)).toBe(MeshtasticChannel.Primary);
    expect(resolveChannelNumber(3)).toBe(MeshtasticChannel.Channel3);
    expect(resolveChannelNumber(7)).toBe(MeshtasticChannel.Admin);
  });

  it("falls back to primary for out-of-range indices", () => {
    expect(resolveChannelNumber(-1)).toBe(MeshtasticChannel.Primary);
    expect(resolveChannelNumber(99)).toBe(MeshtasticChannel.Primary);
  });
});
