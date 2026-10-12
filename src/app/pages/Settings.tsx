import { Fragment, useState } from 'react'
import { useApp } from '../store'
import { useToast } from '../toast'
import { ConfirmButton } from '../components/ConfirmButton'
import { FormSheet, type FieldDef } from '../components/FormSheet'
import { money } from '../format'

type Seg = 'rhythm' | 'commitment' | 'pool'

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
  const [seg, setSeg] = useState<Seg>('rhythm')
  const [form, setForm] = useState<FormSpec | null>(null)

  const dayTypes = Object.keys(settings.dayPlans)
  const buckets = settings.dayPlans[settings.dayType] ?? []

  const num = (v: string | undefined): number | null => {
    const n = Number.parseFloat(v ?? '')
    return Number.isFinite(n) && n > 0 ? n : null
  }

  /* ---------------- 节律方案 ---------------- */

  function editBucket(index: number) {
    const b = buckets[index]
    setForm({
      title: `编辑节律类别（${settings.dayType}）`,
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
      title: `新增节律类别（${settings.dayType}）`,
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

  function delDayType(name: string) {
    updateSettings((s) => {
      delete s.dayPlans[name]
    })
    toast(`日型「${name}」已删`)
  }

  /* ---------------- 义务 ---------------- */

  const cycleOptions = [
    { value: 'monthly', label: '每月' },
    { value: 'yearly', label: '每年' },
  ]

  function editCommitment(index: number) {
    const c = settings.commitments[index]
    setForm({
      title: '编辑义务',
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
          s.commitments[index] = { name: values.name.trim(), amount, cycle }
        })
        setForm(null)
        toast('已保存')
      },
    })
  }

  function addCommitment() {
    setForm({
      title: '新增义务',
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
          s.commitments.push({ name: values.name.trim(), amount, cycle })
        })
        setForm(null)
        toast('已新增')
      },
    })
  }

  /* ---------------- 预算池 ---------------- */

  function editPool(index: number) {
    const p = settings.pools[index]
    setForm({
      title: '编辑预算池',
      fields: [
        { key: 'name', label: '池名', type: 'text', initial: p.name },
        { key: 'month', label: '月预算（元）', type: 'number', initial: String(p.month) },
        { key: 'weekAllow', label: '每周额度（元）', type: 'number', initial: String(p.weekAllow) },
      ],
      onSubmit: (values) => {
        const month = num(values.month)
        const weekAllow = num(values.weekAllow)
        if (!values.name.trim() || month === null || weekAllow === null) {
          toast('池名、月预算、周额度都要填')
          return
        }
        updateSettings((s) => {
          s.pools[index] = { name: values.name.trim(), month, weekAllow }
        })
        setForm(null)
        toast('已保存')
      },
    })
  }

  function addPool() {
    setForm({
      title: '新增预算池',
      fields: [
        { key: 'name', label: '池名', type: 'text', placeholder: '如：购物' },
        { key: 'month', label: '月预算（元）', type: 'number', placeholder: '如：800' },
        { key: 'weekAllow', label: '每周额度（元，常为月/4）', type: 'number', placeholder: '如：200' },
      ],
      onSubmit: (values) => {
        const month = num(values.month)
        const weekAllow = num(values.weekAllow)
        if (!values.name.trim() || month === null || weekAllow === null) {
          toast('池名、月预算、周额度都要填')
          return
        }
        updateSettings((s) => {
          s.pools.push({ name: values.name.trim(), month, weekAllow })
        })
        setForm(null)
        toast('已新增')
      },
    })
  }

  return (
    <>
      <h1>设置</h1>
      <div className="sub">日型节律方案 · 月义务 · 预算池（随时可调）</div>
      <div className="seg">
        {(
          [
            ['rhythm', '节律方案'],
            ['commitment', '义务'],
            ['pool', '预算池'],
          ] as Array<[Seg, string]>
        ).map(([k, t]) => (
          <button type="button" key={k} className={seg === k ? 'on' : ''} onClick={() => setSeg(k)}>
            {t}
          </button>
        ))}
      </div>

      {seg === 'rhythm' && (
        <div className="card">
          <div className="row" style={{ marginBottom: 4 }}>
            <b>今天算哪种日子？</b>
          </div>
          <div className="chips">
            {dayTypes.map((name) => (
              <Fragment key={name}>
                <button
                  type="button"
                  className={name === settings.dayType ? 'chip on' : 'chip'}
                  onClick={() => {
                    updateSettings((s) => {
                      s.dayType = name
                    })
                    toast(`日型切到：${name}`)
                  }}
                >
                  {name}
                </button>
                {dayTypes.length > 1 && name !== settings.dayType ? (
                  <ConfirmButton label="×" confirmLabel="删？" className="chip-x" onConfirm={() => delDayType(name)} />
                ) : null}
              </Fragment>
            ))}
            <button type="button" className="btn2" onClick={addDayType}>
              ＋ 日型
            </button>
          </div>
          <div className="small muted" style={{ marginBottom: 6 }}>
            当前：{settings.dayType} · 每类金额 = 该日型的单日期望
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
              ＋ 新增节律类别
            </button>
          </div>
        </div>
      )}

      {seg === 'commitment' && (
        <div className="card">
          <div className="small muted" style={{ marginBottom: 6 }}>
            每月 / 每年固定要付的钱（点行改名称、金额、周期）
          </div>
          {settings.commitments.map((c, i) => (
            <div className="setrow" key={`${c.name}-${i}`}>
              <button type="button" className="setrow-main" onClick={() => editCommitment(i)}>
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
                    s.commitments.splice(i, 1)
                  })
                  toast('已删')
                }}
              />
            </div>
          ))}
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn2" onClick={addCommitment}>
              ＋ 新增义务
            </button>
          </div>
        </div>
      )}

      {seg === 'pool' && (
        <div className="card">
          <div className="small muted" style={{ marginBottom: 6 }}>
            预算池（点行改月预算 / 周额度）
          </div>
          {settings.pools.map((p, i) => (
            <div className="setrow" key={`${p.name}-${i}`}>
              <button type="button" className="setrow-main" onClick={() => editPool(i)}>
                {p.name}{' '}
                <span className="small muted">
                  月 {money(p.month)} · 周 {money(p.weekAllow)}
                </span>
              </button>
              <ConfirmButton
                label="删"
                confirmLabel="确认删？"
                onConfirm={() => {
                  updateSettings((s) => {
                    s.pools.splice(i, 1)
                  })
                  toast('已删（历史记录保留在流水里）')
                }}
              />
            </div>
          ))}
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn2" onClick={addPool}>
              ＋ 新增预算池
            </button>
          </div>
        </div>
      )}

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
