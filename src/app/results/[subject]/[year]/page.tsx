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

const CONFIDENCE_LABEL: Record<string, string> = {
  confident: '確信あり',
  guess: 'なんとなく',
}

type QResult = {
  id: number
  question_number: number
  points: number
  question_tags: { tags: { name: string } | null }[]
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ subject: string; year: string }>
}) {
  const { subject, year } = await params
  const subjectUpper = subject.toUpperCase()

  if (!VALID_SUBJECTS.has(subjectUpper)) {
    return <NoRecord subjectUpper={subjectUpper} year={year} />
  }

  const yearNum = Number(year)
  if (!Number.isInteger(yearNum) || yearNum < 2000 || yearNum > 2100) {
    return <NoRecord subjectUpper={subjectUpper} year={year} />
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: completion } = await supabase
    .from('session_completions')
    .select('session_id, correct, total, points_earned, completed_at')
    .eq('user_id', user!.id)
    .eq('subject_code', subjectUpper)
    .eq('year', yearNum)
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()

  if (!completion) {
    return <NoRecord subjectUpper={subjectUpper} year={year} />
  }

  const [{ data: logs }, { data: rawQuestions }] = await Promise.all([
    supabase
      .from('user_logs')
      .select('question_id, is_correct, confidence_flag')
      .eq('session_id', completion.session_id),
    supabase
      .from('questions')
      .select('id, question_number, points, question_tags(tags(name))')
      .eq('subject_code', subjectUpper)
      .eq('year', yearNum)
      .order('question_number', { ascending: true }),
  ])

  const questions = (rawQuestions ?? []) as QResult[]
  const logMap = new Map((logs ?? []).map((l) => [l.question_id, l]))

  const completedAt = new Date(completion.completed_at).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ← ダッシュボード
          </Link>
          <div className="mt-2">
            <div className="text-xs font-mono text-indigo-400 font-medium">{subjectUpper}</div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">{SUBJECT_NAMES[subjectUpper]}</h1>
            <div className="text-xs text-gray-400 mt-0.5">{yearNum} 年度 · {completedAt}受講</div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold text-indigo-600">
            {completion.points_earned} <span className="text-base font-normal text-gray-400">/ 100 点</span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {completion.correct}/{completion.total} 問正解
          </div>
        </div>
      </div>

      {/* 問題一覧（2列グリッド） */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {questions.map((q) => {
          const log = logMap.get(q.id)
          const isCorrect = log?.is_correct ?? false
          const confidence = log?.confidence_flag
          const tags = q.question_tags.flatMap((qt) => (qt.tags ? [qt.tags.name] : []))

          return (
            <div
              key={q.id}
              className="flex items-center justify-between gap-4 bg-white border border-gray-100 rounded-xl px-4 py-3"
            >
              <Link
                href={`/quiz/${subjectUpper}/${yearNum}/${q.question_number}`}
                className="min-w-0 flex-1 hover:opacity-70 transition-opacity"
              >
                <span className="text-sm text-gray-700 font-medium">
                  第{String(q.question_number)}問
                  <span className="text-xs text-gray-400 ml-1.5">({q.points}点)</span>
                </span>
                {tags.length > 0 && (
                  <span className="ml-2 text-xs text-gray-400">{tags.join(' / ')}</span>
                )}
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                {confidence && (
                  <span className="text-xs text-gray-400">{CONFIDENCE_LABEL[confidence]}</span>
                )}
                {log ? (
                  isCorrect ? (
                    <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 rounded px-2 py-0.5">
                      ✓ 正解
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-2 py-0.5">
                      ✗ 不正解
                    </span>
                  )
                ) : (
                  <span className="text-xs text-gray-300">未記録</span>
                )}
                <Link
                  href={`/admin/${subjectUpper}/${yearNum}/${q.question_number}`}
                  className="text-xs text-gray-300 hover:text-indigo-400 transition-colors"
                  title="編集"
                >
                  ✎
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      {/* 再演習ボタン */}
      <Link
        href={`/quiz/${subjectUpper}/${yearNum}`}
        className="block w-full py-3 rounded-xl bg-indigo-600 text-white text-center text-sm font-semibold hover:bg-indigo-700 transition-colors"
      >
        この年度を再演習する →
      </Link>
    </main>
  )
}

function NoRecord({ subjectUpper, year }: { subjectUpper: string; year: string }) {
  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-4">
      <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
        ← ダッシュボード
      </Link>
      <p className="text-sm text-gray-500">
        {subjectUpper} {year} 年度の完走記録がまだありません。
      </p>
      <Link
        href={`/quiz/${subjectUpper}/${year}`}
        className="inline-block text-sm text-indigo-600 hover:text-indigo-800"
      >
        演習を開始する →
      </Link>
    </main>
  )
}
