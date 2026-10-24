import { useEffect, useRef, useState } from 'react'
import { fixedExpensesThisPeriod, budgetViews, routinePace, routineToday, todayDayType, visibleBudgets } from '../../core/derive'
import { useApp } from '../store'
import { useToast } from '../toast'
import { useLongPress } from '../components/dragSort'
import { EntrySheet, type EntryTarget } from '../components/EntrySheet'
import { money, todayHeadline } from '../format'
import { statusColor } from '../statusColor'

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
  const unpaidSum = fixedExpenses.filter((c) => !c.paid).reduce((s, c) => s + c.amount, 0)
  const pages = Math.max(1, Math.ceil(routine.buckets.length / 4))

  return (
    <>
      <h1>今日</h1>
      <div className="sub">
        {todayHeadline(now)} · 日型：{todayDayType(settings, now)}（按日历自动，设置里可改）
      </div>

      <div className="card">
        <div className="row">
          <span>
            <b>日常</b>{' '}
            <span className="small muted">
              今日 {money(routine.totalSpent)}/{money(routine.totalExpect)}
              {pace.possible > 0 && (
                <>
                  {' · '}
                  <button type="button" className="pace-chip" onClick={openQuickRetro}>
                    当前消费力 {Math.round(pace.ratio * 100)}%
                  </button>
                </>
              )}
            </span>
          </span>
          <b className="sub-num" style={{ color: statusColor(routine.left < 0 ? 'over' : 'ok') }}>
            {routine.left >= 0 ? `还能花 ${money(routine.left)}` : `超 ${money(-routine.left)}`}
          </b>
        </div>
        {routine.buckets.length > 0 ? (
          <div className="hscroll">
            {Array.from({ length: pages }, (_, p) => (
              <div className="pg" key={p}>
                {routine.buckets.slice(p * 4, p * 4 + 4).map((b) => (
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
                          background:
                            b.left < 0 ? statusColor('over') : b.left < b.expect * 0.2 ? statusColor('warn') : 'var(--bar-accent)',
                        }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="small muted block-gap">
            当前日型还没有日常，去设置里加。
          </div>
        )}
        <div className="small muted block-gap">
          {pages > 1 ? `左右滑动翻页（共 ${pages} 页）· ` : ''}点卡片 = 记一笔该类消费 · 点「消费力」= 看本月回顾
        </div>
      </div>

      <div className="card">
        <div className="row-block">
          <b>预算</b>
        </div>
        {budgets.length > 0 ? (
          budgets.map((p) => (
            <button
              type="button"
              className="budget-row"
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
                <span>
                  {p.name}{' '}
                  <span className="small muted">
                    本周 {money(p.weekSpent)}/{money(p.weekBudget)}
                  </span>
                </span>
                <b className="small" style={{ color: statusColor(p.weekLeft < p.weekBudget * 0.2 ? 'warn' : 'ok') }}>
                  还能花 {money(p.weekLeft)}
                </b>
              </div>
              <div className="bar">
                <i
                  style={{
                    width: `${pct(p.weekLeft / p.weekBudget)}%`,
                    background: p.weekLeft < 0 ? statusColor('over') : p.weekLeft < p.weekBudget * 0.2 ? statusColor('warn') : 'var(--bar-accent)',
                  }}
                />
              </div>
              <div className="small muted block-gap">
                月 {money(p.monthSpent)}/{money(p.month)} · 按日均推算{' '}
                <b style={{ color: statusColor(p.projection > p.month * 1.05 ? 'over' : 'ok') }}>
                  {money(p.projection)}
                </b>
              </div>
            </button>
          ))
        ) : (
          <div className="small muted block-gap">
            {views.length > 0
              ? '本期所有预算都已花完或超支——去流水页看详情，或设置里调整预算'
              : '还没有预算，去设置里加'}
          </div>
        )}
        <div className="small muted block-gap">
          点预算 = 记一笔该预算收支 · 长按 = 去流水看它的全部条目
        </div>
      </div>

      {fixedExpenses.length > 0 && (
        <div className="card">
          <div className="row-block">
            <span>
              <b>固定支出 · 本期</b>{' '}
              <span className="small muted">
                {fixedExpenses.every((c) => c.paid) ? '已结清' : `未付 ${money(unpaidSum)}`}
              </span>
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
                  <span style={c.paid ? { textDecoration: 'line-through' } : { color: statusColor('warn'), fontWeight: 600 }}>
                    {money(c.amount)}
                  </span>
                </button>
              ))}
              <div className="small muted block-gap">
                点一条 = 切换 已付/未付（进流水）
              </div>
            </div>
          )}
        </div>
      )}

      <div className="center">
        <button type="button" className="btn2" onClick={() => setEntry({ type: 'transfer' })}>
          ＋ 记一笔走账（现金/转卡/投资划转）
        </button>
      </div>

      {entry && <EntrySheet target={entry} onClose={() => setEntry(null)} />}
    </>
  )
}
