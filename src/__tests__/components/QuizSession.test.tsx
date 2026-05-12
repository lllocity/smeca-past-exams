import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import QuizSession from '@/components/QuizSession'
import type { Database } from '@/lib/supabase/types'

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockInsert = vi.fn().mockResolvedValue({ error: null })

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      insert: mockInsert,
    }),
  }),
}))

// ── react-markdown mock（jsdom では未サポートの ESM を回避） ──────────────────

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <>{children}</>,
}))

// ── fixtures ──────────────────────────────────────────────────────────────────

type Question = Database['public']['Tables']['questions']['Row']

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 1,
    subject_code: 'ECO',
    year: 2023,
    question_number: 1,
    points: 4,
    question_text: '設問テキスト',
    options: [
      { label: 'ア', text: '選択肢A' },
      { label: 'イ', text: '選択肢B' },
      { label: 'ウ', text: '選択肢C' },
    ],
    correct_answer: 'ア',
    explanation: '解説テキスト',
    image_url: null,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

const defaultProps = {
  subject: 'ECO',
  year: 2023,
  userId: 'user-123',
  history: {},
}

// ── helpers ───────────────────────────────────────────────────────────────────

function renderQuiz(questions: Question[], historyOverride?: Record<number, { correct: number; total: number }>) {
  return render(
    <QuizSession
      {...defaultProps}
      questions={questions}
      history={historyOverride ?? {}}
    />,
  )
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('QuizSession', () => {
  beforeEach(() => {
    mockInsert.mockClear()
    mockInsert.mockResolvedValue({ error: null })
  })

  describe('初期表示', () => {
    it('第1問の問題文が表示される', () => {
      renderQuiz([makeQuestion()])
      expect(screen.getByText('設問テキスト')).toBeInTheDocument()
    })

    it('全選択肢が表示される', () => {
      renderQuiz([makeQuestion()])
      expect(screen.getByText('選択肢A')).toBeInTheDocument()
      expect(screen.getByText('選択肢B')).toBeInTheDocument()
      expect(screen.getByText('選択肢C')).toBeInTheDocument()
    })

    it('スコアが 0/0 で始まる', () => {
      renderQuiz([makeQuestion()])
      expect(screen.getByText('0 / 0 問正解')).toBeInTheDocument()
    })

    it('過去の記録がない場合「初挑戦」を表示しない（回答前は非表示）', () => {
      renderQuiz([makeQuestion()])
      expect(screen.queryByText('初挑戦')).not.toBeInTheDocument()
    })
  })

  describe('正解フロー', () => {
    it('正解の選択肢をクリックすると「正解」バッジが表示される', () => {
      renderQuiz([makeQuestion()])
      fireEvent.click(screen.getByText('選択肢A'))
      expect(screen.getByText('✓ 正解')).toBeInTheDocument()
    })

    it('正解後に自信度ボタンが表示される', () => {
      renderQuiz([makeQuestion()])
      fireEvent.click(screen.getByText('選択肢A'))
      expect(screen.getByText('確信あり ✓')).toBeInTheDocument()
      expect(screen.getByText('なんとなく・勘 ?')).toBeInTheDocument()
    })

    it('自信度ボタンが表示されている間は「次へ」ボタンが表示されない', () => {
      renderQuiz([makeQuestion()])
      fireEvent.click(screen.getByText('選択肢A'))
      expect(screen.queryByText(/次の問題へ/)).not.toBeInTheDocument()
    })

    it('「確信あり」をクリックすると user_logs に is_correct:true / confident で保存される', async () => {
      renderQuiz([makeQuestion()])
      fireEvent.click(screen.getByText('選択肢A'))
      fireEvent.click(screen.getByText('確信あり ✓'))
      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({ is_correct: true, confidence_flag: 'confident' }),
        )
      })
    })

    it('「なんとなく」をクリックすると user_logs に is_correct:true / guess で保存される', async () => {
      renderQuiz([makeQuestion()])
      fireEvent.click(screen.getByText('選択肢A'))
      fireEvent.click(screen.getByText('なんとなく・勘 ?'))
      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({ is_correct: true, confidence_flag: 'guess' }),
        )
      })
    })

    it('自信度選択後に次へ進むボタンが表示される', () => {
      renderQuiz([makeQuestion()])
      fireEvent.click(screen.getByText('選択肢A'))
      fireEvent.click(screen.getByText('確信あり ✓'))
      // 1問しかない場合は「結果を見る」、複数問なら「次の問題へ →」
      expect(screen.getByText(/次の問題へ|結果を見る/)).toBeInTheDocument()
    })
  })

  describe('不正解フロー', () => {
    it('不正解の選択肢をクリックすると「不正解」バッジが表示される', () => {
      renderQuiz([makeQuestion()])
      fireEvent.click(screen.getByText('選択肢B'))
      expect(screen.getByText('✗ 不正解')).toBeInTheDocument()
    })

    it('不正解後は自信度ボタンが表示されない', () => {
      renderQuiz([makeQuestion()])
      fireEvent.click(screen.getByText('選択肢B'))
      expect(screen.queryByText('確信あり ✓')).not.toBeInTheDocument()
    })

    it('不正解後は即、次へ進むボタンが表示される', () => {
      renderQuiz([makeQuestion()])
      fireEvent.click(screen.getByText('選択肢B'))
      expect(screen.getByText(/次の問題へ|結果を見る/)).toBeInTheDocument()
    })

    it('不正解で次へをクリックすると user_logs に is_correct:false で保存される', async () => {
      const twoQ = [
        makeQuestion({ id: 1, question_number: 1, question_text: '問題1', correct_answer: 'ア' }),
        makeQuestion({ id: 2, question_number: 2, question_text: '問題2', correct_answer: 'ア' }),
      ]
      renderQuiz(twoQ)
      fireEvent.click(screen.getByText('選択肢B'))
      fireEvent.click(screen.getByText('次の問題へ →'))
      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({ is_correct: false, confidence_flag: null }),
        )
      })
    })

    it('正解の選択肢が緑でハイライトされる', () => {
      renderQuiz([makeQuestion()])
      fireEvent.click(screen.getByText('選択肢B'))
      const correctBtn = screen.getByText('選択肢A').closest('button')
      expect(correctBtn?.className).toContain('border-green-400')
    })

    it('選択した不正解の選択肢が赤でハイライトされる', () => {
      renderQuiz([makeQuestion()])
      fireEvent.click(screen.getByText('選択肢B'))
      const wrongBtn = screen.getByText('選択肢B').closest('button')
      expect(wrongBtn?.className).toContain('border-red-400')
    })
  })

  describe('二重クリック防止', () => {
    it('回答後に別の選択肢をクリックしてもスコアが変わらない', () => {
      renderQuiz([makeQuestion()])
      fireEvent.click(screen.getByText('選択肢A'))
      fireEvent.click(screen.getByText('選択肢B'))
      expect(screen.getByText('1 / 1 問正解')).toBeInTheDocument()
    })
  })

  describe('全員正解問題', () => {
    it('どの選択肢を選んでも「正解」扱いになる', () => {
      const q = makeQuestion({ correct_answer: '全員正解' })
      renderQuiz([q])
      fireEvent.click(screen.getByText('選択肢B'))
      expect(screen.getByText('✓ 正解')).toBeInTheDocument()
    })

    it('全員正解では「全員正解問題」のラベルが表示される', () => {
      const q = makeQuestion({ correct_answer: '全員正解' })
      renderQuiz([q])
      fireEvent.click(screen.getByText('選択肢B'))
      expect(screen.getByText('全員正解問題')).toBeInTheDocument()
    })
  })

  describe('過去の解答履歴', () => {
    it('過去の正答率が回答後に表示される', () => {
      const history = { 1: { correct: 3, total: 4 } }
      renderQuiz([makeQuestion()], history)
      fireEvent.click(screen.getByText('選択肢A'))
      expect(screen.getByText(/過去の正答率: 75%（3\/4回）/)).toBeInTheDocument()
    })

    it('履歴がない問題は「初挑戦」と表示される', () => {
      renderQuiz([makeQuestion()], {})
      fireEvent.click(screen.getByText('選択肢A'))
      expect(screen.getByText('初挑戦')).toBeInTheDocument()
    })
  })

  describe('複数問題・完走フロー', () => {
    const twoQuestions = [
      makeQuestion({ id: 1, question_number: 1, question_text: '問題1', correct_answer: 'ア' }),
      makeQuestion({ id: 2, question_number: 2, question_text: '問題2', correct_answer: 'イ', points: 6 }),
    ]

    it('全問完走後に完了画面が表示される', async () => {
      renderQuiz(twoQuestions)
      // Q1 正解
      fireEvent.click(screen.getByText('選択肢A'))
      fireEvent.click(screen.getByText('確信あり ✓'))
      fireEvent.click(screen.getByText('次の問題へ →'))
      // Q2 正解
      fireEvent.click(screen.getByText('選択肢B'))
      fireEvent.click(screen.getByText('確信あり ✓'))
      fireEvent.click(screen.getByText('結果を見る'))
      expect(screen.getByText('演習完了')).toBeInTheDocument()
    })

    it('session_completions に1回だけ INSERT される', async () => {
      renderQuiz(twoQuestions)
      fireEvent.click(screen.getByText('選択肢A'))
      fireEvent.click(screen.getByText('確信あり ✓'))
      fireEvent.click(screen.getByText('次の問題へ →'))
      fireEvent.click(screen.getByText('選択肢B'))
      fireEvent.click(screen.getByText('確信あり ✓'))
      fireEvent.click(screen.getByText('結果を見る'))
      await waitFor(() => {
        // session_completions の INSERT は total フィールドを持つ（user_logs には存在しない）
        const sessionInserts = mockInsert.mock.calls.filter((call) =>
          call[0] && 'total' in call[0],
        )
        expect(sessionInserts).toHaveLength(1)
      })
    })

    it('完了画面でリセットすると第1問に戻る', async () => {
      renderQuiz(twoQuestions)
      fireEvent.click(screen.getByText('選択肢A'))
      fireEvent.click(screen.getByText('確信あり ✓'))
      fireEvent.click(screen.getByText('次の問題へ →'))
      fireEvent.click(screen.getByText('選択肢B'))
      fireEvent.click(screen.getByText('確信あり ✓'))
      fireEvent.click(screen.getByText('結果を見る'))
      expect(screen.getByText('演習完了')).toBeInTheDocument()
      fireEvent.click(screen.getByText('もう一度'))
      expect(screen.getByText('問題1')).toBeInTheDocument()
    })
  })

  describe('optionStyle（CSS クラス）', () => {
    it('未回答時はホバースタイルが含まれる', () => {
      renderQuiz([makeQuestion()])
      const btn = screen.getByText('選択肢A').closest('button')
      expect(btn?.className).toContain('hover:bg-indigo-50')
    })

    it('回答後、不正解の他の選択肢はグレーアウトされる', () => {
      renderQuiz([makeQuestion()])
      fireEvent.click(screen.getByText('選択肢B'))
      const otherBtn = screen.getByText('選択肢C').closest('button')
      expect(otherBtn?.className).toContain('text-gray-400')
    })
  })
})
