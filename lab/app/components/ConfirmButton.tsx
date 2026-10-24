import { useEffect, useState } from 'react'

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
