import { useState } from 'react'
import { Sheet } from './Sheet'
import { ConfirmButton } from './ConfirmButton'
import { AccountPicker } from './AccountPicker'
import { useApp } from '../store'
import { useToast } from '../toast'
import { dayKeyOf } from '../../core/time'
import { money } from '../format'
import type { MoneyRecord } from '../../core/types'

/** 编辑固定支出流水：只开放付款日期与账户（金额随设置走，固定支出无备注） */
export function FixedExpenseSheet({
  event,
  onClose,
}: {
  event: Extract<MoneyRecord, { kind: 'fixed' }>
  onClose(): void
}) {
  const editFixedExpense = useApp((s) => s.editFixedExpense)
  const deleteRecord = useApp((s) => s.deleteRecord)
  const accounts = useApp((s) => s.settings.accounts)
  const toast = useToast((s) => s.show)

  const [account, setAccount] = useState(event.account ?? '')
  const [date, setDate] = useState(() => dayKeyOf(event.ts))

  return (
    <Sheet title={`编辑 · 固定支出 · ${event.item}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          try {
            editFixedExpense(event.id, { account, date })
            toast('已更新')
            onClose()
          } catch (error) {
            toast(error instanceof Error ? error.message : '保存失败')
          }
        }}
      >
        <div className="small muted" style={{ marginBottom: 12 }}>
          {event.paid ? '标记已付' : '改回未付'} · {money(event.amount)}（金额在设置里改）
        </div>
        <div className="field-row">
          <label htmlFor="cs-account">付款账户（可空）</label>
          <AccountPicker
            id="cs-account"
            value={account}
            onChange={setAccount}
            accounts={accounts}
            placeholder="如：现金 / 微信"
          />
        </div>
        <div className="field-row">
          <label htmlFor="cs-date">付款日期</label>
          <input id="cs-date" className="field" type="date" required max={dayKeyOf(new Date())} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="form-btns">
          <button type="button" className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button type="submit">保存</button>
        </div>
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <ConfirmButton
            label="删除这笔付款"
            confirmLabel="确认删除？"
            onConfirm={() => {
              deleteRecord(event.id)
              toast('已删除')
              onClose()
            }}
          />
        </div>
      </form>
    </Sheet>
  )
}
