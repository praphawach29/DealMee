import { createAdminClient } from '@/lib/supabase/admin'

export interface VideoScriptSegment {
  duration: string // e.g. "00:00 - 00:03"
  spokenText: string // Voiceover / Script in Thai
  visualDirection: string // Scene instructions, camera angle, action
}

export interface ViralVideoScript {
  title: string
  hook: VideoScriptSegment
  problem: VideoScriptSegment
  solution: VideoScriptSegment
  offer: VideoScriptSegment
  cta: VideoScriptSegment
  caption: string
  hashtags: string[]
}

export interface GenerateScriptParams {
  competitorVideoTitle: string
  competitorName: string
  myProduct?: {
    name: string
    price: number
    features?: string
  }
  shopName?: string
}

async function getGeminiApiKey(): Promise<string> {
  const envKey =
    process.env.GEMINI_API_KEY ||
    process.env.GEMINI_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY

  if (envKey) return envKey

  try {
    const supabase = createAdminClient()
    const { data: setting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'gemini_key')
      .maybeSingle()

    if (setting?.value) return setting.value
  } catch (err) {
    console.warn('[competitorVideoScript] Failed to load gemini_key from settings:', err)
  }

  return ''
}

export async function generateViralScriptFromCompetitor(
  params: GenerateScriptParams
): Promise<ViralVideoScript> {
  const { competitorVideoTitle, competitorName, myProduct, shopName } = params

  const productName = myProduct?.name || 'สินค้าขายดีของร้านเรา'
  const productPrice = myProduct?.price ? `฿${myProduct.price.toLocaleString()}` : '(ร้านยังไม่ได้ตั้งราคา)'
  const productFeatures = myProduct?.features || '(ร้านยังไม่ได้ใส่รายละเอียดสินค้า)'
  const storeName = shopName || 'DealMee'

  const apiKey = await getGeminiApiKey()

  if (apiKey) {
    try {
      const prompt = `คุณคือผู้เชี่ยวชาญการตลาดวิดีโอสั้น (TikTok / Reels / YouTube Shorts) ชั้นยอดในประเทศไทย
จงวิเคราะห์วิดีโอคู่แข่งที่ไวรัล และเขียนบทสคริปต์วิดีโอ 30 วินาที เพื่อให้ร้านของเรา (${storeName}) แย่งยอดขายและดึงดูดลูกค้าด้วยจุดเด่นของเรา

ข้อมูลคู่แข่ง:
- ชื่อคู่แข่ง: ${competitorName}
- หัวข้อ/จุดขายคลิปไวรัลของคู่แข่ง: "${competitorVideoTitle}"

ข้อมูลสินค้าของเราที่ต้องการโปรโมต:
- ชื่อสินค้า: ${productName}
- ราคาของเรา: ${productPrice}
- จุดเด่นสินค้าของเรา: ${productFeatures}

ข้อกำหนดของสคริปต์ (โครงสร้าง 5 ส่วน จังหวะกระชับ หยุดนิ้วคนดู):
1. hook (00:00 - 00:03): คำเปิดที่กระตุกสายตา/หยุดนิ้ว (Pattern Interrupt) ดึงจุดสงสัยหรือเตือนคนดู
2. problem (00:03 - 00:08): ชี้ Pain Point หรือข้อเสียที่คนเคยเจอจากการซื้อที่อื่น (เช่น รอนาน จ่ายแพง ผ้าบาง)
3. solution (00:08 - 00:16): แนะนำสินค้าของเรา สาธิตข้อดีและความคุ้มค่าแบบชัดเจน
4. offer (00:16 - 00:23): บอกราคาของเรา ถ้าร้านมีโปรให้เว้นที่ไว้ในวงเล็บเหลี่ยม เช่น [ใส่โปรของร้าน]
5. cta (00:23 - 00:30): ชวนทักแชทเพื่อสั่งซื้อ

ห้ามแต่งข้อเท็จจริงที่ไม่ได้ให้มา: ราคาคู่แข่ง ส่วนลด ของแถม ส่งฟรี ระยะเวลาจัดส่ง การรับประกัน หรือการเคลม
ห้ามพูดว่าสินค้าของคู่แข่งไม่ดี ให้ชูจุดเด่นของเราจากรายละเอียดที่ให้มาเท่านั้น

รูปแบบผลลัพธ์: ตอบกลับเป็น JSON เท่านั้น (ไม่มี Markdown backticks หรือข้อความอื่น) ตามโครงสร้างนี้:
{
  "title": "ชื่อหัวข้อคลิปที่น่าดึงดูด",
  "hook": { "duration": "00:00 - 00:03", "spokenText": "บทพูดภาษาไทย", "visualDirection": "คำสั่งการถ่ายทำ มุมกล้อง แอ็กชัน" },
  "problem": { "duration": "00:03 - 00:08", "spokenText": "บทพูดภาษาไทย", "visualDirection": "คำสั่งการถ่ายทำ" },
  "solution": { "duration": "00:08 - 00:16", "spokenText": "บทพูดภาษาไทย", "visualDirection": "คำสั่งการถ่ายทำ" },
  "offer": { "duration": "00:16 - 00:23", "spokenText": "บทพูดภาษาไทย", "visualDirection": "คำสั่งการถ่ายทำ" },
  "cta": { "duration": "00:23 - 00:30", "spokenText": "บทพูดภาษาไทย", "visualDirection": "คำสั่งการถ่ายทำ" },
  "caption": "แคปชันโพสต์ลง TikTok/Reels พร้อม call to action ในแชท",
  "hashtags": ["#แฮชแท็ก1", "#แฮชแท็ก2", "#แฮชแท็ก3", "#แฮชแท็ก4", "#แฮชแท็ก5"]
}`

      const candidateModels = [process.env.GEMINI_MODEL || 'gemini-3.8-flash', 'gemini-flash-latest']

      for (const model of candidateModels) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.7,
                response_mime_type: 'application/json',
              },
            }),
          })

          if (res.ok) {
            const data = await res.json()
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text
            if (rawText) {
              const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim()
              const parsed = JSON.parse(cleaned)
              if (parsed.hook && parsed.problem && parsed.solution && parsed.offer && parsed.cta) {
                return parsed as ViralVideoScript
              }
            }
          }
        } catch (modelErr) {
          console.warn(`[competitorVideoScript] Model ${model} request error:`, modelErr)
        }
      }
    } catch (apiErr) {
      console.error('[competitorVideoScript] Gemini call failed:', apiErr)
    }
  }

  // No canned script: the old fallback promised "100% as pictured", a crossed-out
  // near-1,000 baht price and dispatch without pre-order, for any shop
  throw new Error('สร้างสคริปต์ไม่สำเร็จ ระบบ AI ขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง')
}
