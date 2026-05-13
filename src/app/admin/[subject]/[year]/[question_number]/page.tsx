import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import QuestionEditor from '@/components/QuestionEditor'

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

export default async function AdminQuestionPage({
  params,
}: {
  params: Promise<{ subject: string; year: string; question_number: string }>
}) {
  const { subject, year, question_number } = await params
  const subjectUpper = subject.toUpperCase()

  if (!VALID_SUBJECTS.has(subjectUpper)) notFound()

  const yearNum = Number(year)
  if (!Number.isInteger(yearNum) || yearNum < 2000 || yearNum > 2100) notFound()

  const qNum = Number(question_number)
  if (isNaN(qNum)) notFound()

  const supabase = await createClient()
  const { data: question } = await supabase
    .from('questions')
    .select('*')
    .eq('subject_code', subjectUpper)
    .eq('year', yearNum)
    .eq('question_number', qNum)
    .single()

  if (!question) notFound()

  const { data: images } = await supabase
    .from('question_images')
    .select('id, storage_path, display_order')
    .eq('question_id', question.id)
    .order('display_order', { ascending: true })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const imageUrls = (images ?? []).map((img) => ({
    id: img.id,
    url: `${supabaseUrl}/storage/v1/object/public/question-images/${img.storage_path}`,
    display_order: img.display_order,
  }))

  return (
    <main className="max-w-4xl mx-auto px-4 md:px-8 py-8 space-y-6">
      <div>
        <Link
          href={`/admin/${subjectUpper}/${yearNum}`}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← {yearNum} 年度一覧
        </Link>
        <div className="mt-2">
          <div className="text-xs font-mono text-indigo-400 font-medium">{subjectUpper}</div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">{SUBJECT_NAMES[subjectUpper]}</h1>
          <div className="text-xs text-gray-400 mt-0.5">
            {yearNum} 年度 · 第{qNum}問 · {question.points}点
          </div>
        </div>
      </div>

      <QuestionEditor
        questionId={question.id}
        initialQuestionText={question.question_text}
        initialExplanation={question.explanation ?? ''}
        images={imageUrls}
      />
    </main>
  )
}
