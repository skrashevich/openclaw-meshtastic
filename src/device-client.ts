import { MeshDevice, Types } from "@meshtastic/core";
import { TransportHTTP } from "@meshtastic/transport-http";

export type MeshtasticDeviceHandle = {
  accountId: string;
  device: MeshDevice;
  myNodeNum: number | null;
};

const devices = new Map<string, MeshtasticDeviceHandle>();

type MeshtasticHttpTransportInternals = {
  url: string;
  receiveBatchRequests?: boolean;
  inflightReadController?: AbortController;
  fromDeviceController?: {
    enqueue: (output: { type: "packet"; data: Uint8Array }) => void;
  };
  emitStatus?: (next: Types.DeviceStatusEnum, reason?: string) => void;
};

export function buildMeshtasticTransportAddress(host: string, port: number): string {
  return `${host}:${port}`;
}

function toMeshtasticHttpTransportInternals(
  transport: Awaited<ReturnType<typeof TransportHTTP.create>>,
): MeshtasticHttpTransportInternals & { readFromRadio?: () => Promise<void> } {
  return transport as unknown as MeshtasticHttpTransportInternals & {
    readFromRadio?: () => Promise<void>;
  };
}

function installHttpTransportBackpressure(
  transport: Awaited<ReturnType<typeof TransportHTTP.create>>,
): void {
  const http = toMeshtasticHttpTransportInternals(transport);
  if (!http.url || typeof http.readFromRadio !== "function") {
    return;
  }

  http.receiveBatchRequests = true;
  http.inflightReadController?.abort();
  http.readFromRadio = async () => {
    const inflight = new AbortController();
    http.inflightReadController = inflight;
    const signal = AbortSignal.any([inflight.signal, AbortSignal.timeout(7_000)]);
    try {
      const response = await fetch(`${http.url}/api/v1/fromradio?all=true`, {
        method: "GET",
        headers: { Accept: "application/x-protobuf" },
        signal,
      });
      if (!response.ok) {
        throw new Error(`fromradio ${response.status} ${response.statusText}`);
      }
      http.emitStatus?.(Types.DeviceStatusEnum.DeviceConnected);
      const readBuffer = await response.arrayBuffer();
      if (readBuffer.byteLength > 0) {
        http.fromDeviceController?.enqueue({
          type: "packet",
          data: new Uint8Array(readBuffer),
        });
      }
    } finally {
      http.inflightReadController = undefined;
    }
  };
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
  installHttpTransportBackpressure(transport);
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
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("Invalid state")) {
      throw error;
    }
  } finally {
    devices.delete(accountId);
  }
}

export function getMeshtasticDevice(accountId: string): MeshtasticDeviceHandle | undefined {
  return devices.get(accountId);
}

/** Meshtastic channel indices for sendText — @meshtastic/core v2.6+ no longer exports ChannelNumber. */
export const MeshtasticChannel = {
  Primary: 0,
  Channel1: 1,
  Channel2: 2,
  Channel3: 3,
  Channel4: 4,
  Channel5: 5,
  Channel6: 6,
  Admin: 7,
} as const;

export type MeshtasticChannelIndex = (typeof MeshtasticChannel)[keyof typeof MeshtasticChannel];

export function resolveChannelNumber(channelIndex: number): MeshtasticChannelIndex {
  if (channelIndex >= 0 && channelIndex <= 7) {
    return channelIndex as MeshtasticChannelIndex;
  }
  return MeshtasticChannel.Primary;
}
