import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import QuizSession from '@/components/QuizSession'

const VALID_SUBJECTS = new Set(['ECO', 'FIN', 'MGT', 'OPS', 'LAW', 'MIS', 'SME'])

const SUBJECT_NAMES: Record<string, string> = {
  ECO: '経済学・経済政策',
  FIN: '財務・会計',
  MGT: '企業経営理論',
  OPS: '運営管理',
  LAW: '経営法務',
  MIS: '経営情報システム',
  SME: '中小企業経営・中小企業政策',
}

export default async function TagQuizPage({
  params,
}: {
  params: Promise<{ subject: string; tag_name: string }>
}) {
  const { subject, tag_name } = await params
  const subjectUpper = subject.toUpperCase()
  const tagName = decodeURIComponent(tag_name)

  if (!VALID_SUBJECTS.has(subjectUpper)) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: tagRow } = await supabase
    .from('tags')
    .select('id')
    .eq('name', tagName)
    .maybeSingle()

  if (!tagRow) notFound()

  const { data: tagLinks } = await supabase
    .from('question_tags')
    .select('question_id')
    .eq('tag_id', tagRow.id)

  const questionIds = (tagLinks ?? []).map((t) => t.question_id)
  if (questionIds.length === 0) notFound()

  const [{ data: rawQuestions }, { data: histLogs }, { data: imageRows }] = await Promise.all([
    supabase
      .from('questions')
      .select('*')
      .eq('subject_code', subjectUpper)
      .in('id', questionIds)
      .order('year', { ascending: true })
      .order('question_number', { ascending: true }),
    supabase
      .from('user_logs')
      .select('question_id, is_correct')
      .eq('user_id', user!.id)
      .in('question_id', questionIds),
    supabase
      .from('question_images')
      .select('question_id, storage_path, display_order')
      .in('question_id', questionIds)
      .order('display_order', { ascending: true }),
  ])

  const questions = rawQuestions ?? []
  if (questions.length === 0) notFound()

  const history: Record<number, { correct: number; total: number }> = {}
  for (const log of histLogs ?? []) {
    const prev = history[log.question_id] ?? { correct: 0, total: 0 }
    history[log.question_id] = {
      correct: prev.correct + (log.is_correct ? 1 : 0),
      total: prev.total + 1,
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const imageMap: Record<number, string[]> = {}
  for (const row of imageRows ?? []) {
    const url = `${supabaseUrl}/storage/v1/object/public/question-images/${row.storage_path}`
    if (!imageMap[row.question_id]) imageMap[row.question_id] = []
    imageMap[row.question_id].push(url)
  }

  return (
    <main className="w-full max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-4">
      <div>
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← ダッシュボード
        </Link>
        <div className="mt-2 text-xs font-mono text-indigo-400 font-medium">{subjectUpper}</div>
        <h1 className="text-base font-bold text-gray-900 leading-tight">{tagName}</h1>
        <div className="text-xs text-gray-400 mt-0.5">
          {SUBJECT_NAMES[subjectUpper]} · {questions.length} 問（横断演習）
        </div>
      </div>
      <QuizSession
        questions={questions}
        subject={subjectUpper}
        year={0}
        userId={user!.id}
        history={history}
        imageMap={imageMap}
        isReview={true}
        backHref="/dashboard"
      />
    </main>
  )
}
