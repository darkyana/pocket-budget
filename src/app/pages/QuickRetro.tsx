import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import {
  dayRetroMonth,
  retroStats,
  routinePace,
  statusOfRatio,
  weekdayOf,
  type DayRetro,
  type DayStatus,
  type GroupAvg,
} from '../../core/derive'
import { useApp } from '../store'
import { Sheet } from '../components/Sheet'
import { money } from '../format'
import { statusColor } from '../statusColor'

const pct = (n: number) => Math.max(0, Math.min(100, n * 100))
const statusText = (s: DayStatus) => (s === 'over' ? '超' : s === 'warn' ? '贴近' : '省')
const ratioText = (r: number) => (Number.isFinite(r) ? `${Math.round(r * 100)}%` : '超支')
const diffText = (d: DayRetro) => (d.spent > d.expect ? `超 ${money(d.spent - d.expect)}` : `省 ${money(d.expect - d.spent)}`)

const CAL_WEEK = ['一', '二', '三', '四', '五', '六', '日']

export function QuickRetro() {
  const settings = useApp((s) => s.settings)
  const records = useApp((s) => s.records)
  const closeOverlay = useApp((s) => s.closeOverlay)
  const [detail, setDetail] = useState<DayRetro | null>(null)

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
  const pace = routinePace(records, settings, now)
  const month = dayRetroMonth(records, settings, now)
  const stats = retroStats(month)
  const pacePct = Math.round(pace.ratio * 100)
  const paceSt = statusOfRatio(pace.ratio)
  const todayRetro = month.find((d) => d.isToday) ?? null
  const chartDays = month.filter((d) => d.passed).slice(-14)
  const chartMax = Math.max(1, ...chartDays.map((d) => Math.max(d.spent, d.expect)))
  const barH = (v: number) => `${Math.max(3, Math.round((v / chartMax) * 84))}px`
  const leadPad = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7

  return (
    <>
      <div className="retro-head">
        <button type="button" className="back-btn" onClick={closeOverlay}>
          <ChevronLeft size={16} /> 今日
        </button>
        <h1>消费力回顾</h1>
      </div>
      <div className="sub">
        {now.getFullYear()}年{now.getMonth() + 1}月 · 日常实际 vs 日型计划 · 点日期看当天明细
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
        <div className="small muted block-gap">
          每天的计划按当日日型（工作日/周末日）加总；不到 80% 算省，超过计划即超支
        </div>
      </div>

      <div className="card">
        <div className="row-block">
          <b>{now.getMonth() + 1}月日历</b>
          <span className="small muted">格内数字 = 当日日常支出</span>
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
                <span className="cal-amt">{Math.round(d.spent)}</span>
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
        {todayRetro && (
          <div className="small block-gap" style={{ color: statusColor(todayRetro.status) }}>
            今天 {todayRetro.day} 日：{money(todayRetro.spent)} / 计划 {money(todayRetro.expect)} ·{' '}
            {todayRetro.spent > todayRetro.expect
              ? `超 ${money(todayRetro.spent - todayRetro.expect)}`
              : `省 ${money(todayRetro.expect - todayRetro.spent)}`}
          </div>
        )}
      </div>

      <div className="card">
        <div className="row-block">
          <b>近 {chartDays.length} 天 · 实际 vs 计划</b>
          <span className="small muted">深色实际 · 浅色计划</span>
        </div>
        <div className="chart">
          {chartDays.map((d) => (
            <div className="chart-col" key={d.day}>
              <div className="chart-bars">
                <i className="bar-act" style={{ height: barH(d.spent), background: statusColor(d.status) }} />
                <i className="bar-plan" style={{ height: barH(d.expect) }} />
              </div>
              <span className={`chart-day${d.isToday ? ' chart-day-today' : ''}`}>{d.day}</span>
            </div>
          ))}
        </div>
        <div className="small muted block-gap">
          实际按当日状态着色（绿省 / 橙贴近 / 红超）· 今天的日期加粗
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
    </>
  )
}
