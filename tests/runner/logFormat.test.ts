import { describe, expect, test } from 'vitest'
import { coordText, formatEvent, parseMoveLine } from '../../src/runner/logFormat'

const names = { black: 'Player', white: 'AI 중' }

describe('coordText', () => {
  test('(행, 열) 형식', () => {
    expect(coordText({ row: 7, col: 7 })).toBe('(7, 7)')
    expect(coordText({ row: 0, col: 14 })).toBe('(0, 14)')
  })
})

describe('parseMoveLine', () => {
  test('이동 기록 줄을 수 번호, 돌 색, 이름, 좌표로 나눈다', () => {
    expect(parseMoveLine('1. 흑 Player (7, 7)')).toEqual({
      no: 1,
      color: 'black',
      who: 'Player',
      coord: '(7, 7)',
    })
    expect(parseMoveLine('12. 백 AI 중 (5, 14)')).toEqual({
      no: 12,
      color: 'white',
      who: 'AI 중',
      coord: '(5, 14)',
    })
  })

  test('formatEvent가 만든 move 줄은 항상 읽을 수 있다', () => {
    const [line] = formatEvent(
      { type: 'move', moveNumber: 33, color: 2, move: { row: 0, col: 3 } },
      { black: 'Player', white: 'AI 상' },
    )
    expect(parseMoveLine(line.text)).toEqual({ no: 33, color: 'white', who: 'AI 상', coord: '(0, 3)' })
  })

  test('이동 기록이 아닌 줄은 null', () => {
    expect(parseMoveLine('print: 1. 흑 가짜 (1, 1)')).toBeNull()
    expect(parseMoveLine('대국 시작 · 흑 Player / 백 AI 중')).toBeNull()
    expect(parseMoveLine('흑 Player 반칙: (15, 3)은 판 밖입니다.')).toBeNull()
    expect(parseMoveLine('')).toBeNull()
  })
})

describe('formatEvent', () => {
  test('start', () => {
    expect(formatEvent({ type: 'start', black: 'Player', white: 'AI 중' }, names)).toEqual([
      { kind: 'info', text: '대국 시작 · 흑 Player / 백 AI 중' },
    ])
  })

  test('move: 수 번호, 색, 이름, 좌표', () => {
    expect(
      formatEvent({ type: 'move', moveNumber: 3, color: 1, move: { row: 7, col: 8 } }, names),
    ).toEqual([{ kind: 'move', text: '3. 흑 Player (7, 8)' }])
    expect(
      formatEvent({ type: 'move', moveNumber: 4, color: 2, move: { row: 6, col: 6 } }, names),
    ).toEqual([{ kind: 'move', text: '4. 백 AI 중 (6, 6)' }])
  })

  test('move의 stdout은 줄마다 print 줄이 되고 빈 줄은 빠진다', () => {
    const lines = formatEvent(
      { type: 'move', moveNumber: 1, color: 1, move: { row: 7, col: 7 }, stdout: 'a\n\nb\n' },
      names,
    )
    expect(lines).toEqual([
      { kind: 'move', text: '1. 흑 Player (7, 7)' },
      { kind: 'print', text: 'print: a' },
      { kind: 'print', text: 'print: b' },
    ])
  })

  test('stdout이 없거나 비어 있으면 print 줄이 없다', () => {
    const lines = formatEvent(
      { type: 'move', moveNumber: 1, color: 1, move: { row: 7, col: 7 }, stdout: '' },
      names,
    )
    expect(lines).toHaveLength(1)
  })

  test('foul: 색과 이름과 메시지, failure.stdout은 print 줄로', () => {
    const lines = formatEvent(
      {
        type: 'foul',
        color: 1,
        reason: 'failure',
        message: 'ValueError: x (3번째 줄)',
        failure: { kind: 'exception', message: 'ValueError: x', stdout: '디버그\n' },
      },
      names,
    )
    expect(lines).toEqual([
      { kind: 'error', text: '흑 Player 반칙: ValueError: x (3번째 줄)' },
      { kind: 'print', text: 'print: 디버그' },
    ])
  })

  test('failure 없이 stdout만 있는 foul(판 밖, 금수 등)도 print 줄을 낸다', () => {
    const lines = formatEvent(
      { type: 'foul', color: 1, reason: 'out-of-board', message: '(15, 3)은 판 밖입니다.', stdout: 'debug here\n' },
      names,
    )
    expect(lines).toEqual([
      { kind: 'error', text: '흑 Player 반칙: (15, 3)은 판 밖입니다.' },
      { kind: 'print', text: 'print: debug here' },
    ])
  })

  test('foul의 줄 번호가 있으면 메시지 뒤에 n번째 줄을 붙인다', () => {
    const lines = formatEvent(
      {
        type: 'foul',
        color: 1,
        reason: 'failure',
        message: 'ValueError: x',
        failure: { kind: 'exception', message: 'ValueError: x', line: 3 },
      },
      names,
    )
    expect(lines[0].text).toBe('흑 Player 반칙: ValueError: x (3번째 줄)')
  })

  test('foul: 판 밖/금수 등은 메시지를 그대로', () => {
    const lines = formatEvent(
      { type: 'foul', color: 2, reason: 'occupied', message: '(7, 7)에는 이미 돌이 있습니다.' },
      names,
    )
    expect(lines).toEqual([{ kind: 'error', text: '백 AI 중 반칙: (7, 7)에는 이미 돌이 있습니다.' }])
  })

  test('end: 이유별 문구', () => {
    expect(formatEvent({ type: 'end', winner: 1, reason: 'five', line: [] }, names)).toEqual([
      { kind: 'result', text: 'Player 승리' },
    ])
    expect(formatEvent({ type: 'end', winner: 2, reason: 'full', line: null }, names)).toEqual([
      { kind: 'result', text: 'AI 중 승리 (판이 가득 차서 백 승리)' },
    ])
    expect(formatEvent({ type: 'end', winner: 2, reason: 'foul', line: null }, names)).toEqual([
      { kind: 'result', text: 'AI 중 승리 (상대 반칙)' },
    ])
  })
})
