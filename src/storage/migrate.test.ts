import { describe, expect, it } from 'vitest'
import { freshState, migrate } from './migrate'
import { SCHEMA_VERSION, type MoneyEvent } from '../core/types'

/** 构造一份 v1 老数据：义务事件还叫 monthKey（类型按 unknown 传，模拟磁盘上的旧结构） */
function v1State(): unknown {
  const base = freshState()
  return {
    ...base,
    schemaVersion: 1,
    events: [
      { id: 'a', ts: 1, kind: 'rhythm', category: '三餐', amount: 30, note: '', account: '现金' },
      { id: 'b', ts: 2, kind: 'commitment', item: '狗粮', amount: 420, monthKey: '2026-10', paid: true },
    ],
  }
}

describe('migrate', () => {
  it('v1 → v2：义务事件 monthKey 搬到 periodKey，值不变，字段不残留；其他事件原样', () => {
    const out = migrate(v1State())
    expect(out.schemaVersion).toBe(SCHEMA_VERSION)
    const c = out.events.find((e) => e.kind === 'commitment') as Extract<MoneyEvent, { kind: 'commitment' }>
    expect(c.periodKey).toBe('2026-10')
    expect('monthKey' in c).toBe(false)
    expect(c.paid).toBe(true)
    expect(c.amount).toBe(420)
    const r = out.events.find((e) => e.kind === 'rhythm')
    expect(r).toBeDefined()
  })

  it('v2 数据原样通过（同一引用）', () => {
    const v2 = freshState()
    expect(migrate(v2)).toBe(v2)
  })

  it('来自更新版本的数据回退出厂', () => {
    const out = migrate({ schemaVersion: 99, settings: freshState().settings, events: [] })
    expect(out.schemaVersion).toBe(SCHEMA_VERSION)
    expect(out.events).toEqual([])
  })

  it('非法数据回退出厂', () => {
    expect(migrate(null).events).toEqual([])
    expect(migrate('垃圾').events).toEqual([])
    expect(migrate({ schemaVersion: 1, events: [] }).events).toEqual([]) // 缺 settings
  })
})
