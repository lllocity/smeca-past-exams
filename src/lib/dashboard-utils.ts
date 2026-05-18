export const SUBJECT_ORDER = ['ECO', 'FIN', 'MGT', 'OPS', 'LAW', 'MIS', 'SME']

export type SubjectYearScore = {
  subject: string
  year: number
  correct: number
  total: number
  points: number
}

export type QStats = {
  question_id: number
  year: number
  question_number: number
  correct: number
  total: number
  tags: string[]
}

export type WeakSubject = {
  subject: string
  questions: QStats[]
}

export type DayCount = {
  date: string
  count: number
}

export type RawCompletion = {
  subject_code: string
  year: number
  correct: number
  total: number
  points_earned: number
  completed_at: string
}

export type RawLog = {
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

export function buildSubjectYearScores(completions: RawCompletion[]): SubjectYearScore[] {
  const map = new Map<string, SubjectYearScore>()
  for (const c of completions) {
    const key = `${c.subject_code}::${c.year}`
    if (!map.has(key)) {
      map.set(key, {
        subject: c.subject_code,
        year: c.year,
        correct: c.correct,
        total: c.total,
        points: c.points_earned,
      })
    }
  }
  return [...map.values()].sort((a, b) => {
    const si = SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject)
    return si !== 0 ? si : b.year - a.year
  })
}

export function buildWeakBySubject(logs: RawLog[]): WeakSubject[] {
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
  return SUBJECT_ORDER.flatMap((subject) => {
    const qm = subjectQMap.get(subject)
    if (!qm) return []
    const multi = [...qm.values()].filter((q) => q.total >= 2)
    if (multi.length === 0) return []
    const top3 = multi
      .sort((a, b) => a.correct / a.total - b.correct / b.total)
      .slice(0, 3)
    return [{ subject, questions: top3 }]
  })
}

export type TagStat = { tagName: string; correct: number; total: number }
export type TagSubjectStats = { subject: string; tags: TagStat[] }

export function buildTagStats(logs: RawLog[]): TagSubjectStats[] {
  const subjectTagMap = new Map<string, Map<string, { correct: number; total: number }>>()
  for (const log of logs) {
    const q = log.questions
    if (!q) continue
    const tagNames = q.question_tags.flatMap((qt) => (qt.tags ? [qt.tags.name] : []))
    if (tagNames.length === 0) continue
    if (!subjectTagMap.has(q.subject_code)) subjectTagMap.set(q.subject_code, new Map())
    const tagMap = subjectTagMap.get(q.subject_code)!
    for (const tagName of tagNames) {
      const prev = tagMap.get(tagName) ?? { correct: 0, total: 0 }
      tagMap.set(tagName, {
        correct: prev.correct + (log.is_correct ? 1 : 0),
        total: prev.total + 1,
      })
    }
  }
  return SUBJECT_ORDER.flatMap((subject) => {
    const tagMap = subjectTagMap.get(subject)
    if (!tagMap) return []
    const tags = [...tagMap.entries()]
      .filter(([, s]) => s.total >= 2)
      .map(([tagName, s]) => ({ tagName, correct: s.correct, total: s.total }))
      .sort((a, b) => a.correct / a.total - b.correct / b.total)
      .slice(0, 5)
    if (tags.length === 0) return []
    return [{ subject, tags }]
  })
}

export function buildDailyCount(
  logs: Pick<RawLog, 'answered_at'>[],
  today: Date = new Date(),
): { days: DayCount[]; maxDaily: number } {
  const days: DayCount[] = Array.from({ length: 30 }, (_, i) => {
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
  return { days, maxDaily }
}
