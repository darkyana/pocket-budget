import { useRef, useState } from 'react'

const PRESS_MS = 450
const CANCEL_SLOP = 10
const GHOST_CLICK_MS = 400

export function useDragSort(count: number, onCommit: (from: number, to: number) => void) {
  const [drag, setDrag] = useState<{ from: number; hover: number; dy: number } | null>(null)
  const dragRef = useRef<{ from: number; hover: number; dy: number } | null>(null)
  dragRef.current = drag
  const rows = useRef<Array<HTMLDivElement | null>>([])
  rows.current.length = count
  const press = useRef<{ id: number; y: number; index: number; el: HTMLDivElement } | null>(null)
  const active = useRef<{ from: number; startY: number; centers: number[]; height: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const suppressGhostClick = useRef(false)

  function activate(index: number, startY: number) {
    const p = press.current
    if (!p) return
    const centers: number[] = []
    let height = 0
    for (const el of rows.current) {
      if (!el) {
        centers.push(NaN)
        continue
      }
      const r = el.getBoundingClientRect()
      centers.push(r.top + r.height / 2)
      height = r.height
    }
    active.current = { from: index, startY, centers, height }
    try {
      p.el.setPointerCapture(p.id)
    } catch {}
    document.addEventListener('touchmove', preventTouchMove, { passive: false })
    setDrag({ from: index, hover: index, dy: 0 })
  }

  function finish(commit: boolean) {
    window.clearTimeout(timer.current)
    document.removeEventListener('touchmove', preventTouchMove)
    const a = active.current
    if (a) {
      const d = dragRef.current
      if (commit && d && d.hover !== d.from) onCommit(d.from, d.hover)
      suppressGhostClick.current = true
      window.setTimeout(() => (suppressGhostClick.current = false), GHOST_CLICK_MS)
    }
    active.current = null
    press.current = null
    setDrag(null)
  }

  function cancelPickupForScroll() {
    window.clearTimeout(timer.current)
    press.current = null
  }

  function shiftOf(i: number): number {
    const d = drag
    if (!d || !active.current || i === d.from) return 0
    const h = active.current.height
    if (d.from < d.hover && i > d.from && i <= d.hover) return -h
    if (d.from > d.hover && i >= d.hover && i < d.from) return h
    return 0
  }

  function rowProps(i: number) {
    const dragging = drag?.from === i
    const shift = shiftOf(i)
    return {
      ref: (el: HTMLDivElement | null) => {
        rows.current[i] = el
      },
      className: dragging ? 'setrow drag-sorting' : 'setrow',
      style: dragging ? ({ transform: `translateY(${drag!.dy}px) scale(1.02)` } as const) : shift ? ({ transform: `translateY(${shift}px)` } as const) : undefined,
      onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return
        press.current = { id: e.pointerId, y: e.clientY, index: i, el: e.currentTarget }
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => activate(i, e.clientY), PRESS_MS)
      },
      onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
        const p = press.current
        if (!p) return
        if (!active.current) {
          if (Math.abs(e.clientY - p.y) > CANCEL_SLOP) cancelPickupForScroll()
          return
        }
        const pointerY = e.clientY
        let hover = active.current.from
        let best = Infinity
        active.current.centers.forEach((c, j) => {
          if (Number.isNaN(c)) return
          const dist = Math.abs(pointerY - c)
          if (dist < best) {
            best = dist
            hover = j
          }
        })
        setDrag({ from: active.current.from, hover, dy: pointerY - active.current.startY })
      },
      onPointerUp: () => finish(true),
      onPointerCancel: () => finish(false),
      onContextMenu: (e: React.MouseEvent) => {
        if (press.current || active.current) e.preventDefault()
      },
    }
  }

  function guardClick(): boolean {
    if (suppressGhostClick.current) {
      suppressGhostClick.current = false
      return true
    }
    return false
  }

  return { rowProps, guardClick }
}

function preventTouchMove(e: TouchEvent) {
  e.preventDefault()
}

export function useLongPress(action: () => void) {
  const press = useRef<{ y: number; timer: number } | null>(null)
  const suppressGhostClick = useRef(false)

  function clear() {
    if (press.current) window.clearTimeout(press.current.timer)
    press.current = null
  }

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return
      const y = e.clientY
      const timer = window.setTimeout(() => {
        suppressGhostClick.current = true
        window.setTimeout(() => (suppressGhostClick.current = false), GHOST_CLICK_MS)
        action()
      }, PRESS_MS)
      press.current = { y, timer }
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (press.current && Math.abs(e.clientY - press.current.y) > CANCEL_SLOP) clear()
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onContextMenu: (e: React.MouseEvent) => {
      if (press.current) e.preventDefault()
    },
    guardClick: () => {
      if (suppressGhostClick.current) {
        suppressGhostClick.current = false
        return true
      }
      return false
    },
  }
}
