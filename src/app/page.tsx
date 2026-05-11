import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SubjectGrid, { type YearRow } from '@/components/SubjectGrid'
import SignOutButton from '@/components/SignOutButton'

export default async function Home() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('questions')
    .select('subject_code, year')

  // subject_code + year ごとに件数を集計
  const countMap = new Map<string, number>()
  for (const row of data ?? []) {
    const key = `${row.subject_code}::${row.year}`
    countMap.set(key, (countMap.get(key) ?? 0) + 1)
  }

  const rows: YearRow[] = Array.from(countMap.entries()).map(([key, count]) => {
    const [subject_code, year] = key.split('::')
    return { subject_code, year: Number(year), count }
  })

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-900">中小企業診断士</h1>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
            ダッシュボード
          </Link>
          <SignOutButton />
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-6">科目・年度を選んで演習を開始してください</p>
      <SubjectGrid rows={rows} />
    </main>
  )
}
