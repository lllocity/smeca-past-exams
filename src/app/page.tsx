import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: subjects, error } = await supabase.from('subjects').select('*')

  return (
    <main className="p-8 font-sans">
      <h1 className="text-2xl font-bold mb-4">Supabase 接続テスト</h1>

      {error ? (
        <div className="rounded bg-red-100 p-4 text-red-800">
          <p className="font-semibold">接続エラー</p>
          <pre className="mt-2 text-sm">{error.message}</pre>
        </div>
      ) : (
        <div className="rounded bg-green-100 p-4 text-green-800">
          <p className="font-semibold">接続成功 — subjects テーブル ({subjects?.length} 件)</p>
          <ul className="mt-2 space-y-1 text-sm">
            {subjects?.map((s) => (
              <li key={s.code}>
                <span className="font-mono">{s.code}</span>　{s.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  )
}
