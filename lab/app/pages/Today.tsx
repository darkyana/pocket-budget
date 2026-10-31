import { useEffect, useRef, useState } from 'react'
import { fixedExpensesThisPeriod, budgetViews, routinePace, routineToday, todayDayType, visibleBudgets } from '../../core/derive'
import { useApp } from '../store'
import { useToast } from '../toast'
import { useLongPress } from '../components/dragSort'
import { EntrySheet, type EntryTarget } from '../components/EntrySheet'
import { money, todayHeadline } from '../format'
import { barColor, leftStatus, statusColor } from '../statusColor'

const pct = (n: number) => Math.max(0, Math.min(100, n * 100))

export function Today() {
  const settings = useApp((s) => s.settings)
  const records = useApp((s) => s.records)
  const toggleFixedExpense = useApp((s) => s.toggleFixedExpense)
  const jumpToRecords = useApp((s) => s.jumpToRecords)
  const openQuickRetro = useApp((s) => s.openQuickRetro)
  const toast = useToast((s) => s.show)
  const [entry, setEntry] = useState<EntryTarget | null>(null)
  const [fixedOpen, setFixedOpen] = useState(false)

  const pressBudget = useRef('')
  const budgetPress = useLongPress(() => {
    jumpToRecords([`budget:${pressBudget.current}`])
    toast(`流水已筛选：${pressBudget.current}`)
  })

  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  const now = new Date()
  const routine = routineToday(records, settings, now)
  const pace = routinePace(records, settings, now)
  const views = budgetViews(records, settings, now)
  const budgets = visibleBudgets(views)
  const fixedExpenses = fixedExpensesThisPeriod(records, settings, now)
  const pages = Math.max(1, Math.ceil(routine.buckets.length / 4))

  return (
    <>
      <div className="page-head">
        <h1>今日</h1>
        <div className="sub">
          {todayHeadline(now)} · 日型：{todayDayType(settings, now)}
        </div>
      </div>

      <div className="card">
        <div className="row">
          <span>
            <b>日常</b>{' '}
            {pace.possible > 0 && (
              <button type="button" className="pace-chip" onClick={openQuickRetro}>
                {Math.round(pace.ratio * 100)}%
              </button>
            )}
          </span>
          <b className="sub-num" style={{ color: statusColor(routine.left < 0 ? 'over' : 'ok') }}>
            {routine.left >= 0 ? `还能花 ${money(routine.left)}` : `超 ${money(-routine.left)}`}
          </b>
        </div>
        {routine.buckets.length > 0 ? (
          <div className="hscroll">
            {Array.from({ length: pages }, (_, p) => (
              <div className="pg" key={p}>
                {Array.from({ length: 4 }, (_, i) => {
                  const b = routine.buckets[p * 4 + i]
                  if (!b) return <div className="mini-fill" key={`fill-${i}`} />
                  return (
                    <button
                      type="button"
                      className="mini"
                      key={b.name}
                      onClick={() => setEntry({ type: 'routine', category: b.name })}
                    >
                      <div className="small muted">{b.name}</div>
                      <div className="row">
                        <b className="sub-num" style={{ color: b.left < 0 ? statusColor('over') : undefined }}>
                          {b.left >= 0 ? money(b.left) : `超 ${money(-b.left)}`}
                        </b>
                        <span className="small muted">{money(b.spent)}</span>
                      </div>
                      <div className="bar">
                        <i
                          style={{
                            width: `${pct(b.left / b.expect)}%`,
                            background: barColor(leftStatus(b.left, b.expect)),
                          }}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        ) : (
          <div className="small muted block-gap">
            当前日型还没有日常，去设置里加。
          </div>
        )}
      </div>

      <div className="card">
        <div className="row-block">
          <b>预算</b>
        </div>
        {budgets.length > 0 ? (
          budgets.map((p) => {
            const weak = p.weekLeft <= 0
            return (
              <button
                type="button"
                className={`budget-row${weak ? ' is-weak' : ''}`}
                key={p.name}
                onClick={() => {
                  if (budgetPress.guardClick()) return
                  setEntry({ type: 'budget', budget: p.name })
                }}
                onPointerDown={(e) => {
                  pressBudget.current = p.name
                  budgetPress.onPointerDown(e)
                }}
                onPointerMove={budgetPress.onPointerMove}
                onPointerUp={budgetPress.onPointerUp}
                onPointerCancel={budgetPress.onPointerCancel}
                onContextMenu={budgetPress.onContextMenu}
              >
                <div className="row">
                  <span>{p.name}</span>
                  <b className="small" style={{ color: statusColor(leftStatus(p.weekLeft, p.weekBudget)) }}>
                    {p.weekLeft >= 0 ? `还能花 ${money(p.weekLeft)}` : `超支 ${money(-p.weekLeft)}`}
                  </b>
                </div>
                <div className="bar">
                  <i
                    style={{
                      width: `${pct(p.weekLeft / p.weekBudget)}%`,
                      background: barColor(leftStatus(p.weekLeft, p.weekBudget)),
                    }}
                  />
                </div>
              </button>
            )
          })
        ) : (
          <div className="small muted block-gap">还没有预算，去设置里加</div>
        )}
      </div>

      {fixedExpenses.length > 0 && (
        <div className="card">
          <div
            className="row-block"
            style={{ alignItems: 'center', marginBottom: fixedOpen ? undefined : 0 }}
          >
            <span>
              <b>固定支出 · 本期</b>
            </span>
            <button
              type="button"
              className="link"
              aria-expanded={fixedOpen}
              aria-controls="fixed-items"
              onClick={() => setFixedOpen((v) => !v)}
            >
              {fixedOpen ? '收起' : `展开 ${fixedExpenses.length} 项`}
            </button>
          </div>
          {fixedOpen && (
            <div id="fixed-items">
              {fixedExpenses.map((c) => (
                <button
                  type="button"
                  className="fixed-item"
                  key={c.name}
                  onClick={() => {
                    toggleFixedExpense(c.name)
                    toast(`${c.name}${c.paid ? ' 改回未付' : ' ✓ 已付'}`)
                  }}
                >
                  <span>
                    {c.name}
                    {c.cycle === 'yearly' ? ' · 年' : ''}
                    {c.paid ? '（已付）' : ''}
                  </span>
                  <span className={`small ${c.paid ? 'fixed-amt-paid' : 'fixed-amt-due'}`}>{money(c.amount)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="block-gap">
        <button type="button" className="btn2" onClick={() => setEntry({ type: 'transfer' })}>
          ＋ 记一笔走账（现金/转卡/投资划转）
        </button>
      </div>

      {entry && <EntrySheet target={entry} onClose={() => setEntry(null)} />}
    </>
  )
}
