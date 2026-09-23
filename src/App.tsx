import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Download, Eye, Github, GripVertical, List, Plus, Printer, RotateCcw, SlidersHorizontal, Sparkles, Trash2, Upload } from 'lucide-react'

type Guest = { id: string; lines: string[] }
type FontWeight = 500 | 600 | 700
type Settings = {
  fillRatio: number
  sidePaddingMm: number
  lineGapMm: number
  fontWeight: FontWeight
  showGuides: boolean
  imageSide: 'left' | 'right'
  imageWidthMm: number
}
type State = {
  guests: Guest[]
  settings: Settings
  imageUrl: string
  imageName: string
  addGuest: () => void
  removeGuest: (id: string) => void
  updateGuest: (id: string, lines: string[]) => void
  replaceGuests: (blocks: string[][]) => void
  appendGuests: (blocks: string[][]) => void
  reorder: (from: number, to: number) => void
  updateSettings: (patch: Partial<Settings>) => void
  setImage: (url: string, name: string) => void
  clearImage: () => void
}

const TEMPLATE = {
  pageWidthMm: 210,
  pageHeightMm: 297,
  layoutTopMm: 5.5,
  layoutSideMm: 6,
  rowHeightMm: 68.6,
} as const
const GUIDE_MM = [74.1, 142.7, 211.3]
const PX_PER_MM = 96 / 25.4
const PAGE_WIDTH_PX = TEMPLATE.pageWidthMm * PX_PER_MM

const id = () => crypto.randomUUID?.() ?? `guest-${Date.now()}-${Math.random()}`
const guest = (lines: string[] = ['']): Guest => ({ id: id(), lines })

const useStore = create<State>()(
  persist(
    (set) => ({
      guests: [],
      settings: {
        fillRatio: 0.86,
        sidePaddingMm: 5,
        lineGapMm: 1.6,
        fontWeight: 600,
        showGuides: true,
        imageSide: 'left',
        imageWidthMm: 40,
      },
      imageUrl: '',
      imageName: '',
      addGuest: () => set((s) => ({ guests: [...s.guests, guest()] })),
      removeGuest: (gid) => set((s) => ({ guests: s.guests.filter((g) => g.id !== gid) })),
      updateGuest: (gid, lines) => set((s) => ({ guests: s.guests.map((g) => g.id === gid ? { ...g, lines } : g) })),
      replaceGuests: (blocks) => set({ guests: blocks.map(guest) }),
      appendGuests: (blocks) => set((s) => ({ guests: [...s.guests, ...blocks.map(guest)] })),
      reorder: (from, to) => set((s) => {
        const next = [...s.guests]
        const [moved] = next.splice(from, 1)
        if (!moved) return s
        next.splice(to, 0, moved)
        return { guests: next }
      }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setImage: (imageUrl, imageName) => set({ imageUrl, imageName }),
      clearImage: () => set({ imageUrl: '', imageName: '' }),
    }),
    {
      name: 'desk-card-studio-v2',
      partialize: (s) => ({ guests: s.guests, settings: s.settings }),
    },
  ),
)

function parseBlocks(raw: string) {
  const text = raw.replace(/\r/g, '').trim()
  if (!text) return []
  return text.split(/\n\s*\n+/).map((b) => b.split('\n').map((x) => x.trim()).filter(Boolean)).filter((x) => x.length)
}

function useScale(ref: React.RefObject<HTMLDivElement | null>, refreshKey: string) {
  const [scale, setScale] = useState(.72)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const update = () => setScale(Math.min(1, Math.max(.3, (node.clientWidth - 44) / PAGE_WIDTH_PX)))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(node)
    return () => ro.disconnect()
  }, [ref, refreshKey])
  return scale
}

function measureText(el: Element) {
  const range = document.createRange()
  range.selectNodeContents(el)
  const rect = range.getBoundingClientRect()
  range.detach?.()
  return rect
}

function useAutoFit(ref: React.RefObject<HTMLDivElement | null>, lines: string[], settings: Settings) {
  useLayoutEffect(() => {
    const cell = ref.current
    if (!cell || !lines.length) return
    let raf = 0
    const fit = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const lineEls = [...cell.querySelectorAll<HTMLElement>('[data-line]')]
        const stack = cell.querySelector<HTMLElement>('[data-stack]')
        if (!stack || !lineEls.length) return
        const cellRect = cell.getBoundingClientRect()
        const css = getComputedStyle(cell)
        const sx = cell.offsetWidth ? cellRect.width / cell.offsetWidth : 1
        const sy = cell.offsetHeight ? cellRect.height / cell.offsetHeight : 1
        const usableW = cellRect.width - (parseFloat(css.paddingLeft) + parseFloat(css.paddingRight)) * sx
        const usableH = cellRect.height - (parseFloat(css.paddingTop) + parseFloat(css.paddingBottom)) * sy
        const gap = (parseFloat(getComputedStyle(stack).gap) || 0) * sy
        const perLineH = (usableH - gap * Math.max(0, lineEls.length - 1)) / lineEls.length
        for (const line of lineEls) {
          let low = 8, high = 320
          for (let i = 0; i < 17; i++) {
            const mid = (low + high) / 2
            line.style.fontSize = `${mid}px`
            line.style.fontWeight = String(settings.fontWeight)
            const r = measureText(line)
            if (r.width <= usableW * settings.fillRatio && r.height <= perLineH * .92) low = mid
            else high = mid
          }
          line.style.fontSize = `${Math.max(8, low * .985)}px`
        }
      })
    }
    fit()
    document.fonts?.ready.then(fit).catch(() => undefined)
    const ro = new ResizeObserver(fit)
    ro.observe(cell)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [ref, lines.join('\n'), settings.fillRatio, settings.fontWeight, settings.sidePaddingMm, settings.lineGapMm])
}

function Face({ guest, inverted = false }: { guest?: Guest; inverted?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const settings = useStore((s) => s.settings)
  const imageUrl = useStore((s) => s.imageUrl)
  const lines = guest?.lines.filter((x) => x.trim()) ?? []
  useAutoFit(ref, lines, settings)
  const image = imageUrl ? <div className="desk-image" style={{ width: `${settings.imageWidthMm}mm` }}><img src={imageUrl} alt="" /></div> : null
  const text = <div ref={ref} className="desk-text" style={{ paddingLeft: `${settings.sidePaddingMm}mm`, paddingRight: `${settings.sidePaddingMm}mm` }}>
    <div data-stack className="text-stack" style={{ gap: `${settings.lineGapMm}mm` }}>
      {lines.map((line, i) => <div data-line className="text-line" style={{ fontWeight: settings.fontWeight }} key={`${line}-${i}`}>{line}</div>)}
    </div>
  </div>
  return <section className={`face ${inverted ? 'inverted' : ''}`}>{settings.imageSide === 'left' ? <>{image}{text}</> : <>{text}{image}</>}</section>
}

function Page({ pair, scale }: { pair: [Guest | undefined, Guest | undefined]; scale: number }) {
  const showGuides = useStore((s) => s.settings.showGuides)
  return <div className="page-shell" style={{ width: `${TEMPLATE.pageWidthMm * PX_PER_MM * scale}px`, height: `${TEMPLATE.pageHeightMm * PX_PER_MM * scale}px` }}>
    <div className="a4" style={{ transform: `scale(${scale})`, ['--top' as string]: `${TEMPLATE.layoutTopMm}mm`, ['--side' as string]: `${TEMPLATE.layoutSideMm}mm`, ['--row' as string]: `${TEMPLATE.rowHeightMm}mm` }}>
      <div className="page-grid">
        <Face guest={pair[0]} inverted /><Face guest={pair[0]} />
        <Face guest={pair[1]} inverted /><Face guest={pair[1]} />
      </div>
      {showGuides && <div className="guides" aria-hidden="true"><div className="outer" /><div className="guide g1" /><div className="guide g2" /><div className="guide g3" /></div>}
    </div>
  </div>
}

function SortableGuest({ item, index }: { item: Guest; index: number }) {
  const update = useStore((s) => s.updateGuest)
  const remove = useStore((s) => s.removeGuest)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  return <div ref={setNodeRef} className={`guest-card ${isDragging ? 'dragging' : ''}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
    <button className="drag" aria-label={`拖曳第 ${index + 1} 位`} {...attributes} {...listeners}><GripVertical size={18}/></button>
    <div className="guest-body"><span>#{index + 1}</span><textarea value={item.lines.join('\n')} rows={Math.max(2, item.lines.length)} onChange={(e) => update(item.id, e.target.value.split('\n'))} placeholder={'單位名稱\n姓名 職稱'} /></div>
    <button className="icon danger" aria-label="刪除" onClick={() => remove(item.id)}><Trash2 size={17}/></button>
  </div>
}

function LeftPanel() {
  const [raw, setRaw] = useState('')
  const guests = useStore((s) => s.guests)
  const add = useStore((s) => s.addGuest)
  const append = useStore((s) => s.appendGuests)
  const replace = useStore((s) => s.replaceGuests)
  const reorder = useStore((s) => s.reorder)
  const blocks = parseBlocks(raw)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const dragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const a = guests.findIndex((g) => g.id === active.id), b = guests.findIndex((g) => g.id === over.id)
    if (a >= 0 && b >= 0) reorder(a, b)
  }
  return <aside className="left-panel">
    <details className="bulk"><summary>批次貼上 <small>空白行分隔下一位</small></summary><div className="bulk-body">
      <textarea value={raw} rows={7} onChange={(e) => setRaw(e.target.value)} placeholder={'單位名稱\n姓名 職稱\n\n下一位\n姓名 職稱'} />
      <div className="bulk-actions"><span>{blocks.length} 位</span><button disabled={!blocks.length} onClick={() => append(blocks)}>追加</button><button className="dark" disabled={!blocks.length} onClick={() => replace(blocks)}>取代名單</button></div>
    </div></details>
    <div className="section-title"><div><b>桌牌名單</b><small>拖曳調整列印順序</small></div><button onClick={add}><Plus size={15}/>新增</button></div>
    {!guests.length ? <button className="empty" onClick={add}><Plus size={19}/>新增第一位桌牌</button> :
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}><SortableContext items={guests.map((g) => g.id)} strategy={verticalListSortingStrategy}><div className="guest-list">{guests.map((g,i) => <SortableGuest key={g.id} item={g} index={i}/>)}</div></SortableContext></DndContext>}
  </aside>
}

function SettingsPanel() {
  const fileRef = useRef<HTMLInputElement>(null)
  const settings = useStore((s) => s.settings)
  const update = useStore((s) => s.updateSettings)
  const imageUrl = useStore((s) => s.imageUrl)
  const imageName = useStore((s) => s.imageName)
  const setImage = useStore((s) => s.setImage)
  const clear = useStore((s) => s.clearImage)
  const choose = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return
    if (imageUrl.startsWith('blob:')) URL.revokeObjectURL(imageUrl)
    setImage(URL.createObjectURL(file), file.name)
  }
  return <aside className="right-panel">
    <div className="setting-card"><label className="cap">模板</label><b>A4 雙桌牌（實測）</b><div className="chips"><span>A4 直式</span><span>2 位 / 頁</span><span>上倒下正</span></div><small>橫線：{GUIDE_MM.join(' / ')} mm</small></div>
    <div className="setting-card"><label className="cap">文字</label>
      <label className="field"><span>填滿程度 <b>{Math.round(settings.fillRatio*100)}%</b></span><input type="range" min="70" max="94" value={Math.round(settings.fillRatio*100)} onChange={(e) => update({ fillRatio: +e.target.value/100 })}/></label>
      <label className="field"><span>字重</span><select value={settings.fontWeight} onChange={(e) => update({ fontWeight: +e.target.value as FontWeight })}><option value="500">500 Medium</option><option value="600">600 Semibold</option><option value="700">700 Bold</option></select></label>
      <div className="two"><label className="field"><span>左右留白 mm</span><input type="number" min="2" max="20" step=".5" value={settings.sidePaddingMm} onChange={(e)=>update({sidePaddingMm:+e.target.value||5})}/></label><label className="field"><span>行距 mm</span><input type="number" min="0" max="10" step=".2" value={settings.lineGapMm} onChange={(e)=>update({lineGapMm:+e.target.value||0})}/></label></div>
    </div>
    <div className="setting-card"><label className="cap">圖片（選用）</label><input ref={fileRef} hidden type="file" accept="image/*" onChange={(e)=>choose(e.target.files?.[0])}/>
      {!imageUrl ? <button className="upload" onClick={()=>fileRef.current?.click()}><Upload size={17}/>選擇圖片</button> : <div className="image-row"><div className="thumb"><img src={imageUrl} alt=""/></div><div><b>{imageName}</b><small>僅在本機處理</small></div><button className="icon" onClick={()=>{if(imageUrl.startsWith('blob:'))URL.revokeObjectURL(imageUrl);clear()}}><RotateCcw size={16}/></button></div>}
      {imageUrl && <><label className="field"><span>圖片位置</span><select value={settings.imageSide} onChange={(e)=>update({imageSide:e.target.value as 'left'|'right'})}><option value="left">左側</option><option value="right">右側</option></select></label><label className="field"><span>圖片欄寬 <b>{settings.imageWidthMm} mm</b></span><input type="range" min="25" max="55" value={settings.imageWidthMm} onChange={(e)=>update({imageWidthMm:+e.target.value})}/></label></>}
    </div>
    <label className="check"><input type="checkbox" checked={settings.showGuides} onChange={(e)=>update({showGuides:e.target.checked})}/>顯示裁切 / 折線</label>
  </aside>
}

type InstallPrompt = Event & { prompt:()=>Promise<void>; userChoice:Promise<{outcome:string}> }

export default function App() {
  const previewRef = useRef<HTMLDivElement>(null)
  const guests = useStore((s) => s.guests)
  const [mobileView, setMobileView] = useState<'edit' | 'preview' | 'settings'>(() =>
    useStore.getState().guests.length ? 'preview' : 'edit'
  )
  const scale = useScale(previewRef, mobileView)
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null)
  const pages: Array<[Guest|undefined,Guest|undefined]> = []
  for(let i=0;i<guests.length;i+=2) pages.push([guests[i],guests[i+1]])

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e as InstallPrompt) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  return <div className="studio">
    <header><div className="brand"><span><Sparkles size={17}/></span><div><b>Desk Card Studio</b><small>A4 頭對頭桌牌 · React PWA</small></div></div><div className="actions"><a href="https://github.com/jush0147/desk-card-maker" target="_blank"><Github size={17}/>GitHub</a>{installPrompt&&<button onClick={async()=>{await installPrompt.prompt();await installPrompt.userChoice;setInstallPrompt(null)}}><Download size={17}/>安裝</button>}<button className="print" onClick={()=>window.print()}><Printer size={17}/>列印 / PDF</button></div></header>
    <main className={`mobile-view-${mobileView}`}><LeftPanel/><section className="preview" ref={previewRef}><div className="preview-bar"><div><b>列印預覽</b><small>{guests.length} 位 · {Math.ceil(guests.length/2)} 頁</small></div><span>{Math.round(scale*100)}%</span></div><div className="canvas">{!pages.length?<div className="blank"><Sparkles size={26}/><h2>先放幾個名字進來</h2><p>批次貼上或逐張新增。字級、置中、正反面交給它處理。</p></div>:pages.map((pair,i)=><Page key={i} pair={pair} scale={scale}/>)}</div></section><SettingsPanel/></main>
    <nav className="mobile-nav" aria-label="主要功能">
      <button className={mobileView==='edit'?'active':''} onClick={()=>setMobileView('edit')}><List size={20}/><span>編輯</span></button>
      <button className={mobileView==='preview'?'active':''} onClick={()=>setMobileView('preview')}><Eye size={20}/><span>預覽</span></button>
      <button className={mobileView==='settings'?'active':''} onClick={()=>setMobileView('settings')}><SlidersHorizontal size={20}/><span>設定</span></button>
    </nav>
  </div>
}
