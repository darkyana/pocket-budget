import { useState } from 'react'
import { Sheet } from './Sheet'
import { useApp } from '../store'

export type EntryTarget =
  | { type: 'rhythm'; category: string }
  | { type: 'pool'; pool: string }
  | { type: 'transfer' }

/** 记一笔：入口即分类——从哪发起就记哪种锚（裁定 4） */
export function EntrySheet({ target, onClose }: { target: EntryTarget; onClose(): void }) {
  const addRhythm = useApp((s) => s.addRhythm)
  const addPoolEntry = useApp((s) => s.addPoolEntry)
  const addTransfer = useApp((s) => s.addTransfer)
  const accounts = useApp((s) => s.settings.accounts)

  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [dir, setDir] = useState<'out' | 'in'>('out')
  const [from, setFrom] = useState(accounts[0] ?? '')
  const [to, setTo] = useState(accounts[1] ?? '')

  const amountNum = Number.parseFloat(amount)
  const amountOk = Number.isFinite(amountNum) && amountNum > 0
  const transferOk = amountOk && from.trim() !== '' && to.trim() !== '' && from.trim() !== to.trim()
  const canSubmit = target.type === 'transfer' ? transferOk : amountOk

  function submit() {
    if (!canSubmit) return
    if (target.type === 'rhythm') addRhythm(target.category, amountNum, note.trim())
    else if (target.type === 'pool') addPoolEntry(target.pool, dir, amountNum, note.trim())
    else addTransfer(from.trim(), to.trim(), amountNum, note.trim())
    onClose()
  }

  const title =
    target.type === 'rhythm'
      ? `节律 · ${target.category}`
      : target.type === 'pool'
        ? `预算池 · ${target.pool}`
        : '走一笔账'

  return (
    <Sheet title={title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        {target.type === 'pool' && (
          <div className="seg" style={{ marginBottom: 12 }}>
            <button type="button" className={dir === 'out' ? 'on' : ''} onClick={() => setDir('out')}>
              支出
            </button>
            <button type="button" className={dir === 'in' ? 'on' : ''} onClick={() => setDir('in')}>
              回血
            </button>
          </div>
        )}
        {target.type === 'transfer' && (
          <>
            <div className="field-row">
              <label htmlFor="ef-from">从哪个账户</label>
              <input
                id="ef-from"
                className="field"
                list="account-list"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="如：现金"
              />
            </div>
            <div className="field-row">
              <label htmlFor="ef-to">转到哪个账户</label>
              <input
                id="ef-to"
                className="field"
                list="account-list"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="如：工资卡"
              />
            </div>
            <datalist id="account-list">
              {accounts.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </>
        )}
        <div className="field-row">
          <label htmlFor="ef-amount">金额（元）</label>
          <input
            id="ef-amount"
            className="field"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="field-row">
          <label htmlFor="ef-note">备注（可空）</label>
          <input id="ef-note" className="field" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="form-btns">
          <button type="button" className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button type="submit" disabled={!canSubmit}>
            记下
          </button>
        </div>
      </form>
    </Sheet>
  )
}
