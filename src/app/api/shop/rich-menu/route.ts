import { NextRequest, NextResponse } from 'next/server'
import { requireShop } from '@/lib/auth/requireShop'
import { createAdminClient } from '@/lib/supabase/admin'

// Create a LINE Rich Menu for slip recording
export async function POST(request: NextRequest) {
  const auth = await requireShop()
  if (auth.error) return auth.error

  const admin = createAdminClient()
  const { data: shop } = await admin.from('shops').select('line_token, features').eq('id', auth.shopId).single()

  if (!shop?.line_token) {
    return NextResponse.json({ error: 'ไม่พบ LINE Token' }, { status: 400 })
  }

  const token = shop.line_token.trim()

  // Create rich menu
  const richMenu = {
    size: { width: 2500, height: 843 },
    selected: true,
    name: 'DealMee Slip Record Menu',
    chatBarText: 'เมนู',
    areas: [
      {
        bounds: { x: 0, y: 0, width: 2500, height: 843 },
        action: { type: 'postback', label: '📸 บันทึกสลิป', data: 'action=slip_record' },
      },
    ],
  }

  try {
    const res = await fetch('https://api.line.me/v2/bot/richmenu', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(richMenu),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `สร้าง Rich Menu ไม่สำเร็จ: ${err}` }, { status: 500 })
    }

    const data = await res.json()
    return NextResponse.json({
      richMenuId: data.richMenuId,
      message: 'สร้าง Rich Menu สำเร็จ! กรุณาอัพโหลดรูปภาพ (2500x843 px) ผ่าน LINE API แล้วตั้งเป็น default',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Set a rich menu as default
export async function PATCH(request: NextRequest) {
  const auth = await requireShop()
  if (auth.error) return auth.error

  const body = await request.json().catch(() => ({}))
  const richMenuId = body.richMenuId

  if (!richMenuId) {
    return NextResponse.json({ error: 'richMenuId required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: shop } = await admin.from('shops').select('line_token').eq('id', auth.shopId).single()

  if (!shop?.line_token) {
    return NextResponse.json({ error: 'ไม่พบ LINE Token' }, { status: 400 })
  }

  try {
    const res = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${shop.line_token.trim()}` },
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `ตั้งค่า Rich Menu ไม่สำเร็จ: ${err}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'ตั้งค่า Rich Menu เป็น default สำเร็จ' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
