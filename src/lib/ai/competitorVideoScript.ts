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
  const productPrice = myProduct?.price ? `฿${myProduct.price.toLocaleString()}` : 'ราคาพิเศษสุดคุ้ม'
  const productFeatures = myProduct?.features || 'คุณภาพพรีเมียม สัมผัสนุ่ม ทรงสวย คุ้มค่าเกินราคา'
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
4. offer (00:16 - 00:23): เสนอราคาและโปรโมชั่นพิเศษ พร้อมของแถมหรือส่งฟรี
5. cta (00:23 - 00:30): สั่งให้ทักแชททันที มี AI คอยรับออเดอร์ตลอด 24 ชม.

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

      const candidateModels = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-3-flash-preview', 'gemini-flash-latest']

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
      console.error('[competitorVideoScript] Gemini call failed, using heuristic script:', apiErr)
    }
  }

  // Deterministic high-converting heuristic fallback
  return {
    title: `เทียบชัดๆ! ${productName} คุณภาพชนรุ่นดังในราคาแค่ ${productPrice}`,
    hook: {
      duration: '00:00 - 00:03',
      spokenText: `หยุดเลื่อนก่อน 3 วิ! ใครที่กำลังจะสั่งจากร้านดัง ฟังคลิปนี้ก่อนจะได้ไม่เสียดายเงิน`,
      visualDirection: `ถือสินค้าโคลสอัปชัดๆ พร้อมทำท่าชี้นิ้วหยุดกล้อง มีตัวหนังสือกระพริบกลางจอ "หยุดก่อน!"`,
    },
    problem: {
      duration: '00:03 - 00:08',
      spokenText: `เบื่อไหมกับที่เคยสั่งมาแล้วไม่ตรงปก รอนานเป็นอาทิตย์ แถมราคาก็แพงเกินจริง`,
      visualDirection: `ทำหน้าเซ็ง ถือสินค้าตัวเก่าหรือของไม่ตรงปกให้เห็นความผิดหวัง มุมกล้องตัดเร็ว`,
    },
    solution: {
      duration: '00:08 - 00:16',
      spokenText: `แต่รุ่นนี้ของ ${storeName} คือตัวจบจริง! ${productFeatures} งานดีเทลเนียนกริบ การันตีตรงปก 100%`,
      visualDirection: `โชว์ความพรีเมียม ดึงสัมผัสเนื้อวัสดุ/ดีเทลให้เห็นชัดเจน สลับมุมกล้อง OOTD หมุน 360 องศา`,
    },
    offer: {
      duration: '00:16 - 00:23',
      spokenText: `ที่สำคัญ ปกติเกรดนี้ขายกันเกือบพัน แต่วันนี้ที่ร้านเราจัดให้เพียง ${productPrice} เท่านั้น มีจำนวนจำกัด`,
      visualDirection: `ขึ้นป้ายราคาสีทองหรือแดงเด่นๆ กราฟิกเครื่องหมายลดราคาและสติกเกอร์ "พร้อมส่งด่วน"`,
    },
    cta: {
      duration: '00:23 - 00:30',
      spokenText: `อยากได้ราคานี้ รีบทักแชทพิมพ์ "สนใจ" ได้เลย มีแอดมิน AI ตอบรับออเดอร์ทันทีตลอด 24 ชม. จิ้มที่ลิงก์เลยค่ะ!`,
      visualDirection: `ชี้นิ้วลงไปที่ปุ่มแชท/ตะกร้า พร้อมขึ้นไอคอนแชท LINE OA และข้อความ "ทักแชทรับโปรพิเศษ"`,
    },
    caption: `ใครกำลังมองหา ${productName} ที่ทั้งคุ้มทั้งเป๊ะ ต้องรุ่นนี้เลยค่ะ! ✨ สั่งซื้อในแชทวันนี้เพียง ${productPrice} (พร้อมส่งทันทีไม่ต้องรอพรี) ทักแชทได้เลย แอดมิน AI พร้อมดูแล 24 ชม. ค่ะ 💖`,
    hashtags: [
      `#${storeName.replace(/\s+/g, '')}`,
      '#ของดีบอกต่อ',
      '#ช้อปปิ้งออนไลน์',
      '#โปรเด็ด',
      '#รีวิวของดี',
    ],
  }
}
