import { describe, it, expect } from 'vitest'
import { validate, SUBJECT_CODES } from '@/lib/import-validate'

const validQuestion = {
  subject_code: 'ECO',
  year: 2023,
  question_number: 1,
  points: 4,
  question_text: '次の記述のうち、最も適切なものはどれか。',
  options: [
    { label: 'ア', text: '選択肢A' },
    { label: 'イ', text: '選択肢B' },
  ],
  correct_answer: 'ア',
  explanation: '解説テキスト',
  tags: ['需要曲線'],
}

describe('validate', () => {
  describe('非オブジェクト入力', () => {
    it('null は false', () => {
      expect(validate(null)).toBe(false)
    })

    it('文字列は false', () => {
      expect(validate('ECO')).toBe(false)
    })

    it('数値は false', () => {
      expect(validate(42)).toBe(false)
    })

    it('配列は false', () => {
      expect(validate([])).toBe(false)
    })
  })

  describe('subject_code', () => {
    it('全7科目コードを受け付ける', () => {
      for (const code of SUBJECT_CODES) {
        expect(validate({ ...validQuestion, subject_code: code })).toBe(true)
      }
    })

    it('不正な科目コードは false', () => {
      expect(validate({ ...validQuestion, subject_code: 'XYZ' })).toBe(false)
    })

    it('小文字は false', () => {
      expect(validate({ ...validQuestion, subject_code: 'eco' })).toBe(false)
    })

    it('空文字は false', () => {
      expect(validate({ ...validQuestion, subject_code: '' })).toBe(false)
    })

    it('subject_code が欠落している場合は false', () => {
      const { subject_code: _, ...rest } = validQuestion
      expect(validate(rest)).toBe(false)
    })
  })

  describe('year', () => {
    it('数値の year は true', () => {
      expect(validate({ ...validQuestion, year: 2023 })).toBe(true)
    })

    it('文字列の year は false', () => {
      expect(validate({ ...validQuestion, year: '2023' })).toBe(false)
    })

    it('year が欠落している場合は false', () => {
      const { year: _, ...rest } = validQuestion
      expect(validate(rest)).toBe(false)
    })
  })

  describe('question_number', () => {
    it('整数は true', () => {
      expect(validate({ ...validQuestion, question_number: 1 })).toBe(true)
    })

    it('小数も number 型なので true（型レベルでは通過する）', () => {
      expect(validate({ ...validQuestion, question_number: 1.5 })).toBe(true)
    })

    it('文字列は false', () => {
      expect(validate({ ...validQuestion, question_number: '1' })).toBe(false)
    })
  })

  describe('points', () => {
    it('正の整数は true', () => {
      expect(validate({ ...validQuestion, points: 4 })).toBe(true)
    })

    it('0 は true（バリデーションでは数値チェックのみ）', () => {
      expect(validate({ ...validQuestion, points: 0 })).toBe(true)
    })

    it('文字列は false', () => {
      expect(validate({ ...validQuestion, points: '4' })).toBe(false)
    })
  })

  describe('question_text', () => {
    it('空文字でも string 型なら true', () => {
      expect(validate({ ...validQuestion, question_text: '' })).toBe(true)
    })

    it('数値は false', () => {
      expect(validate({ ...validQuestion, question_text: 123 })).toBe(false)
    })
  })

  describe('options', () => {
    it('空配列は true（配列チェックのみ）', () => {
      expect(validate({ ...validQuestion, options: [] })).toBe(true)
    })

    it('配列でなければ false', () => {
      expect(validate({ ...validQuestion, options: {} })).toBe(false)
    })

    it('options が欠落している場合は false', () => {
      const { options: _, ...rest } = validQuestion
      expect(validate(rest)).toBe(false)
    })
  })

  describe('correct_answer', () => {
    it('通常の文字列は true', () => {
      expect(validate({ ...validQuestion, correct_answer: 'ア' })).toBe(true)
    })

    it('"全員正解" も string なので true', () => {
      expect(validate({ ...validQuestion, correct_answer: '全員正解' })).toBe(true)
    })

    it('数値は false', () => {
      expect(validate({ ...validQuestion, correct_answer: 1 })).toBe(false)
    })
  })

  describe('tags', () => {
    it('空配列は true', () => {
      expect(validate({ ...validQuestion, tags: [] })).toBe(true)
    })

    it('文字列の配列は true', () => {
      expect(validate({ ...validQuestion, tags: ['需要曲線', 'IS-LM'] })).toBe(true)
    })

    it('配列でなければ false', () => {
      expect(validate({ ...validQuestion, tags: 'needs-tag' })).toBe(false)
    })
  })

  describe('正常系', () => {
    it('explanation が null でも true', () => {
      expect(validate({ ...validQuestion, explanation: null })).toBe(true)
    })

    it('全フィールド正常なら true', () => {
      expect(validate(validQuestion)).toBe(true)
    })
  })
})
