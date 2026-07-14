// Zero-knowledge vault crypto — runs ONLY in the browser (WebCrypto).
// The master password and derived key never leave the client; the server
// only ever stores the base64 blobs produced here.

const PBKDF2_ITERATIONS = 310_000;   // OWASP baseline for PBKDF2-SHA256
const VERIFIER_MARKER = 'cosmos-vault-v1';

const enc = new TextEncoder();
const dec = new TextDecoder();

function subtle() {
  const c = (typeof globalThis !== 'undefined' && globalThis.crypto) || (typeof window !== 'undefined' && window.crypto);
  if (!c?.subtle) throw new Error('WebCrypto not available');
  return c;
}

// ── base64 ↔ bytes ──────────────────────────────────────────────────────────
export function bytesToB64(bytes) {
  let bin = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}
export function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomSaltB64() {
  return bytesToB64(subtle().getRandomValues(new Uint8Array(16)));
}

// ── key derivation: master password + salt → AES-GCM key ────────────────────
export async function deriveKey(masterPassword, saltB64) {
  const c = subtle();
  const baseKey = await c.subtle.importKey('raw', enc.encode(masterPassword), 'PBKDF2', false, ['deriveKey']);
  return c.subtle.deriveKey(
    { name: 'PBKDF2', salt: b64ToBytes(saltB64), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ── encrypt/decrypt a JSON object → {iv, ct} base64 ─────────────────────────
export async function encryptJson(key, obj) {
  const c = subtle();
  const iv = c.getRandomValues(new Uint8Array(12));
  const ct = await c.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  return { iv: bytesToB64(iv), ct: bytesToB64(ct) };
}
export async function decryptJson(key, ivB64, ctB64) {
  const c = subtle();
  const pt = await c.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(ivB64) }, key, b64ToBytes(ctB64));
  return JSON.parse(dec.decode(pt));
}

// ── verifier: prove a master password is correct without storing it ─────────
export async function makeVerifier(key) {
  return encryptJson(key, VERIFIER_MARKER);
}
export async function checkVerifier(key, ivB64, ctB64) {
  try {
    const v = await decryptJson(key, ivB64, ctB64);
    return v === VERIFIER_MARKER;
  } catch {
    return false;   // wrong key → AES-GCM auth tag fails
  }
}

// ── strong password generator ───────────────────────────────────────────────
export function generatePassword(length = 20) {
  const sets = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*-_=+';
  const bytes = subtle().getRandomValues(new Uint8Array(length));
  let out = '';
  for (let i = 0; i < length; i++) out += sets[bytes[i] % sets.length];
  return out;
}
