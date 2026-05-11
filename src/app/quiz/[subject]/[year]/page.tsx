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
  const { data: questions } = await supabase
    .from('questions')
    .select('*')
    .eq('subject_code', subjectUpper)
    .eq('year', yearNum)
    .order('question_number', { ascending: true })

  if (!questions || questions.length === 0) notFound()

  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main className="max-w-4xl mx-auto px-4 md:px-8 py-6">
      <QuizSession questions={questions} subject={subjectUpper} year={yearNum} userId={user!.id} />
    </main>
  )
}
