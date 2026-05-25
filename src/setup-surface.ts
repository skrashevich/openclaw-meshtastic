import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk/routing";
import type { ChannelSetupWizard } from "openclaw/plugin-sdk/setup";
import {
  createAllowFromSection,
  createPromptParsedAllowFromForAccount,
  createSetupTranslator,
  createStandardChannelSetupStatus,
  formatDocsLink,
  setSetupChannelEnabled,
} from "openclaw/plugin-sdk/setup";
import { normalizeOptionalString } from "openclaw/plugin-sdk/string-coerce-runtime";
import { resolveDefaultMeshtasticAccountId, resolveMeshtasticAccount } from "./accounts.js";
import {
  formatMeshtasticChannelTarget,
  normalizeMeshtasticAllowEntry,
  normalizeMeshtasticMessagingTarget,
} from "./normalize.js";
import {
  meshtasticSetupAdapter,
  parsePort,
  setMeshtasticAllowFrom,
  setMeshtasticDmPolicy,
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

export { meshtasticSetupAdapter };

export const meshtasticSetupWizard: ChannelSetupWizard = {
  channel,
  status: createStandardChannelSetupStatus({
    channelLabel: "Meshtastic",
    configuredLabel: t("wizard.channels.statusConfigured"),
    unconfiguredLabel: "Needs host",
    configuredHint: t("wizard.channels.statusConfigured"),
    unconfiguredHint: "Set channels.meshtastic.host to the node HTTP API address.",
    configuredScore: 1,
    unconfiguredScore: 0,
    includeStatusLine: true,
    resolveConfigured: ({ cfg }) => resolveMeshtasticAccount({ cfg: cfg as CoreConfig }).configured,
    resolveExtraStatusLines: ({ cfg }) => {
      const account = resolveMeshtasticAccount({ cfg: cfg as CoreConfig });
      if (!account.configured) {
        return [];
      }
      return [`HTTP API: ${account.tls ? "https" : "http"}://${account.host}:${account.port}`];
    },
  }),
  introNote: {
    title: "Meshtastic setup",
    lines: [
      "Connect to a Meshtastic node exposing the HTTP API (default port 4433).",
      `Docs: ${formatDocsLink("/channels/meshtastic", "channels/meshtastic")}`,
    ],
  },
  run: async ({ cfg, prompter, accountId, allowFromSection }) => {
    const resolvedAccountId = accountId ?? resolveDefaultMeshtasticAccountId(cfg as CoreConfig);
    const account = resolveMeshtasticAccount({
      cfg: cfg as CoreConfig,
      accountId: resolvedAccountId,
    });

    const host = normalizeOptionalString(
      await prompter.text({
        message: "Meshtastic node host or IP",
        initialValue: account.host || process.env.MESHTASTIC_HOST || "",
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
      .map((entry) => Number.parseInt(entry.trim(), 10))
      .filter((value) => Number.isFinite(value) && value >= 0 && value <= 7);

    let next = updateMeshtasticAccountConfig(cfg as CoreConfig, resolvedAccountId, {
      host,
      port: parsePort(String(portRaw), 4433),
      tls,
      channels: channels.length ? channels : [0],
    });
    next = setSetupChannelEnabled(next, channel, true) as CoreConfig;

    const dmPolicy = await prompter.select({
      message: "Direct message policy",
      options: [
        { label: "Pairing (recommended)", value: "pairing" },
        { label: "Allowlist", value: "allowlist" },
        { label: "Open", value: "open" },
        { label: "Disabled", value: "disabled" },
      ],
      initialValue: account.config.dmPolicy ?? "pairing",
    });
    next = setMeshtasticDmPolicy(next, dmPolicy);

    if (allowFromSection !== false) {
      const allowFrom = await createAllowFromSection({
        prompter,
        initialEntries: account.config.allowFrom?.map(String) ?? [],
        prompt: createPromptParsedAllowFromForAccount({
          channel,
          accountId: resolvedAccountId,
          normalizeEntry: normalizeMeshtasticAllowEntry,
        }),
      });
      next = setMeshtasticAllowFrom(next, allowFrom);
    }

    const groupPolicy = await prompter.select({
      message: "Broadcast channel policy",
      options: [
        { label: "Allowlist (recommended)", value: "allowlist" },
        { label: "Open", value: "open" },
        { label: "Disabled", value: "disabled" },
      ],
      initialValue: account.config.groupPolicy ?? "allowlist",
    });
    const groupEntries =
      groupPolicy === "allowlist"
        ? (
            await prompter.text({
              message: "Allowed broadcast channels (e.g. channel:0)",
              initialValue:
                Object.keys(account.config.groups ?? {}).join(", ") ||
                formatMeshtasticChannelTarget(0),
            })
          )
            .split(/[,;\s]+/)
            .map((entry) => entry.trim())
            .filter(Boolean)
        : [];
    next = setMeshtasticGroupAccess(
      next,
      resolvedAccountId,
      groupPolicy,
      groupEntries,
      normalizeGroupEntry,
    );

    return {
      cfg: next,
      accountId: resolvedAccountId === DEFAULT_ACCOUNT_ID ? undefined : resolvedAccountId,
    };
  },
};
