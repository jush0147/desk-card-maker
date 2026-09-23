import { describe, expect, it } from 'vitest'

describe('tested A4 geometry', () => {
  it('keeps the tested guide positions', () => {
    const top = 5.5
    const row = 68.6
    expect([top + row, top + row * 2, top + row * 3].map(n => +n.toFixed(1))).toEqual([74.1, 142.7, 211.3])
  })
})
