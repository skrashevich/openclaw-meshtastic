import type { ChannelSetupAdapter, ChannelSetupInput } from "openclaw/plugin-sdk/channel-setup";
import type { DmPolicy } from "openclaw/plugin-sdk/config-contracts";
import { normalizeAccountId } from "openclaw/plugin-sdk/routing";
import {
  applyAccountNameToChannelSection,
  createSetupInputPresenceValidator,
  createTopLevelChannelAllowFromSetter,
  createTopLevelChannelDmPolicySetter,
  patchScopedAccountConfig,
} from "openclaw/plugin-sdk/setup";
import type { CoreConfig, MeshtasticAccountConfig } from "./types.js";

const channel = "meshtastic" as const;
const setMeshtasticTopLevelDmPolicy = createTopLevelChannelDmPolicySetter({ channel });
const setMeshtasticTopLevelAllowFrom = createTopLevelChannelAllowFromSetter({ channel });

type MeshtasticSetupInput = ChannelSetupInput & {
  host?: string;
  port?: number | string;
  tls?: boolean;
  channels?: number[];
};

export function parsePort(raw: string, fallback: number): number {
  const trimmed = raw.trim();
  if (!trimmed) {
    return fallback;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    return fallback;
  }
  return parsed;
}

export function updateMeshtasticAccountConfig(
  cfg: CoreConfig,
  accountId: string,
  patch: Partial<MeshtasticAccountConfig>,
): CoreConfig {
  return patchScopedAccountConfig({
    cfg,
    channelKey: channel,
    accountId,
    patch,
    ensureChannelEnabled: false,
    ensureAccountEnabled: false,
  }) as CoreConfig;
}

export function setMeshtasticDmPolicy(cfg: CoreConfig, dmPolicy: DmPolicy): CoreConfig {
  return setMeshtasticTopLevelDmPolicy(cfg, dmPolicy) as CoreConfig;
}

export function setMeshtasticAllowFrom(cfg: CoreConfig, allowFrom: string[]): CoreConfig {
  return setMeshtasticTopLevelAllowFrom(cfg, allowFrom) as CoreConfig;
}

export function setMeshtasticGroupAccess(
  cfg: CoreConfig,
  accountId: string,
  policy: "open" | "allowlist" | "disabled",
  entries: string[],
  normalizeGroupEntry: (raw: string) => string | null,
): CoreConfig {
  if (policy !== "allowlist") {
    return updateMeshtasticAccountConfig(cfg, accountId, { enabled: true, groupPolicy: policy });
  }
  const normalizedEntries = [
    ...new Set(entries.map((entry) => normalizeGroupEntry(entry)).filter(Boolean)),
  ];
  const groups = Object.fromEntries(normalizedEntries.map((entry) => [entry, {}]));
  return updateMeshtasticAccountConfig(cfg, accountId, {
    enabled: true,
    groupPolicy: "allowlist",
    groups,
  });
}

export const meshtasticSetupAdapter: ChannelSetupAdapter = {
  resolveAccountId: ({ accountId }) => normalizeAccountId(accountId),
  applyAccountName: ({ cfg, accountId, name }) =>
    applyAccountNameToChannelSection({
      cfg,
      channelKey: channel,
      accountId,
      name,
    }),
  validateInput: createSetupInputPresenceValidator({
    whenNotUseEnv: [{ someOf: ["host"], message: "Meshtastic requires host." }],
  }),
  applyAccountConfig: ({ cfg, accountId, input }) => {
    const setupInput = input as MeshtasticSetupInput;
    const namedConfig = applyAccountNameToChannelSection({
      cfg,
      channelKey: channel,
      accountId,
      name: setupInput.name,
    });
    const portInput =
      typeof setupInput.port === "number" ? String(setupInput.port) : (setupInput.port ?? "");
    const patch: Partial<MeshtasticAccountConfig> = {
      enabled: true,
      host: setupInput.host?.trim(),
      port: portInput ? parsePort(portInput, 4433) : undefined,
      tls: setupInput.tls,
      channels: setupInput.channels?.length ? setupInput.channels : undefined,
    };
    return updateMeshtasticAccountConfig(namedConfig as CoreConfig, accountId, patch);
  },
};
