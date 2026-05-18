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

  describe('options', () => {
    const validOptions = [
      { label: 'ア', text: '選択肢A' },
      { label: 'イ', text: '選択肢B' },
    ]

    it('正常な配列は ok', () => {
      const r = validateQuestionUpdate({ options: validOptions })
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.update.options).toEqual(validOptions)
    })

    it('空配列は error', () => {
      const r = validateQuestionUpdate({ options: [] })
      expect(r.ok).toBe(false)
    })

    it('配列でない値は error', () => {
      expect(validateQuestionUpdate({ options: 'ア' }).ok).toBe(false)
      expect(validateQuestionUpdate({ options: {} }).ok).toBe(false)
    })

    it('label が空文字の要素は error', () => {
      const r = validateQuestionUpdate({ options: [{ label: '', text: 'text' }] })
      expect(r.ok).toBe(false)
    })

    it('text が文字列でない要素は error', () => {
      const r = validateQuestionUpdate({ options: [{ label: 'ア', text: 123 }] })
      expect(r.ok).toBe(false)
    })

    it('text が空文字は ok（空の選択肢を許容）', () => {
      const r = validateQuestionUpdate({ options: [{ label: 'ア', text: '' }] })
      expect(r.ok).toBe(true)
    })

    it('question_text と同時更新できる', () => {
      const r = validateQuestionUpdate({ question_text: '問題', options: validOptions })
      expect(r.ok).toBe(true)
      if (r.ok) {
        expect(r.update.question_text).toBe('問題')
        expect(r.update.options).toEqual(validOptions)
      }
    })

    it('余分なフィールドは除去される（label と text のみ保持）', () => {
      const r = validateQuestionUpdate({
        options: [{ label: 'ア', text: '選択肢A', extra: 'ignored' }],
      })
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.update.options![0]).toEqual({ label: 'ア', text: '選択肢A' })
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
