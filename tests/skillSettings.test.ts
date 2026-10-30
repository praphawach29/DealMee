import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'

test('merges only the two flags without mutating unrelated feature data', async () => {
  const { mergeSkillSettings } = await helpers()
  assert.equal(typeof mergeSkillSettings, 'function')
  const features = { billing: { enabled: true }, custom: ['a'], shop_skills_enabled: true, assistant_qa_only: false }
  const original = structuredClone(features)
  assert.deepEqual(mergeSkillSettings(features, { enabled: false, qaOnly: true }), {
    ...original, shop_skills_enabled: false, assistant_qa_only: true,
  })
  assert.deepEqual(features, original)
  assert.deepEqual(mergeSkillSettings(null, { enabled: true, qaOnly: false }), {
    shop_skills_enabled: true, assistant_qa_only: false,
  })
  assert.throws(() => mergeSkillSettings(['malformed'], { enabled: true, qaOnly: true }))
})

const require = createRequire(import.meta.url)
const ts = require('typescript')
const routeUrl = new URL('../src/app/api/shop/skills/settings/route.ts', import.meta.url)

type Row = { features: Record<string, unknown> | null; updated_at: string | null }
function database(row: Row | null = { features: { billing: { paid: true } }, updated_at: '2026-01-01T00:00:00Z' }) {
  const calls: { table: string; action: string; filters: [string, unknown][]; values?: Record<string, unknown> }[] = []
  const state = { row, calls, conflict: false, readError: false, writeError: false, verifyError: false, drift: false, cacheError: null as { code?: string; message: string } | null, reads: 0 }
  return Object.assign(state, {
    from(table: string) {
      const call: typeof calls[number] = { table, action: 'read', filters: [] }
      calls.push(call)
      const query = {
        select() { return query },
        update(values: Record<string, unknown>) { call.action = 'update'; call.values = values; return query },
        delete() { call.action = 'delete'; return query },
        eq(key: string, value: unknown) { call.filters.push([key, value]); return query },
        is(key: string, value: unknown) { call.filters.push([key, value]); return query },
        async maybeSingle() {
          if (call.action === 'delete') {
            if (table === 'ai_response_cache' && state.cacheError) return { data: null, error: state.cacheError }
            return { data: null, error: null }
          }
          if (call.action === 'update') {
            if (state.writeError) return { data: null, error: { message: 'private db detail' } }
            if (state.conflict) return { data: null, error: null }
            state.row = { ...state.row!, ...call.values } as Row
            return { data: { id: 'session-shop', ...state.row }, error: null }
          }
          state.reads++
          if (state.readError || (state.verifyError && state.reads > 1)) return { data: null, error: { message: 'private db detail' } }
          const data = state.drift && state.reads > 1
            ? { ...state.row!, features: { ...state.row!.features, assistant_qa_only: false } } : state.row
          return { data, error: null }
        },
      }
      return query
    },
  })
}
async function loadRoute(db = database(), authorized = true) {
  assert.ok(existsSync(routeUrl), 'authenticated settings route must exist')
  const code = ts.transpileModule(readFileSync(routeUrl, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const helper = await helpers()
  const module = { exports: {} as { GET: () => Promise<Response>; PATCH: (request: Request) => Promise<Response> } }
  const dependencies: Record<string, unknown> = {
    'next/server': { NextResponse: Response },
    '@/lib/auth/requireShop': { requireShop: async () => authorized ? { shopId: 'session-shop', userId: 'user' } : { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) } },
    '@/lib/supabase/admin': { createAdminClient: () => db },
    '@/lib/ai/skillSettings': helper,
  }
  new Function('require', 'module', 'exports', code)((name: string) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`)
    return dependencies[name]
  }, module, module.exports)
  return module.exports
}

test('GET returns session-scoped flags with retrieval available unless explicitly false', async () => {
  const previous = process.env.SHOP_SKILLS_RETRIEVAL_ENABLED
  try {
    for (const env of [undefined, 'true', 'false']) {
      if (env === undefined) delete process.env.SHOP_SKILLS_RETRIEVAL_ENABLED
      else process.env.SHOP_SKILLS_RETRIEVAL_ENABLED = env
      const db = database({ features: { shop_skills_enabled: true, assistant_qa_only: true, secret: 'not-returned' }, updated_at: null })
      const response = await (await loadRoute(db)).GET()
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { enabled: true, qaOnly: true, globalAvailable: env !== 'false' })
      assert.deepEqual(db.calls[0].filters, [['id', 'session-shop']])
      assert.equal(db.calls[0].table, 'shops')
    }
    const response = await (await loadRoute(database({ features: null, updated_at: null }))).GET()
    assert.deepEqual(await response.json(), { enabled: false, qaOnly: false, globalAvailable: false })
    const db = database()
    assert.equal((await (await loadRoute(db, false)).GET()).status, 401)
    assert.equal(db.calls.length, 0)
    db.readError = true
    assert.equal((await (await loadRoute(db)).GET()).status, 500)
    assert.equal((await (await loadRoute(database(null))).GET()).status, 404)
  } finally {
    if (previous === undefined) delete process.env.SHOP_SKILLS_RETRIEVAL_ENABLED
    else process.env.SHOP_SKILLS_RETRIEVAL_ENABLED = previous
  }
})

test('PATCH validates, merges session shop flags, uses optimistic guards and verifies persistence', async () => {
  const request = (body: unknown) => new Request('https://example.test/api/shop/skills/settings', { method: 'PATCH', body: JSON.stringify(body) })
  const settings = { enabled: true, qaOnly: true }
  const db = database()
  const route = await loadRoute(db)
  assert.equal(typeof route.PATCH, 'function')
  const response = await route.PATCH(request(settings))
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.enabled, true)
  assert.equal(result.qaOnly, true)
  assert.deepEqual(db.row!.features, { billing: { paid: true }, shop_skills_enabled: true, assistant_qa_only: true })
  const update = db.calls.find(call => call.action === 'update')!
  assert.ok(update.filters.some(([key, value]) => key === 'updated_at' && value === '2026-01-01T00:00:00Z'))
  assert.ok(update.filters.some(([key]) => key === 'features'), 'also guard writers that do not change updated_at')
  assert.notEqual(update.values!.updated_at, '2026-01-01T00:00:00Z')
  assert.equal(db.reads, 2, 'read back persisted shop before success')
  for (const call of db.calls) {
    assert.ok(call.table === 'shops' || call.table === 'ai_response_cache')
    assert.ok(call.filters.some(([key, value]) => key === 'id' && value === 'session-shop') || call.filters.some(([key, value]) => key === 'shop_id' && value === 'session-shop'))
  }
  for (const updated_at of [null, new Date().toISOString()]) {
    const empty = database({ features: null, updated_at })
    assert.equal((await (await loadRoute(empty)).PATCH(request(settings))).status, 200)
    assert.notEqual(empty.row!.updated_at, updated_at)
  }
  for (const invalid of [{ enabled: 'true', qaOnly: true }, { ...settings, shopId: 'victim' }]) {
    const invalidDb = database()
    assert.equal((await (await loadRoute(invalidDb)).PATCH(request(invalid))).status, 400)
    assert.equal(invalidDb.calls.length, 0)
  }
  assert.equal((await route.PATCH(new Request('https://example.test', { method: 'PATCH', body: '{' }))).status, 400)
  const denied = database()
  assert.equal((await (await loadRoute(denied, false)).PATCH(request(settings))).status, 401)
  assert.equal(denied.calls.length, 0)
  assert.equal((await (await loadRoute(database(null))).PATCH(request(settings))).status, 404)
  for (const [flag, status] of [['readError', 500], ['writeError', 500], ['verifyError', 500], ['conflict', 409], ['drift', 409]] as const) {
    const failing = database()
    failing[flag] = true
    const failed = await (await loadRoute(failing)).PATCH(request(settings))
    assert.equal(failed.status, status, flag)
    assert.doesNotMatch(await failed.text(), /private db detail/)
  }
})

test('settings UI loads, saves verified values, warns about global stop and displays network failures', async () => {
  const componentUrl = new URL('../src/app/dashboard/skills/SkillRuntimeSettings.tsx', import.meta.url)
  assert.ok(existsSync(componentUrl), 'runtime settings component must exist')
  const code = ts.transpileModule(readFileSync(componentUrl, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  type Element = { type: unknown; props: Record<string, unknown> }
  const states: unknown[] = []
  const effects: (() => void)[] = []
  let index = 0
  let firstRender = true
  let networkFailure = false
  let malformed = false
  let responseStatus = 200
  let stored = { enabled: false, qaOnly: false, globalAvailable: false }
  const requests: { url: string; options?: RequestInit }[] = []
  const react = {
    useState(initial: unknown) {
      const current = index++
      if (firstRender) states[current] = initial
      return [states[current], (value: unknown) => { states[current] = typeof value === 'function' ? value(states[current]) : value }]
    },
    useCallback(fn: unknown) { return fn },
    useEffect(effect: () => void) { if (firstRender) effects.push(effect) },
  }
  const fakeFetch = async (url: string, options?: RequestInit) => {
    requests.push({ url, options })
    if (networkFailure) throw new Error('Network disconnected')
    if (responseStatus !== 200) return Response.json({ error: 'Settings changed concurrently. Reload and try again.' }, { status: responseStatus })
    if (malformed) return Response.json({})
    if (options?.method === 'PATCH') stored = { ...stored, ...JSON.parse(String(options.body)) }
    return Response.json(stored)
  }
  const module = { exports: {} as { default: () => Element } }
  new Function('require', 'module', 'exports', 'fetch', code)((name: string) => {
    if (name === 'react') return react
    if (name === 'react/jsx-runtime') return require(name)
    if (name === 'next/navigation') return { useRouter: () => ({ refresh: () => undefined }) }
    throw new Error(`Unexpected component import: ${name}`)
  }, module, module.exports, fakeFetch)
  function render() { index = 0; const tree = module.exports.default(); firstRender = false; return tree }
  function nodes(node: unknown): Element[] {
    if (!node || typeof node !== 'object') return []
    if (Array.isArray(node)) return node.flatMap(nodes)
    const element = node as Element
    return [element, ...nodes(element.props?.children)]
  }
  function text(node: unknown): string {
    if (typeof node === 'string') return node
    if (Array.isArray(node)) return node.map(text).join(' ')
    return node && typeof node === 'object' ? text((node as Element).props?.children) : ''
  }
  const button = (tree: Element, label: RegExp) => nodes(tree).find(node => node.type === 'button' && label.test(text(node)))!
  render()
  for (const effect of effects) effect()
  await new Promise(resolve => setTimeout(resolve, 20))
  let tree = render()
  assert.match(text(tree), /SHOP_SKILLS_RETRIEVAL_ENABLED=false/)
  assert.match(text(tree), /ไม่ต้องมีสินค้า/)
  assert.match(text(tree), /ปิดเครื่องมือ.*ขาย/)
  const inputs = nodes(tree).filter(node => node.type === 'input')
  assert.equal(inputs.length, 2)
  for (const input of inputs) (input.props.onChange as (event: unknown) => void)({ target: { checked: true } })
  tree = render()
  await (button(tree, /บันทึก/).props.onClick as () => Promise<void>)()
  tree = render()
  assert.match(text(nodes(tree).find(node => node.props?.role === 'status')), /บันทึก.*แต่.*ปิด/)
  assert.deepEqual(JSON.parse(String(requests.find(request => request.options?.method === 'PATCH')!.options!.body)), { enabled: true, qaOnly: true })
  assert.ok(requests.every(request => request.url === '/api/shop/skills/settings'))
  networkFailure = true
  await (button(tree, /บันทึก/).props.onClick as () => Promise<void>)()
  tree = render()
  assert.match(text(nodes(tree).find(node => node.props?.role === 'alert')), /Network disconnected/)
  await (button(tree, /โหลดใหม่/).props.onClick as () => Promise<void>)()
  tree = render()
  assert.match(text(nodes(tree).find(node => node.props?.role === 'alert')), /Network disconnected/)
  networkFailure = false
  malformed = true
  await (button(tree, /โหลดใหม่/).props.onClick as () => Promise<void>)()
  tree = render()
  assert.ok(nodes(tree).some(node => node.props?.role === 'alert'))
  malformed = false
  await (button(tree, /โหลดใหม่/).props.onClick as () => Promise<void>)()
  tree = render()
  responseStatus = 409
  await (button(tree, /บันทึก/).props.onClick as () => Promise<void>)()
  tree = render()
  assert.match(text(nodes(tree).find(node => node.props?.role === 'alert')), /concurrently/)
})

const helperUrl = new URL('../src/lib/ai/skillSettings.ts', import.meta.url)
async function helpers() {
  assert.ok(existsSync(helperUrl), 'runtime settings validation helper must exist')
  return import(helperUrl.href)
}

test('settings input requires exactly two boolean fields, never a client shop identity', async () => {
  const { parseSkillSettings } = await helpers()
  for (const enabled of [true, false]) {
    for (const qaOnly of [true, false]) {
      assert.deepEqual(parseSkillSettings({ enabled, qaOnly }), { data: { enabled, qaOnly } })
    }
  }
  for (const invalid of [null, [], 'true', {}, { enabled: true }, { enabled: 'false', qaOnly: false },
    { enabled: 1, qaOnly: false }, { enabled: false, qaOnly: null },
    { enabled: true, qaOnly: true, shopId: 'other-shop' }, { enabled: true, qaOnly: false, features: {} }]) {
    assert.equal(typeof parseSkillSettings(invalid).error, 'string')
    assert.equal(parseSkillSettings(invalid).data, undefined)
  }
})
