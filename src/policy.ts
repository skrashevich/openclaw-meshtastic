import type { MeshtasticGroupConfig } from "./types.js";

export type MeshtasticGroupMatch = {
  allowed: boolean;
  groupConfig?: MeshtasticGroupConfig;
  wildcardConfig?: MeshtasticGroupConfig;
  hasConfiguredGroups: boolean;
};

export function resolveMeshtasticGroupMatch(params: {
  groups?: Record<string, MeshtasticGroupConfig>;
  target: string;
}): MeshtasticGroupMatch {
  const groups = params.groups ?? {};
  const hasConfiguredGroups = Object.keys(groups).length > 0;
  const direct = groups[params.target];
  if (direct) {
    return {
      allowed: true,
      groupConfig: direct,
      wildcardConfig: groups["*"],
      hasConfiguredGroups,
    };
  }

  const targetLower = params.target.toLowerCase();
  const directKey = Object.keys(groups).find((key) => key.toLowerCase() === targetLower);
  if (directKey) {
    const matched = groups[directKey];
    if (matched) {
      return {
        allowed: true,
        groupConfig: matched,
        wildcardConfig: groups["*"],
        hasConfiguredGroups,
      };
    }
  }

  const wildcard = groups["*"];
  if (wildcard) {
    return {
      allowed: true,
      wildcardConfig: wildcard,
      hasConfiguredGroups,
    };
  }

  return {
    allowed: false,
    hasConfiguredGroups,
  };
}

export function resolveMeshtasticRequireMention(params: {
  groupConfig?: MeshtasticGroupConfig;
  wildcardConfig?: MeshtasticGroupConfig;
}): boolean {
  if (params.groupConfig?.requireMention !== undefined) {
    return params.groupConfig.requireMention;
  }
  if (params.wildcardConfig?.requireMention !== undefined) {
    return params.wildcardConfig.requireMention;
  }
  return false;
}
