// Replaces globalThis.fetch with a scripted Gemini endpoint and records every request.
export interface GeminiCall {
  url: string
  body: any
  /** all prompt text sent: system instruction (if any) + user parts */
  prompt: string
}

export function installFakeGemini(replies: Array<unknown | { status: number; text: string }>) {
  const calls: GeminiCall[] = []
  const original = globalThis.fetch
  let i = 0
  globalThis.fetch = (async (url: any, init: any) => {
    const body = JSON.parse(init?.body ?? '{}')
    const sys = body.systemInstruction?.parts?.map((p: any) => p.text).join('\n') ?? ''
    const user = (body.contents ?? []).flatMap((c: any) => c.parts ?? []).map((p: any) => p.text).join('\n')
    calls.push({ url: String(url), body, prompt: [sys, user].filter(Boolean).join('\n') })
    const reply: any = replies[Math.min(i++, replies.length - 1)]
    if (reply && typeof reply === 'object' && 'status' in reply) {
      return new Response(reply.text, { status: reply.status })
    }
    const text = typeof reply === 'string' ? reply : JSON.stringify(reply)
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 })
  }) as typeof fetch
  return { calls, restore: () => { globalThis.fetch = original } }
}
