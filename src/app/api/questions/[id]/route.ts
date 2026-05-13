import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateQuestionUpdate } from '@/lib/question-update-validate'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const questionId = Number(id)
  if (!Number.isInteger(questionId) || questionId <= 0) {
    return NextResponse.json({ error: 'Invalid question id' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = validateQuestionUpdate(body)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('questions')
    .update(result.update)
    .eq('id', questionId)
    .select('id, question_text, explanation')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  return NextResponse.json({ data })
}
