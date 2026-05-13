export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

export type UploadValidationResult =
  | { ok: true }
  | { ok: false; error: string }

export function validateUpload(file: { type: string; size: number } | null, questionId: unknown): UploadValidationResult {
  if (!file) {
    return { ok: false, error: 'file is required' }
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, error: `Unsupported file type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(', ')}` }
  }

  if (file.size > MAX_SIZE_BYTES) {
    return { ok: false, error: 'File size exceeds 5MB limit' }
  }

  const id = Number(questionId)
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: 'question_id must be a positive integer' }
  }

  return { ok: true }
}
