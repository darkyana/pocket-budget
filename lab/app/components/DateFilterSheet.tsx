import { useState } from 'react'
import { Sheet } from './Sheet'
import { SegmentedControl } from './SegmentedControl'
import { FormFooter } from './FormFooter'

export function DateFilterSheet({
  fromDate,
  toDate,
  onApply,
  onClose,
}: {
  fromDate: string
  toDate: string
  onApply(from: string, to: string): void
  onClose(): void
}) {
  const [draftFrom, setDraftFrom] = useState(fromDate)
  const [draftTo, setDraftTo] = useState(toDate)
  const [mode, setMode] = useState<'day' | 'range'>(fromDate && fromDate !== toDate ? 'range' : 'day')
  const complete = !!draftFrom && (mode === 'day' || (!!draftTo && draftFrom <= draftTo))
  return (
    <Sheet title="按日期筛选" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (complete) onApply(draftFrom, mode === 'day' ? draftFrom : draftTo)
        }}
      >
        <SegmentedControl<'day' | 'range'>
          value={mode}
          options={[{ value: 'day', label: '单日' }, { value: 'range', label: '日期范围' }]}
          onChange={setMode}
        />
        <div className="field-row">
          <label htmlFor="df-from">{mode === 'day' ? '日期' : '开始日期'}</label>
          <input
            id="df-from"
            className="field"
            type="date"
            required
            max={mode === 'range' ? draftTo || undefined : undefined}
            value={draftFrom}
            onChange={(e) => setDraftFrom(e.target.value)}
          />
        </div>
        {mode === 'range' && (
          <div className="field-row">
            <label htmlFor="df-to">结束日期</label>
            <input id="df-to" className="field" type="date" required min={draftFrom || undefined} value={draftTo} onChange={(e) => setDraftTo(e.target.value)} />
          </div>
        )}
        <div className="small muted field-row">
          {mode === 'day' ? '只显示所选日期的流水' : '请选择完整范围，包含开始和结束当天'}
        </div>
        <FormFooter
          secondary={{ label: '全部日期', onClick: () => onApply('', '') }}
          submitLabel="完成"
          submitDisabled={!complete}
        />
      </form>
    </Sheet>
  )
}
