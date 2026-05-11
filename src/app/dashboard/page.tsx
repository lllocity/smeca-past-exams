import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const SUBJECT_NAMES: Record<string, string> = {
  ECO: '経済学・経済政策',
  FIN: '財務・会計',
  MGT: '企業経営理論',
  OPS: '運営管理',
  LAW: '経営法務',
  MIS: '経営情報システム',
  SME: '中小企業経営・中小企業政策',
}
const SUBJECT_ORDER = ['ECO', 'FIN', 'MGT', 'OPS', 'LAW', 'MIS', 'SME']

type RawLog = {
  question_id: number
  is_correct: boolean
  answered_at: string
  questions: {
    subject_code: string
    year: number
    question_number: number
    question_tags: { tags: { name: string } | null }[]
  } | null
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: completions }, { data: rawLogs }] = await Promise.all([
    // 完走セッション → 科目×年度バー用
    supabase
      .from('session_completions')
      .select('subject_code, year, correct, total, completed_at')
      .eq('user_id', user!.id)
      .order('completed_at', { ascending: false }),
    // 個別回答ログ → 苦手問題・日別用
    supabase
      .from('user_logs')
      .select(
        'question_id, is_correct, answered_at, questions(subject_code, year, question_number, question_tags(tags(name)))',
      )
      .eq('user_id', user!.id)
      .order('answered_at', { ascending: false }),
  ])

  const logs = (rawLogs ?? []) as RawLog[]

  // ① 科目×年度別 最新セッション正答率（session_completions から）
  type SubjectYearScore = {
    subject: string
    year: number
    correct: number
    total: number
    pct: number
  }
  const subjectYearMap = new Map<string, SubjectYearScore>()
  for (const c of completions ?? []) {
    const key = `${c.subject_code}::${c.year}`
    if (!subjectYearMap.has(key)) {
      subjectYearMap.set(key, {
        subject: c.subject_code,
        year: c.year,
        correct: c.correct,
        total: c.total,
        pct: Math.round((c.correct / c.total) * 100),
      })
    }
  }
  const subjectYearScores = [...subjectYearMap.values()].sort((a, b) => {
    const si = SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject)
    return si !== 0 ? si : b.year - a.year
  })

  // ② 苦手問題リスト（user_logs から・科目ごと年度横断・複数回のみ）
  type QStats = {
    question_id: number
    year: number
    question_number: number
    correct: number
    total: number
    tags: string[]
  }
  const subjectQMap = new Map<string, Map<number, QStats>>()
  for (const log of logs) {
    const q = log.questions
    if (!q) continue
    if (!subjectQMap.has(q.subject_code)) subjectQMap.set(q.subject_code, new Map())
    const qm = subjectQMap.get(q.subject_code)!
    const prev = qm.get(log.question_id) ?? {
      question_id: log.question_id,
      year: q.year,
      question_number: q.question_number,
      correct: 0,
      total: 0,
      tags: q.question_tags.flatMap((qt) => (qt.tags ? [qt.tags.name] : [])),
    }
    qm.set(log.question_id, {
      ...prev,
      correct: prev.correct + (log.is_correct ? 1 : 0),
      total: prev.total + 1,
    })
  }
  const weakBySubject = SUBJECT_ORDER.flatMap((subject) => {
    const qm = subjectQMap.get(subject)
    if (!qm) return []
    const multi = [...qm.values()].filter((q) => q.total >= 2)
    if (multi.length === 0) return []
    const top3 = multi
      .sort((a, b) => a.correct / a.total - b.correct / b.total)
      .slice(0, 3)
    return [{ subject, questions: top3 }]
  })

  // ③ 日別解答数（直近30日）
  const today = new Date()
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (29 - i))
    return { date: d.toISOString().slice(0, 10), count: 0 }
  })
  const cutoff = days[0].date
  for (const log of logs) {
    const date = log.answered_at.slice(0, 10)
    if (date < cutoff) continue
    const day = days.find((d) => d.date === date)
    if (day) day.count++
  }
  const maxDaily = Math.max(...days.map((d) => d.count), 1)

  return (
    <main className="max-w-4xl mx-auto px-4 md:px-8 py-8 space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ダッシュボード</h1>
          <p className="text-sm text-gray-500 mt-0.5">学習の進捗と傾向</p>
        </div>
        <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors">
          ← 科目選択へ
        </Link>
      </div>

      {/* 科目×年度 直近セッション正答率 */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          科目×年度 直近セッション正答率
        </h2>
        {subjectYearScores.length === 0 ? (
          <p className="text-sm text-gray-400">まだ完走記録がありません</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            {subjectYearScores.map(({ subject, year, correct, total, pct }) => (
              <Link
                key={`${subject}::${year}`}
                href={`/quiz/${subject}/${year}`}
                className="block hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2 transition-colors"
              >
                <div className="flex justify-between items-baseline mb-1">
                  <div>
                    <span className="text-sm font-semibold text-gray-800">{subject} {year}</span>
                    <span className="text-xs text-gray-400 ml-2">— {SUBJECT_NAMES[subject]}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {pct}%（{correct}/{total}問正解）
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: pct >= 70 ? '#4ade80' : pct >= 50 ? '#facc15' : '#f87171',
                    }}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 苦手問題リスト */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          苦手問題（科目別・複数回解いた問題）
        </h2>
        {weakBySubject.length === 0 ? (
          <p className="text-sm text-gray-400">複数回解いた問題がまだありません</p>
        ) : (
          <div className="space-y-4">
            {weakBySubject.map(({ subject, questions }) => (
              <div key={subject} className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="text-xs font-semibold text-indigo-500 mb-3">
                  {subject} — {SUBJECT_NAMES[subject]}
                </div>
                <div className="space-y-2">
                  {questions.map((q) => {
                    const pct = Math.round((q.correct / q.total) * 100)
                    return (
                      <Link
                        key={q.question_id}
                        href={`/quiz/${subject}/${q.year}/${q.question_number}`}
                        className="flex items-start justify-between gap-4 text-sm hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2 transition-colors"
                      >
                        <div className="min-w-0">
                          <span className="text-gray-700 font-medium">
                            {q.year} 第{String(q.question_number)}問
                          </span>
                          {q.tags.length > 0 && (
                            <span className="ml-2 text-xs text-gray-400">{q.tags.join(' / ')}</span>
                          )}
                        </div>
                        <span
                          className={`shrink-0 text-xs font-semibold ${
                            pct < 50 ? 'text-red-500' : 'text-yellow-500'
                          }`}
                        >
                          {pct}%（{q.correct}/{q.total}回）
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 日別解答数 */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          日別解答数（直近30日）
        </h2>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-end gap-px h-28">
            {days.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                {d.count > 0 && (
                  <span className="text-[9px] text-indigo-400 leading-none">{d.count}</span>
                )}
                <div
                  className="w-full rounded-t bg-indigo-300"
                  style={{
                    height: d.count > 0 ? `${Math.max(4, (d.count / maxDaily) * 80)}px` : '2px',
                    opacity: d.count > 0 ? 1 : 0.2,
                  }}
                  title={`${d.date}: ${d.count}問`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-300 mt-2">
            <span>{days[0].date.slice(5)}</span>
            <span>今日</span>
          </div>
        </div>
      </section>
    </main>
  )
}
