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

export default async function AdminPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('questions').select('subject_code, year')

  const map = new Map<string, { subject: string; year: number; count: number }>()
  for (const row of data ?? []) {
    const key = `${row.subject_code}::${row.year}`
    const prev = map.get(key)
    map.set(key, { subject: row.subject_code, year: row.year, count: (prev?.count ?? 0) + 1 })
  }

  const rows = [...map.values()].sort((a, b) => {
    const si = SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject)
    return si !== 0 ? si : b.year - a.year
  })

  const bySubject = SUBJECT_ORDER.flatMap((s) => {
    const years = rows.filter((r) => r.subject === s)
    return years.length ? [{ subject: s, years }] : []
  })

  return (
    <main className="max-w-4xl mx-auto px-4 md:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">管理画面</h1>
          <p className="text-sm text-gray-500 mt-0.5">問題の編集・画像管理</p>
        </div>
        <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors">
          ← トップへ
        </Link>
      </div>

      <div className="space-y-6">
        {bySubject.map(({ subject, years }) => (
          <section key={subject}>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              {subject} — {SUBJECT_NAMES[subject]}
            </h2>
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
              {years.map(({ year, count }) => (
                <Link
                  key={year}
                  href={`/admin/${subject}/${year}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-800">{year} 年度</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{count} 問</span>
                    <span className="text-xs text-indigo-500">編集 →</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
