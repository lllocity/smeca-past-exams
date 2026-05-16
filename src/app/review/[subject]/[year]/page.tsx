import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import QuizSession from '@/components/QuizSession'

const VALID_SUBJECTS = new Set(['ECO', 'FIN', 'MGT', 'OPS', 'LAW', 'MIS', 'SME'])

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ subject: string; year: string }>
}) {
  const { subject, year } = await params
  const subjectUpper = subject.toUpperCase()

  if (!VALID_SUBJECTS.has(subjectUpper)) notFound()

  const yearNum = Number(year)
  if (!Number.isInteger(yearNum) || yearNum < 2000 || yearNum > 2100) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 直近の session_completions から session_id を取得
  const { data: completion } = await supabase
    .from('session_completions')
    .select('session_id')
    .eq('user_id', user!.id)
    .eq('subject_code', subjectUpper)
    .eq('year', yearNum)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!completion) notFound()

  // 不正解 OR 勘で正解の question_id を取得
  const { data: reviewLogs } = await supabase
    .from('user_logs')
    .select('question_id')
    .eq('session_id', completion.session_id)
    .or('is_correct.eq.false,confidence_flag.eq.guess')

  const reviewIds = (reviewLogs ?? []).map((l) => l.question_id)

  if (reviewIds.length === 0) {
    return (
      <main className="w-full max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-4">
        <Link
          href={`/results/${subjectUpper}/${yearNum}`}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← 結果に戻る
        </Link>
        <p className="text-sm text-gray-500">
          復習対象はありません（全問正解かつ確信あり）。
        </p>
      </main>
    )
  }

  const [{ data: rawQuestions }, { data: histLogs }, { data: imageRows }] = await Promise.all([
    supabase
      .from('questions')
      .select('*')
      .in('id', reviewIds)
      .order('question_number', { ascending: true }),
    supabase
      .from('user_logs')
      .select('question_id, is_correct')
      .in('question_id', reviewIds)
      .eq('user_id', user!.id),
    supabase
      .from('question_images')
      .select('question_id, storage_path, display_order')
      .in('question_id', reviewIds)
      .order('display_order'),
  ])

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
    <main className="w-full max-w-6xl mx-auto px-4 md:px-8 py-8">
      <QuizSession
        questions={rawQuestions ?? []}
        subject={subjectUpper}
        year={yearNum}
        userId={user!.id}
        history={history}
        imageMap={imageMap}
        isReview={true}
      />
    </main>
  )
}
