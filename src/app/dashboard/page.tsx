import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  buildSubjectYearScores,
  buildWeakBySubject,
  buildDailyCount,
  buildTagStats,
  type RawLog,
  type RawCompletion,
} from '@/lib/dashboard-utils'

const SUBJECT_NAMES: Record<string, string> = {
  ECO: '経済学・経済政策',
  FIN: '財務・会計',
  MGT: '企業経営理論',
  OPS: '運営管理',
  LAW: '経営法務',
  MIS: '経営情報システム',
  SME: '中小企業経営・中小企業政策',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: completions }, { data: rawLogs }] = await Promise.all([
    supabase
      .from('session_completions')
      .select('subject_code, year, correct, total, points_earned, completed_at')
      .eq('user_id', user!.id)
      .order('completed_at', { ascending: false }),
    supabase
      .from('user_logs')
      .select(
        'question_id, is_correct, answered_at, questions(subject_code, year, question_number, question_tags(tags(name)))',
      )
      .eq('user_id', user!.id)
      .order('answered_at', { ascending: false }),
  ])

  const logs = (rawLogs ?? []) as RawLog[]
  const subjectYearScores = buildSubjectYearScores((completions ?? []) as RawCompletion[])
  const weakBySubject = buildWeakBySubject(logs)
  const tagStats = buildTagStats(logs)
  const { days, maxDaily } = buildDailyCount(logs)

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ダッシュボード</h1>
          <p className="text-sm text-gray-500 mt-0.5">学習の進捗と傾向</p>
        </div>
        <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors">
          ← 科目選択へ
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* 左列: 科目×年度 正答率 + 日別解答数 */}
        <div className="space-y-8">
          {/* 科目×年度 直近セッション正答率 */}
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              科目×年度 直近セッション正答率
            </h2>
            {subjectYearScores.length === 0 ? (
              <p className="text-sm text-gray-400">まだ完走記録がありません</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
                {subjectYearScores.map(({ subject, year, correct, total, points }) => (
                  <Link
                    key={`${subject}::${year}`}
                    href={`/results/${subject}/${year}`}
                    className="block hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2 transition-colors"
                  >
                    <div className="flex justify-between items-baseline mb-1">
                      <div>
                        <span className="text-sm font-semibold text-gray-800">{subject} {year}</span>
                        <span className="text-xs text-gray-400 ml-2">— {SUBJECT_NAMES[subject]}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {points}点（{correct}/{total}問正解）
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${points}%`,
                          backgroundColor: points >= 70 ? '#4ade80' : points >= 50 ? '#facc15' : '#f87171',
                        }}
                      />
                    </div>
                  </Link>
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
        </div>

        {/* 右列: 苦手問題リスト + 論点別正解率 */}
        <div className="space-y-8">
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

        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            論点別正解率（苦手タグ）
          </h2>
          {tagStats.length === 0 ? (
            <p className="text-sm text-gray-400">タグ付き問題の解答がまだありません</p>
          ) : (
            <div className="space-y-4">
              {tagStats.map(({ subject, tags }) => (
                <div key={subject} className="bg-white rounded-xl border border-gray-100 p-5">
                  <div className="text-xs font-semibold text-indigo-500 mb-3">
                    {subject} — {SUBJECT_NAMES[subject]}
                  </div>
                  <div className="space-y-1.5">
                    {tags.map(({ tagName, correct, total }) => {
                      const pct = Math.round((correct / total) * 100)
                      return (
                        <Link
                          key={tagName}
                          href={`/quiz/${subject}/tag/${encodeURIComponent(tagName)}`}
                          className="flex items-center justify-between gap-4 text-sm hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2 transition-colors"
                        >
                          <span className="text-gray-700 font-medium truncate">{tagName}</span>
                          <span className={`shrink-0 text-xs font-semibold ${pct < 50 ? 'text-red-500' : 'text-yellow-500'}`}>
                            {pct}%（{correct}/{total}回）
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
        </div>
      </div>
    </main>
  )
}
