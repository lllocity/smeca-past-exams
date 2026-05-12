import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { validate, type GeminiQuestion } from '@/lib/import-validate'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}

async function handleImport(request: NextRequest, overwrite: boolean) {
  // 認証
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.IMPORT_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // パース
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!Array.isArray(body)) {
    return NextResponse.json({ error: 'Body must be a JSON array' }, { status: 400 })
  }

  const supabase = createAdminClient()
  let inserted = 0
  let updated = 0
  let skipped = 0
  const errors: string[] = []

  for (const item of body) {
    if (!validate(item)) {
      errors.push(`Invalid question: ${JSON.stringify(item).slice(0, 80)}`)
      continue
    }

    const { data: inserted_row, error: qError } = await supabase
      .from('questions')
      .insert({
        subject_code: item.subject_code,
        year: item.year,
        question_number: item.question_number,
        points: item.points,
        question_text: item.question_text,
        options: item.options,
        correct_answer: item.correct_answer,
        explanation: item.explanation ?? null,
      })
      .select('id')
      .single()

    if (qError) {
      if (qError.code === '23505') {
        if (overwrite) {
          // PUT モード: 既存レコードを UPDATE
          const { data: existing } = await supabase
            .from('questions')
            .update({
              points: item.points,
              question_text: item.question_text,
              options: item.options,
              correct_answer: item.correct_answer,
              explanation: item.explanation ?? null,
            })
            .eq('subject_code', item.subject_code)
            .eq('year', item.year)
            .eq('question_number', item.question_number)
            .select('id')
            .single()

          if (existing) {
            updated++
            await upsertTags(supabase, existing.id, item.subject_code, item.tags)
          }
        } else {
          // POST モード: スキップしてタグのみ同期
          skipped++
          const { data: existing } = await supabase
            .from('questions')
            .select('id')
            .eq('subject_code', item.subject_code)
            .eq('year', item.year)
            .eq('question_number', item.question_number)
            .single()

          if (existing) {
            await upsertTags(supabase, existing.id, item.subject_code, item.tags)
          }
        }
      } else {
        errors.push(`Q${item.question_number}: ${qError.message}`)
      }
      continue
    }

    inserted++
    if (inserted_row) {
      await upsertTags(supabase, inserted_row.id, item.subject_code, item.tags)
    }
  }

  return NextResponse.json({ inserted, updated, skipped, errors })
}

export async function POST(request: NextRequest) {
  return handleImport(request, false)
}

export async function PUT(request: NextRequest) {
  return handleImport(request, true)
}

async function upsertTags(
  supabase: ReturnType<typeof createAdminClient>,
  questionId: number,
  subjectCode: string,
  tags: string[]
) {
  for (const tagName of tags) {
    const { data: tag } = await supabase
      .from('tags')
      .upsert({ subject_code: subjectCode, name: tagName }, { onConflict: 'subject_code,name' })
      .select('id')
      .single()

    if (tag) {
      await supabase
        .from('question_tags')
        .insert({ question_id: questionId, tag_id: tag.id })
        .then(() => {}, () => {})
    }
  }
}
