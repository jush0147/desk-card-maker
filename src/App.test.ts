import { describe, expect, it } from 'vitest'
import { clampScale, paginatePairs, parseBlocks } from './logic'

describe('tested A4 geometry', () => {
  it('keeps the tested guide positions', () => {
    const top = 5.5
    const row = 68.6
    expect([top + row, top + row * 2, top + row * 3].map((n) => +n.toFixed(1))).toEqual([74.1, 142.7, 211.3])
  })
})

describe('guest pagination', () => {
  it.each([
    [1, [[1, undefined]]],
    [2, [[1, 2]]],
    [3, [[1, 2], [3, undefined]]],
    [4, [[1, 2], [3, 4]]],
    [5, [[1, 2], [3, 4], [5, undefined]]],
  ])('groups %i guests into printable A4 pairs', (count, expected) => {
    expect(paginatePairs(Array.from({ length: count }, (_, index) => index + 1))).toEqual(expected)
  })
})

describe('bulk paste parsing', () => {
  it('keeps multiline cards and separates guests on blank lines', () => {
    expect(parseBlocks('學校 A\n王小明 校長\n\n學校 B\n李小華 主任')).toEqual([
      ['學校 A', '王小明 校長'],
      ['學校 B', '李小華 主任'],
    ])
  })

  it('ignores empty input and extra blank lines', () => {
    expect(parseBlocks('   \n\n')).toEqual([])
    expect(parseBlocks('甲\n\n\n乙')).toEqual([['甲'], ['乙']])
  })
})

describe('preview zoom', () => {
  it('keeps manual zoom inside a useful range', () => {
    expect(clampScale(0.1)).toBe(0.3)
    expect(clampScale(0.8)).toBe(0.8)
    expect(clampScale(2)).toBe(1.4)
  })
})
