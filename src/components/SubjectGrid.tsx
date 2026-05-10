'use client'

import { useState } from 'react'
import Link from 'next/link'

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

export type YearRow = { subject_code: string; year: number; count: number }

export default function SubjectGrid({ rows }: { rows: YearRow[] }) {
  const [open, setOpen] = useState<string | null>(null)

  const bySubject = SUBJECT_ORDER.reduce<Record<string, YearRow[]>>((acc, code) => {
    acc[code] = rows
      .filter((r) => r.subject_code === code)
      .sort((a, b) => b.year - a.year)
    return acc
  }, {})

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {SUBJECT_ORDER.map((code) => {
        const years = bySubject[code]
        const isOpen = open === code
        return (
          <div key={code} className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <button
              className="w-full text-left px-4 py-3 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors"
              onClick={() => setOpen(isOpen ? null : code)}
            >
              <div className="text-xs font-mono text-indigo-500 font-medium">{code}</div>
              <div className="text-sm font-semibold text-gray-800 mt-0.5 leading-tight">
                {SUBJECT_NAMES[code]}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {years.length > 0 ? `${years.length} 年度` : 'データなし'}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 bg-gray-50">
                {years.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-gray-400">データなし</p>
                ) : (
                  years.map((r) => (
                    <Link
                      key={r.year}
                      href={`/quiz/${code}/${r.year}`}
                      className="flex items-center justify-between px-4 py-2.5 text-sm text-indigo-600 hover:bg-indigo-50 border-b border-gray-100 last:border-0 transition-colors"
                    >
                      <span>{r.year} 年度</span>
                      <span className="text-xs text-gray-400">{r.count} 問 →</span>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
