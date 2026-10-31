import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { parseSkillFile } from '../src/lib/ai/skillFile.ts'

test('UI previews text before multipart import, refreshes candidates and clears loading on errors', async () => {
  const source = readFileSync(new URL('../src/app/dashboard/skills/SkillManager.tsx', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const states: unknown[] = []
  let cursor = 0
  const react = require('react')
  const compiledModule = { exports: {} as { default: (props: { enabled: boolean }) => unknown } }
  new Function('require', 'module', 'exports', compiled)((name: string) => {
    if (name === 'react') return { ...react, useEffect: () => {}, useCallback: (fn: unknown) => fn, useRef: () => ({ current: 0 }), useState: (initial: unknown) => {
      const index = cursor++
      if (!(index in states)) states[index] = initial
      return [states[index], (value: unknown) => { states[index] = typeof value === 'function' ? value(states[index]) : value }]
    } }
    if (name === '@/lib/ai/skillFile') return { parseSkillFile, MAX_SKILL_FILE_BYTES: 16384 }
    if (name === './SkillRuntimeSettings') return { __esModule: true, default: () => null }
    return require(name)
  }, compiledModule, compiledModule.exports)
  function render() {
    cursor = 0
    const nodes: { type: string; props: Record<string, any> }[] = []
    function walk(node: any) {
      if (Array.isArray(node)) return node.forEach(walk)
      if (node && typeof node === 'object' && node.props) { nodes.push(node); walk(node.props.children) }
    }
    walk(compiledModule.exports.default({ enabled: true }))
    return nodes
  }
  const oldFetch = globalThis.fetch
  const calls: { url: string; init?: RequestInit }[] = []
  let fail = false
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    if (fail) throw new Error('offline')
    return Response.json(init?.method === 'POST' ? { skill: { id: 'new' } } : { skills: [] }, { status: init?.method === 'POST' ? 201 : 200 })
  }
  try {
    let nodes = render()
    const fileInput = nodes.find(n => n.type === 'input' && n.props.type === 'file')
    assert.ok(fileInput, 'file input is available')
    assert.equal(calls.length, 0)
    const instruction = '\n<script>alert(1)</script>\nExact body\n'
    const file = new File([instruction], 'policy.md')
    await fileInput.props.onChange({ target: { files: [file], value: 'policy.md' } })
    nodes = render()
    assert.ok(nodes.some(n => n.type === 'pre' && n.props.children === instruction), 'full text preview, not HTML')
    assert.equal(calls.length, 0, 'preview must not save or activate')
    const form = nodes.find(n => n.type === 'form' && n.props['aria-label'] === 'Import skill')!
    assert.ok(form)
    await form.props.onSubmit({ preventDefault() {} })
    assert.equal(calls[0].url, '/api/shop/skills/import')
    assert.ok(calls[0].init?.body instanceof FormData)
    assert.equal((calls[0].init?.body as FormData).get('file') instanceof File, true)
    assert.equal(calls[1].url, '/api/shop/skills')
    nodes = render()
    assert.ok(!nodes.some(n => n.type === 'pre'), 'successful import clears preview')
    await nodes.find(n => n.type === 'input' && n.props.type === 'file')!.props.onChange({ target: { files: [file], value: 'policy.md' } })
    fail = true
    await render().find(n => n.type === 'form' && n.props['aria-label'] === 'Import skill')!.props.onSubmit({ preventDefault() {} })
    nodes = render()
    assert.ok(nodes.some(n => n.props.role === 'alert'), 'network failure is visible')
    const importForm = nodes.find(n => n.type === 'form' && n.props['aria-label'] === 'Import skill')!
    assert.equal(importForm.props['aria-busy'], false, 'import loading resets')
  } finally { globalThis.fetch = oldFetch }
})

test('downloadable government and legal templates are valid imports with source-verification safeguards', () => {
  for (const filename of ['government-service.md', 'legal-information.md']) {
    const content = readFileSync(new URL('../public/skill-templates/' + filename, import.meta.url))
    const parsed = parseSkillFile(filename, content)
    assert.ok(parsed.category.length <= 50)
    assert.match(parsed.instruction, /ห้าม.*(?:แต่ง|สร้าง|อ้าง)/)
    assert.match(parsed.instruction, /แหล่ง.*ทางการ/)
    assert.match(parsed.instruction, /\[.*\]/)
  }
})

const bytes = (text: string) => new TextEncoder().encode(text)
const require = createRequire(import.meta.url)

// Run the actual route with only session/database boundaries substituted.
function importRoute(options: { unauthorized?: boolean; dbError?: boolean } = {}) {
  const inserted: Record<string, unknown>[] = []
  const source = readFileSync(new URL('../src/app/api/shop/skills/import/route.ts', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const compiledModule = { exports: {} as { POST: (request: Request) => Promise<Response> } }
  const db = { from: (table: string) => {
    assert.equal(table, 'shop_skills')
    return { insert: (row: Record<string, unknown>) => {
      inserted.push(row)
      return { select: () => ({ single: async () => ({ data: options.dbError ? null : { id: 'new-skill', ...row }, error: options.dbError ? { message: 'private db detail' } : null }) }) }
    } }
  } }
  new Function('require', 'module', 'exports', compiled)((name: string) => {
    if (name === '@/lib/auth/requireShop') return { requireShop: async () => options.unauthorized ? { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) } : { shopId: 'session-shop', userId: 'session-user' } }
    if (name === '@/lib/supabase/admin') return { createAdminClient: () => db }
    if (name === '@/lib/ai/skillFile') return { parseSkillFile, MAX_SKILL_FILE_BYTES: 16384 }
    return require(name)
  }, compiledModule, compiledModule.exports)
  return { POST: compiledModule.exports.POST, inserted }
}

function upload(content: string | Uint8Array = '---\nname: policy\ndescription: summary\n---\n\nHello\n', filename = 'SKILL.md') {
  const data = new FormData()
  data.set('file', new File([content], filename))
  data.set('shop_id', 'attacker-shop')
  data.set('status', 'active')
  data.set('trigger_keywords', '["ignored"]')
  return new Request('http://localhost/api/shop/skills/import', { method: 'POST', body: data })
}

test('multipart import saves only a session-owned behavior candidate with full instructions', async () => {
  const route = importRoute()
  const response = await route.POST(upload())
  assert.equal(response.status, 201)
  assert.deepEqual(route.inserted, [{
    shop_id: 'session-shop', created_by: 'session-user', status: 'candidate',
    skill_type: 'behavior', category: 'policy', trigger_keywords: [],
    knowledge_body: 'summary', instruction: '\nHello\n', gold_conversations: [],
    facts_confirmed: true,
  }])
  assert.equal((await response.json()).skill.id, 'new-skill')
})

test('import authenticates before reading the upload and never inserts invalid files', async () => {
  const unauthorized = importRoute({ unauthorized: true })
  assert.equal((await unauthorized.POST(new Request('http://localhost', { method: 'POST', body: 'bad' }))).status, 401)
  assert.equal(unauthorized.inserted.length, 0)
  const route = importRoute()
  for (const request of [upload(''), upload('a'.repeat(8001)), upload('a'.repeat(16385)), upload('Hello', 'x.exe'), upload(new Uint8Array([0xff])), upload('binary\u0000'), new Request('http://localhost', { method: 'POST', body: new FormData() }), new Request('http://localhost', { method: 'POST', body: 'bad' })]) {
    const response = await route.POST(request)
    assert.ok([400, 413].includes(response.status))
    assert.ok((await response.json()).error)
  }
  assert.equal(route.inserted.length, 0)
})

test('import reports database failure without exposing private details', async () => {
  const response = await importRoute({ dbError: true }).POST(upload())
  assert.equal(response.status, 500)
  assert.doesNotMatch(JSON.stringify(await response.json()), /private db detail/)
})

test('file validation rejects invalid formats, empty, binary and invalid UTF-8 without truncation', () => {
  for (const [filename, content, message] of [
    ['skill.pdf', bytes('hello'), /\.md.*\.txt/],
    ['skill.md', bytes(' \n\t'), /empty/i],
    ['skill.md', bytes('abc\u0000def'), /binary/i],
    ['skill.md', new Uint8Array([0xc3, 0x28]), /UTF-8/],
    ['skill.md', bytes('a'.repeat(16385)), /16 KB/],
    ['skill.md', bytes('a'.repeat(8001)), /8000/],
    ['skill.md', bytes('ก'.repeat(6000)), /16 KB/],
  ] as const) assert.throws(() => parseSkillFile(filename, content), message)
  assert.equal(parseSkillFile('skill.TXT', bytes('a'.repeat(8000))).instruction.length, 8000)
})

test('simple frontmatter maps name to category and description to metadata while preserving the body', () => {
  const instruction = '\r\n# Guidance\r\n  Explain clearly.\r\n\r\n'
  assert.deepEqual(parseSkillFile('policy.md', bytes('\ufeff---\r\nname: "Government help"\r\ndescription: General information only\r\n---\r\n' + instruction)), {
    category: 'Government help', description: 'General information only', instruction,
  })
  assert.equal(parseSkillFile('x.md', bytes("---\nname: 'Merchant''s policy'\n---\nHello")).category, "Merchant's policy")
  assert.equal(parseSkillFile('x.md', bytes('---\ndescription: Explain clearly\n---\nHello')).category, 'imported')
})

test('frontmatter rejects complex or ambiguous YAML, unknown keys and metadata exceeding schema limits', () => {
  for (const metadata of [
    'name: [one, two]', 'name: {nested: value}', 'name: |\n  Multiline', 'name: >\n  Folded',
    'name: &anchor hi', 'name: *anchor', 'name: !tag hello', 'name:\n  nested: hi',
    'name: value\nname: duplicate', 'unknown: value', 'name: hello # comment',
    'name: value: nested', 'name: "unclosed', 'name: ', 'name: ' + 'x'.repeat(51),
  ]) assert.throws(() => parseSkillFile('x.md', bytes(`---\n${metadata}\n---\nBody`)), /frontmatter|50/i)
  assert.throws(() => parseSkillFile('x.md', bytes('---\nname: missing close\nBody')), /frontmatter/i)
  assert.throws(() => parseSkillFile('x.md', bytes('---\nname: empty\n---\n  ')), /empty/i)
  assert.throws(() => parseSkillFile('x.md', bytes('---\ndescription: ' + 'd'.repeat(8001) + '\n---\nBody')), /8000/)
  assert.equal(parseSkillFile('x.md', bytes('---\nname: ' + 'n'.repeat(50) + '\n---\nBody')).category.length, 50)
})

test('plain markdown preserves the complete body including whitespace and HTML as text', () => {
  const instruction = '\n# Reply policy\r\n  Keep indentation.\n<script>alert(1)</script>\n\n'
  assert.deepEqual(parseSkillFile('SKILL.md', bytes(instruction)), {
    category: 'imported', description: null, instruction,
  })
})
