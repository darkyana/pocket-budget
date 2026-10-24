import { useEffect, type ReactNode } from 'react'

export function Sheet({
  title,
  onClose,
  children,
  headerExtra,
}: {
  title: string
  onClose(): void
  children: ReactNode
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
