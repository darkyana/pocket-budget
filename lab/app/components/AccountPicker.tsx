import { useState } from 'react'

export function AccountPicker({
  id,
  value,
  onChange,
  accounts,
  placeholder,
}: {
  id: string
  value: string
  onChange(v: string): void
  accounts: string[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState(false)
  const kw = value.trim()
  const list = typed && kw ? accounts.filter((a) => a.includes(kw)) : accounts

  return (
    <div className="combo">
      <input
        id={id}
        className="field"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false)
          setTyped(false)
        }}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setTyped(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && list.length > 0 && (
        <div className="combo-list" onMouseDown={(e) => e.preventDefault()}>
          {list.map((a) => (
            <button
              type="button"
              key={a}
              className="combo-option"
              onClick={() => {
                onChange(a)
                setOpen(false)
                setTyped(false)
              }}
            >
              {a}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
