import { useRef, useState } from 'react'
import { SCHEMA_VERSION, type MoneyEvent, type PersistedState } from '../../core/types'
import { dayLabel, groupByDay } from '../../core/derive'
import { downloadVoucherFile } from '../../storage/voucher'
import { useApp } from '../store'
import { useToast } from '../toast'
import { ConfirmButton } from '../components/ConfirmButton'
import { CommitmentSheet } from '../components/CommitmentSheet'
import { EntrySheet, type EntryTarget } from '../components/EntrySheet'
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

/** 消费/走账用通用记账弹层编辑；义务用专用弹层（日期+账户） */
function targetOf(e: MoneyEvent): EntryTarget | null {
  if (e.kind === 'rhythm') return { type: 'rhythm', category: e.category }
  if (e.kind === 'pool') return { type: 'pool', pool: e.pool }
  if (e.kind === 'transfer') return { type: 'transfer' }
  return null
}

export function Records() {
  const settings = useApp((s) => s.settings)
  const events = useApp((s) => s.events)
  const clearEvents = useApp((s) => s.clearEvents)
  const importVoucher = useApp((s) => s.importVoucher)
  const toast = useToast((s) => s.show)
  const fileRef = useRef<HTMLInputElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const groups = groupByDay(events)
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
        本机记录的全部经济事件 · {events.length} 笔
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
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
                    <span style={{ whiteSpace: 'nowrap' }}>{d.amount}</span>
                  </button>
                )
              })}
            </div>
          ))
        ) : (
          <div className="small muted" style={{ padding: '10px 0' }}>
            还没有记录。回「今日」页点卡片 / 池 / 义务即可记。
          </div>
        )}
      </div>
      <div className="small muted" style={{ textAlign: 'center' }}>
        点一笔可编辑；节律/池子可互转改类（先批量记、回头分类）
      </div>
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
