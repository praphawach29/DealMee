import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoots = [path.join(root, 'src'), path.join(root, 'tests')]

function inSource(parentURL) {
  if (!parentURL?.startsWith('file:')) return false
  const parent = fileURLToPath(parentURL)
  return sourceRoots.some((dir) => parent === dir || parent.startsWith(dir + path.sep))
}

function withExtension(base) {
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, path.join(base, 'index.ts')]
  return candidates.find((candidate) => existsSync(candidate))
}

/**
 * Resolves `@/` to `src/` and adds the `.ts` extension on relative imports
 * inside this repo, so Node's type-stripping runner can load the sales agent.
 * Packages outside src/ and tests/ are left to Node.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const hit = withExtension(path.join(root, 'src', specifier.slice(2)))
    if (!hit) throw new Error(`Cannot resolve ${specifier}`)
    return { url: pathToFileURL(hit).href, shortCircuit: true }
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && inSource(context.parentURL) && !path.extname(specifier)) {
    const parent = fileURLToPath(context.parentURL)
    const hit = withExtension(path.resolve(path.dirname(parent), specifier))
    if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
