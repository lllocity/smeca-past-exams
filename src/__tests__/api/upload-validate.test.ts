import { describe, it, expect } from 'vitest'
import { validateUpload, ALLOWED_TYPES, MAX_SIZE_BYTES } from '@/lib/upload-validate'

const validFile = { type: 'image/jpeg', size: 1024 }

describe('validateUpload', () => {
  describe('file', () => {
    it('null file は error', () => {
      const r = validateUpload(null, '1')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toContain('file is required')
    })

    it('全許可MIMEタイプが通る', () => {
      for (const type of ALLOWED_TYPES) {
        const r = validateUpload({ type, size: 1024 }, '1')
        expect(r.ok).toBe(true)
      }
    })

    it('不正MIMEタイプは error', () => {
      const r = validateUpload({ type: 'image/bmp', size: 1024 }, '1')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toContain('Unsupported file type')
    })

    it('application/pdf は error', () => {
      expect(validateUpload({ type: 'application/pdf', size: 1024 }, '1').ok).toBe(false)
    })

    it('ちょうど 5MB は ok（境界値）', () => {
      const r = validateUpload({ type: 'image/jpeg', size: MAX_SIZE_BYTES }, '1')
      expect(r.ok).toBe(true)
    })

    it('5MB + 1byte は error（境界値）', () => {
      const r = validateUpload({ type: 'image/jpeg', size: MAX_SIZE_BYTES + 1 }, '1')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toContain('5MB')
    })

    it('0 バイトは ok（サイズチェックは上限のみ）', () => {
      const r = validateUpload({ type: 'image/jpeg', size: 0 }, '1')
      expect(r.ok).toBe(true)
    })
  })

  describe('question_id', () => {
    it('正の整数は ok', () => {
      expect(validateUpload(validFile, '1').ok).toBe(true)
      expect(validateUpload(validFile, '999').ok).toBe(true)
    })

    it('0 は error', () => {
      expect(validateUpload(validFile, '0').ok).toBe(false)
    })

    it('負の数は error', () => {
      expect(validateUpload(validFile, '-1').ok).toBe(false)
    })

    it('文字列は error', () => {
      expect(validateUpload(validFile, 'abc').ok).toBe(false)
    })

    it('null は error', () => {
      expect(validateUpload(validFile, null).ok).toBe(false)
    })

    it('小数は error', () => {
      expect(validateUpload(validFile, '1.5').ok).toBe(false)
    })
  })

  describe('正常系', () => {
    it('PNG ファイル + 有効な question_id', () => {
      expect(validateUpload({ type: 'image/png', size: 2048 }, '42').ok).toBe(true)
    })
  })
})
