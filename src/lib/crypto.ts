const ITERATIONS = 120_000
const SALT_BYTES = 16
const IV_BYTES = 12

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (const byte of arr) s += String.fromCharCode(byte)
  return btoa(s)
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function toBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer
}

async function derive(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: toBuffer(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function hashPin(pin: string, saltB64?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltB64 ? fromB64(saltB64) : crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const raw = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: toBuffer(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    raw,
    256,
  )
  return { hash: b64(bits), salt: b64(salt) }
}

/** Compares in time independent of where the first difference falls. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifyPin(pin: string, hash: string, salt: string): Promise<boolean> {
  const next = await hashPin(pin, salt)
  return constantTimeEqual(next.hash, hash)
}

/**
 * Packs as `v1.salt.iv.ciphertext`. The version prefix exists so the KDF or
 * cipher can change later without stranding notes already on disk.
 */
export async function encryptText(pin: string, text: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await derive(pin, salt)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text))
  return `v1.${b64(salt)}.${b64(iv)}.${b64(cipher)}`
}

export async function decryptText(pin: string, packed: string): Promise<string> {
  const parts = packed.split('.')
  const [version, saltB64, ivB64, dataB64] = parts
  if (parts.length !== 4 || version !== 'v1' || !saltB64 || !ivB64 || !dataB64) {
    throw new Error('Unrecognised lock format')
  }
  const key = await derive(pin, fromB64(saltB64))
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toBuffer(fromB64(ivB64)) },
    key,
    toBuffer(fromB64(dataB64)),
  )
  return new TextDecoder().decode(plain)
}
