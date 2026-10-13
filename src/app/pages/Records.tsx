import { useRef, useState } from 'react'
import { SCHEMA_VERSION, type MoneyEvent, type PersistedState } from '../../core/types'
import { dayLabel, groupByDay } from '../../core/derive'
import { downloadVoucherFile } from '../../storage/voucher'
import { useApp } from '../store'
import { useToast } from '../toast'
import { ConfirmButton } from '../components/ConfirmButton'
import { EntrySheet, type EntryTarget } from '../components/EntrySheet'
import { money } from '../format'

function describe(e: MoneyEvent): { label: string; amount: string } {
  switch (e.kind) {
    case 'rhythm':
      return { label: `节律 · ${e.category}${e.account ? ` · ${e.account}` : ''}`, amount: money(e.amount) }
    case 'pool':
      return {
        label: `预算池 · ${e.pool} ${e.dir === 'out' ? '支出' : '回血'}${e.account ? ` · ${e.account}` : ''}`,
        amount: `${e.dir === 'in' ? '+' : ''}${money(e.amount)}`,
      }
    case 'commitment':
      return { label: `义务 · ${e.item} ${e.paid ? '标记已付' : '改回未付'}`, amount: money(e.amount) }
    case 'transfer':
      return { label: `走账 · ${e.from} → ${e.to}`, amount: money(e.amount) }
  }
}

/** 编辑入口只对消费/走账开放；义务事件的「编辑」是再点一次切换 */
function targetOf(e: MoneyEvent): EntryTarget | null {
  if (e.kind === 'rhythm') return { type: 'rhythm', category: e.category }
  if (e.kind === 'pool') return { type: 'pool', pool: e.pool }
  if (e.kind === 'transfer') return { type: 'transfer' }
  return null
}

function timeOf(ts: number): string {
  const t = new Date(ts)
  const mm = String(t.getMinutes()).padStart(2, '0')
  return `${t.getMonth() + 1}/${t.getDate()} ${String(t.getHours()).padStart(2, '0')}:${mm}`
}

export function Records() {
  const settings = useApp((s) => s.settings)
  const events = useApp((s) => s.events)
  const clearEvents = useApp((s) => s.clearEvents)
  const importVoucher = useApp((s) => s.importVoucher)
  const toast = useToast((s) => s.show)
  const fileRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState<{ id: string; target: EntryTarget } | null>(null)

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
                <span>支出 {money(g.outflow)}</span>
              </div>
              {g.events.map((e) => {
                const d = describe(e)
                const target = targetOf(e)
                return (
                  <button
                    type="button"
                    className="feed-item"
                    key={e.id}
                    onClick={() =>
                      target
                        ? setEditing({ id: e.id, target })
                        : toast('义务状态请在今日页点那一条切换')
                    }
                  >
                    <span>
                      {d.label}
                      {'note' in e && e.note ? <span className="muted small"> {e.note}</span> : null}
                      <span className="small muted" style={{ marginLeft: 6 }}>
                        {timeOf(e.ts)}
                      </span>
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
        点一笔可编辑（金额 / 账户 / 备注 / 日期）或删除
      </div>
      {editing && (
        <EntrySheet
          target={editing.target}
          existing={events.find((e) => e.id === editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
