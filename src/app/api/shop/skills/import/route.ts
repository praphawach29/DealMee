import { NextRequest, NextResponse } from 'next/server'
import { requireShop } from '@/lib/auth/requireShop'
import { MAX_SKILL_FILE_BYTES, parseSkillFile } from '@/lib/ai/skillFile'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const auth = await requireShop()
  if (auth.error) return auth.error

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Upload a multipart form with one .md or .txt file' }, { status: 400 })
  }
  const files = form.getAll('file')
  const file = files[0]
  if (files.length !== 1 || !(file instanceof File)) {
    return NextResponse.json({ error: 'Select exactly one .md or .txt file' }, { status: 400 })
  }
  if (file.size > MAX_SKILL_FILE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 16 KB' }, { status: 413 })
  }
  let parsed: ReturnType<typeof parseSkillFile>
  try {
    parsed = parseSkillFile(file.name, new Uint8Array(await file.arrayBuffer()))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to read skill file' }, { status: 400 })
  }

  // Never trust tenant/status/type/keywords from the multipart request.
  // Description uses the existing knowledge field; the body stays intact.
  try {
    const { data, error } = await createAdminClient().from('shop_skills').insert({
      shop_id: auth.shopId,
      created_by: auth.userId,
      status: 'candidate',
      skill_type: 'behavior',
      category: parsed.category,
      trigger_keywords: [],
      knowledge_body: parsed.description,
      instruction: parsed.instruction,
      gold_conversations: [],
      facts_confirmed: true,
    }).select('*').single()
    if (error || !data) return NextResponse.json({ error: 'Unable to import skill; please try again' }, { status: 500 })
    return NextResponse.json({ skill: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unable to import skill; please try again' }, { status: 500 })
  }
}
