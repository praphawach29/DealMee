import type { AiCompetitorPlaybook, CompetitorPost, SocialPlatform } from './scraperEngine'
import { platformSecret } from '@/lib/platformSecrets'

/**
 * Writes the strategy section of a competitor scan with Gemini, from the posts and
 * profile that were actually fetched and the shop's own catalogue. Returns null
 * when there is no key or the model gives nothing usable: the page then says the
 * analysis is unavailable rather than showing stock advice. (Until Oct 2026 every
 * shop got the same hard-coded t-shirt playbook, whatever it sold.)
 */

export interface PlaybookInput {
  competitorName: string
  platform: SocialPlatform
  followerCount: number
  posts: CompetitorPost[]
  myProducts: Array<{ name: string; price: number }>
  shopName?: string
}

function buildPrompt(input: PlaybookInput): string {
  const posts = input.posts
    .map(
      (p, i) =>
        `${i + 1}. "${p.title_or_caption.slice(0, 300)}" — วิว ${p.views_count.toLocaleString()} ไลก์ ${p.likes_count.toLocaleString()} คอมเมนต์ ${p.comments_count.toLocaleString()} แชร์ ${p.shares_count.toLocaleString()} (engagement ${p.engagement_rate}%)`
    )
    .join('\n')
  const products = input.myProducts
    .slice(0, 15)
    .map((p) => `- ${p.name}: ฿${p.price.toLocaleString()}`)
    .join('\n')

  return `คุณเป็นที่ปรึกษาการตลาดออนไลน์ให้ร้านค้าไทย${input.shopName ? ` (ร้าน ${input.shopName})` : ''}
วิเคราะห์บัญชีคู่แข่งจากข้อมูลจริงด้านล่าง แล้วแนะนำว่าร้านของเราควรทำคอนเทนต์และตั้งราคาอย่างไร

คู่แข่ง: ${input.competitorName} บน ${input.platform} ผู้ติดตาม ${input.followerCount.toLocaleString()} คน
โพสต์ล่าสุดของคู่แข่ง:
${posts || '(ไม่มีข้อมูลโพสต์)'}

สินค้าของร้านเรา:
${products || '(ร้านยังไม่ได้เพิ่มสินค้า)'}

กติกา (สำคัญมาก):
- ใช้เฉพาะข้อมูลข้างบน ห้ามแต่งตัวเลข ราคาของคู่แข่ง ยอดขาย หรือข้อเท็จจริงที่ไม่ได้ให้มา
- เราไม่รู้ราคาของคู่แข่ง ห้ามอ้างว่าร้านเราถูกหรือแพงกว่า ถ้าจะพูดเรื่องราคา ให้พูดจากราคาสินค้าของเราเท่านั้น
- ห้ามสัญญาแทนร้าน เช่น ส่งฟรี ส่งภายในกี่ชั่วโมง ของแถม รับประกัน เคลม ส่วนลด หรือโปรโมชั่น ถ้าอยากเสนอ ให้เขียนเป็นคำแนะนำว่า "ถ้าร้านมี ... ให้ชูเรื่องนี้"
- hook และแคปชั่นต้องเกี่ยวกับสินค้าของร้านเรา ไม่ใช่สินค้าของคู่แข่ง
- ภาษาไทย กระชับ

ตอบเป็น JSON เท่านั้น ตามโครงสร้างนี้:
{
  "pricingStrategyVerdict": "สรุป 2-3 ประโยคว่าคู่แข่งดึงคนดูด้วยอะไร และร้านเราควรวางตัวอย่างไร",
  "priceAdvantageBullets": ["คำแนะนำที่ทำได้จริง 3-4 ข้อ"],
  "topViralHooks": [{ "hookText": "ประโยคเปิดคลิปสำหรับสินค้าของเรา", "whyItWorks": "อ้างอิงสิ่งที่เห็นจากโพสต์ของคู่แข่ง", "recommendedFormat": "รูปแบบคลิป" }],
  "winningCaptionTemplate": "แคปชั่นตัวอย่างสำหรับสินค้าของเรา (เว้นที่ให้ร้านเติมโปรของตัวเองในวงเล็บเหลี่ยม)",
  "recommendedHashtags": ["#แฮชแท็ก"]
}
topViralHooks 3 ข้อ, recommendedHashtags 6-10 แท็ก`
}

function isPlaybook(value: any): value is AiCompetitorPlaybook {
  return (
    value &&
    typeof value.pricingStrategyVerdict === 'string' &&
    Array.isArray(value.priceAdvantageBullets) &&
    Array.isArray(value.topViralHooks) &&
    typeof value.winningCaptionTemplate === 'string' &&
    Array.isArray(value.recommendedHashtags)
  )
}

export async function generateCompetitorPlaybook(input: PlaybookInput): Promise<AiCompetitorPlaybook | null> {
  if (input.posts.length === 0) return null
  const apiKey = await platformSecret('GEMINI_API_KEY')
  if (!apiKey) return null

  const model = (await platformSecret('GEMINI_MODEL')) || 'gemini-3.8-flash'
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(input) }] }],
        generationConfig: { temperature: 0.6, responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) {
      console.error('[competitorPlaybook] Gemini error:', res.status, (await res.text()).slice(0, 300))
      return null
    }
    const data = await res.json()
    const text: string = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('')
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    return isPlaybook(parsed) ? parsed : null
  } catch (err) {
    console.error('[competitorPlaybook] failed:', err)
    return null
  }
}
