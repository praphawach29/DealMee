import { NextRequest, NextResponse } from 'next/server'
import { requireShop } from '@/lib/auth/requireShop'
import { createAdminClient } from '@/lib/supabase/admin'

// Template library for common business types
const TEMPLATES: Record<string, { skill_type: string; category: string; trigger_keywords: string[]; knowledge_body: string; instruction: string }[]> = {
  restaurant: [
    {
      skill_type: 'knowledge', category: 'menu',
      trigger_keywords: ['เมนู', 'อาหาร', 'ราคา', 'มีอะไร', 'แนะนำ'],
      knowledge_body: 'เมนูแนะนำ: [ใส่เมนูและราคา] | โปรโมชั่น: [ใส่โปรโมชั่น] | เปิด-ปิด: [ใส่เวลาทำการ]',
      instruction: 'ตอบเมนูและราคาสั้น กระชับ พร้อม CTA ให้สั่งอาหาร',
    },
    {
      skill_type: 'knowledge', category: 'delivery',
      trigger_keywords: ['ส่ง', 'เดลิเวอรี่', 'delivery', 'ส่งถึงบ้าน', 'ค่าส่ง'],
      knowledge_body: 'ค่าส่ง: [ใส่ค่าส่ง] | พื้นที่ส่ง: [ใส่พื้นที่] | เวลาส่ง: [ใส่เวลา]',
      instruction: 'ตอบข้อมูลการส่งสั้น พร้อม CTA ให้สั่ง',
    },
  ],
  salon: [
    {
      skill_type: 'knowledge', category: 'services',
      trigger_keywords: ['บริการ', 'ทำผม', 'ทำเล็บ', 'นวด', 'ราคา', 'มีอะไร'],
      knowledge_body: 'บริการ: [ใส่บริการและราคา] | เปิด-ปิด: [ใส่เวลาทำการ] | จองคิว: [ใส่วิธีจอง]',
      instruction: 'ตอบบริการและราคาสั้น พร้อม CTA ให้จองคิว',
    },
    {
      skill_type: 'knowledge', category: 'booking',
      trigger_keywords: ['จอง', 'นัด', 'คิว', 'วันนี้', 'พรุ่งนี้'],
      knowledge_body: 'จองคิว: [ใส่วิธีจอง] | เลือกช่าง: [ใส่ชื่อช่าง] | ยกเลิก: [ใส่นโยบาย]',
      instruction: 'ตอบวิธีจองสั้น ชัดเจน',
    },
  ],
  retail: [
    {
      skill_type: 'knowledge', category: 'products',
      trigger_keywords: ['สินค้า', 'มีไหม', 'ราคา', 'สี', 'ไซส์'],
      knowledge_body: 'สินค้า: [ใส่สินค้าและราคา] | สี/ไซส์: [ใส่ตัวเลือก] | จัดส่ง: [ใส่วิธีจัดส่ง]',
      instruction: 'ตอบสินค้าและราคาสั้น พร้อม CTA ให้สั่งซื้อ',
    },
    {
      skill_type: 'knowledge', category: 'shipping',
      trigger_keywords: ['จัดส่ง', 'ส่ง', 'EMS', 'Kerry', 'Flash', 'ค่าส่ง'],
      knowledge_body: 'วิธีจัดส่ง: [ใส่วิธี] | ค่าส่ง: [ใส่ค่าส่ง] | เวลาจัดส่ง: [ใส่เวลา]',
      instruction: 'ตอบข้อมูลจัดส่งสั้น ชัดเจน',
    },
  ],
  general: [
    {
      skill_type: 'knowledge', category: 'sales',
      trigger_keywords: ['ราคา', 'แพ็กเกจ', 'ราคาเท่าไหร่', 'กี่บาท'],
      knowledge_body: '[ใส่ราคาและแพ็กเกจ]',
      instruction: 'ตอบราคาสั้น กระชับ พร้อม CTA',
    },
    {
      skill_type: 'knowledge', category: 'payment',
      trigger_keywords: ['ชำระเงิน', 'โอนเงิน', 'QR', 'บัญชี', 'เติมเงิน'],
      knowledge_body: '[ใส่ช่องทางชำระเงิน]',
      instruction: 'ตอบช่องทางชำระเงินสั้น พร้อม CTA',
    },
  ],
}

export async function GET() {
  return NextResponse.json({ templates: Object.keys(TEMPLATES), details: TEMPLATES })
}

export async function POST(request: NextRequest) {
  const auth = await requireShop()
  if (auth.error) return auth.error

  const body = await request.json()
  const templateType = body.template_type as string

  if (!TEMPLATES[templateType]) {
    return NextResponse.json({ error: 'Unknown template type' }, { status: 400 })
  }

  const admin = createAdminClient()
  const skills = TEMPLATES[templateType].map((t) => ({
    ...t,
    shop_id: auth.shopId,
    status: 'candidate',
    created_by: auth.userId,
    facts_confirmed: false,
  }))

  const { data, error } = await admin
    .from('shop_skills')
    .insert(skills)
    .select('*')

  if (error) {
    return NextResponse.json({ error: 'Failed to create skills from template' }, { status: 500 })
  }

  return NextResponse.json({ skills: data, count: data?.length || 0 }, { status: 201 })
}
