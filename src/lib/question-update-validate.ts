export type QuestionUpdatePayload = {
  question_text?: string
  explanation?: string | null
}

export type ValidationResult =
  | { ok: true; update: QuestionUpdatePayload }
  | { ok: false; error: string }

export function validateQuestionUpdate(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Body must be an object' }
  }

  const obj = body as Record<string, unknown>
  const update: QuestionUpdatePayload = {}

  if ('question_text' in obj) {
    if (typeof obj.question_text !== 'string' || obj.question_text.trim() === '') {
      return { ok: false, error: 'question_text must be a non-empty string' }
    }
    update.question_text = obj.question_text
  }

  if ('explanation' in obj) {
    if (obj.explanation !== null && typeof obj.explanation !== 'string') {
      return { ok: false, error: 'explanation must be a string or null' }
    }
    update.explanation = obj.explanation as string | null
  }

  if (Object.keys(update).length === 0) {
    return { ok: false, error: 'No updatable fields provided' }
  }

  return { ok: true, update }
}
