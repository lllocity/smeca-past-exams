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

  const { data: histLogs } = await supabase
    .from('user_logs')
    .select('question_id, is_correct')
    .eq('user_id', user!.id)
    .in('question_id', questions.map((q) => q.id))

  const history: Record<number, { correct: number; total: number }> = {}
  for (const log of histLogs ?? []) {
    if (!history[log.question_id]) history[log.question_id] = { correct: 0, total: 0 }
    history[log.question_id].correct += log.is_correct ? 1 : 0
    history[log.question_id].total += 1
  }

  return (
    <main className="max-w-4xl mx-auto px-4 md:px-8 py-6">
      <QuizSession
        questions={questions}
        subject={subjectUpper}
        year={yearNum}
        userId={user!.id}
        history={history}
      />
    </main>
  )
}
