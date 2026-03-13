import { fromBase64, randomBase64, toBase64 } from "../lib/encoding";

export const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024;

export const generateFileKey = async () =>
  crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256
    },
    true,
    ["encrypt", "decrypt"]
  );

export const createBaseIv = () => randomBase64(12);

export const deriveChunkIv = (baseIv, chunkIndex) => {
  const bytes = typeof baseIv === "string" ? fromBase64(baseIv) : new Uint8Array(baseIv);
  const iv = bytes.slice(0, 12);
  const view = new DataView(iv.buffer);

  view.setUint32(8, chunkIndex);
  return iv;
};

export const encryptChunk = async (fileKey, chunk, baseIv, chunkIndex) =>
  crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: deriveChunkIv(baseIv, chunkIndex)
    },
    fileKey,
    chunk
  );

export const decryptChunk = async (fileKey, encryptedChunk, baseIv, chunkIndex) =>
  crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: deriveChunkIv(baseIv, chunkIndex)
    },
    fileKey,
    encryptedChunk
  );

export const mergeArrayBuffers = (buffers) => {
  const totalLength = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;

  for (const buffer of buffers) {
    merged.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }

  return merged.buffer;
};

export const exportFileKeyPreview = async (fileKey) => toBase64(await crypto.subtle.exportKey("raw", fileKey));

