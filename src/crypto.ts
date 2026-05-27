/**
 * AES-256-CTR decryption for Meshtastic channel-encrypted packets.
 *
 * When using TCP/serial transports, the device sends packets with encrypted
 * payloads (payloadVariant.case === "encrypted"). The HTTP transport decodes
 * them server-side, but @meshtastic/core does not implement client-side
 * decryption. This module fills that gap.
 *
 * Nonce layout (16 bytes, little-endian):
 *   Bytes 0-7:  packet ID (uint64 LE)
 *   Bytes 8-11: from node number (uint32 LE)
 *   Bytes 12-15: extra nonce / channel index (uint32 LE, usually 0)
 *
 * Algorithm: AES-{128,256}-CTR with the channel PSK as the key.
 * PSK length determines AES variant: 16 bytes → AES-128-CTR, 32 bytes → AES-256-CTR.
 */

import { createDecipheriv } from "node:crypto";

/**
 * Decrypt a Meshtastic channel-encrypted payload.
 *
 * @param ciphertext  Raw encrypted bytes from MeshPacket.payloadVariant.value (encrypted case)
 * @param psk         Channel pre-shared key (16 or 32 bytes)
 * @param fromNode    Source node number (meshPacket.from)
 * @param packetId    Packet ID (meshPacket.id)
 * @param channelIndex Optional channel index for nonce extra bytes (firmware 2.7+)
 * @returns Decrypted plaintext bytes, or null if decryption fails (wrong key / corrupted)
 */
export function decryptChannelPacket(
  ciphertext: Uint8Array,
  psk: Uint8Array,
  fromNode: number,
  packetId: number,
  channelIndex?: number,
): Uint8Array | null {
  try {
    const iv = constructNonce(fromNode, packetId, channelIndex ?? 0);
    const algo = psk.length === 32 ? "aes-256-ctr" : "aes-128-ctr";
    const decipher = createDecipheriv(algo, Buffer.from(psk), iv);
    return Buffer.concat([decipher.update(Buffer.from(ciphertext)), decipher.final()]);
  } catch {
    return null;
  }
}

/**
 * Expand a raw PSK value from channel settings.
 * Single-byte PSK (e.g. 0x01 = "AQ==") maps to the default key.
 * 16-byte and 32-byte PSKs are used as-is.
 */
export function expandPsk(rawPsk: Uint8Array): Uint8Array | null {
  if (rawPsk.length === 1) {
    // Default Meshtastic key for single-byte index 1 ("AQ==")
    if (rawPsk[0] === 1) {
      return new Uint8Array([
        0xd4, 0xf1, 0xbb, 0x3a, 0x20, 0x29, 0x07, 0x59,
        0xf0, 0xbc, 0xff, 0xab, 0xcf, 0x4e, 0x69, 0x01,
      ]);
    }
    // Other single-byte indices are not standard; return null
    return null;
  }
  if (rawPsk.length === 16 || rawPsk.length === 32) {
    return rawPsk;
  }
  return null;
}

function constructNonce(fromNode: number, packetId: number, extraNonce: number): Buffer {
  const iv = Buffer.alloc(16);
  // packetId as uint64 LE
  iv.writeBigUInt64LE(BigInt(packetId >>> 0), 0);
  // fromNode as uint32 LE
  iv.writeUInt32LE(fromNode >>> 0, 8);
  // extra nonce (channel index) as uint32 LE
  iv.writeUInt32LE(extraNonce >>> 0, 12);
  return iv;
}
