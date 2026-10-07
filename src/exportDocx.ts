import JSZip from 'jszip'

export type WordGuest = {
  lines: string[]
  sizesPt: number[]
}

export type WordExportOptions = {
  guests: WordGuest[]
  fontName: string
  bold: boolean
  showGuides: boolean
  image?: {
    url: string
    side: 'left' | 'right'
    widthMm: number
  }
}

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PACKAGE_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const CONTENT_TYPES = 'http://schemas.openxmlformats.org/package/2006/content-types'
const IMAGE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'
const EMU_PER_MM = 36000
const TWIPS_PER_MM = 1440 / 25.4

const q = (name: string) => `w:${name}`

function parseXml(xml: string, message: string) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error(message)
  return doc
}

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

function appendGuestRuns(
  doc: XMLDocument,
  paragraph: Element,
  guest: WordGuest | undefined,
  fontName: string,
  bold: boolean,
) {
  const lines = guest?.lines.filter((line) => line.trim()) ?? []
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

function findWordParagraph(node: Element) {
  let current: Element | null = node
  while (current) {
    if (current.namespaceURI === W && current.localName === 'p') return current
    current = current.parentElement
  }
  return null
}

function createBorderlessTableProperties(doc: XMLDocument) {
  const props = doc.createElementNS(W, q('tblPr'))
  const width = doc.createElementNS(W, q('tblW'))
  width.setAttributeNS(W, q('w'), '5000')
  width.setAttributeNS(W, q('type'), 'pct')
  props.appendChild(width)

  const layout = doc.createElementNS(W, q('tblLayout'))
  layout.setAttributeNS(W, q('type'), 'fixed')
  props.appendChild(layout)

  const borders = doc.createElementNS(W, q('tblBorders'))
  for (const edge of ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']) {
    const border = doc.createElementNS(W, q(edge))
    border.setAttributeNS(W, q('val'), 'nil')
    borders.appendChild(border)
  }
  props.appendChild(borders)
  return props
}

function createTableCell(doc: XMLDocument, widthTwips: number) {
  const cell = doc.createElementNS(W, q('tc'))
  const props = doc.createElementNS(W, q('tcPr'))

  const width = doc.createElementNS(W, q('tcW'))
  width.setAttributeNS(W, q('w'), String(Math.round(widthTwips)))
  width.setAttributeNS(W, q('type'), 'dxa')
  props.appendChild(width)

  const vertical = doc.createElementNS(W, q('vAlign'))
  vertical.setAttributeNS(W, q('val'), 'center')
  props.appendChild(vertical)

  const margins = doc.createElementNS(W, q('tcMar'))
  for (const side of ['top', 'bottom', 'left', 'right']) {
    const margin = doc.createElementNS(W, q(side))
    margin.setAttributeNS(W, q('w'), side === 'left' || side === 'right' ? '80' : '0')
    margin.setAttributeNS(W, q('type'), 'dxa')
    margins.appendChild(margin)
  }
  props.appendChild(margins)
  cell.appendChild(props)
  return cell
}

function createImageRun(
  doc: XMLDocument,
  relationshipId: string,
  widthMm: number,
  heightMm: number,
) {
  const cx = Math.round(widthMm * EMU_PER_MM)
  const cy = Math.round(heightMm * EMU_PER_MM)
  const run = doc.createElementNS(W, q('r'))
  const drawing = doc.createElementNS(W, q('drawing'))
  const inline = doc.createElementNS(WP, 'wp:inline')
  inline.setAttribute('distT', '0')
  inline.setAttribute('distB', '0')
  inline.setAttribute('distL', '0')
  inline.setAttribute('distR', '0')

  const extent = doc.createElementNS(WP, 'wp:extent')
  extent.setAttribute('cx', String(cx))
  extent.setAttribute('cy', String(cy))
  inline.appendChild(extent)

  const effectExtent = doc.createElementNS(WP, 'wp:effectExtent')
  effectExtent.setAttribute('l', '0')
  effectExtent.setAttribute('t', '0')
  effectExtent.setAttribute('r', '0')
  effectExtent.setAttribute('b', '0')
  inline.appendChild(effectExtent)

  const docPr = doc.createElementNS(WP, 'wp:docPr')
  docPr.setAttribute('id', '1')
  docPr.setAttribute('name', 'Desk card image')
  inline.appendChild(docPr)

  const frameProps = doc.createElementNS(WP, 'wp:cNvGraphicFramePr')
  const frameLocks = doc.createElementNS(A, 'a:graphicFrameLocks')
  frameLocks.setAttribute('noChangeAspect', '1')
  frameProps.appendChild(frameLocks)
  inline.appendChild(frameProps)

  const graphic = doc.createElementNS(A, 'a:graphic')
  const graphicData = doc.createElementNS(A, 'a:graphicData')
  graphicData.setAttribute('uri', PIC)
  const picture = doc.createElementNS(PIC, 'pic:pic')

  const nonVisual = doc.createElementNS(PIC, 'pic:nvPicPr')
  const nonVisualProps = doc.createElementNS(PIC, 'pic:cNvPr')
  nonVisualProps.setAttribute('id', '0')
  nonVisualProps.setAttribute('name', 'Desk card image')
  nonVisual.appendChild(nonVisualProps)
  nonVisual.appendChild(doc.createElementNS(PIC, 'pic:cNvPicPr'))
  picture.appendChild(nonVisual)

  const blipFill = doc.createElementNS(PIC, 'pic:blipFill')
  const blip = doc.createElementNS(A, 'a:blip')
  blip.setAttributeNS(R, 'r:embed', relationshipId)
  blipFill.appendChild(blip)
  const stretch = doc.createElementNS(A, 'a:stretch')
  stretch.appendChild(doc.createElementNS(A, 'a:fillRect'))
  blipFill.appendChild(stretch)
  picture.appendChild(blipFill)

  const shapeProps = doc.createElementNS(PIC, 'pic:spPr')
  const transform = doc.createElementNS(A, 'a:xfrm')
  const offset = doc.createElementNS(A, 'a:off')
  offset.setAttribute('x', '0')
  offset.setAttribute('y', '0')
  transform.appendChild(offset)
  const ext = doc.createElementNS(A, 'a:ext')
  ext.setAttribute('cx', String(cx))
  ext.setAttribute('cy', String(cy))
  transform.appendChild(ext)
  shapeProps.appendChild(transform)
  const geometry = doc.createElementNS(A, 'a:prstGeom')
  geometry.setAttribute('prst', 'rect')
  geometry.appendChild(doc.createElementNS(A, 'a:avLst'))
  shapeProps.appendChild(geometry)
  picture.appendChild(shapeProps)

  graphicData.appendChild(picture)
  graphic.appendChild(graphicData)
  inline.appendChild(graphic)
  drawing.appendChild(inline)
  run.appendChild(drawing)
  return run
}

function createImageParagraph(
  doc: XMLDocument,
  relationshipId: string,
  widthMm: number,
  heightMm: number,
) {
  const paragraph = doc.createElementNS(W, q('p'))
  const props = doc.createElementNS(W, q('pPr'))
  const justify = doc.createElementNS(W, q('jc'))
  justify.setAttributeNS(W, q('val'), 'center')
  props.appendChild(justify)
  paragraph.appendChild(props)
  paragraph.appendChild(createImageRun(doc, relationshipId, widthMm, heightMm))
  return paragraph
}

function createTextParagraph(
  doc: XMLDocument,
  original: Element,
  guest: WordGuest | undefined,
  fontName: string,
  bold: boolean,
) {
  const paragraph = doc.createElementNS(W, q('p'))
  const originalProps = Array.from(original.children)
    .find((child) => child.namespaceURI === W && child.localName === 'pPr')
  if (originalProps) paragraph.appendChild(originalProps.cloneNode(true))
  appendGuestRuns(doc, paragraph, guest, fontName, bold)
  return paragraph
}

function replaceParagraphWithImageLayout(
  doc: XMLDocument,
  paragraph: Element,
  guest: WordGuest | undefined,
  fontName: string,
  bold: boolean,
  image: { relationshipId: string; side: 'left' | 'right'; widthMm: number; heightMm: number },
) {
  const parent = paragraph.parentElement
  if (!parent || parent.namespaceURI !== W || parent.localName !== 'tc') return false

  const totalWidthMm = 198
  const imageColumnMm = Math.min(62, Math.max(30, image.widthMm + 6))
  const textColumnMm = Math.max(80, totalWidthMm - imageColumnMm)
  const imageWidthTwips = imageColumnMm * TWIPS_PER_MM
  const textWidthTwips = textColumnMm * TWIPS_PER_MM

  const table = doc.createElementNS(W, q('tbl'))
  table.appendChild(createBorderlessTableProperties(doc))

  const grid = doc.createElementNS(W, q('tblGrid'))
  const widths = image.side === 'left'
    ? [imageWidthTwips, textWidthTwips]
    : [textWidthTwips, imageWidthTwips]
  for (const columnWidth of widths) {
    const column = doc.createElementNS(W, q('gridCol'))
    column.setAttributeNS(W, q('w'), String(Math.round(columnWidth)))
    grid.appendChild(column)
  }
  table.appendChild(grid)

  const row = doc.createElementNS(W, q('tr'))
  const imageCell = createTableCell(doc, imageWidthTwips)
  imageCell.appendChild(createImageParagraph(
    doc,
    image.relationshipId,
    image.widthMm,
    image.heightMm,
  ))
  const textCell = createTableCell(doc, textWidthTwips)
  textCell.appendChild(createTextParagraph(doc, paragraph, guest, fontName, bold))

  if (image.side === 'left') {
    row.appendChild(imageCell)
    row.appendChild(textCell)
  } else {
    row.appendChild(textCell)
    row.appendChild(imageCell)
  }
  table.appendChild(row)

  parent.replaceChild(table, paragraph)
  const trailingParagraph = doc.createElementNS(W, q('p'))
  if (table.nextSibling) parent.insertBefore(trailingParagraph, table.nextSibling)
  else parent.appendChild(trailingParagraph)
  return true
}

function replacePlaceholder(
  doc: XMLDocument,
  scope: Element,
  token: string,
  guest: WordGuest | undefined,
  fontName: string,
  bold: boolean,
  image?: { relationshipId: string; side: 'left' | 'right'; widthMm: number; heightMm: number },
) {
  const targets = Array.from(scope.getElementsByTagNameNS(W, 't'))
    .filter((node) => node.textContent?.includes(token))

  for (const target of targets) {
    const paragraph = findWordParagraph(target)
    if (!paragraph) continue

    if (image && replaceParagraphWithImageLayout(
      doc,
      paragraph,
      guest,
      fontName,
      bold,
      image,
    )) continue

    for (const run of Array.from(paragraph.getElementsByTagNameNS(W, 'r'))) {
      if (run.parentNode === paragraph) paragraph.removeChild(run)
    }
    appendGuestRuns(doc, paragraph, guest, fontName, bold)
  }
}

function setTableGuides(doc: XMLDocument, table: Element, showGuides: boolean) {
  const tblPr = table.getElementsByTagNameNS(W, 'tblPr')[0]
  if (!tblPr) return

  for (const existing of Array.from(tblPr.getElementsByTagNameNS(W, 'tblBorders'))) {
    if (existing.parentNode === tblPr) tblPr.removeChild(existing)
  }

  const borders = doc.createElementNS(W, q('tblBorders'))
  for (const edge of ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']) {
    const border = doc.createElementNS(W, q(edge))
    border.setAttributeNS(W, q('val'), showGuides ? 'single' : 'nil')
    border.setAttributeNS(W, q('sz'), '4')
    border.setAttributeNS(W, q('space'), '0')
    border.setAttributeNS(W, q('color'), 'auto')
    borders.appendChild(border)
  }
  tblPr.appendChild(borders)
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

function loadImageElement(blob: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('圖片解析失敗'))
    }
    image.src = url
  })
}

async function prepareImage(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('無法載入桌牌圖片')
  const source = await response.blob()
  const image = await loadImageElement(source)
  const widthPx = image.naturalWidth || image.width
  const heightPx = image.naturalHeight || image.height
  if (!widthPx || !heightPx) throw new Error('圖片尺寸無法辨識')

  if (source.type === 'image/png' || source.type === 'image/jpeg') {
    return {
      bytes: new Uint8Array(await source.arrayBuffer()),
      extension: source.type === 'image/png' ? 'png' : 'jpg',
      mime: source.type,
      ratio: heightPx / widthPx,
    }
  }

  const maxDimension = 1600
  const scale = Math.min(1, maxDimension / Math.max(widthPx, heightPx))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(widthPx * scale))
  canvas.height = Math.max(1, Math.round(heightPx * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('圖片轉換失敗')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const png = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('圖片轉換失敗')),
      'image/png',
    )
  })
  return {
    bytes: new Uint8Array(await png.arrayBuffer()),
    extension: 'png',
    mime: 'image/png',
    ratio: heightPx / widthPx,
  }
}

async function addImageToPackage(zip: JSZip, imageUrl: string) {
  const prepared = await prepareImage(imageUrl)
  const mediaName = `desk-card-image.${prepared.extension}`
  zip.file(`word/media/${mediaName}`, prepared.bytes)

  const contentTypesFile = zip.file('[Content_Types].xml')
  if (!contentTypesFile) throw new Error('Word 範本缺少 Content_Types')
  const contentTypesDoc = parseXml(
    await contentTypesFile.async('string'),
    'Word Content_Types 解析失敗',
  )
  const typesRoot = contentTypesDoc.documentElement
  const hasType = Array.from(typesRoot.getElementsByTagNameNS(CONTENT_TYPES, 'Default'))
    .some((node) => node.getAttribute('Extension')?.toLowerCase() === prepared.extension)
  if (!hasType) {
    const entry = contentTypesDoc.createElementNS(CONTENT_TYPES, 'Default')
    entry.setAttribute('Extension', prepared.extension)
    entry.setAttribute('ContentType', prepared.mime)
    typesRoot.appendChild(entry)
    zip.file('[Content_Types].xml', new XMLSerializer().serializeToString(contentTypesDoc))
  }

  const relsPath = 'word/_rels/document.xml.rels'
  const relsFile = zip.file(relsPath)
  const relsXml = relsFile
    ? await relsFile.async('string')
    : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' +
      PACKAGE_REL + '"></Relationships>'
  const relsDoc = parseXml(relsXml, 'Word relationships 解析失敗')
  const relsRoot = relsDoc.documentElement
  const ids = Array.from(relsRoot.getElementsByTagNameNS(PACKAGE_REL, 'Relationship'))
    .map((node) => Number(node.getAttribute('Id')?.match(/^rId(\d+)$/)?.[1] ?? 0))
  const relationshipId = `rId${Math.max(0, ...ids) + 1}`
  const relationship = relsDoc.createElementNS(PACKAGE_REL, 'Relationship')
  relationship.setAttribute('Id', relationshipId)
  relationship.setAttribute('Type', IMAGE_REL)
  relationship.setAttribute('Target', `media/${mediaName}`)
  relsRoot.appendChild(relationship)
  zip.file(relsPath, new XMLSerializer().serializeToString(relsDoc))

  return { relationshipId, ratio: prepared.ratio }
}

export async function exportDeskCardsToWord(options: WordExportOptions) {
  const response = await fetch(`${import.meta.env.BASE_URL}desk-card-template.docx`)
  if (!response.ok) throw new Error('無法載入 Word 範本')

  const zip = await JSZip.loadAsync(await response.arrayBuffer())
  const file = zip.file('word/document.xml')
  if (!file) throw new Error('Word 範本缺少 document.xml')

  const xml = await file.async('string')
  const doc = parseXml(xml, 'Word 範本解析失敗')

  const body = doc.getElementsByTagNameNS(W, 'body')[0]
  const templateTable = Array.from(body.children)
    .find((node) => node.namespaceURI === W && node.localName === 'tbl')
  const sectPr = Array.from(body.children)
    .find((node) => node.namespaceURI === W && node.localName === 'sectPr')
  if (!templateTable || !sectPr) throw new Error('Word 範本版面結構不完整')

  let imageLayout:
    | { relationshipId: string; side: 'left' | 'right'; widthMm: number; heightMm: number }
    | undefined
  if (options.image) {
    const packaged = await addImageToPackage(zip, options.image.url)
    const maxHeightMm = 54
    let widthMm = options.image.widthMm
    let heightMm = widthMm * packaged.ratio
    if (heightMm > maxHeightMm) {
      const shrink = maxHeightMm / heightMm
      widthMm *= shrink
      heightMm = maxHeightMm
    }
    imageLayout = {
      relationshipId: packaged.relationshipId,
      side: options.image.side,
      widthMm,
      heightMm,
    }
  }

  for (const child of Array.from(body.children)) {
    if (child !== sectPr) body.removeChild(child)
  }

  const pageCount = Math.max(1, Math.ceil(options.guests.length / 2))
  let drawingId = 1

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const table = templateTable.cloneNode(true) as Element
    const first = options.guests[pageIndex * 2]
    const second = options.guests[pageIndex * 2 + 1]

    replacePlaceholder(
      doc,
      table,
      '[[G1]]',
      first,
      options.fontName,
      options.bold,
      imageLayout,
    )
    replacePlaceholder(
      doc,
      table,
      '[[G2]]',
      second,
      options.fontName,
      options.bold,
      imageLayout,
    )
    setTableGuides(doc, table, options.showGuides)
    drawingId = renumberDrawingIds(table, drawingId)

    body.insertBefore(table, sectPr)
    if (pageIndex < pageCount - 1) body.insertBefore(addPageBreak(doc), sectPr)
  }

  zip.file('word/document.xml', new XMLSerializer().serializeToString(doc))

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
