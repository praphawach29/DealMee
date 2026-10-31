import { createAdminClient } from '@/lib/supabase/admin'
import type { ShopSkill } from './shopSkills'
import { describeShadowResult, skillDigest, type ShadowStatus, type ShadowWinner } from './shadowReport'

const RUNNING_MS = 180_000

export type ShadowEvalRow = {
  id: string
  shop_id: string
  skill_id: string
  skill_version: string | null
  winner: ShadowWinner
  recommendation: string
  status: ShadowStatus
  sample_size: number | null
  improved_count: number | null
  regressed_count: number | null
  tied_count: number | null
  grounded_with: number | null
  grounded_without: number | null
  handoff_with: number | null
  handoff_without: number | null
  judge_with: number | null
  judge_without: number | null
  judge_used: boolean | null
  prompt_tokens: number | null
  completion_tokens: number | null
  estimated_cost_usd: number | null
  skill_digest: string | null
  metrics: Record<string, unknown> | null
  error: string | null
  created_at: string
  finished_at: string | null
}

export type ShadowSave = Partial<Omit<ShadowEvalRow, 'id' | 'shop_id' | 'skill_id' | 'created_at'>> & {
  winner: ShadowWinner
  recommendation: string
  status: ShadowStatus
  original_confidence?: number | null
  shadow_confidence?: number | null
}

function missingSchema(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  return error.code === '42703' || error.code === '42P01' || error.code === '23514' || /shop_skill_shadow_evals|sample_size|status/i.test(error.message || '')
}

export function schemaErrorMessage(): string {
  return 'ยังบันทึกผลทดสอบไม่ได้ กรุณารันสคริปต์ฐานข้อมูลล่าสุดใน Supabase ก่อน'
}

export async function beginShadowEval(input: {
  shopId: string
  skill: ShopSkill
  confirmFacts: boolean
  skillsEnabled: boolean
}): Promise<{ ok: true; id: string; already: boolean } | { ok: false; error: string; status: number }> {
  if (input.skill.shop_id !== input.shopId) return { ok: false, error: 'ไม่พบสกิลนี้', status: 404 }
  if (input.skill.status === 'archived') return { ok: false, error: 'ทดสอบได้เฉพาะสกิลที่รอเปิดใช้หรือเปิดใช้อยู่', status: 409 }
  const supabase = createAdminClient()
  const now = Date.now()
  const { data: running, error: runningError } = await supabase
    .from('shop_skill_shadow_evals')
    .select('id, created_at, status')
    .eq('shop_id', input.shopId)
    .eq('skill_id', input.skill.id)
    .eq('status', 'running')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (runningError) {
    console.error('[ShadowEval] read running failed', runningError.message)
    return { ok: false, error: missingSchema(runningError) ? schemaErrorMessage() : 'เริ่มทดสอบไม่สำเร็จ', status: missingSchema(runningError) ? 503 : 500 }
  }
  if (running?.id) {
    const started = new Date(running.created_at).getTime()
    if (!Number.isNaN(started) && now - started < RUNNING_MS) return { ok: true, id: running.id, already: true }
    await supabase.from('shop_skill_shadow_evals').update({
      status: 'failed',
      winner: 'pending',
      recommendation: describeShadowResult({
        status: 'failed', sampleSize: 0, found: 0, improved: 0, regressed: 0, tied: 0,
        winner: 'pending', skillsEnabled: input.skillsEnabled, confirmFacts: input.confirmFacts, judgeUsed: false,
      }),
      error: 'timeout',
      finished_at: new Date().toISOString(),
    }).eq('id', running.id).eq('shop_id', input.shopId)
  }
  const confirmFacts = input.confirmFacts || input.skill.facts_confirmed === true
  const recommendation = describeShadowResult({
    status: 'running', sampleSize: 0, found: 0, improved: 0, regressed: 0, tied: 0,
    winner: 'pending', skillsEnabled: input.skillsEnabled, confirmFacts, judgeUsed: false,
  })
  const { data, error } = await supabase.from('shop_skill_shadow_evals').insert({
    shop_id: input.shopId,
    skill_id: input.skill.id,
    skill_version: String(input.skill.version ?? ''),
    winner: 'pending',
    recommendation,
    status: 'running',
    sample_size: 0,
    judge_used: false,
    skill_digest: skillDigest(input.skill, confirmFacts),
    metrics: { kind: 'replay', confirmFacts, skillsEnabled: input.skillsEnabled, phase: 'running' },
  }).select('id').single()
  if (error || !data?.id) {
    console.error('[ShadowEval] insert failed', error?.message)
    return { ok: false, error: missingSchema(error) ? schemaErrorMessage() : 'เริ่มทดสอบไม่สำเร็จ', status: missingSchema(error) ? 503 : 500 }
  }
  return { ok: true, id: data.id, already: false }
}

export async function saveShadowEval(shopId: string, evalId: string, patch: ShadowSave): Promise<void> {
  const { error } = await createAdminClient()
    .from('shop_skill_shadow_evals')
    .update({ ...patch, finished_at: patch.finished_at ?? new Date().toISOString() })
    .eq('id', evalId)
    .eq('shop_id', shopId)
  if (error) console.error('[ShadowEval] update failed', error.message)
}

export async function listLatestShadowEvals(shopId: string): Promise<ShadowEvalRow[]> {
  const { data, error } = await createAdminClient()
    .from('shop_skill_shadow_evals')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) {
    console.error('[ShadowEval] list failed', error.message)
    return []
  }
  const seen = new Set<string>()
  const rows: ShadowEvalRow[] = []
  for (const row of (data || []) as ShadowEvalRow[]) {
    if (row.shop_id !== shopId || seen.has(row.skill_id)) continue
    seen.add(row.skill_id)
    rows.push(row)
  }
  return rows
}
