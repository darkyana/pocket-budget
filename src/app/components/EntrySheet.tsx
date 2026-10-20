import { useState } from 'react'
import { Sheet } from './Sheet'
import { ConfirmButton } from './ConfirmButton'
import { AccountPicker } from './AccountPicker'
import { useApp } from '../store'
import { useToast } from '../toast'
import { dayKeyOf } from '../../core/time'
import { money } from '../format'
import type { MoneyRecord } from '../../core/types'

export type EntryTarget =
  | { type: 'routine'; category: string }
  | { type: 'budget'; budget: string }
  | { type: 'transfer' }
  | { type: 'free' }

/** 记一笔：锚定入口「入口即分类」（裁定 4）；无锚入口（如流水页）在表单内选锚（ADR 0001）。传 existing 即为编辑模式 */
export function EntrySheet({
  target,
  onClose,
  existing,
}: {
  target: EntryTarget
  onClose(): void
  existing?: MoneyRecord
}) {
  const addRhythm = useApp((s) => s.addRhythm)
  const addBudgetEntry = useApp((s) => s.addBudgetEntry)
  const addTransfer = useApp((s) => s.addTransfer)
  const editRecord = useApp((s) => s.editRecord)
  const saveEntryRecord = useApp((s) => s.saveEntryRecord)
  const deleteRecord = useApp((s) => s.deleteRecord)
  const accounts = useApp((s) => s.settings.accounts)
  const lastAccount = useApp((s) => s.settings.lastAccount)
  const lastTransferTo = useApp((s) => s.settings.lastTransferTo)
  const budgets = useApp((s) => s.settings.budgets)
  const dayPlans = useApp((s) => s.settings.dayPlans)
  const toast = useToast((s) => s.show)

  /** 编辑模式（日常/预算）下可切换锚：批量补录后回头分类的工作流 */
  const kindSwitchable = !!existing && (existing.kind === 'routine' || existing.kind === 'budget')
  /** 无锚模式当前锚：与编辑互转分开设态，互转仍限日常↔预算、不得转走账 */
  const [freeSel, setFreeSel] = useState<'routine' | 'budget' | 'transfer'>('routine')
  const routineCategoryOptions = [...new Set([...Object.values(dayPlans).flat().map((b) => b.name), ...(existing?.kind === 'routine' ? [existing.category] : [])])]
  const budgetOptions = [...new Set([...budgets.map((p) => p.name), ...(existing?.kind === 'budget' ? [existing.budget] : [])])]

  const defaultAccount = lastAccount ?? accounts[0] ?? ''
  const defaultTo =
    lastTransferTo && lastTransferTo !== defaultAccount
      ? lastTransferTo
      : (accounts.find((a) => a !== defaultAccount) ?? '')
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '')
  const [note, setNote] = useState(existing && 'note' in existing ? existing.note : '')
  const [dir, setDir] = useState<'out' | 'in'>(existing?.kind === 'budget' ? existing.dir : 'out')
  const [kindSel, setKindSel] = useState<'routine' | 'budget'>(existing?.kind === 'budget' ? 'budget' : 'routine')
  const [categoryPick, setCategoryPick] = useState(
    existing?.kind === 'routine' ? existing.category : routineCategoryOptions[0] ?? '',
  )
  const [budgetPick, setBudgetPick] = useState(existing?.kind === 'budget' ? existing.budget : budgetOptions[0] ?? '')
  const [account, setAccount] = useState(
    existing && existing.kind !== 'transfer' && existing.kind !== 'fixed' ? existing.account ?? '' : defaultAccount,
  )
  const [from, setFrom] = useState(existing?.kind === 'transfer' ? existing.from : defaultAccount)
  const [to, setTo] = useState(existing?.kind === 'transfer' ? existing.to : defaultTo)
  const [date, setDate] = useState(() => dayKeyOf(existing ? existing.ts : new Date()))
  /** 「再记一笔」：记下后弹层不关、字段原样保留，方便改个数连续记 */
  const [again, setAgain] = useState(false)

  const amountNum = Number.parseFloat(amount)
  const amountOk = Number.isFinite(amountNum) && amountNum > 0
  const transferOk = amountOk && from.trim() !== '' && to.trim() !== '' && from.trim() !== to.trim()
  const switchOk = kindSel === 'routine' ? categoryPick !== '' : budgetPick !== ''
  /** 表单当前生效的锚：无锚随三选、编辑随互转、锚定入口固定 */
  const formKind: 'routine' | 'budget' | 'transfer' =
    target.type === 'free' ? freeSel : kindSwitchable ? kindSel : target.type
  /** 无锚校验沿互转的形状：类目/预算下拉为空（设置还没定义）时禁提交 */
  const freeOk = amountOk && (formKind === 'routine' ? categoryPick !== '' : budgetPick !== '')
  const canSubmit = kindSwitchable
    ? amountOk && switchOk
    : formKind === 'transfer'
      ? transferOk
      : target.type === 'free'
        ? freeOk
        : amountOk

  function submit() {
    if (!canSubmit) return
    if (existing) {
      if (kindSwitchable) {
        saveEntryRecord(existing.id, {
          kind: kindSel,
          ...(kindSel === 'routine' ? { category: categoryPick } : { budget: budgetPick }),
          dir,
          amount: amountNum,
          note: note.trim(),
          account,
          date,
        })
      } else {
        editRecord(existing.id, { amount: amountNum, note: note.trim(), account, date })
      }
      toast('已更新')
      onClose()
      return
    }
    // 无锚新建按表单内当前锚分发；锚定入口维持「入口即分类」直接用 target
    if (formKind === 'routine') addRhythm(target.type === 'routine' ? target.category : categoryPick, amountNum, note.trim(), account, date)
    else if (formKind === 'budget')
      addBudgetEntry(target.type === 'budget' ? target.budget : budgetPick, dir, amountNum, note.trim(), account, date)
    else addTransfer(from.trim(), to.trim(), amountNum, note.trim(), date)
    if (again) {
      toast(`已记 ${money(amountNum)}`)
      return
    }
    onClose()
  }

  const baseTitle =
    target.type === 'routine'
      ? `日常 · ${target.category}`
      : target.type === 'budget'
        ? `预算 · ${target.budget}`
        : target.type === 'free'
          ? '记一笔'
          : '走一笔账'
  const title = !existing
    ? baseTitle
    : kindSwitchable
      ? kindSel === 'routine'
        ? `编辑 · 日常 · ${categoryPick}`
        : `编辑 · 预算 · ${budgetPick}`
      : `编辑 · ${baseTitle}`

  /** 切换段点选：无锚三选自由切；编辑互转仍限日常↔预算（走账按钮只在无锚渲染） */
  const switchKind = (k: 'routine' | 'budget' | 'transfer') => {
    if (target.type === 'free') setFreeSel(k)
    else if (k !== 'transfer') setKindSel(k)
  }

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
        {(kindSwitchable || target.type === 'free') && (
          <div className="seg" style={{ marginBottom: 12 }}>
            <button type="button" className={formKind === 'routine' ? 'on' : ''} onClick={() => switchKind('routine')}>
              日常
            </button>
            <button type="button" className={formKind === 'budget' ? 'on' : ''} onClick={() => switchKind('budget')}>
              预算
            </button>
            {target.type === 'free' && (
              <button type="button" className={formKind === 'transfer' ? 'on' : ''} onClick={() => switchKind('transfer')}>
                走账
              </button>
            )}
          </div>
        )}
        {formKind === 'routine' && (kindSwitchable || target.type === 'free') && (
          <div className="field-row">
            <label htmlFor="ef-cat">日常</label>
            <select id="ef-cat" className="field" value={categoryPick} onChange={(e) => setCategoryPick(e.target.value)}>
              {routineCategoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
        {formKind === 'budget' && (kindSwitchable || target.type === 'free') && (
          <div className="field-row">
            <label htmlFor="ef-budget">预算</label>
            <select id="ef-budget" className="field" value={budgetPick} onChange={(e) => setBudgetPick(e.target.value)}>
              {budgetOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        )}
        {formKind === 'budget' && (
          <div className="seg" style={{ marginBottom: 12 }}>
            <button type="button" className={dir === 'out' ? 'on' : ''} onClick={() => setDir('out')}>
              支出
            </button>
            <button type="button" className={dir === 'in' ? 'on' : ''} onClick={() => setDir('in')}>
              回血
            </button>
          </div>
        )}
        {formKind === 'transfer' && (
          <>
            <div className="field-row">
              <label htmlFor="ef-from">从哪个账户</label>
              <AccountPicker
                id="ef-from"
                value={from}
                onChange={setFrom}
                accounts={accounts}
                placeholder="如：现金"
              />
            </div>
            <div className="field-row">
              <label htmlFor="ef-to">转到哪个账户</label>
              <AccountPicker
                id="ef-to"
                value={to}
                onChange={setTo}
                accounts={accounts}
                placeholder="如：储蓄卡"
              />
            </div>
          </>
        )}
        {formKind !== 'transfer' && (
          <div className="field-row">
            <label htmlFor="ef-account">用的哪个账户（可空）</label>
            <AccountPicker
              id="ef-account"
              value={account}
              onChange={setAccount}
              accounts={accounts}
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
                deleteRecord(existing.id)
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
