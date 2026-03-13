import { decodeText, encodeText, fromBase64, randomBase64, toBase64 } from "../lib/encoding";

const PBKDF2_ITERATIONS = 250_000;

const derivePasswordKey = async (password, salt, usages) => {
  const passwordKey = await crypto.subtle.importKey("raw", encodeText(password), "PBKDF2", false, ["deriveKey"]);

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: PBKDF2_ITERATIONS
    },
    passwordKey,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    usages
  );
};

const encryptBytesWithPassword = async (bytes, password) => {
  const salt = fromBase64(randomBase64(16));
  const iv = fromBase64(randomBase64(12));
  const key = await derivePasswordKey(password, salt, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);

  return {
    algorithm: "AES-GCM",
    iterations: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext)
  };
};

const decryptBytesWithPassword = async (bundle, password) => {
  const salt = fromBase64(bundle.salt);
  const iv = fromBase64(bundle.iv);
  const ciphertext = fromBase64(bundle.ciphertext);
  const key = await derivePasswordKey(password, salt, ["decrypt"]);

  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
};

export const encryptJsonWithPassword = async (payload, password) => {
  const bytes = encodeText(JSON.stringify(payload));
  return encryptBytesWithPassword(bytes, password);
};

export const decryptJsonWithPassword = async (bundle, password) => {
  const buffer = await decryptBytesWithPassword(bundle, password);
  return JSON.parse(decodeText(buffer));
};

export const wrapFileKeyForOwner = async (fileKey, password) => {
  const rawKey = await crypto.subtle.exportKey("raw", fileKey);
  const wrapped = await encryptBytesWithPassword(rawKey, password);

  return {
    mode: "owner-password",
    ...wrapped
  };
};

export const unwrapFileKeyForOwner = async (bundle, password) => {
  const rawKey = await decryptBytesWithPassword(bundle, password);
  return crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
};

export const wrapFileKeyWithPassphrase = async (fileKey, passphrase) => {
  const rawKey = await crypto.subtle.exportKey("raw", fileKey);
  const wrapped = await encryptBytesWithPassword(rawKey, passphrase);

  return {
    mode: "link-password",
    ...wrapped
  };
};

export const unwrapFileKeyWithPassphrase = async (bundle, passphrase) => {
  const rawKey = await decryptBytesWithPassword(bundle, passphrase);
  return crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
};

