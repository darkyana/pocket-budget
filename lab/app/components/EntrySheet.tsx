import { useState } from 'react'
import { Sheet } from './Sheet'
import { SegmentedControl } from './SegmentedControl'
import { FormFooter } from './FormFooter'
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

type EntryKind = 'routine' | 'budget' | 'transfer'

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

  const kindSwitchable = !!existing && (existing.kind === 'routine' || existing.kind === 'budget')
  const [freeSel, setFreeSel] = useState<EntryKind>('routine')
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
  const [again, setAgain] = useState(false)

  const amountNum = Number.parseFloat(amount)
  const amountOk = Number.isFinite(amountNum) && amountNum > 0
  const transferOk = amountOk && from.trim() !== '' && to.trim() !== '' && from.trim() !== to.trim()
  const formKind: EntryKind =
    target.type === 'free' ? freeSel : kindSwitchable ? kindSel : target.type
  const canSubmit =
    formKind === 'transfer'
      ? transferOk
      : amountOk && (formKind === 'routine' ? categoryPick !== '' : budgetPick !== '')
  const kindPickable = kindSwitchable || target.type === 'free'

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
        editRecord(existing.id, { amount: amountNum, note: note.trim(), account, date, from, to })
      }
      toast('已更新')
      onClose()
      return
    }
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

  const switchKind = (k: EntryKind) => {
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
          try {
            submit()
          } catch (error) {
            toast(error instanceof Error ? error.message : '保存失败')
          }
        }}
      >
        {kindPickable && (
          <SegmentedControl<EntryKind>
            value={formKind}
            options={[
              { value: 'routine', label: '日常' },
              { value: 'budget', label: '预算' },
              ...(target.type === 'free' ? [{ value: 'transfer' as const, label: '走账' }] : []),
            ]}
            onChange={switchKind}
          />
        )}
        {formKind === 'routine' && kindPickable && (
          <div className="field-row">
            <label htmlFor="ef-cat">日常</label>
            <select id="ef-cat" className="field" value={categoryPick} onChange={(e) => setCategoryPick(e.target.value)}>
              {routineCategoryOptions.length === 0 && <option value="">（设置里还没有日常）</option>}
              {routineCategoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
        {formKind === 'budget' && kindPickable && (
          <div className="field-row">
            <label htmlFor="ef-budget">预算</label>
            <select id="ef-budget" className="field" value={budgetPick} onChange={(e) => setBudgetPick(e.target.value)}>
              {budgetOptions.length === 0 && <option value="">（设置里还没有预算）</option>}
              {budgetOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        )}
        {formKind === 'budget' && (
          <SegmentedControl<'out' | 'in'>
            value={dir}
            options={[{ value: 'out', label: '支出' }, { value: 'in', label: '回血' }]}
            onChange={setDir}
          />
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
            required
            max={dayKeyOf(new Date())}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <FormFooter
          secondary={{ label: '取消', onClick: onClose }}
          submitLabel={existing ? '保存' : '记下'}
          submitDisabled={!canSubmit}
        />
        {existing && (
          <div className="block-gap center">
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
