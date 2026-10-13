import { useState } from 'react'

/** 账户输入：点击即展开全量候选，打字实时过滤；同时允许自由输入新账户名（datalist 做不到点击即展开） */
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
  /** 只有用户实际打字才过滤；仅聚焦（哪怕预填了默认值）一律展示全量 */
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
