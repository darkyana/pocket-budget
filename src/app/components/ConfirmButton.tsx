import { useEffect, useState } from 'react'

/** 两段式确认：先点进入待确认，3 秒内再点才执行（PWA 里原生 confirm() 不可靠） */
export function ConfirmButton({
  label,
  confirmLabel = '确认？',
  className = 'btn-danger',
  onConfirm,
}: {
  label: string
  confirmLabel?: string
  className?: string
  onConfirm(): void
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      type="button"
      className={armed ? 'btn-danger' : className}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else {
          setArmed(true)
        }
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  )
}
