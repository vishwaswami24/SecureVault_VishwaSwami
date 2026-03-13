import { decryptJsonWithPassword, encryptJsonWithPassword } from "./passwordEnvelope";

export const generateUserKeyBundle = async (password) => {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    true,
    ["deriveBits"]
  );

  const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const encryptedPrivateKeyBundle = await encryptJsonWithPassword(privateKeyJwk, password);

  return {
    publicKeyJwk,
    encryptedPrivateKeyBundle
  };
};

export const unlockPrivateKey = async (bundle, password) => {
  const privateKeyJwk = await decryptJsonWithPassword(bundle, password);

  return crypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    true,
    ["deriveBits"]
  );
};

