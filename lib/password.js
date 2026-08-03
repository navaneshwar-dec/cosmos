import crypto from 'crypto';

// scrypt-based password hashing (built-in — no external dependency). Stored as
// "scrypt:<salt>:<hash>". Verify uses a timing-safe compare.
const KEYLEN = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, KEYLEN).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hash] = parts;
  let derived;
  try { derived = crypto.scryptSync(String(password), salt, KEYLEN); } catch { return false; }
  const hb = Buffer.from(hash, 'hex');
  return hb.length === derived.length && crypto.timingSafeEqual(hb, derived);
}
