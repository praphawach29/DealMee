import { NextRequest, NextResponse } from 'next/server'
import { requireShop } from '@/lib/auth/requireShop'
import { getShopAiKey } from '@/lib/billing/shopAiKey'

function providerError(body: string, key: string): string {
  const redacted = key ? body.split(key).join('[redacted]') : body
  return redacted.slice(0, 100)
}

export async function POST(request: NextRequest) {
  const auth = await requireShop()
  if (auth.error) return auth.error

  const body = await request.json().catch(() => ({}))
  const provider = body.provider || 'gemini'
  const key = body.key || ''

  if (!key) {
    // Test saved key
    const saved = await getShopAiKey(auth.shopId)
    if (!saved) {
      return NextResponse.json({ valid: false, error: 'ไม่พบ API Key ที่บันทึกไว้' })
    }
    return testKey(saved.provider, saved.key)
  }

  // Test provided key
  return testKey(provider, key)
}

async function testKey(provider: string, key: string): Promise<NextResponse> {
  try {
    if (provider === 'gemini') {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        headers: { 'x-goog-api-key': key },
      })
      if (!res.ok) {
        const err = await res.text()
        return NextResponse.json({ valid: false, error: `Gemini API key ไม่ถูกต้อง: ${providerError(err, key)}` })
      }
      const data = await res.json()
      const models = data.models?.length || 0
      return NextResponse.json({ valid: true, message: `Gemini API key ใช้งานได้ (${models} models available)` })
    }

    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      })
      if (!res.ok) {
        return NextResponse.json({ valid: false, error: 'OpenAI API key ไม่ถูกต้อง' })
      }
      return NextResponse.json({ valid: true, message: 'OpenAI API key ใช้งานได้' })
    }

    if (provider === 'claude') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      })
      if (!res.ok && res.status !== 400) {
        return NextResponse.json({ valid: false, error: 'Claude API key ไม่ถูกต้อง' })
      }
      return NextResponse.json({ valid: true, message: 'Claude API key ใช้งานได้' })
    }

    return NextResponse.json({ valid: false, error: 'Unknown provider' })
  } catch (err: any) {
    return NextResponse.json({ valid: false, error: `Connection error: ${err.message}` })
  }
}
