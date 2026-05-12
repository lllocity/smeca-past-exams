'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import type { Database } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'

type Question = Database['public']['Tables']['questions']['Row']
type Option = { label: string; text: string }

const SUBJECT_NAMES: Record<string, string> = {
  ECO: '経済学・経済政策',
  FIN: '財務・会計',
  MGT: '企業経営理論',
  OPS: '運営管理',
  LAW: '経営法務',
  MIS: '経営情報システム',
  SME: '中小企業経営・中小企業政策',
}

export default function QuizSession({
  questions,
  subject,
  year,
  userId,
  history,
}: {
  questions: Question[]
  subject: string
  year: number
  userId: string
  history: Record<number, { correct: number; total: number }>
}) {
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [confidenceFlag, setConfidenceFlag] = useState<'confident' | 'guess' | null>(null)
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0)
  const [score, setScore] = useState({ correct: 0, answered: 0, points: 0 })
  const completionLoggedRef = useRef(false)

  const total = questions.length
  const isFinished = currentIndex >= total
  const question = isFinished ? null : questions[currentIndex]
  const isAnswered = selectedAnswer !== null
  const isAllCorrect = question?.correct_answer === '全員正解'

  // 通しで完走したときだけ session_completions へ記録
  useEffect(() => {
    if (!isFinished || completionLoggedRef.current) return
    completionLoggedRef.current = true
    createClient()
      .from('session_completions')
      .insert({
        user_id: userId,
        session_id: sessionId,
        subject_code: subject,
        year: year,
        correct: score.correct,
        total: total,
        points_earned: score.points,
      })
      .then(({ error }) => {
        if (error) console.error('[session_completions] insert failed:', error)
      })
  }, [isFinished, sessionId, userId, subject, year, score.correct, total])

  function handleSelect(label: string) {
    if (isAnswered || !question) return
    setSelectedAnswer(label)
    const correct = isAllCorrect || label === question.correct_answer
    setScore((s) => ({
      correct: s.correct + (correct ? 1 : 0),
      answered: s.answered + 1,
      points: s.points + (correct ? question.points : 0),
    }))
  }

  async function handleConfidence(flag: 'confident' | 'guess') {
    if (!question) return
    setConfidenceFlag(flag)
    const supabase = createClient()
    await supabase.from('user_logs').insert({
      user_id: userId,
      session_id: sessionId,
      question_id: question.id,
      is_correct: true,
      confidence_flag: flag,
    })
  }

  async function handleIncorrectNext() {
    if (!question) return
    const supabase = createClient()
    await supabase.from('user_logs').insert({
      user_id: userId,
      session_id: sessionId,
      question_id: question.id,
      is_correct: false,
      confidence_flag: null,
    })
    handleNext()
  }

  function handleNext() {
    setCurrentIndex((i) => i + 1)
    setSelectedAnswer(null)
    setConfidenceFlag(null)
  }

  function handleReset() {
    setCurrentIndex(0)
    setSelectedAnswer(null)
    setConfidenceFlag(null)
    setScore({ correct: 0, answered: 0, points: 0 })
    setSessionId(crypto.randomUUID())
    completionLoggedRef.current = false
  }

  function optionStyle(label: string): string {
    const base =
      'w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors '
    if (!isAnswered) {
      return base + 'border-gray-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 active:bg-indigo-100'
    }
    const isCorrectLabel = isAllCorrect || label === question?.correct_answer
    if (isCorrectLabel) {
      return base + 'border-green-400 bg-green-50 text-green-800'
    }
    if (label === selectedAnswer) {
      return base + 'border-red-400 bg-red-50 text-red-800'
    }
    return base + 'border-gray-100 bg-gray-50 text-gray-400'
  }

  // 最終スコア画面
  if (isFinished) {
    return (
      <div className="text-center py-12 space-y-6">
        <div>
          <p className="text-sm text-gray-500">{SUBJECT_NAMES[subject]} {year} 年度</p>
          <h2 className="text-2xl font-bold text-gray-900 mt-1">演習完了</h2>
        </div>
        <div className="inline-flex flex-col items-center bg-indigo-50 rounded-2xl px-10 py-6">
          <div className="flex items-baseline gap-1">
            <span className="text-6xl font-bold text-indigo-600">{score.points}</span>
            <span className="text-xl text-gray-400 font-medium">/ 100 点</span>
          </div>
          <span className="text-sm text-gray-400 mt-3">
            正解 {score.correct} / {total} 問（満点 {totalPoints} 点）
          </span>
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={handleReset}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
          >
            もう一度
          </button>
          <Link
            href="/dashboard"
            className="w-full py-3 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-center text-sm font-semibold hover:bg-indigo-100 transition-colors"
          >
            ダッシュボードを確認
          </Link>
          <Link
            href="/"
            className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 text-center text-sm hover:bg-gray-50 transition-colors"
          >
            科目選択に戻る
          </Link>
        </div>
      </div>
    )
  }

  const options = (question!.options as Option[]) ?? []
  const questionHistory = history[question!.id]

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-4 mb-1">
        <Link href="/" className="flex items-center gap-1 text-gray-400 hover:text-gray-600 mt-0.5 shrink-0">
          <span className="text-sm">←</span>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-mono text-indigo-400 font-medium">{subject}</div>
          <div className="text-base font-bold text-gray-800 leading-tight">{SUBJECT_NAMES[subject]}</div>
          <div className="text-xs text-gray-400 mt-0.5">{year} 年度 · 全 {total} 問</div>
        </div>
        <span className="text-sm font-semibold text-indigo-600 shrink-0 mt-1">
          {score.correct} / {score.answered} 問正解
        </span>
      </div>

      {/* 進捗バー */}
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-400 rounded-full transition-all"
          style={{ width: `${((currentIndex) / total) * 100}%` }}
        />
      </div>

      {/* 問題ヘッダー */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>第 {String(question!.question_number)} 問 / 全 {total} 問</span>
        <span>{question!.points} 点</span>
      </div>

      {/* 問題文 */}
      <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed bg-white rounded-xl border border-gray-100 p-4">
        <ReactMarkdown>{question!.question_text}</ReactMarkdown>
      </div>

      {/* 選択肢 */}
      <div className="space-y-2">
        {options.map((opt) => (
          <button
            key={opt.label}
            onClick={() => handleSelect(opt.label)}
            disabled={isAnswered}
            className={optionStyle(opt.label)}
          >
            <span className="font-semibold mr-2">{opt.label}</span>
            {opt.text}
          </button>
        ))}
      </div>

      {/* 解説 */}
      {isAnswered && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isAllCorrect || selectedAnswer === question!.correct_answer ? (
                <span className="text-green-600 font-semibold text-sm">✓ 正解</span>
              ) : (
                <span className="text-red-600 font-semibold text-sm">✗ 不正解</span>
              )}
              {!isAllCorrect && (
                <span className="text-xs text-gray-500">
                  正解: {question!.correct_answer}
                </span>
              )}
              {isAllCorrect && (
                <span className="text-xs text-gray-500">全員正解問題</span>
              )}
            </div>
            <span className="text-xs text-gray-400">
              {questionHistory
                ? `過去の正答率: ${Math.round((questionHistory.correct / questionHistory.total) * 100)}%（${questionHistory.correct}/${questionHistory.total}回）`
                : '初挑戦'}
            </span>
          </div>
          {question!.explanation && (
            <div className="prose prose-sm max-w-none text-gray-700">
              <ReactMarkdown>{question!.explanation}</ReactMarkdown>
            </div>
          )}
        </div>
      )}

      {/* 自信度フラグ（正解時のみ） */}
      {isAnswered && (isAllCorrect || selectedAnswer === question!.correct_answer) && !confidenceFlag && (
        <div className="space-y-2">
          <p className="text-xs text-center text-gray-400">この問題の自信度は？</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleConfidence('confident')}
              className="py-3 rounded-xl border-2 border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-semibold hover:bg-indigo-100 transition-colors"
            >
              確信あり ✓
            </button>
            <button
              onClick={() => handleConfidence('guess')}
              className="py-3 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-600 text-sm font-semibold hover:bg-gray-100 transition-colors"
            >
              なんとなく・勘 ?
            </button>
          </div>
        </div>
      )}

      {/* 次へボタン（不正解時は即表示、正解時は自信度選択後） */}
      {isAnswered && (
        ((!isAllCorrect && selectedAnswer !== question!.correct_answer)) ||
        confidenceFlag
      ) && (
        <button
          onClick={(!isAllCorrect && selectedAnswer !== question!.correct_answer) && !confidenceFlag
            ? handleIncorrectNext
            : handleNext}
          className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
        >
          {currentIndex + 1 < total ? '次の問題へ →' : '結果を見る'}
        </button>
      )}
    </div>
  )
}
