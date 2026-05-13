import { describe, it, expect } from 'vitest'
import { validateQuestionUpdate } from '@/lib/question-update-validate'

describe('validateQuestionUpdate', () => {
  describe('不正なボディ', () => {
    it('null は error', () => {
      const r = validateQuestionUpdate(null)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toContain('object')
    })

    it('文字列は error', () => {
      expect(validateQuestionUpdate('text').ok).toBe(false)
    })

    it('配列は error', () => {
      expect(validateQuestionUpdate([]).ok).toBe(false)
    })

    it('空オブジェクトは更新フィールドなし error', () => {
      const r = validateQuestionUpdate({})
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toContain('No updatable fields')
    })
  })

  describe('question_text', () => {
    it('正常な文字列は ok', () => {
      const r = validateQuestionUpdate({ question_text: '問題文です' })
      expect(r.ok).toBe(true)
    })

    it('空文字は error', () => {
      const r = validateQuestionUpdate({ question_text: '' })
      expect(r.ok).toBe(false)
    })

    it('スペースのみは error', () => {
      const r = validateQuestionUpdate({ question_text: '   ' })
      expect(r.ok).toBe(false)
    })

    it('数値は error', () => {
      const r = validateQuestionUpdate({ question_text: 123 })
      expect(r.ok).toBe(false)
    })

    it('null は error（question_text は null 不可）', () => {
      const r = validateQuestionUpdate({ question_text: null })
      expect(r.ok).toBe(false)
    })
  })

  describe('explanation', () => {
    it('文字列は ok', () => {
      const r = validateQuestionUpdate({ explanation: '解説です' })
      expect(r.ok).toBe(true)
    })

    it('null は ok（解説なしを許容）', () => {
      const r = validateQuestionUpdate({ explanation: null })
      expect(r.ok).toBe(true)
    })

    it('空文字も string なので ok', () => {
      const r = validateQuestionUpdate({ explanation: '' })
      expect(r.ok).toBe(true)
    })

    it('数値は error', () => {
      const r = validateQuestionUpdate({ explanation: 42 })
      expect(r.ok).toBe(false)
    })
  })

  describe('両フィールド同時', () => {
    it('question_text と explanation を同時更新できる', () => {
      const r = validateQuestionUpdate({ question_text: '問題', explanation: '解説' })
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.update.question_text).toBe('問題')
        expect(r.update.explanation).toBe('解説')
      }
    })

    it('explanation のみ null で question_text あり', () => {
      const r = validateQuestionUpdate({ question_text: '問題', explanation: null })
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.update.explanation).toBeNull()
    })
  })

  describe('未知フィールドは無視される', () => {
    it('余分なフィールドがあっても question_text が有効なら ok', () => {
      const r = validateQuestionUpdate({ question_text: '問題', unknown_field: 'xxx' })
      expect(r.ok).toBe(true)
      if (r.ok) expect('unknown_field' in r.update).toBe(false)
    })
  })
})
