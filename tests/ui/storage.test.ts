import { describe, expect, test } from 'vitest'
import { STARTER_CODE } from '../../src/python/starter'
import { CODE_KEY, loadCode, saveCode } from '../../src/ui/storage'

describe('loadCode', () => {
  test('저장된 값이 있으면 그 값', () => {
    expect(loadCode({ getItem: (k) => (k === CODE_KEY ? 'print(1)' : null) })).toBe('print(1)')
  })

  test('빈 문자열로 저장된 코드도 그대로 돌려준다 (사용자가 지운 상태)', () => {
    expect(loadCode({ getItem: () => '' })).toBe('')
  })

  test('저장된 값이 없으면 예제 코드', () => {
    expect(loadCode({ getItem: () => null })).toBe(STARTER_CODE)
  })

  test('접근 중 예외가 나도 예제 코드', () => {
    expect(
      loadCode({
        getItem: () => {
          throw new Error('denied')
        },
      }),
    ).toBe(STARTER_CODE)
  })
})

describe('saveCode', () => {
  test('CODE_KEY로 저장한다', () => {
    const calls: [string, string][] = []
    saveCode('abc', { setItem: (k, v) => void calls.push([k, v]) })
    expect(calls).toEqual([[CODE_KEY, 'abc']])
  })

  test('저장 중 예외가 나도 밖으로 나오지 않는다', () => {
    expect(() =>
      saveCode('abc', {
        setItem: () => {
          throw new Error('quota')
        },
      }),
    ).not.toThrow()
  })
})
