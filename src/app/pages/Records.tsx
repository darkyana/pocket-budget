import { useRef, useState } from 'react'
import { SCHEMA_VERSION, type MoneyEvent, type PersistedState } from '../../core/types'
import { dayKeyOf } from '../../core/time'
import { dayLabel, groupByDay } from '../../core/derive'
import { downloadVoucherFile } from '../../storage/voucher'
import { useApp } from '../store'
import { useToast } from '../toast'
import { ConfirmButton } from '../components/ConfirmButton'
import { CommitmentSheet } from '../components/CommitmentSheet'
import { EntrySheet, type EntryTarget } from '../components/EntrySheet'
import { Sheet } from '../components/Sheet'
import { moneyExact } from '../format'

function describe(e: MoneyEvent): { label: string; amount: string } {
  switch (e.kind) {
    case 'rhythm':
      return { label: `节律 · ${e.category}${e.account ? ` · ${e.account}` : ''}`, amount: moneyExact(e.amount) }
    case 'pool':
      return {
        label: `预算池 · ${e.pool} ${e.dir === 'out' ? '支出' : '回血'}${e.account ? ` · ${e.account}` : ''}`,
        amount: `${e.dir === 'in' ? '+' : ''}${moneyExact(e.amount)}`,
      }
    case 'commitment':
      return {
        label: `义务 · ${e.item} ${e.paid ? '标记已付' : '改回未付'}${e.account ? ` · ${e.account}` : ''}`,
        amount: moneyExact(e.amount),
      }
    case 'transfer':
      return { label: `走账 · ${e.from} → ${e.to}`, amount: moneyExact(e.amount) }
  }
}

/** 金额配色：支出墨色、收入（回血）绿、走账灰（非收支） */
function amountClass(e: MoneyEvent): string {
  if (e.kind === 'pool' && e.dir === 'in') return 'amt-in'
  if (e.kind === 'transfer') return 'amt-transfer'
  return 'amt-out'
}

/** 消费/走账用通用记账弹层编辑；义务用专用弹层（日期+账户） */
function targetOf(e: MoneyEvent): EntryTarget | null {
  if (e.kind === 'rhythm') return { type: 'rhythm', category: e.category }
  if (e.kind === 'pool') return { type: 'pool', pool: e.pool }
  if (e.kind === 'transfer') return { type: 'transfer' }
  return null
}

/** 日期筛选弹层：草稿态，完成才生效；清除立即生效并关闭 */
function DateFilterSheet({
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
  return (
    <Sheet title="按日期筛选" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onApply(draftFrom, draftTo)
        }}
      >
        <div className="field-row">
          <label htmlFor="df-from">开始日期（可空）</label>
          <input
            id="df-from"
            className="field"
            type="date"
            value={draftFrom}
            onChange={(e) => setDraftFrom(e.target.value)}
          />
        </div>
        <div className="field-row">
          <label htmlFor="df-to">结束日期（可空）</label>
          <input id="df-to" className="field" type="date" value={draftTo} onChange={(e) => setDraftTo(e.target.value)} />
        </div>
        <div className="small muted" style={{ margin: '4px 0 12px' }}>
          只填开始 = 从那天到现在；只填结束 = 截至那天
        </div>
        <div className="form-btns">
          <button type="button" className="btn-ghost" onClick={() => onApply('', '')}>
            清除
          </button>
          <button type="submit">完成</button>
        </div>
      </form>
    </Sheet>
  )
}

export function Records() {
  const settings = useApp((s) => s.settings)
  const events = useApp((s) => s.events)
  const clearEvents = useApp((s) => s.clearEvents)
  const importVoucher = useApp((s) => s.importVoucher)
  const toast = useToast((s) => s.show)
  const fileRef = useRef<HTMLInputElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  /** 对账筛选：账户（走账匹配转出/转入任一侧）+ 日期区间（可只填一端）；入口在按钮排，选择走半弹层 */
  const [accountFilter, setAccountFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const hasFilter = !!accountFilter || !!fromDate || !!toDate
  const [filterSheet, setFilterSheet] = useState<'account' | 'date' | null>(null)

  const dateLabel = (() => {
    const f = fromDate ? fromDate.slice(5).replace('-', '/') : ''
    const t = toDate ? toDate.slice(5).replace('-', '/') : ''
    if (f && t) return fromDate === toDate ? f : `${f}–${t}`
    if (f) return `${f} 起`
    if (t) return `至 ${t}`
    return ''
  })()

  const filtered = events.filter((e) => {
    if (accountFilter) {
      if ('account' in e && e.account) {
        if (e.account !== accountFilter) return false
      } else if (e.kind === 'transfer') {
        if (e.from !== accountFilter && e.to !== accountFilter) return false
      } else {
        return false // 无账户信息的条目在筛选具体账户时排除
      }
    }
    if (fromDate || toDate) {
      const k = dayKeyOf(e.ts)
      if (fromDate && k < fromDate) return false
      if (toDate && k > toDate) return false
    }
    return true
  })

  const groups = groupByDay(filtered)
  const now = new Date()

  function onExport() {
    const state: PersistedState = { schemaVersion: SCHEMA_VERSION, settings, events }
    const name = downloadVoucherFile(state)
    toast(`已导出 ${name}`)
  }

  async function onImport(file: File) {
    try {
      importVoucher(await file.text())
      toast('已导入凭证（整包替换）')
    } catch (err) {
      toast(err instanceof Error ? `导入失败：${err.message}` : '导入失败')
    }
  }

  return (
    <>
      <h1>流水</h1>
      <div className="sub">
        {hasFilter ? `筛选中 · ${filtered.length}/${events.length} 笔` : `本机记录的全部经济事件 · ${events.length} 笔`}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button type="button" className={`btn2 ${accountFilter ? 'on' : ''}`} onClick={() => setFilterSheet('account')}>
          {accountFilter ? `账户 · ${accountFilter}` : '按账户筛选'}
        </button>
        <button type="button" className={`btn2 ${dateLabel ? 'on' : ''}`} onClick={() => setFilterSheet('date')}>
          {dateLabel ? `日期 · ${dateLabel}` : '按日期筛选'}
        </button>
        <button type="button" className="btn2" onClick={onExport}>
          导出凭证
        </button>
        <button type="button" className="btn2" onClick={() => fileRef.current?.click()}>
          导入凭证
        </button>
        <ConfirmButton
          label="清空全部记录"
          confirmLabel="确认清空？"
          onConfirm={() => {
            clearEvents()
            toast('已清空全部记录（设置保留）')
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onImport(f)
            e.target.value = ''
          }}
        />
      </div>
      <div className="card">
        {groups.length > 0 ? (
          groups.map((g) => (
            <div key={g.dayKey}>
              <div className="day-head">
                <span>{dayLabel(g.dayKey, now)}</span>
                <span>支出 {moneyExact(g.outflow)}</span>
              </div>
              {g.events.map((e) => {
                const d = describe(e)
                return (
                  <button type="button" className="feed-item" key={e.id} onClick={() => setEditingId(e.id)}>
                    <span>
                      {d.label}
                      {'note' in e && e.note ? <span className="muted small"> {e.note}</span> : null}
                    </span>
                    <span className={amountClass(e)} style={{ whiteSpace: 'nowrap' }}>
                      {d.amount}
                    </span>
                  </button>
                )
              })}
            </div>
          ))
        ) : (
          <div className="small muted" style={{ padding: '10px 0' }}>
            {events.length === 0
              ? '还没有记录。回「今日」页点卡片 / 池 / 义务即可记。'
              : '没有符合条件的记录——试试清除筛选。'}
          </div>
        )}
      </div>
      <div className="small muted" style={{ textAlign: 'center' }}>
        点一笔可编辑；节律/池子可互转改类（先批量记、回头分类）
      </div>
      {filterSheet === 'account' && (
        <Sheet title="按账户筛选" onClose={() => setFilterSheet(null)}>
          <div className="picker-list">
            <button
              type="button"
              className={accountFilter === '' ? 'on' : ''}
              onClick={() => {
                setAccountFilter('')
                setFilterSheet(null)
              }}
            >
              全部账户
            </button>
            {settings.accounts.map((a) => (
              <button
                type="button"
                key={a}
                className={accountFilter === a ? 'on' : ''}
                onClick={() => {
                  setAccountFilter(a)
                  setFilterSheet(null)
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {filterSheet === 'date' && (
        <DateFilterSheet
          fromDate={fromDate}
          toDate={toDate}
          onApply={(f, t) => {
            setFromDate(f)
            setToDate(t)
            setFilterSheet(null)
          }}
          onClose={() => setFilterSheet(null)}
        />
      )}
      {editingId &&
        (() => {
          const ev = events.find((x) => x.id === editingId)
          if (!ev) return null
          if (ev.kind === 'commitment') {
            return <CommitmentSheet event={ev} onClose={() => setEditingId(null)} />
          }
          const target = targetOf(ev)
          return target ? <EntrySheet target={target} existing={ev} onClose={() => setEditingId(null)} /> : null
        })()}
    </>
  )
}
