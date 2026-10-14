import { useRef, useState } from 'react'

const PRESS_MS = 450
const CANCEL_SLOP = 10

/**
 * 长按拖拽排序（设置页三张列表共用）：
 * - 短按不受影响，click 正常触发（编辑弹层等）
 * - 按住 ~450ms 拎起该行：跟手浮动（阴影+微放大），其余行实时腾位
 * - 按住期间先移动 >10px 视为滚动意图，取消拎起；拎起后 touchmove 被拦，页面不滚
 * - 松手落位提交 onCommit(from, to)；拎起过的这次 click 会被吞掉（guardClick）
 */
export function useDragSort(count: number, onCommit: (from: number, to: number) => void) {
  const [drag, setDrag] = useState<{ from: number; hover: number; dy: number } | null>(null)
  const dragRef = useRef<{ from: number; hover: number; dy: number } | null>(null)
  dragRef.current = drag
  const rows = useRef<Array<HTMLDivElement | null>>([])
  rows.current.length = count
  const press = useRef<{ id: number; y: number; index: number; el: HTMLDivElement } | null>(null)
  const active = useRef<{ from: number; startY: number; centers: number[]; height: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const suppressClick = useRef(false)

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
      p.el.setPointerCapture(p.id) // 拎起后手指移出行也能持续收到事件
    } catch {
      /* 指针已释放等场景忽略 */
    }
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
      suppressClick.current = true // 拎起过的手指抬起还会派发一次 click，吞掉
      window.setTimeout(() => (suppressClick.current = false), 400)
    }
    active.current = null
    press.current = null
    setDrag(null)
  }

  function shiftOf(i: number): number {
    const d = drag
    if (!d || !active.current || i === d.from) return 0
    const h = active.current.height
    if (d.from < d.hover && i > d.from && i <= d.hover) return -h
    if (d.from > d.hover && i >= d.hover && i < d.from) return h
    return 0
  }

  /** 铺到每行 .setrow 上：几何测量、跟手位移与腾位都在这里 */
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
          if (Math.abs(e.clientY - p.y) > CANCEL_SLOP) {
            window.clearTimeout(timer.current) // 滚动意图：取消拎起
            press.current = null
          }
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
        if (press.current || active.current) e.preventDefault() // 长按不弹系统菜单
      },
    }
  }

  /** 行内按钮的 click 先过这道闸：刚结束拖拽的那次点击作废 */
  function guardClick(): boolean {
    if (suppressClick.current) {
      suppressClick.current = false
      return true
    }
    return false
  }

  return { rowProps, guardClick }
}

function preventTouchMove(e: TouchEvent) {
  e.preventDefault()
}
