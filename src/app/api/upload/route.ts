import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateUpload } from '@/lib/upload-validate'

export async function POST(request: NextRequest) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  const questionIdRaw = formData.get('question_id')

  const fileArg = file instanceof File ? { type: file.type, size: file.size } : null
  const validation = validateUpload(fileArg, questionIdRaw)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  // validateUpload が ok なら file は File インスタンスであることが保証される
  const actualFile = file as File
  const questionId = Number(questionIdRaw)

  const supabase = await createClient()

  // display_order は現在の最大値 + 1
  const { data: existing } = await supabase
    .from('question_images')
    .select('display_order')
    .eq('question_id', questionId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (existing?.display_order ?? 0) + 1
  const ext = actualFile.name.split('.').pop() ?? 'jpg'
  const storagePath = `questions/${questionId}/${Date.now()}.${ext}`

  const bytes = await actualFile.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('question-images')
    .upload(storagePath, bytes, { contentType: actualFile.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: inserted, error: insertError } = await supabase
    .from('question_images')
    .insert({ question_id: questionId, storage_path: storagePath, display_order: nextOrder })
    .select('id, storage_path, display_order')
    .single()

  if (insertError) {
    // ストレージのファイルは残るが、DBエラーを返す
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  return NextResponse.json({
    data: {
      ...inserted,
      url: `${supabaseUrl}/storage/v1/object/public/question-images/${storagePath}`,
    },
  })
}
