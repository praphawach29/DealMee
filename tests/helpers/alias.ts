// Lets node --test load src/ files that use the "@/..." alias, and swaps the two
// modules that would touch real services (Supabase admin client, platform secrets)
// for in-memory stubs. Import this file BEFORE importing anything from src/.
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const stubs: Record<string, string> = {
  '@/lib/supabase/admin': new URL('./stubAdmin.ts', import.meta.url).href,
  '@/lib/platformSecrets': new URL('./stubSecrets.ts', import.meta.url).href,
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (stubs[specifier]) return { url: stubs[specifier], shortCircuit: true }
    if (specifier.startsWith('@/')) {
      const base = `${root}src/${specifier.slice(2)}`
      for (const ext of ['.ts', '/index.ts']) {
        if (existsSync(base + ext)) return { url: pathToFileURL(base + ext).href, shortCircuit: true }
      }
    }
    return nextResolve(specifier, context)
  },
})
