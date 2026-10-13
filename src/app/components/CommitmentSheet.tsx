import { useState } from 'react'
import { Sheet } from './Sheet'
import { ConfirmButton } from './ConfirmButton'
import { AccountPicker } from './AccountPicker'
import { useApp } from '../store'
import { useToast } from '../toast'
import { dayKeyOf } from '../../core/time'
import { money } from '../format'
import type { MoneyEvent } from '../../core/types'

/** 编辑义务事件：只开放付款日期与账户（金额随设置走，义务无备注） */
export function CommitmentSheet({
  event,
  onClose,
}: {
  event: Extract<MoneyEvent, { kind: 'commitment' }>
  onClose(): void
}) {
  const editCommitment = useApp((s) => s.editCommitment)
  const deleteEvent = useApp((s) => s.deleteEvent)
  const accounts = useApp((s) => s.settings.accounts)
  const toast = useToast((s) => s.show)

  const [account, setAccount] = useState(event.account ?? '')
  const [date, setDate] = useState(() => dayKeyOf(event.ts))

  return (
    <Sheet title={`编辑 · 义务 · ${event.item}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          editCommitment(event.id, { account, date })
          toast('已更新')
          onClose()
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
          <input id="cs-date" className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="form-btns">
          <button type="button" className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button type="submit">保存</button>
        </div>
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <ConfirmButton
            label="删除这一条（撤销切换）"
            confirmLabel="确认删除？"
            onConfirm={() => {
              deleteEvent(event.id)
              toast('已删除')
              onClose()
            }}
          />
        </div>
      </form>
    </Sheet>
  )
}
