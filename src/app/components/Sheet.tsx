import { useEffect, type ReactNode } from 'react'

/** 底部弹层：点击背景或按 Escape 关闭。替代 iOS PWA 里不可靠的 prompt()/confirm() */
export function Sheet({
  title,
  onClose,
  children,
  headerExtra,
}: {
  title: string
  onClose(): void
  children: ReactNode
  /** 标题行右侧的附加控件（如「再记一笔」开关） */
  headerExtra?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="sheet-title">{title}</div>
          {headerExtra}
        </div>
        {children}
      </div>
    </div>
  )
}
