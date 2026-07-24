import crypto from 'crypto';

// Encrypts statement-file passwords at rest in the local finance DB (Mac-only).
// Key lives in .env.local (FINANCE_ENC_KEY, base64 32 bytes) — never leaves the laptop.
function key() {
  const b64 = process.env.FINANCE_ENC_KEY;
  if (!b64) throw new Error('FINANCE_ENC_KEY not set in .env.local');
  const k = Buffer.from(b64, 'base64');
  if (k.length !== 32) throw new Error('FINANCE_ENC_KEY must be 32 bytes (base64)');
  return k;
}

export function encryptSecret(plaintext) {
  if (plaintext == null || plaintext === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64'); // iv(12) | tag(16) | ct
}

export function decryptSecret(enc) {
  if (!enc) return null;
  const buf = Buffer.from(enc, 'base64');
  const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
