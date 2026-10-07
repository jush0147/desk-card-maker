export function parseBlocks(raw: string) {
  const text = raw.replace(/\r/g, '').trim()
  if (!text) return []
  return text
    .split(/\n\s*\n+/)
    .map((block) => block.split('\n').map((line) => line.trim()).filter(Boolean))
    .filter((block) => block.length)
}

export function paginatePairs<T>(items: T[]): Array<[T | undefined, T | undefined]> {
  const pages: Array<[T | undefined, T | undefined]> = []
  for (let index = 0; index < items.length; index += 2) {
    pages.push([items[index], items[index + 1]])
  }
  return pages
}

export function clampScale(value: number) {
  return Math.min(1.4, Math.max(0.3, value))
}
