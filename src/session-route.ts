import {
  buildChannelOutboundSessionRoute,
  stripChannelTargetPrefix,
  type ChannelOutboundSessionRouteParams,
} from "openclaw/plugin-sdk/core";
import { isMeshtasticGroupTarget, normalizeMeshtasticMessagingTarget } from "./normalize.js";

export function resolveMeshtasticOutboundSessionRoute(params: ChannelOutboundSessionRouteParams) {
  const target = stripChannelTargetPrefix(params.target, "meshtastic");
  const normalized = normalizeMeshtasticMessagingTarget(target);
  if (!normalized) {
    return null;
  }
  const isGroup = isMeshtasticGroupTarget(normalized);
  return buildChannelOutboundSessionRoute({
    cfg: params.cfg,
    agentId: params.agentId,
    channel: "meshtastic",
    accountId: params.accountId,
    peer: {
      kind: isGroup ? "group" : "direct",
      id: normalized,
    },
    chatType: isGroup ? "group" : "direct",
    from: `meshtastic:${normalized}`,
    to: `meshtastic:${normalized}`,
  });
}
