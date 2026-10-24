import { useState } from 'react'
import { Sheet } from './Sheet'
import { FormFooter } from './FormFooter'

export function CategoryFilterSheet({
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
  const toggleAll = (prefix: 'routine:' | 'budget:', names: string[], allOn: boolean) =>
    setDraft((d) => (allOn ? d.filter((t) => !t.startsWith(prefix)) : [...d.filter((t) => !t.startsWith(prefix)), ...names.map((n) => `${prefix}${n}`)]))
  const allRoutineOn = routineCategories.length > 0 && routineCategories.every((c) => draft.includes(`routine:${c}`))
  const allBudgetOn = budgetNames.length > 0 && budgetNames.every((b) => draft.includes(`budget:${b}`))
  return (
    <Sheet title="按分类筛选" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onApply(draft)
        }}
      >
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
        <div className="small muted field-row">
          「全部日常 / 全部预算」一键全选对应细分；多选取并集。数字 = 当前账户/日期筛选范围内的笔数
        </div>
        <FormFooter secondary={{ label: '清除', onClick: () => onApply([]) }} submitLabel="完成" />
      </form>
    </Sheet>
  )
}
