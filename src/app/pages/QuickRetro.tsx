import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import {
  budgetMonthEntries,
  budgetViews,
  dayRetroMonth,
  fixedExpensesThisPeriod,
  kindStatOf,
  monthOverview,
  retroStats,
  routinePace,
  statusOfRatio,
  weekdayOf,
  type DayRetro,
  type DayStatus,
  type GroupAvg,
  type MonthKindKey,
} from '../../core/derive'
import { useApp } from '../store'
import { Sheet } from '../components/Sheet'
import { useLongPress } from '../components/dragSort'
import { money } from '../format'
import { statusColor } from '../statusColor'
import type { BudgetView } from '../../core/derive'

const pct = (n: number) => Math.max(0, Math.min(100, n * 100))
const statusText = (s: DayStatus) => (s === 'over' ? '超' : s === 'warn' ? '贴近' : '省')
const ratioText = (r: number) => (Number.isFinite(r) ? `${Math.round(r * 100)}%` : '超支')
const diffText = (d: DayRetro) => (d.spent > d.expect ? `超 ${money(d.spent - d.expect)}` : `省 ${money(d.expect - d.spent)}`)

const CAL_WEEK = ['一', '二', '三', '四', '五', '六', '日']

const KIND_LABELS: Record<MonthKindKey | 'transfer', string> = {
  routine: '日常',
  budget: '预算',
  fixed: '固定',
  transfer: '走账',
}

export function QuickRetro() {
  const settings = useApp((s) => s.settings)
  const records = useApp((s) => s.records)
  const closeOverlay = useApp((s) => s.closeOverlay)
  const jumpToRecords = useApp((s) => s.jumpToRecords)
  const [detail, setDetail] = useState<DayRetro | null>(null)
  const [budgetDetail, setBudgetDetail] = useState<BudgetView | null>(null)

  const unassignedPress = useLongPress(() => {
    jumpToRecords([])
  })

  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const scroller = document.querySelector('.phone')
    if (!scroller) return
    const saved = scroller.scrollTop
    scroller.scrollTop = 0
    return () => {
      scroller.scrollTop = saved
    }
  }, [])

  const now = new Date()
  const overview = monthOverview(records, now)
  const routineKind = kindStatOf(overview, 'routine')
  const budgetKind = kindStatOf(overview, 'budget')
  const fixedKind = kindStatOf(overview, 'fixed')
  const fixedItems = fixedExpensesThisPeriod(records, settings, now)
  const fixedPaidCount = fixedItems.filter((c) => c.paid).length
  const views = budgetViews(records, settings, now)
  const pace = routinePace(records, settings, now)
  const month = dayRetroMonth(records, settings, now)
  const stats = retroStats(month)
  const pacePct = Math.round(pace.ratio * 100)
  const paceSt = statusOfRatio(pace.ratio)
  const chartDays = month.filter((d) => d.passed).slice(-14)
  const chartMax = Math.max(1, ...chartDays.map((d) => Math.max(d.spent, d.expect)))
  const barH = (v: number) => `${Math.max(3, Math.round((v / chartMax) * 84))}px`
  const leadPad = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7

  const kindCards: Array<{ kind: MonthKindKey | 'transfer'; metric: string; note: string; sub: string }> = [
    { kind: 'routine', metric: money(routineKind.amount), note: '日常支出', sub: `${routineKind.count} 笔` },
    { kind: 'budget', metric: money(budgetKind.amount), note: '预算净支出', sub: `${budgetKind.count} 笔` },
    { kind: 'fixed', metric: money(fixedKind.amount), note: '固定已付', sub: `已付 ${fixedPaidCount}/${fixedItems.length} 项` },
    { kind: 'transfer', metric: `${overview.transfers} 次`, note: '内部走账 · 不计支出', sub: '' },
  ]

  return (
    <div className="retro-ok-recap">
      <div className="page-head retro-head">
        <div className="row-block">
          <button type="button" className="back-btn" onClick={closeOverlay}>
            <ChevronLeft size={16} /> 今日
          </button>
          <h1>消费力回顾</h1>
        </div>
        <div className="sub">
          {now.getFullYear()}年{now.getMonth() + 1}月 · 全口径月度总结
        </div>
      </div>

      <div className="card retro-hero">
        <div className="small muted">本月总支出</div>
        <b className="hero-num">{money(overview.totalAmount)}</b>
        <div className="small muted">
          共 {overview.totalCount} 笔 · 日常 + 预算 + 未归属 + 固定 · 走账不计入
        </div>
      </div>

      <div className="retro-kinds">
        {kindCards.map((c) => (
          <div className="card kind-card" key={c.kind}>
            <div className="small muted">{KIND_LABELS[c.kind]}</div>
            <b className="kind-num">{c.metric}</b>
            <div className="small muted">
              {c.note}
              {c.sub ? ` · ${c.sub}` : ''}
            </div>
          </div>
        ))}
      </div>

      {overview.unassigned && (
        <button
          type="button"
          className="card retro-warn"
          onClick={() => unassignedPress.guardClick()}
          onPointerDown={unassignedPress.onPointerDown}
          onPointerMove={unassignedPress.onPointerMove}
          onPointerUp={unassignedPress.onPointerUp}
          onPointerCancel={unassignedPress.onPointerCancel}
          onContextMenu={unassignedPress.onContextMenu}
        >
          <div className="row">
            <span>有 {overview.unassigned.count} 笔未归属预算支出</span>
            <b>{money(overview.unassigned.amount)}</b>
          </div>
        </button>
      )}

      <div className="card">
        <div className="row-block">
          <b>{now.getMonth() + 1}月日历</b>
        </div>
        <div className="cal-grid">
          {CAL_WEEK.map((w) => (
            <div className="cal-week" key={w}>
              {w}
            </div>
          ))}
          {Array.from({ length: leadPad }, (_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {month.map((d) =>
            d.passed ? (
              <button
                type="button"
                key={d.day}
                className={`cal-cell cal-${d.status}${d.isToday ? ' cal-today' : ''}`}
                onClick={() => setDetail(d)}
                aria-label={`${d.day}日 ${weekdayOf(d.date)} ${d.dayType} · ${statusText(d.status)}，实际 ${money(d.spent)}，计划 ${money(d.expect)}`}
              >
                <span className="cal-num">{d.day}</span>
                <span className="cal-amt">{money(d.spent)}</span>
              </button>
            ) : (
              <div className="cal-cell cal-future" key={d.day}>
                <span className="cal-num">{d.day}</span>
              </div>
            ),
          )}
        </div>
        <div className="legend">
          <span>
            <i className="lg-ok" />
            省 &lt;80%
          </span>
          <span>
            <i className="lg-warn" />
            贴近 80–100%
          </span>
          <span>
            <i className="lg-over" />
            超 &gt;100%
          </span>
        </div>
        <div className="counts">
          <div className="count count-ok">
            <b>{stats.okDays}</b>
            <span>省</span>
          </div>
          <div className="count count-warn">
            <b>{stats.warnDays}</b>
            <span>贴近</span>
          </div>
          <div className="count count-over">
            <b>{stats.overDays}</b>
            <span>超</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <span>
            <b>当前消费力</b> <span className="small muted">与今日页同口径</span>
          </span>
          <b className="hero-num" style={{ color: statusColor(paceSt) }}>{pacePct}%</b>
        </div>
        <div className="bar">
          <i style={{ width: `${pct(pace.ratio)}%`, background: statusColor(paceSt) }} />
        </div>
        <div className="small muted block-gap">
          本月日常实际 {money(pace.spent)} ÷ 已过 {stats.passedDays} 天计划 {money(pace.possible)} ·{' '}
          {stats.saved >= 0 ? `比计划省下 ${money(stats.saved)}` : `比计划超 ${money(-stats.saved)}`}
        </div>
      </div>

      <div className="card">
        <div className="row-block">
          <b>近 {chartDays.length} 天 · 日常实际 vs 计划</b>
          <span className="small muted">深色实际 · 浅色计划</span>
        </div>
        <div className="chart">
          {chartDays.map((d) => (
            <div className="chart-col" key={d.day}>
              <div className="chart-bars">
                <i style={{ height: barH(d.spent), background: statusColor(d.status) }} />
                <i className="bar-plan" style={{ height: barH(d.expect) }} />
              </div>
              <span className={`chart-day${d.isToday ? ' chart-day-today' : ''}`}>{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="row-block">
          <b>节奏透视</b>
        </div>
        {[stats.workAvg, stats.restAvg].filter((g): g is GroupAvg => !!g).map((g) => (
          <div key={g.label} className="block-gap">
            <div className="row">
              <span className="small">
                {g.label}平均 <span className="muted">· {g.days} 天</span>
              </span>
              <span className="small muted">
                {money(g.spent / g.days)} / {money(g.expect / g.days)} · {ratioText(g.ratio)}
              </span>
            </div>
            <div className="bar">
              <i style={{ width: `${pct(g.ratio)}%`, background: statusColor(statusOfRatio(g.ratio)) }} />
            </div>
          </div>
        ))}
        {(stats.best || stats.worst) && (
          <div className="small muted block-gap">
            {stats.best && <>最省 {stats.best.day} 日（{ratioText(stats.best.ratio)} · {diffText(stats.best)}）</>}
            {stats.best && stats.worst && ' · '}
            {stats.worst && <>最超 {stats.worst.day} 日（{ratioText(stats.worst.ratio)} · {diffText(stats.worst)}）</>}
          </div>
        )}
      </div>

      {settings.budgets.length > 0 && (
        <div className="card">
          <div className="row-block">
            <b>预算 · 本月额度消耗</b>
          </div>
          {views.map((p) => {
            const ratio = p.monthSpent / p.month
            return (
              <button
                type="button"
                key={p.name}
                className="block-gap budget-retro-btn"
                onClick={() => setBudgetDetail(p)}
                aria-label={`${p.name} 本月净支出 ${money(p.monthSpent)}，额度 ${money(p.month)}，查看当月明细`}
              >
                <div className="row">
                  <span className="small">
                    {p.name} <span className="muted">· {p.monthOutCount} 笔{p.monthBackflow > 0 ? ` · 回血 ${p.monthBackflow} 笔` : ''}</span>
                  </span>
                  <span className="small muted">
                    {money(p.monthSpent)} / {money(p.month)} · {Math.round(ratio * 100)}%
                  </span>
                </div>
                <div className="bar">
                  <i style={{ width: `${pct(ratio)}%`, background: statusColor(statusOfRatio(ratio)) }} />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {detail && (
        <Sheet
          title={`${now.getMonth() + 1}/${detail.day} ${weekdayOf(detail.date)} · ${detail.dayType}`}
          onClose={() => setDetail(null)}
        >
          <div className="row-block">
            <span className="small muted">
              计划 {money(detail.expect)} · {detail.entries.length} 笔
            </span>
            <b style={{ color: statusColor(detail.status) }}>
              实际 {money(detail.spent)} · {ratioText(detail.ratio)}
            </b>
          </div>
          <div className="bar">
            <i style={{ width: `${pct(detail.ratio)}%`, background: statusColor(detail.status) }} />
          </div>
          <div className="small block-gap" style={{ color: statusColor(detail.status) }}>
            {detail.spent > detail.expect
              ? `超 ${money(detail.spent - detail.expect)}`
              : `省 ${money(detail.expect - detail.spent)}`}
          </div>
          <div className="block-gap">
            {detail.entries.length > 0 ? (
              detail.entries.map((e) => (
                <div className="feed-item" key={e.id}>
                  <span>
                    {e.category} {e.note && <span className="small muted">{e.note}</span>}
                  </span>
                  <b className="amt-out">{money(e.amount)}</b>
                </div>
              ))
            ) : (
              <div className="small muted">这一天没有日常流水</div>
            )}
          </div>
        </Sheet>
      )}

      {budgetDetail && (
        <Sheet title={`${budgetDetail.name} · ${now.getMonth() + 1}月明细`} onClose={() => setBudgetDetail(null)}>
          {(() => {
            const entries = budgetMonthEntries(records, budgetDetail.name, now)
            const ratio = budgetDetail.monthSpent / budgetDetail.month
            const st = statusOfRatio(ratio)
            return (
              <>
                <div className="row-block">
                  <span className="small muted">
                    额度 {money(budgetDetail.month)} · 支出 {budgetDetail.monthOutCount} 笔
                    {budgetDetail.monthBackflow > 0 ? ` · 回血 ${budgetDetail.monthBackflow} 笔` : ''}
                  </span>
                  <b style={{ color: statusColor(st) }}>
                    净 {money(budgetDetail.monthSpent)} · {ratioText(ratio)}
                  </b>
                </div>
                <div className="bar">
                  <i style={{ width: `${pct(ratio)}%`, background: statusColor(st) }} />
                </div>
                <div className="small block-gap" style={{ color: statusColor(st) }}>
                  {budgetDetail.monthSpent > budgetDetail.month
                    ? `超 ${money(budgetDetail.monthSpent - budgetDetail.month)}`
                    : `还剩 ${money(budgetDetail.month - budgetDetail.monthSpent)}`}
                </div>
                <div className="block-gap">
                  {entries.length > 0 ? (
                    entries.map((e) => (
                      <div className="feed-item" key={e.id}>
                        <span>
                          {new Date(e.ts).getDate()} 日 {e.note && <span className="small muted">{e.note}</span>}
                        </span>
                        <b className={e.dir === 'in' ? 'amt-in' : 'amt-out'}>
                          {e.dir === 'in' ? '+' : ''}
                          {money(e.amount)}
                        </b>
                      </div>
                    ))
                  ) : (
                    <div className="small muted">这个月该预算还没有流水</div>
                  )}
                </div>
              </>
            )
          })()}
        </Sheet>
      )}
    </div>
  )
}
