import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = process.cwd()

function withTypeScript(file) {
  if (existsSync(file)) return file
  if (existsSync(`${file}.ts`)) return `${file}.ts`
  if (existsSync(`${file}.tsx`)) return `${file}.tsx`
  if (existsSync(path.join(file, 'index.ts'))) return path.join(file, 'index.ts')
  return null
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const resolved = withTypeScript(path.join(root, 'src', specifier.slice(2)))
    if (resolved) return nextResolve(pathToFileURL(resolved).href, context)
  }
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const parent = context.parentURL ? fileURLToPath(context.parentURL) : path.join(root, 'scripts', 'reindex-knowledge.mjs')
    const abs = path.resolve(path.dirname(parent), specifier)
    const resolved = withTypeScript(abs)
    if (resolved && resolved !== abs) return nextResolve(pathToFileURL(resolved).href, context)
  }
  return nextResolve(specifier, context)
}
