import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function masterKey(): Buffer {
  const secret = process.env.APP_ENCRYPTION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "APP_ENCRYPTION_SECRET must be set (≥16 chars) to store API keys",
    );
  }
  // Derive 32-byte key from secret (stable, not stored)
  return createHash("sha256").update(`planner-llm-v1:${secret}`).digest();
}

/** Encrypt plaintext → base64(iv + ciphertext + authTag). Server-only. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, masterKey(), iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString("base64");
}

/** Decrypt base64 blob. Server-only. Never log result. */
export function decryptSecret(blob: string): string {
  const buf = Buffer.from(blob, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("Invalid ciphertext");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const data = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, masterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

export function maskApiKey(key: string): { last4: string; display: string } {
  const last4 = key.slice(-4);
  return { last4, display: `••••••••${last4}` };
}

export function canEncrypt(): boolean {
  const secret = process.env.APP_ENCRYPTION_SECRET;
  return Boolean(secret && secret.length >= 16);
}
