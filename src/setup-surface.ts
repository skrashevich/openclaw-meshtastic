import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk/routing";
import type { ChannelSetupWizard } from "openclaw/plugin-sdk/setup";
import {
  createAllowFromSection,
  createPromptParsedAllowFromForAccount,
  createSetupTranslator,
  createStandardChannelSetupStatus,
  formatDocsLink,
  mergeAllowFromEntries,
  setSetupChannelEnabled,
  splitSetupEntries,
} from "openclaw/plugin-sdk/setup";
import { normalizeOptionalString } from "openclaw/plugin-sdk/string-coerce-runtime";
import { resolveDefaultMeshtasticAccountId, resolveMeshtasticAccount } from "./accounts.js";
import {
  formatMeshtasticChannelTarget,
  normalizeMeshtasticAllowEntry,
  normalizeMeshtasticMessagingTarget,
} from "./normalize.js";
import { formatMeshtasticEndpoint } from "./transport.js";
import {
  meshtasticSetupAdapter,
  parsePort,
  setMeshtasticGroupAccess,
  updateMeshtasticAccountConfig,
} from "./setup-core.js";
import type { CoreConfig } from "./types.js";

const t = createSetupTranslator();
const channel = "meshtastic" as const;

function normalizeGroupEntry(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed === "*") {
    return "*";
  }
  return normalizeMeshtasticMessagingTarget(trimmed) ?? trimmed;
}

function resolveMeshtasticConfigKeys(accountId?: string): { policyKey: string; allowFromKey: string } {
  if (accountId && accountId !== DEFAULT_ACCOUNT_ID) {
    return {
      policyKey: `channels.meshtastic.accounts.${accountId}.dmPolicy`,
      allowFromKey: `channels.meshtastic.accounts.${accountId}.allowFrom`,
    };
  }
  return {
    policyKey: "channels.meshtastic.dmPolicy",
    allowFromKey: "channels.meshtastic.allowFrom",
  };
}

export { meshtasticSetupAdapter };

export const meshtasticSetupWizard: ChannelSetupWizard = {
  channel,
  status: createStandardChannelSetupStatus({
    channelLabel: "Meshtastic",
    configuredLabel: t("wizard.channels.statusConfigured"),
    unconfiguredLabel: "Needs connection",
    configuredHint: t("wizard.channels.statusConfigured"),
    unconfiguredHint:
      "Set channels.meshtastic.host (http/tcp) or serialPath (serial) for the Meshtastic device.",
    configuredScore: 1,
    unconfiguredScore: 0,
    includeStatusLine: true,
    resolveConfigured: ({ cfg, accountId }) =>
      resolveMeshtasticAccount({ cfg: cfg as CoreConfig, accountId }).configured,
    resolveExtraStatusLines: ({ cfg, accountId }) => {
      const account = resolveMeshtasticAccount({ cfg: cfg as CoreConfig, accountId });
      if (!account.configured) {
        return [];
      }
      return [`${account.transport}: ${formatMeshtasticEndpoint(account)}`];
    },
  }),
  introNote: {
    title: "Meshtastic setup",
    lines: [
      "Connect via HTTP API (4433), native TCP protobuf (4403, e.g. serial2tcp), or USB serial.",
      `Docs: ${formatDocsLink("/channels/meshtastic", "channels/meshtastic")}`,
    ],
  },
  credentials: [],
  finalize: async ({ cfg, prompter, accountId }) => {
    const resolvedAccountId = accountId ?? resolveDefaultMeshtasticAccountId(cfg as CoreConfig);
    const account = resolveMeshtasticAccount({
      cfg: cfg as CoreConfig,
      accountId: resolvedAccountId,
    });

    const host = normalizeOptionalString(
      await prompter.text({
        message: "Meshtastic node host or IP",
        initialValue: account.host || process.env.MESHTASTIC_HOST || "",
        validate: (value: string) => (normalizeOptionalString(value) ? undefined : "Required"),
      }),
    );
    const portRaw = await prompter.text({
      message: "HTTP API port",
      initialValue: String(account.port || 4433),
    });
    const tls = await prompter.confirm({
      message: "Use HTTPS for the Meshtastic HTTP API?",
      initialValue: account.tls,
    });
    const channelsRaw = await prompter.text({
      message: "Mesh channel indices to listen (comma-separated, 0-7)",
      initialValue: (account.config.channels ?? [0]).join(","),
    });
    const channels = channelsRaw
      .split(/[,;\s]+/)
      .map((entry: string) => Number.parseInt(entry.trim(), 10))
      .filter((value: number) => Number.isFinite(value) && value >= 0 && value <= 7);

    const next = setSetupChannelEnabled(
      updateMeshtasticAccountConfig(cfg as CoreConfig, resolvedAccountId, {
        host,
        port: parsePort(String(portRaw), 4433),
        tls,
        channels: channels.length ? channels : [0],
      }),
      channel,
      true,
    ) as CoreConfig;

    return { cfg: next };
  },
  dmPolicy: {
    label: "Meshtastic",
    channel,
    policyKey: "channels.meshtastic.dmPolicy",
    allowFromKey: "channels.meshtastic.allowFrom",
    resolveConfigKeys: (_cfg, accountId) => resolveMeshtasticConfigKeys(accountId),
    getCurrent: (cfg, accountId) =>
      resolveMeshtasticAccount({ cfg: cfg as CoreConfig, accountId }).config.dmPolicy ?? "pairing",
    setPolicy: (cfg, policy, accountId) =>
      updateMeshtasticAccountConfig(
        cfg as CoreConfig,
        accountId ?? resolveDefaultMeshtasticAccountId(cfg as CoreConfig),
        { dmPolicy: policy },
      ),
    promptAllowFrom: createPromptParsedAllowFromForAccount({
      defaultAccountId: resolveDefaultMeshtasticAccountId,
      message: "Allowed Meshtastic node ids",
      placeholder: "!deef96d6, node:1234567890, *",
      parseEntries: (raw: string) => ({
        entries: mergeAllowFromEntries(undefined, splitSetupEntries(raw)),
      }),
      getExistingAllowFrom: ({ cfg, accountId }) =>
        resolveMeshtasticAccount({ cfg: cfg as CoreConfig, accountId }).config.allowFrom ?? [],
      applyAllowFrom: ({ cfg, accountId, allowFrom }) =>
        updateMeshtasticAccountConfig(cfg as CoreConfig, accountId, { allowFrom }),
    }),
  },
  allowFrom: createAllowFromSection({
    message: "Allowed Meshtastic node ids",
    placeholder: "!deef96d6, node:1234567890, *",
    invalidWithoutCredentialNote: "Entries that are not valid Meshtastic node ids will be ignored.",
    parseId: normalizeMeshtasticAllowEntry,
    apply: ({ cfg, accountId, allowFrom }) =>
      updateMeshtasticAccountConfig(cfg as CoreConfig, accountId, { allowFrom }),
  }),
  groupAccess: {
    label: "Meshtastic broadcast channels",
    placeholder: formatMeshtasticChannelTarget(0),
    currentPolicy: ({ cfg, accountId }) =>
      resolveMeshtasticAccount({ cfg: cfg as CoreConfig, accountId }).config.groupPolicy ??
      "allowlist",
    currentEntries: ({ cfg, accountId }) =>
      Object.keys(resolveMeshtasticAccount({ cfg: cfg as CoreConfig, accountId }).config.groups ?? {}),
    updatePrompt: () => true,
    setPolicy: ({ cfg, accountId, policy }) =>
      setMeshtasticGroupAccess(cfg as CoreConfig, accountId, policy, [], normalizeGroupEntry),
    resolveAllowlist: async ({ entries }) => entries,
    applyAllowlist: ({ cfg, accountId, resolved }) =>
      setMeshtasticGroupAccess(
        cfg as CoreConfig,
        accountId,
        "allowlist",
        Array.isArray(resolved) ? resolved.filter((entry): entry is string => typeof entry === "string") : [],
        normalizeGroupEntry,
      ),
  },
};
