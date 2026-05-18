export type OptionItem = { label: string; text: string }

export type QuestionUpdatePayload = {
  question_text?: string
  explanation?: string | null
  options?: OptionItem[]
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

  if ('options' in obj) {
    if (!Array.isArray(obj.options) || obj.options.length === 0) {
      return { ok: false, error: 'options must be a non-empty array' }
    }
    for (const item of obj.options) {
      if (typeof item !== 'object' || item === null) {
        return { ok: false, error: 'each option must be an object' }
      }
      const opt = item as Record<string, unknown>
      if (typeof opt.label !== 'string' || opt.label.trim() === '') {
        return { ok: false, error: 'each option must have a non-empty label string' }
      }
      if (typeof opt.text !== 'string') {
        return { ok: false, error: 'each option text must be a string' }
      }
    }
    update.options = (obj.options as OptionItem[]).map(({ label, text }) => ({ label, text }))
  }

  if (Object.keys(update).length === 0) {
    return { ok: false, error: 'No updatable fields provided' }
  }

  return { ok: true, update }
}
