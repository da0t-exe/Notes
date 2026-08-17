import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The suite covers pure logic (encoding, line endings, list parsing,
    // crypto round-trips). None of it needs a DOM, and Node ships the
    // WebCrypto, TextDecoder and Blob globals these modules rely on.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
