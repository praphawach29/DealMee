import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Vercel's Turbopack font resolver failed on Anuphan with
// "next/font/google queries have exactly one entry" (deployment 8822815).
// Guard the explicit production workaround; actual compilation is checked by npm run build.
test('production build uses webpack to bypass the failing Turbopack Google font resolver', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(pkg.scripts.build, 'next build --webpack')
  assert.equal(pkg.scripts.dev, 'next dev')
})
