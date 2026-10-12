import { useState } from 'react'
import { Sheet } from './Sheet'

export interface FieldDef {
  key: string
  label: string
  type: 'text' | 'number'
  initial?: string
  placeholder?: string
}

/** 通用小表单弹层：设置项的新增/编辑共用。提交后由父组件校验并决定是否关闭 */
export function FormSheet({
  title,
  fields,
  submitLabel = '保存',
  onSubmit,
  onClose,
}: {
  title: string
  fields: FieldDef[]
  submitLabel?: string
  onSubmit(values: Record<string, string>): void
  onClose(): void
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.initial ?? ''])),
  )
  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }))

  return (
    <Sheet title={title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(values)
        }}
      >
        {fields.map((f, i) => (
          <div className="field-row" key={f.key}>
            <label htmlFor={`fs-${f.key}`}>{f.label}</label>
            <input
              id={`fs-${f.key}`}
              className="field"
              type={f.type}
              inputMode={f.type === 'number' ? 'decimal' : undefined}
              autoFocus={i === 0}
              value={values[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => set(f.key, e.target.value)}
            />
          </div>
        ))}
        <div className="form-btns">
          <button type="button" className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button type="submit">{submitLabel}</button>
        </div>
      </form>
    </Sheet>
  )
}
