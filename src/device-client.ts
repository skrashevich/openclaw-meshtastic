import { ChannelNumber, MeshDevice } from "@meshtastic/core";
import { TransportHTTP } from "@meshtastic/transport-http";

export type MeshtasticDeviceHandle = {
  accountId: string;
  device: MeshDevice;
  myNodeNum: number | null;
};

const devices = new Map<string, MeshtasticDeviceHandle>();

export function buildMeshtasticTransportAddress(host: string, port: number): string {
  return `${host}:${port}`;
}

export async function connectMeshtasticDevice(params: {
  accountId: string;
  host: string;
  port: number;
  tls: boolean;
}): Promise<MeshtasticDeviceHandle> {
  const existing = devices.get(params.accountId);
  if (existing) {
    await disconnectMeshtasticDevice(params.accountId);
  }

  const address = buildMeshtasticTransportAddress(params.host, params.port);
  const transport = await TransportHTTP.create(address, params.tls);
  const device = new MeshDevice(transport);
  const handle: MeshtasticDeviceHandle = {
    accountId: params.accountId,
    device,
    myNodeNum: null,
  };

  device.events.onMyNodeInfo.subscribe((info) => {
    if (typeof info.myNodeNum === "number") {
      handle.myNodeNum = info.myNodeNum;
    }
  });

  // HTTP transport starts receiving immediately; configure() waits up to ~60s for
  // routing ACKs that often never arrive over HTTP, which blocks inbound subscribe.
  void device.configure().catch(() => undefined);
  device.setHeartbeatInterval(30_000);

  devices.set(params.accountId, handle);
  return handle;
}

export async function disconnectMeshtasticDevice(accountId: string): Promise<void> {
  const handle = devices.get(accountId);
  if (!handle) {
    return;
  }
  try {
    await handle.device.disconnect();
  } finally {
    devices.delete(accountId);
  }
}

export function getMeshtasticDevice(accountId: string): MeshtasticDeviceHandle | undefined {
  return devices.get(accountId);
}

export function resolveChannelNumber(channelIndex: number): ChannelNumber {
  switch (channelIndex) {
    case 0:
      return ChannelNumber.Primary;
    case 1:
      return ChannelNumber.Channel1;
    case 2:
      return ChannelNumber.Channel2;
    case 3:
      return ChannelNumber.Channel3;
    case 4:
      return ChannelNumber.Channel4;
    case 5:
      return ChannelNumber.Channel5;
    case 6:
      return ChannelNumber.Channel6;
    case 7:
      return ChannelNumber.Admin;
    default:
      return ChannelNumber.Primary;
  }
}
