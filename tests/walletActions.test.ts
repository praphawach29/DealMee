import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const routeUrl = new URL('../src/app/dashboard/billing/actions.ts', import.meta.url)

type Shop = { id: string; plan: string; plan_key: string }
function database(shop: Shop | null = { id: 'shop-1', plan: 'free', plan_key: 'free' }, rpcResult: unknown = { success: false, error: 'invalid_plan' }) {
  const calls: string[] = []
  return {
    calls,
    from(table: string) {
      calls.push(table)
      return {
        select() { return this },
        eq() { return this },
        maybeSingle: async () => ({ data: table === 'addon_packs' ? { kind: 'slips' } : null, error: null }),
      }
    },
    rpc: async () => ({ data: rpcResult, error: null }),
  }
}

async function load(db: ReturnType<typeof database>, user: { id: string } | null = { id: 'user-1' }, shop: Shop | null = { id: 'shop-1', plan: 'free', plan_key: 'free' }) {
  const code = ts.transpileModule(readFileSync(routeUrl, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} as Record<string, unknown> }
  new Function('require', 'module', 'exports', code)((name: string) => {
    if (name === '@/utils/supabase/server') return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) }, }) }
    if (name === '@/lib/supabase/admin') return { createAdminClient: () => db }
    if (name === '@/lib/billing/trial') return { effectivePlanKey: () => 'free', PLAN_GRACE_DAYS: 3 }
    if (name === '@/lib/shopHelper') return { getOrCreateShopForUser: async () => (user ? shop : null) }
    if (name === 'next/cache') return { revalidatePath: () => undefined }
    throw new Error(`Unexpected dependency: ${name}`)
  }, module, module.exports)
  return module.exports
}

test('wallet buy addon is blocked for free shops before spending', async () => {
  const db = database()
  const actions = await load(db)
  const result = await (actions.buyAddonWithWallet as (key: string) => Promise<{ success: boolean; error?: string }>)('slip-pack')
  assert.equal(result.success, false)
  assert.match(result.error || '', /แพ็กเกจแบบชำระเงิน/)
  assert.equal(db.calls.includes('addon_packs'), true)
  assert.equal(db.calls.includes('shop_wallets'), false)
})

test('wallet actions require authentication', async () => {
  const db = database()
  const actions = await load(db, null)
  assert.deepEqual(await (actions.buyPlanWithWallet as (key: string) => Promise<unknown>)('starter'), { success: false, error: 'กรุณาเข้าสู่ระบบอีกครั้ง' })
  assert.deepEqual(await (actions.setWalletAutoRenew as (value: boolean) => Promise<unknown>)(true), { success: false, error: 'กรุณาเข้าสู่ระบบอีกครั้ง' })
})
