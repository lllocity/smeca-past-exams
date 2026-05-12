export const SUBJECT_CODES = ['ECO', 'FIN', 'MGT', 'OPS', 'LAW', 'MIS', 'SME'] as const
export type SubjectCode = (typeof SUBJECT_CODES)[number]

export type GeminiQuestion = {
  subject_code: SubjectCode
  year: number
  question_number: number
  points: number
  question_text: string
  options: Array<{ label: string; text: string }>
  correct_answer: string
  explanation: string | null
  tags: string[]
}

export function validate(q: unknown): q is GeminiQuestion {
  if (typeof q !== 'object' || q === null) return false
  const obj = q as Record<string, unknown>
  return (
    SUBJECT_CODES.includes(obj.subject_code as SubjectCode) &&
    typeof obj.year === 'number' &&
    typeof obj.question_number === 'number' &&
    typeof obj.points === 'number' &&
    typeof obj.question_text === 'string' &&
    Array.isArray(obj.options) &&
    typeof obj.correct_answer === 'string' &&
    Array.isArray(obj.tags)
  )
}
