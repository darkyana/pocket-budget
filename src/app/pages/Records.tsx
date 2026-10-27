import { useEffect, useState } from 'react'
import { type MoneyRecord } from '../../core/types'
import { filterRecords } from '../../core/recordsFilter'
import { dayLabel, effectiveRecords, groupByDay } from '../../core/derive'
import { useApp } from '../store'
import { DataSheet } from '../components/DataSheet'
import { FixedExpenseSheet } from '../components/FixedExpenseSheet'
import { EntrySheet, type EntryTarget } from '../components/EntrySheet'
import { Sheet } from '../components/Sheet'
import { DateFilterSheet } from '../components/DateFilterSheet'
import { CategoryFilterSheet } from '../components/CategoryFilterSheet'
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

function amountClass(e: MoneyRecord): string {
  if (e.kind === 'budget' && e.dir === 'in') return 'amt-in'
  if (e.kind === 'transfer') return 'amt-transfer'
  return 'amt-out'
}

function targetOf(e: MoneyRecord): EntryTarget | null {
  if (e.kind === 'routine') return { type: 'routine', category: e.category }
  if (e.kind === 'budget') return { type: 'budget', budget: e.budget }
  if (e.kind === 'transfer') return { type: 'transfer' }
  return null
}

function catHit(e: MoneyRecord, tokens: string[]): boolean {
  if (e.kind === 'routine') return tokens.includes(`routine:${e.category}`)
  if (e.kind === 'budget') return tokens.includes(`budget:${e.budget}`)
  return tokens.includes(e.kind)
}

export function Records() {
  const settings = useApp((s) => s.settings)
  const storedRecords = useApp((s) => s.records)
  const records = effectiveRecords(storedRecords)
  const pendingCatTokens = useApp((s) => s.pendingCatTokens)
  const clearPendingCats = useApp((s) => s.clearPendingCats)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const [accountFilter, setAccountFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [catFilter, setCatFilter] = useState<string[]>([])
  const hasFilter = !!accountFilter || !!fromDate || !!toDate || catFilter.length > 0
  const [filterSheet, setFilterSheet] = useState<'account' | 'date' | 'cat' | null>(null)

  useEffect(() => {
    if (pendingCatTokens.length > 0) {
      setCatFilter(pendingCatTokens)
      clearPendingCats()
    }
  }, [])
  const [dataSheet, setDataSheet] = useState(false)

  const dateLabel = (() => {
    const f = fromDate ? fromDate.slice(5).replace('-', '/') : ''
    const t = toDate ? toDate.slice(5).replace('-', '/') : ''
    if (f && t) return fromDate === toDate ? f : `${f}–${t}`
    if (f) return `${f} 起`
    if (t) return `至 ${t}`
    return ''
  })()

  const matchScope = (e: MoneyRecord) => {
    if (accountFilter) {
      if ('account' in e && e.account) {
        if (e.account !== accountFilter) return false
      } else if (e.kind === 'transfer') {
        if (e.from !== accountFilter && e.to !== accountFilter) return false
      } else {
        return false
      }
    }
    return true
  }

  const dateFiltered = filterRecords(records, { from: fromDate, to: toDate })
  const filtered = dateFiltered.filter((e) => matchScope(e) && (catFilter.length === 0 || catHit(e, catFilter)))

  const groups = groupByDay(filtered)
  const now = new Date()

  const routineCategories = [
    ...new Set([
      ...Object.values(settings.dayPlans).flat().map((b) => b.name),
      ...records.flatMap((e) => (e.kind === 'routine' ? [e.category] : [])),
    ]),
  ]
  const budgetNames = [
    ...new Set([...settings.budgets.map((b) => b.name), ...records.flatMap((e) => (e.kind === 'budget' ? [e.budget] : []))]),
  ]

  const scoped = dateFiltered.filter(matchScope)
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
      <div className="page-head">
        <h1>流水</h1>
        <div className="sub">
          {hasFilter ? `筛选中 · ${filtered.length}/${records.length} 笔` : `本机记录的全部流水 · ${records.length} 笔`}
          {' · '}
          <button type="button" className="link" onClick={() => setAdding(true)}>
            ＋ 记一笔
          </button>
        </div>
        <div className="chips">
          <button type="button" className={`btn2 ${accountFilter ? 'on' : ''}`} onClick={() => setFilterSheet('account')}>
            {accountFilter ? `账户 · ${accountFilter}` : '按账户筛选'}
          </button>
          <button type="button" className={`btn2 ${dateLabel ? 'on' : ''}`} onClick={() => setFilterSheet('date')}>
            {dateLabel ? `日期 · ${dateLabel}` : '按日期筛选'}
          </button>
          <button type="button" className={`btn2 ${catFilter.length ? 'on' : ''}`} onClick={() => setFilterSheet('cat')}>
            {catFilter.length ? `分类 · ${catFilter.length} 项` : '按分类筛选'}
          </button>
          <button type="button" className="btn2 push-end" onClick={() => setDataSheet(true)}>
            数据管理
          </button>
        </div>
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
                  <span className={amountClass(e)}>
                    {d.amount}
                  </span>
                </button>
              )
            })}
          </div>
        ))
      ) : (
        <div className="card">
          <div className="small muted center">
            {records.length === 0 ? '还没有记录' : '没有符合条件的记录——试试清除筛选。'}
          </div>
        </div>
      )}
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
      {adding && <EntrySheet target={{ type: 'free' }} onClose={() => setAdding(false)} />}
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
