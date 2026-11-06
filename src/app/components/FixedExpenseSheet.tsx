import { useState } from 'react'
import { Sheet } from './Sheet'
import { FormFooter } from './FormFooter'
import { ConfirmButton } from './ConfirmButton'
import { AccountPicker } from './AccountPicker'
import { useApp } from '../store'
import { useToast } from '../toast'
import { dayKeyOf } from '../../core/time'
import { money } from '../format'
import type { FixedExpense, MoneyRecord } from '../../core/types'

export type FixedTarget =
  | { kind: 'mark'; item: FixedExpense }
  | { kind: 'edit'; event: Extract<MoneyRecord, { kind: 'fixed' }> }

export function FixedExpenseSheet({
  target,
  onClose,
}: {
  target: FixedTarget
  onClose(): void
}) {
  const editFixedExpense = useApp((s) => s.editFixedExpense)
  const markFixedExpensePaid = useApp((s) => s.markFixedExpensePaid)
  const deleteRecord = useApp((s) => s.deleteRecord)
  const accounts = useApp((s) => s.settings.accounts)
  const lastAccount = useApp((s) => s.settings.lastAccount)
  const toast = useToast((s) => s.show)

  const paid = target.kind === 'edit'
  const { name: label, amount } = paid ? { name: target.event.item, amount: target.event.amount } : target.item
  const cycle = paid ? undefined : target.item.cycle
  const [account, setAccount] = useState(paid ? target.event.account ?? '' : lastAccount ?? '')
  const [date, setDate] = useState(() => dayKeyOf(paid ? target.event.ts : new Date()))
  const canSubmit = account.trim() !== '' && date !== ''

  function save() {
    try {
      if (paid) {
        editFixedExpense(target.event.id, { account, date })
        toast('已更新')
      } else {
        markFixedExpensePaid(target.item.name, { account, date })
        toast(`${label} ✓ 已付`)
      }
      onClose()
    } catch (error) {
      toast(error instanceof Error ? error.message : '保存失败')
    }
  }

  return (
    <Sheet
      title={paid ? `编辑 · 固定支出 · ${label}` : `标记已付 · 固定支出 · ${label}`}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (canSubmit) save()
        }}
      >
        <div className="small muted field-row">
          {paid ? '编辑付款' : '标记已付'} · {money(amount)}（金额在设置里改）
          {cycle === 'yearly' ? ' · 年付' : ''}
        </div>
        <div className="field-row">
          <label htmlFor="cs-account">付款账户</label>
          <AccountPicker
            id="cs-account"
            value={account}
            onChange={setAccount}
            accounts={accounts}
            placeholder="如：现金 / 电子钱包"
            required
          />
        </div>
        <div className="field-row">
          <label htmlFor="cs-date">付款日期</label>
          <input id="cs-date" className="field" type="date" required max={dayKeyOf(new Date())} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <FormFooter secondary={{ label: '取消', onClick: onClose }} submitLabel="保存" submitDisabled={!canSubmit} />
        {paid && (
          <div className="block-gap center">
            <ConfirmButton
              label="删除这笔付款"
              confirmLabel="确认删除？"
              onConfirm={() => {
                deleteRecord(target.event.id)
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
