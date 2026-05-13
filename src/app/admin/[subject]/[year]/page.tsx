import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

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

export default async function AdminYearPage({
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
    .select('id, question_number, points, correct_answer, question_tags(tags(name))')
    .eq('subject_code', subjectUpper)
    .eq('year', yearNum)
    .order('question_number', { ascending: true })

  if (!questions || questions.length === 0) notFound()

  // 画像の有無をチェック
  const questionIds = questions.map((q) => q.id)
  const { data: images } = await supabase
    .from('question_images')
    .select('question_id')
    .in('question_id', questionIds)

  const hasImage = new Set((images ?? []).map((i) => i.question_id))

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← 管理トップ
          </Link>
          <div className="mt-2">
            <div className="text-xs font-mono text-indigo-400 font-medium">{subjectUpper}</div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">{SUBJECT_NAMES[subjectUpper]}</h1>
            <div className="text-xs text-gray-400 mt-0.5">{yearNum} 年度 · {questions.length} 問</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {questions.map((q) => {
          const tags = (q.question_tags as { tags: { name: string } | null }[])
            .flatMap((qt) => (qt.tags ? [qt.tags.name] : []))
          return (
            <Link
              key={q.id}
              href={`/admin/${subjectUpper}/${yearNum}/${q.question_number}`}
              className="flex items-center justify-between gap-4 bg-white border border-gray-100 rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium text-gray-800">
                  第{q.question_number}問
                  <span className="text-xs text-gray-400 ml-1.5">({q.points}点)</span>
                </span>
                {tags.length > 0 && (
                  <span className="ml-2 text-xs text-gray-400">{tags.join(' / ')}</span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {hasImage.has(q.id) && (
                  <span className="text-xs text-amber-500">🖼</span>
                )}
                <span className="text-xs text-gray-400">正解: {q.correct_answer}</span>
                <span className="text-xs text-indigo-500">編集 →</span>
              </div>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
