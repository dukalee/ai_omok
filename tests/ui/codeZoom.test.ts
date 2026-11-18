import { describe, expect, test } from 'vitest'
import { DEFAULT_CODE_SIZE, MAX_CODE_SIZE, MIN_CODE_SIZE, stepCodeSize } from '../../src/ui/codeZoom'

describe('stepCodeSize', () => {
  test('확대는 1px씩 커지고 축소는 1px씩 작아진다', () => {
    expect(stepCodeSize(14, 'in')).toBe(15)
    expect(stepCodeSize(14, 'out')).toBe(13)
  })

  test('최대와 최소를 넘지 않는다', () => {
    expect(stepCodeSize(MAX_CODE_SIZE, 'in')).toBe(MAX_CODE_SIZE)
    expect(stepCodeSize(MIN_CODE_SIZE, 'out')).toBe(MIN_CODE_SIZE)
  })

  test('기본 크기는 범위 안에 있다', () => {
    expect(DEFAULT_CODE_SIZE).toBeGreaterThanOrEqual(MIN_CODE_SIZE)
    expect(DEFAULT_CODE_SIZE).toBeLessThanOrEqual(MAX_CODE_SIZE)
  })
})
