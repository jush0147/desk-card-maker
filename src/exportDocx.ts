import JSZip from 'jszip'

export type WordGuest = {
  lines: string[]
  sizesPt: number[]
}

export type WordExportOptions = {
  guests: WordGuest[]
  fontName: string
  bold: boolean
}

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'

const q = (name: string) => `w:${name}`

function createWordRun(doc: XMLDocument, text: string, fontName: string, sizePt: number, bold: boolean) {
  const run = doc.createElementNS(W, q('r'))
  const props = doc.createElementNS(W, q('rPr'))

  const fonts = doc.createElementNS(W, q('rFonts'))
  fonts.setAttributeNS(W, q('ascii'), fontName)
  fonts.setAttributeNS(W, q('hAnsi'), fontName)
  fonts.setAttributeNS(W, q('eastAsia'), fontName)
  fonts.setAttributeNS(W, q('hint'), 'eastAsia')
  props.appendChild(fonts)

  if (bold) props.appendChild(doc.createElementNS(W, q('b')))

  const size = Math.max(16, Math.round(sizePt * 2))
  const sz = doc.createElementNS(W, q('sz'))
  sz.setAttributeNS(W, q('val'), String(size))
  props.appendChild(sz)
  const szCs = doc.createElementNS(W, q('szCs'))
  szCs.setAttributeNS(W, q('val'), String(size))
  props.appendChild(szCs)

  run.appendChild(props)
  const node = doc.createElementNS(W, q('t'))
  if (/^\s|\s$/.test(text)) node.setAttribute('xml:space', 'preserve')
  node.textContent = text
  run.appendChild(node)
  return run
}

function findWordParagraph(node: Element) {
  let current: Element | null = node
  while (current) {
    if (current.namespaceURI === W && current.localName === 'p') return current
    current = current.parentElement
  }
  return null
}

function replacePlaceholder(doc: XMLDocument, scope: Element, token: string, guest: WordGuest | undefined, fontName: string, bold: boolean) {
  const targets = Array.from(scope.getElementsByTagNameNS(W, 't'))
    .filter((node) => node.textContent?.includes(token))

  for (const target of targets) {
    const paragraph = findWordParagraph(target)
    if (!paragraph) continue

    for (const run of Array.from(paragraph.getElementsByTagNameNS(W, 'r'))) {
      if (run.parentNode === paragraph) paragraph.removeChild(run)
    }

    const lines = guest?.lines.filter((line) => line.trim()) ?? []
    if (!lines.length) continue

    lines.forEach((line, index) => {
      if (index > 0) {
        const breakRun = doc.createElementNS(W, q('r'))
        breakRun.appendChild(doc.createElementNS(W, q('br')))
        paragraph.appendChild(breakRun)
      }
      const sizePt = guest?.sizesPt[index] ?? guest?.sizesPt[0] ?? 56
      paragraph.appendChild(createWordRun(doc, line, fontName, sizePt, bold))
    })
  }
}

function addPageBreak(doc: XMLDocument) {
  const p = doc.createElementNS(W, q('p'))
  const r = doc.createElementNS(W, q('r'))
  const br = doc.createElementNS(W, q('br'))
  br.setAttributeNS(W, q('type'), 'page')
  r.appendChild(br)
  p.appendChild(r)
  return p
}

function renumberDrawingIds(scope: Element, start: number) {
  let next = start
  for (const node of Array.from(scope.getElementsByTagNameNS(WP, 'docPr'))) {
    node.setAttribute('id', String(next++))
  }
  return next
}

export async function exportDeskCardsToWord(options: WordExportOptions) {
  const response = await fetch(`${import.meta.env.BASE_URL}desk-card-template.docx`)
  if (!response.ok) throw new Error('無法載入 Word 範本')

  const zip = await JSZip.loadAsync(await response.arrayBuffer())
  const file = zip.file('word/document.xml')
  if (!file) throw new Error('Word 範本缺少 document.xml')

  const xml = await file.async('string')
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Word 範本解析失敗')

  const body = doc.getElementsByTagNameNS(W, 'body')[0]
  const templateTable = Array.from(body.children).find((node) => node.namespaceURI === W && node.localName === 'tbl')
  const sectPr = Array.from(body.children).find((node) => node.namespaceURI === W && node.localName === 'sectPr')
  if (!templateTable || !sectPr) throw new Error('Word 範本版面結構不完整')

  for (const child of Array.from(body.children)) {
    if (child !== sectPr) body.removeChild(child)
  }

  const pageCount = Math.max(1, Math.ceil(options.guests.length / 2))
  let drawingId = 1

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const table = templateTable.cloneNode(true) as Element
    const first = options.guests[pageIndex * 2]
    const second = options.guests[pageIndex * 2 + 1]

    replacePlaceholder(doc, table, '[[G1]]', first, options.fontName, options.bold)
    replacePlaceholder(doc, table, '[[G2]]', second, options.fontName, options.bold)
    drawingId = renumberDrawingIds(table, drawingId)

    body.insertBefore(table, sectPr)
    if (pageIndex < pageCount - 1) body.insertBefore(addPageBreak(doc), sectPr)
  }

  const serialized = new XMLSerializer().serializeToString(doc)
  zip.file('word/document.xml', serialized)

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  })

  const url = URL.createObjectURL(blob)
  const filename = `桌牌-${new Date().toISOString().slice(0, 10)}.docx`
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  return filename
}
