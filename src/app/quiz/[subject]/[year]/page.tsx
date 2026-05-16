import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import QuizSession from '@/components/QuizSession'

const VALID_SUBJECTS = new Set(['ECO', 'FIN', 'MGT', 'OPS', 'LAW', 'MIS', 'SME'])

export default async function QuizPage({
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
  const [{ data: questions }, { data: { user } }] = await Promise.all([
    supabase
      .from('questions')
      .select('*')
      .eq('subject_code', subjectUpper)
      .eq('year', yearNum)
      .order('question_number', { ascending: true }),
    supabase.auth.getUser(),
  ])

  if (!questions || questions.length === 0) notFound()

  const questionIds = questions.map((q) => q.id)
  const [{ data: histLogs }, { data: imageRows }] = await Promise.all([
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

  const history: Record<number, { correct: number; total: number }> = {}
  for (const log of histLogs ?? []) {
    if (!history[log.question_id]) history[log.question_id] = { correct: 0, total: 0 }
    history[log.question_id].correct += log.is_correct ? 1 : 0
    history[log.question_id].total += 1
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const imageMap: Record<number, string[]> = {}
  for (const img of imageRows ?? []) {
    if (!imageMap[img.question_id]) imageMap[img.question_id] = []
    imageMap[img.question_id].push(
      `${supabaseUrl}/storage/v1/object/public/question-images/${img.storage_path}`,
    )
  }

  return (
    <main className="w-full max-w-6xl mx-auto px-4 md:px-8 py-6">
      <QuizSession
        questions={questions}
        subject={subjectUpper}
        year={yearNum}
        userId={user!.id}
        history={history}
        imageMap={imageMap}
      />
    </main>
  )
}
