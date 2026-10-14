import { useEffect, useState } from 'react'
import { type MoneyRecord } from '../../core/types'
import { dayKeyOf } from '../../core/time'
import { dayLabel, groupByDay } from '../../core/derive'
import { useApp } from '../store'
import { DataSheet } from '../components/DataSheet'
import { FixedExpenseSheet } from '../components/FixedExpenseSheet'
import { EntrySheet, type EntryTarget } from '../components/EntrySheet'
import { Sheet } from '../components/Sheet'
import { moneyExact } from '../format'

function describe(e: MoneyRecord): { label: string; amount: string } {
  switch (e.kind) {
    case 'routine':
      return { label: `日常 · ${e.category}${e.account ? ` · ${e.account}` : ''}`, amount: moneyExact(e.amount) }
    case 'budget':
      return {
        label: `预算 · ${e.budget} ${e.dir === 'out' ? '支出' : '回血'}${e.account ? ` · ${e.account}` : ''}`,
        amount: `${e.dir === 'in' ? '+' : ''}${moneyExact(e.amount)}`,
      }
    case 'fixed':
      return {
        label: `固定支出 · ${e.item} ${e.paid ? '标记已付' : '改回未付'}${e.account ? ` · ${e.account}` : ''}`,
        amount: moneyExact(e.amount),
      }
    case 'transfer':
      return { label: `走账 · ${e.from} → ${e.to}`, amount: moneyExact(e.amount) }
  }
}

/** 金额配色：支出墨色、收入（回血）绿、走账灰（非收支） */
function amountClass(e: MoneyRecord): string {
  if (e.kind === 'budget' && e.dir === 'in') return 'amt-in'
  if (e.kind === 'transfer') return 'amt-transfer'
  return 'amt-out'
}

/** 消费/走账用通用记账弹层编辑；固定支出用专用弹层（日期+账户） */
function targetOf(e: MoneyRecord): EntryTarget | null {
  if (e.kind === 'routine') return { type: 'routine', category: e.category }
  if (e.kind === 'budget') return { type: 'budget', budget: e.budget }
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

/** 分类筛选 token：细分 = routine:分类名 / budget:预算名；固定支出/走账只有大类 token */
function catHit(e: MoneyRecord, tokens: string[]): boolean {
  if (e.kind === 'routine') return tokens.includes(`routine:${e.category}`)
  if (e.kind === 'budget') return tokens.includes(`budget:${e.budget}`)
  return tokens.includes(e.kind)
}

/** 分类筛选弹层：草稿态多选 chips。「全部日常/全部预算」是细分的主开关——点 = 全选细分，再点 = 全清；
 *  固定支出/走账不细分，直接按类型选；多选取并集。chip 上的数字 = 账户/日期范围内的笔数 */
function CategoryFilterSheet({
  selected,
  routineCategories,
  budgetNames,
  counts,
  onApply,
  onClose,
}: {
  selected: string[]
  routineCategories: string[]
  budgetNames: string[]
  counts: { routine: number; budget: number; fixed: number; transfer: number; routineCat: Record<string, number>; budgetCat: Record<string, number> }
  onApply(tokens: string[]): void
  onClose(): void
}) {
  const [draft, setDraft] = useState<string[]>(selected)
  const toggle = (t: string) => setDraft((d) => (d.includes(t) ? d.filter((x) => x !== t) : [...d, t]))
  const chip = (on: boolean) => (on ? 'chip on' : 'chip')
  /** 主开关：全选/全清某前缀的细分 token */
  const toggleAll = (prefix: 'routine:' | 'budget:', names: string[], allOn: boolean) =>
    setDraft((d) => (allOn ? d.filter((t) => !t.startsWith(prefix)) : [...d.filter((t) => !t.startsWith(prefix)), ...names.map((n) => `${prefix}${n}`)]))
  const allRoutineOn = routineCategories.length > 0 && routineCategories.every((c) => draft.includes(`routine:${c}`))
  const allBudgetOn = budgetNames.length > 0 && budgetNames.every((b) => draft.includes(`budget:${b}`))
  return (
    <Sheet title="按分类筛选" onClose={onClose}>
      <div className="dm-label">类型</div>
      <div className="chips">
        <button type="button" className={chip(allRoutineOn)} onClick={() => toggleAll('routine:', routineCategories, allRoutineOn)}>
          全部日常 {counts.routine}
        </button>
        <button type="button" className={chip(allBudgetOn)} onClick={() => toggleAll('budget:', budgetNames, allBudgetOn)}>
          全部预算 {counts.budget}
        </button>
        <button type="button" className={chip(draft.includes('fixed'))} onClick={() => toggle('fixed')}>
          固定支出 {counts.fixed}
        </button>
        <button type="button" className={chip(draft.includes('transfer'))} onClick={() => toggle('transfer')}>
          走账 {counts.transfer}
        </button>
      </div>
      {routineCategories.length > 0 && (
        <>
          <div className="dm-label">日常分类（细分）</div>
          <div className="chips">
            {routineCategories.map((c) => (
              <button key={c} type="button" className={chip(draft.includes(`routine:${c}`))} onClick={() => toggle(`routine:${c}`)}>
                {c} {counts.routineCat[c] ?? 0}
              </button>
            ))}
          </div>
        </>
      )}
      {budgetNames.length > 0 && (
        <>
          <div className="dm-label">预算（细分）</div>
          <div className="chips">
            {budgetNames.map((b) => (
              <button key={b} type="button" className={chip(draft.includes(`budget:${b}`))} onClick={() => toggle(`budget:${b}`)}>
                {b} {counts.budgetCat[b] ?? 0}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="small muted" style={{ margin: '4px 0 12px' }}>
        「全部日常 / 全部预算」一键全选对应细分；多选取并集。数字 = 当前账户/日期筛选范围内的笔数
      </div>
      <div className="form-btns">
        <button type="button" className="btn-ghost" onClick={() => onApply([])}>
          清除
        </button>
        <button type="button" onClick={() => onApply(draft)}>
          完成
        </button>
      </div>
    </Sheet>
  )
}

export function Records() {
  const settings = useApp((s) => s.settings)
  const records = useApp((s) => s.records)
  const pendingCatTokens = useApp((s) => s.pendingCatTokens)
  const clearPendingCats = useApp((s) => s.clearPendingCats)
  const [editingId, setEditingId] = useState<string | null>(null)

  /** 对账筛选：账户（走账匹配转出/转入任一侧）+ 日期区间（可只填一端）+ 分类（大类/细分多选并集）；入口在按钮排，选择走半弹层 */
  const [accountFilter, setAccountFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [catFilter, setCatFilter] = useState<string[]>([])
  const hasFilter = !!accountFilter || !!fromDate || !!toDate || catFilter.length > 0
  const [filterSheet, setFilterSheet] = useState<'account' | 'date' | 'cat' | null>(null)

  // 跨页跳转预置的分类筛选（今日页长按预算行）：挂载时消费一次
  useEffect(() => {
    if (pendingCatTokens.length > 0) {
      setCatFilter(pendingCatTokens)
      clearPendingCats()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  /** 导出/导入/清空收拢进数据管理弹层 */
  const [dataSheet, setDataSheet] = useState(false)

  const dateLabel = (() => {
    const f = fromDate ? fromDate.slice(5).replace('-', '/') : ''
    const t = toDate ? toDate.slice(5).replace('-', '/') : ''
    if (f && t) return fromDate === toDate ? f : `${f}–${t}`
    if (f) return `${f} 起`
    if (t) return `至 ${t}`
    return ''
  })()

  /** 账户 + 日期范围（分类计数的口径：分类条件不参与，数字在切换分类时保持稳定） */
  const matchScope = (e: MoneyRecord) => {
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
  }

  const filtered = records.filter((e) => matchScope(e) && (catFilter.length === 0 || catHit(e, catFilter)))

  const groups = groupByDay(filtered)
  const now = new Date()

  /** 细分选项来源：设置里定义的 + 流水里实际出现过（但设置已删）的名字，去重 */
  const routineCategories = [
    ...new Set([
      ...Object.values(settings.dayPlans).flat().map((b) => b.name),
      ...records.flatMap((e) => (e.kind === 'routine' ? [e.category] : [])),
    ]),
  ]
  const budgetNames = [
    ...new Set([...settings.budgets.map((b) => b.name), ...records.flatMap((e) => (e.kind === 'budget' ? [e.budget] : []))]),
  ]

  /** 分类弹层的计数：按账户/日期范围（不含分类条件） */
  const scoped = records.filter(matchScope)
  const catCounts = {
    routine: scoped.filter((e) => e.kind === 'routine').length,
    budget: scoped.filter((e) => e.kind === 'budget').length,
    fixed: scoped.filter((e) => e.kind === 'fixed').length,
    transfer: scoped.filter((e) => e.kind === 'transfer').length,
    routineCat: Object.fromEntries(routineCategories.map((c) => [c, scoped.filter((e) => e.kind === 'routine' && e.category === c).length])),
    budgetCat: Object.fromEntries(budgetNames.map((b) => [b, scoped.filter((e) => e.kind === 'budget' && e.budget === b).length])),
  }

  return (
    <>
      <h1>流水</h1>
      <div className="sub">
        {hasFilter ? `筛选中 · ${filtered.length}/${records.length} 笔` : `本机记录的全部流水 · ${records.length} 笔`}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button type="button" className={`btn2 ${accountFilter ? 'on' : ''}`} onClick={() => setFilterSheet('account')}>
          {accountFilter ? `账户 · ${accountFilter}` : '按账户筛选'}
        </button>
        <button type="button" className={`btn2 ${dateLabel ? 'on' : ''}`} onClick={() => setFilterSheet('date')}>
          {dateLabel ? `日期 · ${dateLabel}` : '按日期筛选'}
        </button>
        <button type="button" className={`btn2 ${catFilter.length ? 'on' : ''}`} onClick={() => setFilterSheet('cat')}>
          {catFilter.length ? `分类 · ${catFilter.length} 项` : '按分类筛选'}
        </button>
        <button type="button" className="btn2" style={{ marginLeft: 'auto' }} onClick={() => setDataSheet(true)}>
          数据管理
        </button>
      </div>
      {groups.length > 0 ? (
        groups.map((g) => (
          <div className="card" key={g.dayKey}>
            <div className="day-head">
              <span>{dayLabel(g.dayKey, now)}</span>
              <span>支出 {moneyExact(g.outflow)}</span>
            </div>
            {g.records.map((e) => {
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
        <div className="card">
          <div className="small muted" style={{ padding: '10px 0' }}>
            {records.length === 0
              ? '还没有记录。回「今日」页点卡片 / 预算 / 固定支出即可记。'
              : '没有符合条件的记录——试试清除筛选。'}
          </div>
        </div>
      )}
      <div className="small muted" style={{ textAlign: 'center' }}>
        点一笔可编辑；日常/预算可互转改类（先批量记、回头分类）
      </div>
      {dataSheet && <DataSheet onClose={() => setDataSheet(false)} />}
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
      {filterSheet === 'cat' && (
        <CategoryFilterSheet
          selected={catFilter}
          routineCategories={routineCategories}
          budgetNames={budgetNames}
          counts={catCounts}
          onApply={(tokens) => {
            setCatFilter(tokens)
            setFilterSheet(null)
          }}
          onClose={() => setFilterSheet(null)}
        />
      )}
      {editingId &&
        (() => {
          const ev = records.find((x) => x.id === editingId)
          if (!ev) return null
          if (ev.kind === 'fixed') {
            return <FixedExpenseSheet event={ev} onClose={() => setEditingId(null)} />
          }
          const target = targetOf(ev)
          return target ? <EntrySheet target={target} existing={ev} onClose={() => setEditingId(null)} /> : null
        })()}
    </>
  )
}
