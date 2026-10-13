import { useEffect, useState } from 'react'
import { fixedExpensesThisPeriod, budgetViews, routineToday, todayDayType, visibleBudgets } from '../../core/derive'
import { useApp } from '../store'
import { useToast } from '../toast'
import { EntrySheet, type EntryTarget } from '../components/EntrySheet'
import { money, todayHeadline } from '../format'

const pct = (n: number) => Math.max(0, Math.min(100, n * 100))

export function Today() {
  const settings = useApp((s) => s.settings)
  const records = useApp((s) => s.records)
  const toggleFixedExpense = useApp((s) => s.toggleFixedExpense)
  const toast = useToast((s) => s.show)
  const [entry, setEntry] = useState<EntryTarget | null>(null)

  // 每分钟醒一次：跨零点后「今天」自动翻页，数字不至于停在昨天
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  const now = new Date()
  const routine = routineToday(records, settings, now)
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
          <b>日常</b>
          <span className="small">
            <b style={{ fontSize: 15, color: routine.left < 0 ? 'var(--over)' : 'var(--accent)' }}>
              {routine.left >= 0 ? `还能花 ${money(routine.left)}` : `超 ${money(-routine.left)}`}
            </b>{' '}
            <span className="muted">
              / 期望 {money(routine.totalExpect)} · 已花 {money(routine.totalSpent)}
            </span>
          </span>
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
                    <div className="row" style={{ marginTop: 2 }}>
                      <b style={{ fontSize: 17, color: b.left < 0 ? 'var(--over)' : undefined }}>
                        {b.left >= 0 ? money(b.left) : `超 ${money(-b.left)}`}
                      </b>
                      <span className="small muted">{money(b.spent)}</span>
                    </div>
                    <div className="bar">
                      <i
                        style={{
                          width: `${pct(b.left / b.expect)}%`,
                          background:
                            b.left < 0 ? 'var(--over)' : b.left < b.expect * 0.2 ? 'var(--warn)' : 'var(--bar-accent)',
                        }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="small muted" style={{ padding: '10px 0' }}>
            当前日型还没有日常，去设置里加。
          </div>
        )}
        <div className="small muted" style={{ marginTop: 8 }}>
          {pages > 1 ? `左右滑动翻页（共 ${pages} 页）· ` : ''}点卡片 = 记一笔该类消费
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 6 }}>
          <b>预算</b>
          <span className="small muted">还能花 · 按剩余排序</span>
        </div>
        {budgets.length > 0 ? (
          budgets.map((p) => (
            <button
              type="button"
              className="budget-row"
              key={p.name}
              onClick={() => setEntry({ type: 'budget', budget: p.name })}
            >
              <div className="row">
                <span>{p.name}</span>
                <span className="small">
                  <b>{money(p.weekLeft)}</b> <span className="muted">/ 本周 {money(p.weekBudget)}</span>
                </span>
              </div>
              <div className="bar">
                <i
                  style={{
                    width: `${pct(p.weekLeft / p.weekBudget)}%`,
                    background: p.weekLeft < 0 ? 'var(--over)' : p.weekLeft < p.weekBudget * 0.2 ? 'var(--warn)' : 'var(--bar-accent)',
                  }}
                />
              </div>
              <div className="small muted" style={{ marginTop: 4 }}>
                月 {money(p.monthSpent)}/{money(p.month)} · 推算月底{' '}
                <b style={{ color: p.projection > p.month * 1.05 ? 'var(--over)' : 'var(--ok)' }}>
                  {money(p.projection)}
                </b>
              </div>
            </button>
          ))
        ) : (
          <div className="small muted" style={{ padding: '8px 0' }}>
            {views.length > 0
              ? '本期所有预算都已花完或超支——去流水页看详情，或设置里调整预算'
              : '还没有预算，去设置里加'}
          </div>
        )}
        <div className="small muted" style={{ marginTop: 8 }}>
          点预算 = 记一笔该预算收支（支出 / 回血）
        </div>
      </div>

      <div className="fixed-block">
        <div className="row" style={{ padding: '3px 0' }}>
          <span>固定支出 · 本期</span>
          <span>
            {fixedExpenses.length === 0 ? '无' : fixedExpenses.every((c) => c.paid) ? '已结清' : `未付 ${money(unpaidSum)}`}
          </span>
        </div>
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
            <span style={c.paid ? { textDecoration: 'line-through' } : { color: 'var(--warn)', fontWeight: 600 }}>
              {money(c.amount)}
            </span>
          </button>
        ))}
        <div className="small muted" style={{ marginTop: 6 }}>
          点一条 = 切换 已付/未付（进流水）
        </div>
      </div>

      <div style={{ textAlign: 'center', paddingBottom: 8 }}>
        <button type="button" className="btn2" onClick={() => setEntry({ type: 'transfer' })}>
          ＋ 记一笔走账（现金/转卡/投资划转）
        </button>
      </div>

      {entry && <EntrySheet target={entry} onClose={() => setEntry(null)} />}
    </>
  )
}
