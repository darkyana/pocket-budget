import { describe, expect, it } from 'vitest'
import { buildFamilyLedgerVoucher } from './voucher'
import { timestampOf } from '../core/time'

const ts = (date: string) => timestampOf(date, new Date(2026, 0, 1, 12, 0, 0))

describe('buildFamilyLedgerVoucher', () => {
  it('收支符号与描述：日常/预算支出/已付固定支出为负，预算回血为正', () => {
    const { voucher } = buildFamilyLedgerVoucher([
      { id: 'a', ts: ts('2026-10-02'), kind: 'routine', category: '咖啡', amount: 18.5, note: '公司楼下', account: '微信' },
      { id: 'b', ts: ts('2026-10-02'), kind: 'budget', budget: '购物', dir: 'out', amount: 200, note: '', account: '现金' },
      { id: 'c', ts: ts('2026-10-03'), kind: 'budget', budget: '购物', dir: 'in', amount: 99, note: '退货', account: '现金' },
      { id: 'd', ts: ts('2026-10-03'), kind: 'fixed', item: '狗粮', amount: 420, periodKey: '2026-10', paid: true, account: '工资卡' },
    ])
    expect(voucher.voucher_schema_version).toBe('1.0')
    expect(voucher.rows).toEqual([
      { date: '2026-10-03', account: '现金', amount: 99, description: '预算 · 购物 回血 — 退货', ref_id: 'c' },
      { date: '2026-10-03', account: '工资卡', amount: -420, description: '固定支出 · 狗粮', ref_id: 'd' },
      { date: '2026-10-02', account: '微信', amount: -18.5, description: '日常 · 咖啡 — 公司楼下', ref_id: 'a' },
      { date: '2026-10-02', account: '现金', amount: -200, description: '预算 · 购物 支出', ref_id: 'b' },
    ])
  })

  it('走账与未付固定支出不导出；无账户记录跳过并计数', () => {
    const { voucher, skipped } = buildFamilyLedgerVoucher([
      { id: 't', ts: ts('2026-10-02'), kind: 'transfer', from: '现金', to: '工资卡', amount: 500, note: '' },
      { id: 'u', ts: ts('2026-10-02'), kind: 'fixed', item: '房租', amount: 3000, periodKey: '2026-10', paid: false },
      { id: 'n', ts: ts('2026-10-02'), kind: 'routine', category: '咖啡', amount: 18, note: '' },
      { id: 'p', ts: ts('2026-10-02'), kind: 'fixed', item: '狗粮', amount: 420, periodKey: '2026-10', paid: true, account: '工资卡' },
    ])
    expect(voucher.rows.map((r) => r.ref_id)).toEqual(['p'])
    expect(skipped).toBe(1)
    expect(voucher.meta.rows).toBe(1)
    expect(voucher.meta.skipped_no_account).toBe(1)
  })
})
