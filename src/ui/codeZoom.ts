/** 코드 에디터 글자 크기(px) 확대/축소 */
export const MIN_CODE_SIZE = 10
export const MAX_CODE_SIZE = 24
export const DEFAULT_CODE_SIZE = 14

export function stepCodeSize(size: number, direction: 'in' | 'out'): number {
  const next = direction === 'in' ? size + 1 : size - 1
  return Math.min(MAX_CODE_SIZE, Math.max(MIN_CODE_SIZE, next))
}
