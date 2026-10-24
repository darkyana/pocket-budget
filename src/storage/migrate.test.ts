import { describe, expect, it } from 'vitest'
import { freshState, migrate } from './migrate'

const v1 = {
  schemaVersion: 1,
  settings: {
    dayType: '工作日',
    dayPlans: {},
    pools: [{ name: '购物', month: 800, weekAllow: 200 }],
    commitments: [{ name: '宠物粮', amount: 400 }],
    accounts: [],
  },
  events: [
    { id: 'a', ts: 1, kind: 'rhythm', category: '咖啡', amount: 20, note: '' },
    { id: 'b', ts: 2, kind: 'pool', pool: '购物', dir: 'out', amount: 100, note: '' },
    { id: 'c', ts: 3, kind: 'commitment', item: '宠物粮', amount: 400, monthKey: '2026-09', paid: true },
    { id: 'd', ts: 4, kind: 'transfer', from: '现金', to: '储蓄卡', amount: 500, note: '' },
  ],
}

describe('migrate', () => {
  it('v1 → v3：monthKey 搬到 periodKey，kind 值与设置键统一到新术语，weekAllow 丢弃', () => {
    const s = migrate(v1)
    expect(s.schemaVersion).toBe(3)
    expect(s.records.map((r) => r.kind)).toEqual(['routine', 'budget', 'fixed', 'transfer'])
    const b = s.records[1] as any
    expect(b.budget).toBe('购物')
    expect(b.pool).toBeUndefined()
    const f = s.records[2] as any
    expect(f.periodKey).toBe('2026-09')
    expect(f.monthKey).toBeUndefined()
    expect(s.settings.budgets).toEqual([{ name: '购物', month: 800 }])
    expect(s.settings.fixedExpenses).toEqual([{ name: '宠物粮', amount: 400 }])
    expect((s.settings as any).pools).toBeUndefined()
    expect((s.settings as any).commitments).toBeUndefined()
  })

  it('v2 → v3：periodKey 保留，kind 与设置键统一', () => {
    const v2 = {
      ...v1,
      schemaVersion: 2,
      events: [
        { id: 'c', ts: 3, kind: 'commitment', item: '宠物粮', amount: 400, periodKey: '2026-09', paid: true },
        { id: 'b', ts: 2, kind: 'pool', pool: '购物', dir: 'in', amount: 30, note: '' },
      ],
    }
    const s = migrate(v2)
    expect(s.schemaVersion).toBe(3)
    expect(s.records[0].kind).toBe('fixed')
    expect((s.records[0] as any).periodKey).toBe('2026-09')
    expect(s.records[1].kind).toBe('budget')
    expect((s.records[1] as any).budget).toBe('购物')
    expect(s.settings.budgets).toEqual([{ name: '购物', month: 800 }])
    expect(s.settings.fixedExpenses).toEqual([{ name: '宠物粮', amount: 400 }])
  })

  it('v3 数据原样通过（records 键），不重复迁移', () => {
    const s = migrate(freshState())
    expect(s.schemaVersion).toBe(3)
    expect(s.records).toEqual([])
  })

  it('损坏数据回退出厂', () => {
    expect(migrate(null)).toEqual(freshState())
    expect(migrate({ schemaVersion: 99, settings: {}, events: [] }).schemaVersion).toBe(3)
    expect(migrate({ schemaVersion: 2, settings: null, events: [] })).toEqual(freshState())
  })

  it('迁移不丢流水（铁律）：旧事件逐条都有对应新流水', () => {
    const s = migrate(v1)
    expect(s.records).toHaveLength(v1.events.length)
    expect(s.records.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})