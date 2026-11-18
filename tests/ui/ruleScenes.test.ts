import { describe, expect, test } from 'vitest'
import { createBoard, placeStone } from '../../src/engine/board'
import { getForbiddenReason } from '../../src/engine/forbidden'
import { findWinningLine } from '../../src/engine/rules'
import type { Board } from '../../src/engine/types'
import { SCENES } from '../../src/ui/ruleScenes'
import type { RuleScene } from '../../src/ui/ruleScenes'

// 그림은 9×9 창이다. 실제 15×15 판의 가장자리 영향을 받지 않도록 가운데쪽으로 옮겨서 판정한다.
const OFFSET = 3

function boardOf(scene: RuleScene): Board {
  const board = createBoard()
  for (const s of scene.stones) {
    placeStone(board, { row: s.r + OFFSET, col: s.c + OFFSET }, s.color === 'black' ? 1 : 2)
  }
  return board
}

const targetOf = (scene: RuleScene) => ({ row: scene.target.r + OFFSET, col: scene.target.c + OFFSET })

describe('금수 설명 장면', () => {
  test('장면은 장목, 사사, 삼삼, 예외 네 가지이고 id가 서로 다르다', () => {
    expect(SCENES.map((s) => s.id)).toEqual(['overline', 'double-four', 'double-three', 'exception'])
  })

  test.each(SCENES)('$id: 그림의 결과(expected)가 실제 규칙 엔진의 판정과 같다', (scene) => {
    expect(getForbiddenReason(boardOf(scene), targetOf(scene))).toBe(scene.expected)
  })

  test('금수 장면 셋은 금수이고, 예외 장면은 금수가 아니다', () => {
    const byId = Object.fromEntries(SCENES.map((s) => [s.id, s.expected]))
    expect(byId).toEqual({
      overline: 'overline',
      'double-four': 'double-four',
      'double-three': 'double-three',
      exception: null,
    })
  })

  test('예외 장면은 목표 자리에 두면 정확히 5목이 완성된다', () => {
    const scene = SCENES.find((s) => s.id === 'exception')!
    const board = boardOf(scene)
    const target = targetOf(scene)
    placeStone(board, target, 1)
    expect(findWinningLine(board, target)).toHaveLength(5)
  })

  test.each(SCENES)('$id: 모든 좌표가 9×9 창 안에 있고, 돌끼리 겹치지 않으며, 목표 자리는 비어 있다', (scene) => {
    const inside = (r: number, c: number) => r >= 0 && r < scene.size && c >= 0 && c < scene.size
    expect(scene.size).toBe(9)
    const keys = new Set<string>()
    for (const s of scene.stones) {
      expect(inside(s.r, s.c)).toBe(true)
      const key = `${s.r},${s.c}`
      expect(keys.has(key)).toBe(false)
      keys.add(key)
    }
    expect(inside(scene.target.r, scene.target.c)).toBe(true)
    expect(keys.has(`${scene.target.r},${scene.target.c}`)).toBe(false)
  })

  test.each(SCENES)('$id: 강조하는 줄의 칸은 모두 흑돌이거나 목표 자리이다', (scene) => {
    const black = new Set(scene.stones.filter((s) => s.color === 'black').map((s) => `${s.r},${s.c}`))
    black.add(`${scene.target.r},${scene.target.c}`)
    expect(scene.lines.length).toBeGreaterThan(0)
    for (const line of scene.lines) {
      expect(line.cells.length).toBeGreaterThanOrEqual(2)
      for (const [r, c] of line.cells) expect(black.has(`${r},${c}`)).toBe(true)
    }
  })

  test.each(SCENES)('$id: 설명 문구가 네 단계 모두 있다', (scene) => {
    expect(scene.captions).toHaveLength(4)
    for (const caption of scene.captions) expect(caption.trim().length).toBeGreaterThan(0)
    expect(scene.title.trim().length).toBeGreaterThan(0)
    expect(scene.summary.trim().length).toBeGreaterThan(0)
    expect(scene.details.length).toBeGreaterThan(0)
  })

  // 팝업은 문장 하나를 한 줄에 보여 준다(줄바꿈 없음). 한 줄에 들어가도록 문장은 짧게, 하나씩만 쓴다.
  const MAX_LEN = 36
  test.each(SCENES)('$id: 설명 문장은 하나씩이고 한 줄에 들어갈 만큼 짧다', (scene) => {
    for (const text of [...scene.captions, ...scene.details]) {
      expect(text.length, text).toBeLessThanOrEqual(MAX_LEN)
      // 문장 끝 표시(마침표)는 맨 끝에 하나만 있다. 괄호 안의 점이나 "4-4" 같은 표기는 해당하지 않는다.
      expect(text.slice(0, -1), text).not.toMatch(/[.!?]\s/)
    }
  })
})
