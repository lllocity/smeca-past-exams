import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const SUBJECT_CODES = ['ECO', 'FIN', 'MGT', 'OPS', 'LAW', 'MIS', 'SME'] as const
type SubjectCode = (typeof SUBJECT_CODES)[number]

type GeminiQuestion = {
  subject_code: SubjectCode
  year: number
  question_number: number
  points: number
  question_text: string
  options: Array<{ label: string; text: string }>
  correct_answer: string
  explanation: string | null
  tags: string[]
}

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

function validate(q: unknown): q is GeminiQuestion {
  if (typeof q !== 'object' || q === null) return false
  const obj = q as Record<string, unknown>
  return (
    SUBJECT_CODES.includes(obj.subject_code as SubjectCode) &&
    typeof obj.year === 'number' &&
    typeof obj.question_number === 'number' &&
    typeof obj.points === 'number' &&
    typeof obj.question_text === 'string' &&
    Array.isArray(obj.options) &&
    typeof obj.correct_answer === 'string' &&
    Array.isArray(obj.tags)
  )
}

export async function POST(request: NextRequest) {
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
  let skipped = 0
  const errors: string[] = []

  for (const item of body) {
    if (!validate(item)) {
      errors.push(`Invalid question: ${JSON.stringify(item).slice(0, 80)}`)
      continue
    }

    // questions テーブルに挿入（重複はスキップ）
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
        // UNIQUE 制約違反 = 既存レコード → id を取得してタグ処理へ
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

  return NextResponse.json({ inserted, skipped, errors })
}

async function upsertTags(
  supabase: ReturnType<typeof createAdminClient>,
  questionId: number,
  subjectCode: string,
  tags: string[]
) {
  for (const tagName of tags) {
    // tags テーブルに upsert してIDを取得
    const { data: tag } = await supabase
      .from('tags')
      .upsert({ subject_code: subjectCode, name: tagName }, { onConflict: 'subject_code,name' })
      .select('id')
      .single()

    if (tag) {
      await supabase
        .from('question_tags')
        .insert({ question_id: questionId, tag_id: tag.id })
        .then(() => {}, () => {}) // ON CONFLICT DO NOTHING 相当
    }
  }
}
