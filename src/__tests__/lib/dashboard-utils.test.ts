import { describe, it, expect } from 'vitest'
import {
  buildSubjectYearScores,
  buildWeakBySubject,
  buildDailyCount,
  buildTagStats,
  type RawCompletion,
  type RawLog,
} from '@/lib/dashboard-utils'

// ── helpers ──────────────────────────────────────────────────────────────────

function makeCompletion(overrides: Partial<RawCompletion> = {}): RawCompletion {
  return {
    subject_code: 'ECO',
    year: 2023,
    correct: 18,
    total: 25,
    points_earned: 72,
    completed_at: '2024-01-10T10:00:00Z',
    ...overrides,
  }
}

function makeLog(overrides: Partial<RawLog> = {}): RawLog {
  return {
    question_id: 1,
    is_correct: true,
    answered_at: '2024-01-10T10:00:00Z',
    questions: {
      subject_code: 'ECO',
      year: 2023,
      question_number: 1,
      question_tags: [],
    },
    ...overrides,
  }
}

// ── buildSubjectYearScores ────────────────────────────────────────────────────

describe('buildSubjectYearScores', () => {
  it('空配列なら空を返す', () => {
    expect(buildSubjectYearScores([])).toEqual([])
  })

  it('1件のデータを正しくマッピングする', () => {
    const result = buildSubjectYearScores([makeCompletion()])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      subject: 'ECO',
      year: 2023,
      correct: 18,
      total: 25,
      points: 72,
    })
  })

  it('同一科目×年度が複数あれば最初（最新）のみ残す', () => {
    const completions = [
      makeCompletion({ correct: 18, points_earned: 72, completed_at: '2024-02-01T00:00:00Z' }),
      makeCompletion({ correct: 10, points_earned: 40, completed_at: '2024-01-01T00:00:00Z' }),
    ]
    const result = buildSubjectYearScores(completions)
    expect(result).toHaveLength(1)
    expect(result[0].correct).toBe(18)
    expect(result[0].points).toBe(72)
  })

  it('科目順（SUBJECT_ORDER）でソートされる', () => {
    const completions = [
      makeCompletion({ subject_code: 'SME', year: 2023 }),
      makeCompletion({ subject_code: 'ECO', year: 2023 }),
      makeCompletion({ subject_code: 'FIN', year: 2023 }),
    ]
    const result = buildSubjectYearScores(completions)
    expect(result.map((r) => r.subject)).toEqual(['ECO', 'FIN', 'SME'])
  })

  it('同一科目で複数年度は年度降順でソートされる', () => {
    const completions = [
      makeCompletion({ year: 2021 }),
      makeCompletion({ year: 2023 }),
      makeCompletion({ year: 2022 }),
    ]
    const result = buildSubjectYearScores(completions)
    expect(result.map((r) => r.year)).toEqual([2023, 2022, 2021])
  })
})

// ── buildWeakBySubject ────────────────────────────────────────────────────────

describe('buildWeakBySubject', () => {
  it('空配列なら空を返す', () => {
    expect(buildWeakBySubject([])).toEqual([])
  })

  it('1回しか解いていない問題はフィルタされる', () => {
    const result = buildWeakBySubject([makeLog()])
    expect(result).toEqual([])
  })

  it('2回以上解いた問題が含まれる', () => {
    const logs = [
      makeLog({ question_id: 1, is_correct: false }),
      makeLog({ question_id: 1, is_correct: true }),
    ]
    const result = buildWeakBySubject(logs)
    expect(result).toHaveLength(1)
    expect(result[0].questions[0]).toMatchObject({ question_id: 1, correct: 1, total: 2 })
  })

  it('questions が null のログはスキップする', () => {
    const logs = [
      makeLog({ question_id: 1, questions: null }),
      makeLog({ question_id: 1, questions: null }),
    ]
    expect(buildWeakBySubject(logs)).toEqual([])
  })

  it('正答率の低い順（弱い順）にソートされる', () => {
    const logs = [
      // question_id:1 → 0/2 = 0%
      makeLog({ question_id: 1, is_correct: false, questions: { subject_code: 'ECO', year: 2023, question_number: 1, question_tags: [] } }),
      makeLog({ question_id: 1, is_correct: false, questions: { subject_code: 'ECO', year: 2023, question_number: 1, question_tags: [] } }),
      // question_id:2 → 2/2 = 100%
      makeLog({ question_id: 2, is_correct: true, questions: { subject_code: 'ECO', year: 2023, question_number: 2, question_tags: [] } }),
      makeLog({ question_id: 2, is_correct: true, questions: { subject_code: 'ECO', year: 2023, question_number: 2, question_tags: [] } }),
    ]
    const result = buildWeakBySubject(logs)
    expect(result[0].questions[0].question_id).toBe(1)
    expect(result[0].questions[1].question_id).toBe(2)
  })

  it('4問以上あっても top3 に絞られる', () => {
    const makeQ = (id: number, correct: boolean) =>
      makeLog({
        question_id: id,
        is_correct: correct,
        questions: { subject_code: 'ECO', year: 2023, question_number: id, question_tags: [] },
      })
    const logs = [1, 2, 3, 4].flatMap((id) => [makeQ(id, false), makeQ(id, false)])
    const result = buildWeakBySubject(logs)
    expect(result[0].questions).toHaveLength(3)
  })

  it('全問正解でも2回以上解いた問題は苦手リストに出る', () => {
    const logs = [
      makeLog({ question_id: 1, is_correct: true }),
      makeLog({ question_id: 1, is_correct: true }),
    ]
    const result = buildWeakBySubject(logs)
    expect(result).toHaveLength(1)
    expect(result[0].questions[0]).toMatchObject({ correct: 2, total: 2 })
  })

  it('タグが正しく抽出される', () => {
    const logWithTag = makeLog({
      question_id: 1,
      questions: {
        subject_code: 'ECO',
        year: 2023,
        question_number: 1,
        question_tags: [{ tags: { name: '需要曲線' } }, { tags: null }],
      },
    })
    const logs = [logWithTag, makeLog({ question_id: 1 })]
    const result = buildWeakBySubject(logs)
    expect(result[0].questions[0].tags).toEqual(['需要曲線'])
  })
})

// ── buildTagStats ─────────────────────────────────────────────────────────────

function makeTagLog(tagNames: string[], overrides: Partial<RawLog> = {}): RawLog {
  return {
    question_id: 1,
    is_correct: true,
    answered_at: '2024-01-10T10:00:00Z',
    questions: {
      subject_code: 'ECO',
      year: 2023,
      question_number: 1,
      question_tags: tagNames.map((name) => ({ tags: { name } })),
    },
    ...overrides,
  }
}

describe('buildTagStats', () => {
  it('空配列なら空を返す', () => {
    expect(buildTagStats([])).toEqual([])
  })

  it('1回しか解いていないタグは除外される', () => {
    const logs = [makeTagLog(['需給分析'])]
    expect(buildTagStats(logs)).toEqual([])
  })

  it('2回以上解いたタグが含まれる', () => {
    const logs = [
      makeTagLog(['需給分析'], { question_id: 1, is_correct: false }),
      makeTagLog(['需給分析'], { question_id: 2, is_correct: true }),
    ]
    const result = buildTagStats(logs)
    expect(result).toHaveLength(1)
    expect(result[0].tags[0]).toMatchObject({ tagName: '需給分析', correct: 1, total: 2 })
  })

  it('タグなし問題（question_tags 空配列）はスキップされる', () => {
    const logs = [
      makeTagLog([], { question_id: 1 }),
      makeTagLog([], { question_id: 2 }),
    ]
    expect(buildTagStats(logs)).toEqual([])
  })

  it('複数科目が独立して集計される', () => {
    const ecoLog = makeTagLog(['需給分析'], { question_id: 1 })
    const finLog = makeTagLog(['CVP分析'], {
      question_id: 2,
      questions: { subject_code: 'FIN', year: 2023, question_number: 1, question_tags: [{ tags: { name: 'CVP分析' } }] },
    })
    const logs = [ecoLog, ecoLog, finLog, finLog]
    const result = buildTagStats(logs)
    expect(result.map((r) => r.subject)).toContain('ECO')
    expect(result.map((r) => r.subject)).toContain('FIN')
  })

  it('正解率昇順（苦手順）にソートされる', () => {
    const logs = [
      // 需給分析: 0/2 = 0%
      makeTagLog(['需給分析'], { question_id: 1, is_correct: false }),
      makeTagLog(['需給分析'], { question_id: 2, is_correct: false }),
      // 弾力性: 2/2 = 100%
      makeTagLog(['弾力性'], { question_id: 3, is_correct: true }),
      makeTagLog(['弾力性'], { question_id: 4, is_correct: true }),
    ]
    const result = buildTagStats(logs)
    expect(result[0].tags[0].tagName).toBe('需給分析')
    expect(result[0].tags[1].tagName).toBe('弾力性')
  })

  it('6タグ以上あっても上位5件に絞られる', () => {
    const tagNames = ['タグA', 'タグB', 'タグC', 'タグD', 'タグE', 'タグF']
    const logs = tagNames.flatMap((name, i) => [
      makeTagLog([name], { question_id: i * 2, is_correct: false }),
      makeTagLog([name], { question_id: i * 2 + 1, is_correct: false }),
    ])
    const result = buildTagStats(logs)
    expect(result[0].tags).toHaveLength(5)
  })

  it('questions が null のログはスキップされる', () => {
    const logs = [
      makeTagLog(['需給分析'], { question_id: 1, questions: null }),
      makeTagLog(['需給分析'], { question_id: 2, questions: null }),
    ]
    expect(buildTagStats(logs)).toEqual([])
  })
})

// ── buildDailyCount ───────────────────────────────────────────────────────────

describe('buildDailyCount', () => {
  const fixedToday = new Date('2024-01-30T12:00:00Z')

  it('空配列なら全日 count=0、maxDaily=1', () => {
    const { days, maxDaily } = buildDailyCount([], fixedToday)
    expect(days).toHaveLength(30)
    expect(days.every((d) => d.count === 0)).toBe(true)
    expect(maxDaily).toBe(1)
  })

  it('今日のログがカウントされる', () => {
    const logs = [{ answered_at: '2024-01-30T09:00:00Z' }]
    const { days } = buildDailyCount(logs, fixedToday)
    const today = days[days.length - 1]
    expect(today.date).toBe('2024-01-30')
    expect(today.count).toBe(1)
  })

  it('30日より古いログは除外される', () => {
    const logs = [{ answered_at: '2023-12-31T00:00:00Z' }]
    const { days } = buildDailyCount(logs, fixedToday)
    expect(days.every((d) => d.count === 0)).toBe(true)
  })

  it('ちょうど30日前（cutoff 日）のログはカウントされる', () => {
    const logs = [{ answered_at: '2024-01-01T00:00:00Z' }]
    const { days } = buildDailyCount(logs, fixedToday)
    const oldest = days[0]
    expect(oldest.date).toBe('2024-01-01')
    expect(oldest.count).toBe(1)
  })

  it('maxDaily はその日の最大カウント', () => {
    const logs = [
      { answered_at: '2024-01-30T09:00:00Z' },
      { answered_at: '2024-01-30T10:00:00Z' },
      { answered_at: '2024-01-30T11:00:00Z' },
    ]
    const { maxDaily } = buildDailyCount(logs, fixedToday)
    expect(maxDaily).toBe(3)
  })

  it('全ログがゼロでも maxDaily は最低1（ゼロ除算防止）', () => {
    const { maxDaily } = buildDailyCount([], fixedToday)
    expect(maxDaily).toBe(1)
  })

  it('30日分の日付配列が古い順に並んでいる', () => {
    const { days } = buildDailyCount([], fixedToday)
    expect(days[0].date).toBe('2024-01-01')
    expect(days[29].date).toBe('2024-01-30')
  })
})
