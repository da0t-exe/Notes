import { describe, expect, it } from 'vitest'
import { decryptText, encryptText, hashPin, verifyPin } from './crypto'

describe('hashPin / verifyPin', () => {
  it('accepts the right pin', async () => {
    const { hash, salt } = await hashPin('1234')
    expect(await verifyPin('1234', hash, salt)).toBe(true)
  })

  it('rejects the wrong pin', async () => {
    const { hash, salt } = await hashPin('1234')
    expect(await verifyPin('1235', hash, salt)).toBe(false)
    expect(await verifyPin('', hash, salt)).toBe(false)
  })

  it('salts each pin separately, so equal pins do not share a hash', async () => {
    const a = await hashPin('same')
    const b = await hashPin('same')
    expect(a.salt).not.toBe(b.salt)
    expect(a.hash).not.toBe(b.hash)
  })

  it('is deterministic once the salt is fixed', async () => {
    const first = await hashPin('pin')
    const again = await hashPin('pin', first.salt)
    expect(again.hash).toBe(first.hash)
  })
})

describe('encryptText / decryptText', () => {
  it('round-trips', async () => {
    const packed = await encryptText('code', 'my secret note')
    expect(await decryptText('code', packed)).toBe('my secret note')
  })

  it('round-trips unicode and newlines', async () => {
    const text = '# Titre\r\n\némojis 🔐 accents éàü 日本語'
    expect(await decryptText('pw', await encryptText('pw', text))).toBe(text)
  })

  it('round-trips an empty note', async () => {
    expect(await decryptText('pw', await encryptText('pw', ''))).toBe('')
  })

  it('never emits the plaintext in the packed form', async () => {
    const packed = await encryptText('pw', 'topsecret')
    expect(packed).not.toContain('topsecret')
  })

  it('produces a different ciphertext each time for the same input', async () => {
    expect(await encryptText('pw', 'same')).not.toBe(await encryptText('pw', 'same'))
  })

  it('fails on the wrong pin rather than returning garbage', async () => {
    const packed = await encryptText('right', 'secret')
    await expect(decryptText('wrong', packed)).rejects.toThrow()
  })

  it('rejects a malformed package', async () => {
    await expect(decryptText('pw', 'not-a-package')).rejects.toThrow(/lock format/i)
    await expect(decryptText('pw', 'v2.a.b.c')).rejects.toThrow(/lock format/i)
  })

  it('detects tampering, because GCM authenticates', async () => {
    const packed = await encryptText('pw', 'secret')
    const parts = packed.split('.')
    const flipped = `${parts[3]?.slice(0, -2)}${parts[3]?.endsWith('A=') ? 'B=' : 'A='}`
    await expect(decryptText('pw', `v1.${parts[1]}.${parts[2]}.${flipped}`)).rejects.toThrow()
  })
})
