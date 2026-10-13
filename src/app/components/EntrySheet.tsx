import { useState } from 'react'
import { Sheet } from './Sheet'
import { ConfirmButton } from './ConfirmButton'
import { useApp } from '../store'
import { useToast } from '../toast'
import { dayKeyOf } from '../../core/time'
import { money } from '../format'
import type { MoneyEvent } from '../../core/types'

export type EntryTarget =
  | { type: 'rhythm'; category: string }
  | { type: 'pool'; pool: string }
  | { type: 'transfer' }

/** 记一笔：入口即分类——从哪发起就记哪种锚（裁定 4）。传 existing 即为编辑模式 */
export function EntrySheet({
  target,
  onClose,
  existing,
}: {
  target: EntryTarget
  onClose(): void
  existing?: MoneyEvent
}) {
  const addRhythm = useApp((s) => s.addRhythm)
  const addPoolEntry = useApp((s) => s.addPoolEntry)
  const addTransfer = useApp((s) => s.addTransfer)
  const editEvent = useApp((s) => s.editEvent)
  const saveEntryEvent = useApp((s) => s.saveEntryEvent)
  const deleteEvent = useApp((s) => s.deleteEvent)
  const accounts = useApp((s) => s.settings.accounts)
  const lastAccount = useApp((s) => s.settings.lastAccount)
  const pools = useApp((s) => s.settings.pools)
  const dayPlans = useApp((s) => s.settings.dayPlans)
  const toast = useToast((s) => s.show)

  /** 编辑模式（节律/池子）下可切换锚：批量补录后回头分类的工作流 */
  const kindSwitchable = !!existing && (existing.kind === 'rhythm' || existing.kind === 'pool')
  const rhythmCategoryOptions = [...new Set([...Object.values(dayPlans).flat().map((b) => b.name), ...(existing?.kind === 'rhythm' ? [existing.category] : [])])]
  const poolOptions = [...new Set([...pools.map((p) => p.name), ...(existing?.kind === 'pool' ? [existing.pool] : [])])]

  const defaultAccount = lastAccount ?? accounts[0] ?? ''
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '')
  const [note, setNote] = useState(existing && 'note' in existing ? existing.note : '')
  const [dir, setDir] = useState<'out' | 'in'>(existing?.kind === 'pool' ? existing.dir : 'out')
  const [kindSel, setKindSel] = useState<'rhythm' | 'pool'>(existing?.kind === 'pool' ? 'pool' : 'rhythm')
  const [categoryPick, setCategoryPick] = useState(
    existing?.kind === 'rhythm' ? existing.category : rhythmCategoryOptions[0] ?? '',
  )
  const [poolPick, setPoolPick] = useState(existing?.kind === 'pool' ? existing.pool : poolOptions[0] ?? '')
  const [account, setAccount] = useState(
    existing && existing.kind !== 'transfer' && existing.kind !== 'commitment' ? existing.account ?? '' : defaultAccount,
  )
  const [from, setFrom] = useState(existing?.kind === 'transfer' ? existing.from : defaultAccount)
  const [to, setTo] = useState(existing?.kind === 'transfer' ? existing.to : accounts.find((a) => a !== defaultAccount) ?? '')
  const [date, setDate] = useState(() => dayKeyOf(existing ? existing.ts : new Date()))
  /** 「再记一笔」：记下后弹层不关、字段原样保留，方便改个数连续记 */
  const [again, setAgain] = useState(false)

  const amountNum = Number.parseFloat(amount)
  const amountOk = Number.isFinite(amountNum) && amountNum > 0
  const transferOk = amountOk && from.trim() !== '' && to.trim() !== '' && from.trim() !== to.trim()
  const switchOk = kindSel === 'rhythm' ? categoryPick !== '' : poolPick !== ''
  const canSubmit = kindSwitchable ? amountOk && switchOk : target.type === 'transfer' ? transferOk : amountOk

  function submit() {
    if (!canSubmit) return
    if (existing) {
      if (kindSwitchable) {
        saveEntryEvent(existing.id, {
          kind: kindSel,
          ...(kindSel === 'rhythm' ? { category: categoryPick } : { pool: poolPick }),
          dir,
          amount: amountNum,
          note: note.trim(),
          account,
          date,
        })
      } else {
        editEvent(existing.id, { amount: amountNum, note: note.trim(), account, date })
      }
      toast('已更新')
      onClose()
      return
    }
    if (target.type === 'rhythm') addRhythm(target.category, amountNum, note.trim(), account, date)
    else if (target.type === 'pool') addPoolEntry(target.pool, dir, amountNum, note.trim(), account, date)
    else addTransfer(from.trim(), to.trim(), amountNum, note.trim(), date)
    if (again) {
      toast(`已记 ${money(amountNum)}`)
      return
    }
    onClose()
  }

  const baseTitle =
    target.type === 'rhythm'
      ? `节律 · ${target.category}`
      : target.type === 'pool'
        ? `预算池 · ${target.pool}`
        : '走一笔账'
  const title = !existing
    ? baseTitle
    : kindSwitchable
      ? kindSel === 'rhythm'
        ? `编辑 · 节律 · ${categoryPick}`
        : `编辑 · 预算池 · ${poolPick}`
      : `编辑 · ${baseTitle}`

  return (
    <Sheet
      title={title}
      onClose={onClose}
      headerExtra={
        existing ? undefined : (
          <label className="again-toggle">
            <input type="checkbox" checked={again} onChange={(e) => setAgain(e.target.checked)} />
            再记一笔
          </label>
        )
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        {kindSwitchable && (
          <div className="seg" style={{ marginBottom: 12 }}>
            <button type="button" className={kindSel === 'rhythm' ? 'on' : ''} onClick={() => setKindSel('rhythm')}>
              节律
            </button>
            <button type="button" className={kindSel === 'pool' ? 'on' : ''} onClick={() => setKindSel('pool')}>
              预算池
            </button>
          </div>
        )}
        {kindSwitchable && kindSel === 'rhythm' && (
          <div className="field-row">
            <label htmlFor="ef-cat">节律类别</label>
            <select id="ef-cat" className="field" value={categoryPick} onChange={(e) => setCategoryPick(e.target.value)}>
              {rhythmCategoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
        {kindSwitchable && kindSel === 'pool' && (
          <div className="field-row">
            <label htmlFor="ef-pool">预算池</label>
            <select id="ef-pool" className="field" value={poolPick} onChange={(e) => setPoolPick(e.target.value)}>
              {poolOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        )}
        {(target.type === 'pool' || (kindSwitchable && kindSel === 'pool')) && (
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
          </>
        )}
        {target.type !== 'transfer' && (
          <div className="field-row">
            <label htmlFor="ef-account">用的哪个账户（可空）</label>
            <input
              id="ef-account"
              className="field"
              list="account-list"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="如：现金 / 微信"
            />
          </div>
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
        <div className="field-row">
          <label htmlFor="ef-date">日期（补记时改这里）</label>
          <input
            id="ef-date"
            className="field"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <datalist id="account-list">
          {accounts.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
        <div className="form-btns">
          <button type="button" className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button type="submit" disabled={!canSubmit}>
            {existing ? '保存' : '记下'}
          </button>
        </div>
        {existing && (
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <ConfirmButton
              label="删除这一笔"
              confirmLabel="确认删除？"
              onConfirm={() => {
                deleteEvent(existing.id)
                toast('已删除')
                onClose()
              }}
            />
          </div>
        )}
      </form>
    </Sheet>
  )
}
