import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireShop } from '@/lib/auth/requireShop'

// Paid TTS providers bill per character, so cap what one request can spend.
const MAX_TTS_CHARS = 1500

/**
 * GET or POST /api/live/tts
 * Generates and streams Thai speech audio MP3 for live streaming pitches and comments
 */
export async function GET(req: NextRequest) {
  const auth = await requireShop()
  if (auth.error) return auth.error

  const searchParams = req.nextUrl.searchParams
  const text = (searchParams.get('text') || '').trim().slice(0, MAX_TTS_CHARS)
  const shopId = auth.shopId
  const speed = parseFloat(searchParams.get('speed') || '1.15')
  const voice = searchParams.get('voice') || 'female'

  if (!text) {
    return NextResponse.json({ error: 'Missing text parameter' }, { status: 400 })
  }

  return generateAudioResponse(text, shopId, speed, voice)
}

export async function POST(req: NextRequest) {
  const auth = await requireShop()
  if (auth.error) return auth.error

  try {
    const body = await req.json()
    const text = (body.text || '').trim().slice(0, MAX_TTS_CHARS)
    const shopId = auth.shopId
    const speed = parseFloat(body.speed || '1.15')
    const voice = body.voice || 'female'

    if (!text) {
      return NextResponse.json({ error: 'Missing text parameter' }, { status: 400 })
    }

    return generateAudioResponse(text, shopId, speed, voice)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Invalid request body' }, { status: 400 })
  }
}

/**
 * Splits Thai text cleanly at sentence endings, discourse particles, or punctuation.
 * Prevents chopping Thai words in the middle of syllables!
 */
function splitThaiSentencesCleanly(text: string, maxLen = 170): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxLen) return [clean]

  const regex = /([^!?.\n]*(?:ค่ะ|ครับ|นะคะ|นะครับ|จ้า|จ้ะ|เลยค่ะ|เลยครับ|เท่านั้นค่ะ|เท่านั้นครับ|ด่วนเลยค่ะ|ด่วนเลยครับ|[!?.\n]+)\s*)/g
  const matches = clean.match(regex)

  if (!matches || matches.length === 0) {
    const chunks: string[] = []
    let cur = ''
    const words = clean.split(' ')
    for (const w of words) {
      if ((cur + ' ' + w).length <= maxLen) {
        cur = cur ? cur + ' ' + w : w
      } else {
        if (cur) chunks.push(cur)
        cur = w
      }
    }
    if (cur) chunks.push(cur)
    return chunks.filter(c => c.trim().length > 1)
  }

  const results: string[] = []
  let buffer = ''
  for (const part of matches) {
    if ((buffer + part).length <= maxLen) {
      buffer += part
    } else {
      if (buffer.trim()) results.push(buffer.trim())
      buffer = part
    }
  }
  if (buffer.trim()) results.push(buffer.trim())

  const resultFiltered = results.filter(c => c.trim().length > 1)
  return resultFiltered.length > 0 ? resultFiltered : [clean.slice(0, maxLen)]
}

async function generateAudioResponse(
  text: string,
  shopId?: string,
  speed = 1.15,
  voice = 'female'
): Promise<Response> {
  const supabase = createAdminClient()

  // 1. Check for OpenAI API key (Env or Shop Settings)
  let openaiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || ''
  if (!openaiKey && shopId) {
    try {
      const { data: setting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'openai_key')
        .maybeSingle()
      if (setting?.value) {
        openaiKey = typeof setting.value === 'string' ? setting.value : setting.value.key || ''
      }
    } catch {
      // Ignore
    }
  }

  if (openaiKey) {
    try {
      const openaiVoice = voice === 'male' ? 'onyx' : 'nova' // 'nova' is lively & energetic for live commerce
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: openaiVoice,
          speed: Math.max(0.85, Math.min(speed, 1.4)),
        }),
      })

      if (res.ok) {
        const audioBuffer = await res.arrayBuffer()
        return new Response(audioBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'private, max-age=86400',
          },
        })
      }
    } catch (openaiErr) {
      console.warn('[OpenAI TTS Warning, falling back]:', openaiErr)
    }
  }

  // 2. Check if ElevenLabs API key is configured (Env or Shop Settings)
  let elevenLabsKey = process.env.ELEVENLABS_API_KEY || ''
  let elevenLabsVoiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'

  if (!elevenLabsKey && shopId) {
    try {
      const { data: setting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'elevenlabs_key')
        .maybeSingle()
      if (setting?.value) {
        elevenLabsKey = typeof setting.value === 'string' ? setting.value : setting.value.key || ''
      }
    } catch {
      // Ignore fallback
    }
  }

  if (elevenLabsKey) {
    try {
      const elevenRes = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': elevenLabsKey,
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.45,
              similarity_boost: 0.75,
              style: 0.4,
            },
          }),
        }
      )

      if (elevenRes.ok) {
        const audioBuffer = await elevenRes.arrayBuffer()
        return new Response(audioBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'private, max-age=86400',
          },
        })
      }
    } catch (elevenErr) {
      console.warn('[ElevenLabs TTS Warning, falling back]:', elevenErr)
    }
  }

  // 3. High-speed Thai Speech Generation with smart sentence/clause boundaries
  try {
    const chunks = splitThaiSentencesCleanly(text, 170)
    const audioBuffers: Buffer[] = []

    for (const chunk of chunks) {
      if (!chunk.trim()) continue
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=th&client=tw-ob&q=${encodeURIComponent(chunk)}`
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      })
      if (res.ok) {
        const arr = await res.arrayBuffer()
        audioBuffers.push(Buffer.from(arr))
      }
    }

    if (audioBuffers.length === 0) {
      return NextResponse.json({ error: 'Failed to generate speech audio' }, { status: 500 })
    }

    const combinedBuffer = Buffer.concat(audioBuffers)

    return new Response(combinedBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': combinedBuffer.length.toString(),
        'Cache-Control': 'private, max-age=86400',
      },
    })
  } catch (err: any) {
    console.error('[Live TTS Error]:', err)
    return NextResponse.json({ error: err?.message || 'TTS generation error' }, { status: 500 })
  }
}
