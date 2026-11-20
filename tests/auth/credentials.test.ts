import { describe, expect, test } from 'vitest'
import { idToEmail, normalizeId, validateId, validateName, validatePassword } from '../../src/auth/credentials'

describe('ID', () => {
  test('영문 소문자, 숫자, _ 로 4~20자면 통과한다', () => {
    expect(validateId('omok_01')).toBeNull()
    expect(validateId('abcd')).toBeNull()
    expect(validateId('a'.repeat(20))).toBeNull()
  })

  test('대문자는 소문자로 맞춰 통과한다 (대소문자 구분 없음)', () => {
    expect(validateId('  Omok_01 ')).toBeNull()
    expect(normalizeId('  Omok_01 ')).toBe('omok_01')
  })

  test('짧거나 길거나 허용되지 않는 글자가 있으면 안내 문구를 돌려준다', () => {
    for (const bad of ['', 'abc', 'a'.repeat(21), 'omok!', '오목이', 'a b c d', 'a@b.com']) {
      expect(validateId(bad)).toContain('ID는')
    }
  })

  test('ID는 가짜 이메일로 바뀐다', () => {
    expect(idToEmail('Omok_01')).toBe('omok_01@omok.app')
  })
})

describe('이름과 PASSWORD', () => {
  test('이름은 1~20자 (앞뒤 공백 제외)', () => {
    expect(validateName('홍길동')).toBeNull()
    expect(validateName('   ')).not.toBeNull()
    expect(validateName('가'.repeat(20))).toBeNull()
    expect(validateName('가'.repeat(21))).not.toBeNull()
  })

  test('PASSWORD는 6자 이상', () => {
    expect(validatePassword('12345')).not.toBeNull()
    expect(validatePassword('123456')).toBeNull()
  })
})
