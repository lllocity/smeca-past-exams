import { notFound } from 'next/navigation'
import Link from 'next/link'
import MarkdownRenderer from '@/components/MarkdownRenderer'
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

type Option = { label: string; text: string }

export default async function QuestionPermalinkPage({
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
  const [{ data: question }, { data: { user } }] = await Promise.all([
    supabase
      .from('questions')
      .select('*')
      .eq('subject_code', subjectUpper)
      .eq('year', yearNum)
      .eq('question_number', qNum)
      .single(),
    supabase.auth.getUser(),
  ])

  if (!question) notFound()

  const [{ data: histLogs }, { data: imageRows }] = await Promise.all([
    supabase
      .from('user_logs')
      .select('is_correct')
      .eq('user_id', user!.id)
      .eq('question_id', question.id),
    supabase
      .from('question_images')
      .select('storage_path, display_order')
      .eq('question_id', question.id)
      .order('display_order', { ascending: true }),
  ])

  const histCorrect = (histLogs ?? []).filter((l) => l.is_correct).length
  const histTotal = (histLogs ?? []).length

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const imageUrls = (imageRows ?? []).map(
    (img) => `${supabaseUrl}/storage/v1/object/public/question-images/${img.storage_path}`,
  )

  const options = (question.options as Option[]) ?? []
  const isAllCorrect = question.correct_answer === '全員正解'

  return (
    <main className="w-full max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-4">
      {/* ヘッダー */}
      <div className="flex items-start gap-4">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm mt-0.5 shrink-0">
          ←
        </Link>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-mono text-indigo-400 font-medium">{subjectUpper}</div>
          <div className="text-base font-bold text-gray-800 leading-tight">{SUBJECT_NAMES[subjectUpper]}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {yearNum} 年度 · 第{question_number}問 · {question.points}点
          </div>
        </div>
        <span className="text-xs text-gray-400 shrink-0 mt-1">
          {histTotal > 0
            ? `過去の正答率: ${Math.round((histCorrect / histTotal) * 100)}%（${histCorrect}/${histTotal}回）`
            : '未解答'}
        </span>
      </div>

      {/* 問題文 */}
      <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed bg-white rounded-xl border border-gray-100 p-4">
        <MarkdownRenderer>{question.question_text}</MarkdownRenderer>
      </div>

      {/* 問題画像 */}
      {imageUrls.length > 0 && (
        <div className="space-y-2">
          {imageUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={url} alt={`問題図 ${i + 1}`} className="w-full rounded-xl border border-gray-100" />
          ))}
        </div>
      )}

      {/* 選択肢（正解を緑表示） */}
      <div className="space-y-2">
        {options.map((opt) => {
          const isCorrect = isAllCorrect || opt.label === question.correct_answer
          return (
            <div
              key={opt.label}
              className={`w-full px-4 py-3 rounded-lg border text-sm ${
                isCorrect
                  ? 'border-green-400 bg-green-50 text-green-800'
                  : 'border-gray-100 bg-gray-50 text-gray-400'
              }`}
            >
              <span className="font-semibold mr-2">{opt.label}</span>
              {opt.text}
            </div>
          )
        })}
      </div>

      {/* 解説 */}
      {question.explanation && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-1">
          <div className="text-xs font-semibold text-green-600">
            {isAllCorrect ? '全員正解問題' : `正解: ${question.correct_answer}`}
          </div>
          <div className="prose prose-sm max-w-none text-gray-700">
            <MarkdownRenderer>{question.explanation}</MarkdownRenderer>
          </div>
        </div>
      )}
    </main>
  )
}
