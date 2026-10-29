import { NextRequest, NextResponse } from 'next/server'
import { requireShop } from '@/lib/auth/requireShop'
import { batchShadowEvaluate } from '@/lib/ai/shadowEval'

export async function POST(request: NextRequest) {
  const auth = await requireShop()
  if (auth.error) return auth.error

  try {
    const results = await batchShadowEvaluate(auth.shopId)
    return NextResponse.json({ results, count: results.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Shadow evaluation failed' }, { status: 500 })
  }
}
