import { api } from "../api/client.js";
import { decryptChunk, mergeArrayBuffers } from "../crypto/fileCrypto.js";
import { unwrapFileKeyForOwner, unwrapFileKeyWithPassphrase } from "../crypto/passwordEnvelope.js";
import { unwrapEcdhSharePackage } from "../crypto/shareCrypto.js";

export const unwrapGrantFileKey = async ({ grant, password, privateKey, passphrase }) => {
  if (grant.grantType === "owner-password") {
    if (!password) {
      throw new Error("The owner password is required to unlock this file key.");
    }

    return unwrapFileKeyForOwner(grant.wrappedKeyPackage, password);
  }

  if (grant.grantType === "ecdh") {
    if (!privateKey) {
      throw new Error("Your private sharing key is not available in memory. Please sign in again.");
    }

    return unwrapEcdhSharePackage(grant.wrappedKeyPackage, privateKey);
  }

  if (grant.grantType === "link-password") {
    if (!passphrase) {
      throw new Error("The share passphrase is required.");
    }

    return unwrapFileKeyWithPassphrase(grant.wrappedKeyPackage, passphrase);
  }

  throw new Error(`Unsupported grant type: ${grant.grantType}`);
};

export const downloadDecryptedFile = async ({
  token,
  shareToken,
  file,
  grant,
  password,
  privateKey,
  passphrase,
  onProgress
}) => {
  const fileKey = await unwrapGrantFileKey({ grant, password, privateKey, passphrase });
  const decryptedChunks = [];

  for (let chunkIndex = 0; chunkIndex < file.chunkCount; chunkIndex += 1) {
    const encryptedChunk = await api.getEncryptedChunk({
      token,
      shareToken,
      fileId: file.id,
      chunkIndex
    });
    const decryptedChunk = await decryptChunk(fileKey, encryptedChunk, file.encryption.baseIv, chunkIndex);
    decryptedChunks.push(decryptedChunk);

    if (onProgress) {
      onProgress({
        current: chunkIndex + 1,
        total: file.chunkCount
      });
    }
  }

  return new Blob([mergeArrayBuffers(decryptedChunks)], { type: file.mimeType });
};

export const triggerBrowserDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

