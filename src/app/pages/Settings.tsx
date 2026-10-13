import { useState } from 'react'
import { todayDayType, monthQuickCalc } from '../../core/derive'
import { dayKeyOf } from '../../core/time'
import { useApp } from '../store'
import { useToast } from '../toast'
import { ConfirmButton } from '../components/ConfirmButton'
import { FormSheet, type FieldDef } from '../components/FormSheet'
import { money } from '../format'

type Seg = 'routine' | 'fixed' | 'budget'

interface FormSpec {
  title: string
  fields: FieldDef[]
  submitLabel?: string
  onSubmit(values: Record<string, string>): void
}

export function SettingsPage() {
  const settings = useApp((s) => s.settings)
  const updateSettings = useApp((s) => s.updateSettings)
  const factoryReset = useApp((s) => s.factoryReset)
  const toast = useToast((s) => s.show)
  const [seg, setSeg] = useState<Seg>('routine')
  const [form, setForm] = useState<FormSpec | null>(null)

  const dayTypes = Object.keys(settings.dayPlans)
  /** 今日生效的日型：默认按日历自动（周末/法定节假日），点选可覆盖当天 */
  const effDayType = todayDayType(settings, new Date())
  const buckets = settings.dayPlans[effDayType] ?? []

  const num = (v: string | undefined): number | null => {
    const n = Number.parseFloat(v ?? '')
    return Number.isFinite(n) && n > 0 ? n : null
  }

  /* ---------------- 日常 ---------------- */

  function editBucket(index: number) {
    const b = buckets[index]
    setForm({
      title: `编辑日常（${effDayType}）`,
      fields: [
        { key: 'name', label: '类别名', type: 'text', initial: b.name },
        { key: 'expect', label: '单日期望（元）', type: 'number', initial: String(b.expect) },
      ],
      onSubmit: (values) => {
        const expect = num(values.expect)
        if (!values.name.trim() || expect === null) {
          toast('类别名和期望金额都要填')
          return
        }
        updateSettings((s) => {
          s.dayPlans[s.dayType][index] = { name: values.name.trim(), expect }
        })
        setForm(null)
        toast('已保存')
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
          s.dayPlans[s.dayType].push({ name: values.name.trim(), expect })
        })
        setForm(null)
        toast('已新增')
      },
    })
  }

  function addDayType() {
    setForm({
      title: '新增日型',
      fields: [{ key: 'name', label: '日型名', type: 'text', placeholder: '如：假期日、出差日' }],
      onSubmit: (values) => {
        const name = values.name.trim()
        if (!name) {
          toast('日型名不能为空')
          return
        }
        updateSettings((s) => {
          if (!s.dayPlans[name]) s.dayPlans[name] = []
          s.dayType = name
        })
        setForm(null)
        toast(`日型「${name}」已建并切换`)
      },
    })
  }

  /* ---------------- 固定支出 ---------------- */

  const cycleOptions = [
    { value: 'monthly', label: '每月' },
    { value: 'yearly', label: '每年' },
  ]

  function editFixedExpense(index: number) {
    const c = settings.fixedExpenses[index]
    setForm({
      title: '编辑固定支出',
      fields: [
        { key: 'name', label: '名称', type: 'text', initial: c.name },
        { key: 'amount', label: '金额（元）', type: 'number', initial: String(c.amount) },
        { key: 'cycle', label: '周期', type: 'select', options: cycleOptions, initial: c.cycle ?? 'monthly' },
      ],
      onSubmit: (values) => {
        const amount = num(values.amount)
        if (!values.name.trim() || amount === null) {
          toast('名称和金额都要填')
          return
        }
        const cycle = values.cycle === 'yearly' ? 'yearly' : 'monthly'
        updateSettings((s) => {
          s.fixedExpenses[index] = { name: values.name.trim(), amount, cycle }
        })
        setForm(null)
        toast('已保存')
      },
    })
  }

  function addFixedExpense() {
    setForm({
      title: '新增固定支出',
      fields: [
        { key: 'name', label: '名称', type: 'text', placeholder: '如：狗粮 / 域名' },
        { key: 'amount', label: '金额（元）', type: 'number', placeholder: '如：420' },
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

  /* ---------------- 预算 ---------------- */

  function editBudget(index: number) {
    const p = settings.budgets[index]
    setForm({
      title: '编辑预算',
      fields: [
        { key: 'name', label: '名称', type: 'text', initial: p.name },
        { key: 'month', label: '月预算（元）', type: 'number', initial: String(p.month) },
      ],
      onSubmit: (values) => {
        const month = num(values.month)
        if (!values.name.trim() || month === null) {
          toast('名称和月预算都要填')
          return
        }
        updateSettings((s) => {
          s.budgets[index] = { name: values.name.trim(), month }
        })
        setForm(null)
        toast('已保存')
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
      <h1>设置</h1>
      <div className="sub">日型日常 · 预算 · 固定支出（随时可调）</div>
      <div className="seg">
        {(
          [
            ['routine', '日常'],
            ['budget', '预算'],
            ['fixed', '固定支出'],
          ] as Array<[Seg, string]>
        ).map(([k, t]) => (
          <button type="button" key={k} className={seg === k ? 'on' : ''} onClick={() => setSeg(k)}>
            {t}
          </button>
        ))}
      </div>

      {seg === 'routine' && (
        <div className="card">
          <div className="row" style={{ marginBottom: 4 }}>
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
                    s.dayTypeSetFor = dayKeyOf(new Date()) // 点选只覆盖今天，明天回到自动
                  })
                  toast(`日型切到：${name}（今天）`)
                }}
              >
                {name}
              </button>
            ))}
            <button type="button" className="btn2" onClick={addDayType}>
              ＋ 日型
            </button>
          </div>
          <div className="small muted" style={{ marginBottom: 6 }}>
            当前：{effDayType} · 按周末与法定节假日自动选，点选只改今天
          </div>
          {buckets.map((b, i) => (
            <div className="setrow" key={`${b.name}-${i}`}>
              <button type="button" className="setrow-main" onClick={() => editBucket(i)}>
                {b.name} <span className="small muted">期望 {money(b.expect)}</span>
              </button>
              <ConfirmButton
                label="删"
                confirmLabel="确认删？"
                onConfirm={() => {
                  updateSettings((s) => {
                    s.dayPlans[s.dayType].splice(i, 1)
                  })
                  toast('已删')
                }}
              />
            </div>
          ))}
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn2" onClick={addBucket}>
              ＋ 新增日常
            </button>
          </div>
        </div>
      )}

      {seg === 'fixed' && (
        <div className="card">
          <div className="small muted" style={{ marginBottom: 6 }}>
            每月 / 每年固定要付的钱（点行改名称、金额、周期）
          </div>
          {settings.fixedExpenses.map((c, i) => (
            <div className="setrow" key={`${c.name}-${i}`}>
              <button type="button" className="setrow-main" onClick={() => editFixedExpense(i)}>
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
          ))}
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn2" onClick={addFixedExpense}>
              ＋ 新增固定支出
            </button>
          </div>
        </div>
      )}

      {seg === 'budget' && (
        <div className="card">
          <div className="small muted" style={{ marginBottom: 6 }}>
            预算（点行改月预算 / 周额度）
          </div>
          {settings.budgets.map((p, i) => (
            <div className="setrow" key={`${p.name}-${i}`}>
              <button type="button" className="setrow-main" onClick={() => editBudget(i)}>
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
          ))}
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn2" onClick={addBudget}>
              ＋ 新增预算
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="row" style={{ marginBottom: 6 }}>
          <b>本月速算</b>
          <span className="small muted">按当前设置与日历推算</span>
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
        <div className="small muted" style={{ marginTop: 8 }}>
          休息日 = 周末与法定节假日（调休上班除外）；自定义日型与当天的手动点选不计入速算
        </div>
      </div>

      <div style={{ marginTop: 14, textAlign: 'center' }}>
        <ConfirmButton
          label="恢复出厂（清空一切，含记录）"
          confirmLabel="真的全部清空？"
          onConfirm={() => {
            factoryReset()
            toast('已恢复出厂')
          }}
        />
      </div>

      {form && <FormSheet {...form} onClose={() => setForm(null)} />}
    </>
  )
}
