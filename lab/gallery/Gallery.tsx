import { useState } from 'react'
import { AccountPicker } from '../app/components/AccountPicker'
import { CategoryFilterSheet } from '../app/components/CategoryFilterSheet'
import { ConfirmButton } from '../app/components/ConfirmButton'
import { DataSheet } from '../app/components/DataSheet'
import { DateFilterSheet } from '../app/components/DateFilterSheet'
import { EntrySheet, type EntryTarget } from '../app/components/EntrySheet'
import { FixedExpenseSheet } from '../app/components/FixedExpenseSheet'
import { FormFooter } from '../app/components/FormFooter'
import { FormSheet, type FieldDef } from '../app/components/FormSheet'
import { SegmentedControl } from '../app/components/SegmentedControl'
import { Sheet } from '../app/components/Sheet'
import { useDragSort } from '../app/components/dragSort'
import { useToast } from '../app/toast'
import { monthKeyOf } from '../core/time'

const ACCOUNTS = ['现金', '储蓄卡', '备用金', '电子钱包']

function SegDemo() {
  const [kind, setKind] = useState<'routine' | 'budget' | 'transfer'>('routine')
  return (
    <>
      <SegmentedControl<'routine' | 'budget' | 'transfer'>
        value={kind}
        options={[
          { value: 'routine', label: '日常' },
          { value: 'budget', label: '预算' },
          { value: 'transfer', label: '走账' },
        ]}
        onChange={setKind}
      />
      <div className="small muted">当前选中：{kind}</div>
    </>
  )
}

function FooterDemo() {
  const toast = useToast((s) => s.show)
  const [submitted, setSubmitted] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setSubmitted(new Date().toLocaleTimeString('zh-CN'))
        toast('表单已提交')
      }}
    >
      <FormFooter secondary={{ label: '取消', onClick: () => toast('已取消') }} submitLabel="保存示例" />
      <div className="small muted">{submitted ? `上次提交：${submitted}` : '未提交'}</div>
    </form>
  )
}

function ConfirmDemo() {
  const toast = useToast((s) => s.show)
  return (
    <ConfirmButton label="删除示例记录" confirmLabel="确认删除？" onConfirm={() => toast('已确认删除（示例）')} />
  )
}

function SheetDemo() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        打开弹层
      </button>
      {open && (
        <Sheet title="示例弹层" onClose={() => setOpen(false)}>
          <div className="field-row">
            点 backdrop 或按 Esc 关闭；本弹层即主库 Sheet 原组件。
          </div>
          <FormFooter secondary={{ label: '关闭', onClick: () => setOpen(false) }} submitLabel="知道了" />
        </Sheet>
      )}
    </>
  )
}

function ComboDemo() {
  const [account, setAccount] = useState('')
  return (
    <>
      <AccountPicker
        id="lab-combo"
        value={account}
        onChange={setAccount}
        accounts={ACCOUNTS}
        placeholder="输入过滤，如：卡"
      />
      <div className="small muted">当前值：{account || '（空）'}</div>
    </>
  )
}

function DragSortDemo() {
  const [items, setItems] = useState(['三餐', '交通', '咖啡', '日用'])
  const { rowProps } = useDragSort(items.length, (from, to) => {
    setItems((xs) => {
      const next = [...xs]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  })
  return (
    <>
      <div className="lab-drag-list">
        {items.map((name, i) => (
          <div key={name} {...rowProps(i)}>
            <span className="row">
              <b>{name}</b>
            </span>
          </div>
        ))}
      </div>
      <div className="small muted">长按 450ms 拖动排序</div>
    </>
  )
}

const FORM_FIELDS: FieldDef[] = [
  { key: 'name', label: '名称', type: 'text', initial: '示例预算', placeholder: '如：学习' },
  { key: 'amount', label: '每月额度', type: 'number', initial: '300' },
  {
    key: 'cycle',
    label: '周期',
    type: 'select',
    options: [
      { value: 'monthly', label: '每月' },
      { value: 'yearly', label: '每年' },
    ],
  },
]

function Card({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <b>{title}</b>
      <div className="small muted">{note}</div>
      <div className="lab-demo">{children}</div>
    </div>
  )
}

export function Gallery() {
  const toast = useToast((s) => s.show)
  const [formOpen, setFormOpen] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)
  const [catOpen, setCatOpen] = useState(false)
  const [dataOpen, setDataOpen] = useState(false)
  const [entry, setEntry] = useState<EntryTarget | null>(null)
  const [fixedOpen, setFixedOpen] = useState(false)

  const fixedEvent = {
    id: 'lab-fixed-demo',
    ts: Date.now(),
    kind: 'fixed' as const,
    item: '宠物粮',
    amount: 400,
    periodKey: monthKeyOf(new Date()),
    paid: false,
  }

  return (
    <>
      <section className="lab-section">
        <h2>原子</h2>
        <Card title="SegmentedControl 分段控件" note="点击切换选中段">
          <SegDemo />
        </Card>
        <Card title="ConfirmButton 二次确认" note="首次点击进入 3 秒待确认态，再次点击才触发">
          <ConfirmDemo />
        </Card>
        <Card title="Sheet 弹层" note="backdrop 点击 / Esc 关闭">
          <SheetDemo />
        </Card>
        <Card title="AccountPicker 组合框" note="输入后按关键字过滤账户列表">
          <ComboDemo />
        </Card>
        <Card title="FormFooter 表单按钮组" note="提交 / 次要动作">
          <FooterDemo />
        </Card>
        <Card title="dragSort 拖拽排序" note="useDragSort：长按后拖动">
          <DragSortDemo />
        </Card>
      </section>

      <section className="lab-section">
        <h2>复合</h2>
        <Card title="FormSheet 通用表单弹层" note="字段定义驱动的表单">
          <div className="lab-actions">
            <button type="button" className="btn-primary" onClick={() => setFormOpen(true)}>
              打开
            </button>
          </div>
          {formOpen && (
            <FormSheet
              title="示例表单"
              fields={FORM_FIELDS}
              onClose={() => setFormOpen(false)}
              onSubmit={(values) => {
                toast(`已提交：${values.name} / ${values.amount}`)
                setFormOpen(false)
              }}
            />
          )}
        </Card>
        <Card title="DateFilterSheet 日期筛选" note="单日 / 范围切换 + 日期字段">
          <div className="lab-actions">
            <button type="button" className="btn-primary" onClick={() => setDateOpen(true)}>
              打开
            </button>
          </div>
          {dateOpen && (
            <DateFilterSheet
              fromDate=""
              toDate=""
              onClose={() => setDateOpen(false)}
              onApply={(from, to) => {
                toast(`筛选：${from || '全部'} ~ ${to || from || '全部'}`)
                setDateOpen(false)
              }}
            />
          )}
        </Card>
        <Card title="CategoryFilterSheet 分类筛选" note="类型 / 细分 chip 多选">
          <div className="lab-actions">
            <button type="button" className="btn-primary" onClick={() => setCatOpen(true)}>
              打开
            </button>
          </div>
          {catOpen && (
            <CategoryFilterSheet
              selected={['routine:三餐']}
              routineCategories={['三餐', '交通', '咖啡', '日用']}
              budgetNames={['购物', '学习', '娱乐']}
              counts={{
                routine: 7,
                budget: 3,
                fixed: 2,
                transfer: 1,
                routineCat: { 三餐: 3, 交通: 1, 咖啡: 2, 日用: 1 },
                budgetCat: { 购物: 2, 学习: 1, 娱乐: 1 },
              }}
              onClose={() => setCatOpen(false)}
              onApply={(tokens) => {
                toast(`已选 ${tokens.length} 项`)
                setCatOpen(false)
              }}
            />
          )}
        </Card>
        <Card title="EntrySheet 记一笔" note="日常 / 预算 / 走账，写入口径同主库（lab 内存夹具层）">
          <div className="lab-actions">
            <button type="button" className="btn-primary" onClick={() => setEntry({ type: 'free' })}>
              记一笔（自由）
            </button>
            <button type="button" onClick={() => setEntry({ type: 'routine', category: '三餐' })}>
              日常 · 三餐
            </button>
            <button type="button" onClick={() => setEntry({ type: 'budget', budget: '购物' })}>
              预算 · 购物
            </button>
            <button type="button" onClick={() => setEntry({ type: 'transfer' })}>
              走一笔账
            </button>
          </div>
          {entry && <EntrySheet target={entry} onClose={() => setEntry(null)} />}
        </Card>
        <Card title="FixedExpenseSheet 固定支出付款" note="账户 + 日期，删除二次确认">
          <div className="lab-actions">
            <button type="button" className="btn-primary" onClick={() => setFixedOpen(true)}>
              编辑 · 宠物粮
            </button>
          </div>
          {fixedOpen && <FixedExpenseSheet event={fixedEvent} onClose={() => setFixedOpen(false)} />}
        </Card>
        <Card title="DataSheet 数据管理" note="导出 / 导入 / 清空">
          <div className="lab-actions">
            <button type="button" className="btn-primary" onClick={() => setDataOpen(true)}>
              打开
            </button>
          </div>
          {dataOpen && <DataSheet onClose={() => setDataOpen(false)} />}
        </Card>
      </section>
    </>
  )
}
