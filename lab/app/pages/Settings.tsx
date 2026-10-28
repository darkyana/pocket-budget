import { useRef, useState } from 'react'
import { todayDayType, monthQuickCalc, DEFAULT_ROUTINE_RATIO } from '../../core/derive'
import { dayKeyOf } from '../../core/time'
import { useDragSort } from '../components/dragSort'
import { Sheet } from '../components/Sheet'
import { useApp } from '../store'
import { useToast } from '../toast'
import { ConfirmButton } from '../components/ConfirmButton'
import { FormSheet, type FieldDef } from '../components/FormSheet'
import { SegmentedControl } from '../components/SegmentedControl'
import { FormFooter } from '../components/FormFooter'
import { money } from '../format'

type Seg = 'routine' | 'fixed' | 'budget'

function arrayMove<T>(arr: T[], from: number, to: number) {
  const [x] = arr.splice(from, 1)
  arr.splice(to, 0, x)
}

interface FormSpec {
  title: string
  fields: FieldDef[]
  submitLabel?: string
  onSubmit(values: Record<string, string>): void
}

export function SettingsPage() {
  const settings = useApp((s) => s.settings)
  const updateSettings = useApp((s) => s.updateSettings)
  const renameAnchor = useApp((s) => s.renameAnchor)
  const saveRoutine = useApp((s) => s.saveRoutine)
  const saveBudget = useApp((s) => s.saveBudget)
  const factoryReset = useApp((s) => s.factoryReset)
  const toast = useToast((s) => s.show)
  const [seg, setSeg] = useState<Seg>('routine')
  const [form, setForm] = useState<FormSpec | null>(null)
  const [ratioSheet, setRatioSheet] = useState(false)
  const mergeArmed = useRef<{ name: string } | null>(null)

  const dayTypes = Object.keys(settings.dayPlans)
  const effDayType = todayDayType(settings, new Date())
  const buckets = settings.dayPlans[effDayType] ?? []

  const dragRoutine = useDragSort(buckets.length, (from, to) =>
    updateSettings((s) => {
      arrayMove(s.dayPlans[effDayType], from, to)
    }),
  )
  const dragBudget = useDragSort(settings.budgets.length, (from, to) =>
    updateSettings((s) => {
      arrayMove(s.budgets, from, to)
    }),
  )
  const dragFixed = useDragSort(settings.fixedExpenses.length, (from, to) =>
    updateSettings((s) => {
      arrayMove(s.fixedExpenses, from, to)
    }),
  )

  const num = (v: string | undefined): number | null => {
    const n = Number.parseFloat(v ?? '')
    return Number.isFinite(n) && n > 0 ? n : null
  }

  function editBucket(index: number) {
    const b = buckets[index]
    mergeArmed.current = null
    setForm({
      title: `编辑日常（${effDayType}）`,
      fields: [
        { key: 'name', label: '类别名', type: 'text', initial: b.name },
        { key: 'expect', label: '单日期望（元）', type: 'number', initial: String(b.expect) },
      ],
      onSubmit: (values) => {
        const expect = num(values.expect)
        const name = values.name.trim()
        if (!name || expect === null) {
          toast('类别名和期望金额都要填')
          return
        }
        saveRoutine(effDayType, index, { name, expect })
        setForm(null)
        toast(name === b.name ? '已保存' : '已保存，历史流水已同步改名')
      },
    })
  }

  function addBucket() {
    setForm({
      title: `新增日常（${effDayType}）`,
      fields: [
        { key: 'name', label: '类别名', type: 'text', placeholder: '如：咖啡' },
        { key: 'expect', label: '单日期望（元）', type: 'number', placeholder: '如：20' },
      ],
      onSubmit: (values) => {
        const expect = num(values.expect)
        if (!values.name.trim() || expect === null) {
          toast('类别名和期望金额都要填')
          return
        }
        updateSettings((s) => {
          s.dayPlans[effDayType].push({ name: values.name.trim(), expect })
        })
        setForm(null)
        toast('已新增')
      },
    })
  }

  const cycleOptions = [
    { value: 'monthly', label: '每月' },
    { value: 'yearly', label: '每年' },
  ]

  function editFixedExpense(index: number) {
    const c = settings.fixedExpenses[index]
    mergeArmed.current = null
    setForm({
      title: '编辑固定支出',
      fields: [
        { key: 'name', label: '名称', type: 'text', initial: c.name },
        { key: 'amount', label: '金额（元）', type: 'number', initial: String(c.amount) },
        { key: 'cycle', label: '周期', type: 'select', options: cycleOptions, initial: c.cycle ?? 'monthly' },
      ],
      onSubmit: (values) => {
        const amount = num(values.amount)
        const name = values.name.trim()
        if (!name || amount === null) {
          toast('名称和金额都要填')
          return
        }
        const cycle = values.cycle === 'yearly' ? 'yearly' : 'monthly'
        if (name === c.name) {
          updateSettings((s) => {
            s.fixedExpenses[index] = { name, amount, cycle }
          })
          setForm(null)
          toast('已保存')
          return
        }
        const dup = settings.fixedExpenses.some((x, i) => i !== index && x.name === name)
        if (dup && mergeArmed.current?.name !== name) {
          mergeArmed.current = { name }
          toast(`「${name}」已存在——再点一次「保存」合并（历史流水归入它，金额/周期沿用对方）`)
          return
        }
        mergeArmed.current = null
        if (dup) {
          updateSettings((s) => {
            s.fixedExpenses.splice(index, 1)
          })
          renameAnchor('fixed', c.name, name)
          setForm(null)
          toast(`已合并到「${name}」，历史流水同步改名`)
        } else {
          updateSettings((s) => {
            s.fixedExpenses[index] = { name, amount, cycle }
          })
          renameAnchor('fixed', c.name, name)
          setForm(null)
          toast('已保存，历史流水已同步改名')
        }
      },
    })
  }

  function addFixedExpense() {
    setForm({
      title: '新增固定支出',
      fields: [
        { key: 'name', label: '名称', type: 'text', placeholder: '如：宠物粮 / 域名' },
        { key: 'amount', label: '金额（元）', type: 'number', placeholder: '如：400' },
        { key: 'cycle', label: '周期', type: 'select', options: cycleOptions, initial: 'monthly' },
      ],
      onSubmit: (values) => {
        const amount = num(values.amount)
        if (!values.name.trim() || amount === null) {
          toast('名称和金额都要填')
          return
        }
        const cycle = values.cycle === 'yearly' ? 'yearly' : 'monthly'
        updateSettings((s) => {
          s.fixedExpenses.push({ name: values.name.trim(), amount, cycle })
        })
        setForm(null)
        toast('已新增')
      },
    })
  }

  function editBudget(index: number) {
    const p = settings.budgets[index]
    mergeArmed.current = null
    setForm({
      title: '编辑预算',
      fields: [
        { key: 'name', label: '名称', type: 'text', initial: p.name },
        { key: 'month', label: '月预算（元）', type: 'number', initial: String(p.month) },
      ],
      onSubmit: (values) => {
        const month = num(values.month)
        const name = values.name.trim()
        if (!name || month === null) {
          toast('名称和月预算都要填')
          return
        }
        saveBudget(index, { name, month })
        setForm(null)
        toast(name === p.name ? '已保存' : '已保存，历史流水已同步改名')
      },
    })
  }

  function addBudget() {
    setForm({
      title: '新增预算',
      fields: [
        { key: 'name', label: '名称', type: 'text', placeholder: '如：购物' },
        { key: 'month', label: '月预算（元）', type: 'number', placeholder: '如：800' },
      ],
      onSubmit: (values) => {
        const month = num(values.month)
        if (!values.name.trim() || month === null) {
          toast('名称和月预算都要填')
          return
        }
        updateSettings((s) => {
          s.budgets.push({ name: values.name.trim(), month })
        })
        setForm(null)
        toast('已新增')
      },
    })
  }

  return (
    <>
      <div className="page-head">
        <h1>设置</h1>
        <div className="sub">日常 · 预算 · 固定支出</div>
      </div>
      <SegmentedControl<Seg>
        value={seg}
        options={[
          { value: 'routine', label: '日常' },
          { value: 'budget', label: '预算' },
          { value: 'fixed', label: '固定支出' },
        ]}
        onChange={setSeg}
      />

      {seg === 'routine' && (
        <div className="card">
          <div className="row-block">
            <b>今天算哪种日子？</b>
          </div>
          <div className="chips">
            {dayTypes.map((name) => (
              <button
                type="button"
                key={name}
                className={name === effDayType ? 'chip on' : 'chip'}
                onClick={() => {
                  updateSettings((s) => {
                    s.dayType = name
                    s.dayTypeSetFor = dayKeyOf(new Date())
                  })
                  toast(`日型切到：${name}（今天）`)
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="small muted hint">
            当前：{effDayType} · 按周末与法定节假日自动选，点选只改今天
          </div>
          {buckets.map((b, i) => {
            const p = dragRoutine.rowProps(i)
            return (
              <div key={`${b.name}-${i}`} {...p}>
                <button
                  type="button"
                  className="setrow-main"
                  onClick={() => {
                    if (dragRoutine.guardClick()) return
                    editBucket(i)
                  }}
                >
                  {b.name} <span className="small muted">期望 {money(b.expect)}</span>
                </button>
                <ConfirmButton
                  label="删"
                  confirmLabel="确认删？"
                  onConfirm={() => {
                    updateSettings((s) => {
                      s.dayPlans[effDayType].splice(i, 1)
                    })
                    toast('已删')
                  }}
                />
              </div>
            )
          })}
          <div className="block-gap">
            <button type="button" className="btn2" onClick={addBucket}>
              ＋ 新增日常
            </button>
          </div>
        </div>
      )}

      {seg === 'fixed' && (
        <div className="card">
          <div className="small muted hint">
            每月 / 每年固定要付的钱（点行改名称、金额、周期）
          </div>
          {settings.fixedExpenses.map((c, i) => {
            const p = dragFixed.rowProps(i)
            return (
              <div key={`${c.name}-${i}`} {...p}>
                <button
                  type="button"
                  className="setrow-main"
                  onClick={() => {
                    if (dragFixed.guardClick()) return
                    editFixedExpense(i)
                  }}
                >
                  {c.name}{' '}
                  <span className="small muted">
                    {money(c.amount)}/{c.cycle === 'yearly' ? '年' : '月'}
                  </span>
                </button>
                <ConfirmButton
                  label="删"
                  confirmLabel="确认删？"
                  onConfirm={() => {
                    updateSettings((s) => {
                      s.fixedExpenses.splice(i, 1)
                    })
                    toast('已删')
                  }}
                />
              </div>
            )
          })}
          <div className="block-gap">
            <button type="button" className="btn2" onClick={addFixedExpense}>
              ＋ 新增固定支出
            </button>
          </div>
        </div>
      )}

      {seg === 'budget' && (
        <div className="card">
          <div className="small muted hint">
            预算（点行改月预算 / 周额度）
          </div>
          {settings.budgets.map((p, i) => {
            const d = dragBudget.rowProps(i)
            return (
              <div key={`${p.name}-${i}`} {...d}>
                <button
                  type="button"
                  className="setrow-main"
                  onClick={() => {
                    if (dragBudget.guardClick()) return
                    editBudget(i)
                  }}
                >
                  {p.name}{' '}
                  <span className="small muted">
                    月 {money(p.month)} · 周 {money(p.month / 4)}（自动）
                  </span>
                </button>
                <ConfirmButton
                  label="删"
                  confirmLabel="确认删？"
                  onConfirm={() => {
                    updateSettings((s) => {
                      s.budgets.splice(i, 1)
                    })
                    toast('已删（历史记录保留在流水里）')
                  }}
                />
              </div>
            )
          })}
          <div className="block-gap">
            <button type="button" className="btn2" onClick={addBudget}>
              ＋ 新增预算
            </button>
          </div>
        </div>
      )}

      <div className="section-gap">
        <div className="row-block">
          <b>本月速算</b>
        </div>
        {(() => {
          const qc = monthQuickCalc(settings, new Date())
          return (
            <table className="quick-table">
              <thead>
                <tr>
                  <th>项目</th>
                  <th>构成</th>
                  <th className="num">金额</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>日常</td>
                  <td className="muted">
                    工作日 {qc.workDays} 天 × {money(qc.workExpect)} + 休息日 {qc.restDays} 天 × {money(qc.restExpect)}
                    （全额 {money(qc.routineBase)} × 实际 {Math.round(qc.ratio * 100)}%）{' · '}
                    <button
                      type="button"
                      className="link"
                      onClick={() => {
                        mergeArmed.current = null
                        setRatioSheet(true)
                      }}
                    >
                      调整比率
                    </button>
                  </td>
                  <td className="num">{money(qc.routineTotal)}</td>
                </tr>
                <tr>
                  <td>预算</td>
                  <td className="muted">{qc.budgetCount} 项月额度</td>
                  <td className="num">{money(qc.budgetTotal)}</td>
                </tr>
                <tr>
                  <td>固定支出 · 月付</td>
                  <td className="muted">{qc.fixedMonthlyCount} 项</td>
                  <td className="num">{money(qc.fixedMonthlyTotal)}</td>
                </tr>
                <tr>
                  <td>固定支出 · 年付</td>
                  <td className="muted">
                    {qc.fixedYearlyCount} 项共 {money(qc.fixedYearlyTotal)}（÷12 月摊）
                  </td>
                  <td className="num">{money(qc.fixedYearlyAmortized)}</td>
                </tr>
                <tr className="sum">
                  <td>本月合计</td>
                  <td className="muted">日常 + 预算 + 固定</td>
                  <td className="num">{money(qc.total)}</td>
                </tr>
              </tbody>
            </table>
          )
        })()}
      </div>

      <div className="block-gap center">
        <ConfirmButton
          label="恢复出厂（清空一切，含记录）"
          confirmLabel="真的全部清空？"
          onConfirm={() => {
            factoryReset()
            toast('已恢复出厂')
          }}
        />
      </div>

      {ratioSheet && (
        <Sheet title="调整日常实际比率" onClose={() => setRatioSheet(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setRatioSheet(false)
            }}
          >
            <div className="small muted field-row note">
              日常的单日期望是「这种日子合理消费的上限」，并不是每天都会把它花光。
              本月速算按这个比率把期望全额折算成预计实际花费——只影响速算的估算，
              不影响今日页的期望与进度条。
            </div>
            <div className="row-block">
              <input
                type="range"
                className="range"
                min={10}
                max={100}
                step={5}
                value={Math.round((settings.routineSpendRatio ?? DEFAULT_ROUTINE_RATIO) * 100)}
                onChange={(e) => {
                  const pctVal = Number(e.target.value)
                  updateSettings((s) => {
                    s.routineSpendRatio = pctVal / 100
                  })
                }}
              />
              <b className="nowrap">{Math.round((settings.routineSpendRatio ?? DEFAULT_ROUTINE_RATIO) * 100)}%</b>
            </div>
            <div className="small muted field-row">
              缺省 60%，调整即时保存
            </div>
            <FormFooter submitLabel="完成" />
          </form>
        </Sheet>
      )}

      {form && <FormSheet {...form} onClose={() => setForm(null)} onSubmit={(values) => {
        try {
          form.onSubmit(values)
        } catch (error) {
          toast(error instanceof Error ? error.message : '保存失败，请重试')
        }
      }} />}
    </>
  )
}
