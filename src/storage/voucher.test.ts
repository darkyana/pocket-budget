import { describe, expect, it } from 'vitest'
import { buildFamilyLedgerVoucher } from './voucher'
import { timestampOf } from '../core/time'
import type { MoneyRecord } from '../core/types'

const ts = (date: string) => timestampOf(date, new Date(2026, 0, 1, 12, 0, 0))

describe('buildFamilyLedgerVoucher', () => {
  it('收支符号与描述：日常/预算支出/已付固定支出为负，预算回血为正', () => {
    const { voucher } = buildFamilyLedgerVoucher([
      { id: 'a', ts: ts('2026-10-02'), kind: 'routine', category: '咖啡', amount: 18.5, note: '公司楼下', account: '微信' },
      { id: 'b', ts: ts('2026-10-02'), kind: 'budget', budget: '购物', dir: 'out', amount: 200, note: '', account: '现金' },
      { id: 'c', ts: ts('2026-10-03'), kind: 'budget', budget: '购物', dir: 'in', amount: 99, note: '退货', account: '现金' },
      { id: 'd', ts: ts('2026-10-03'), kind: 'fixed', item: '宠物粮', amount: 400, periodKey: '2026-10', paid: true, account: '储蓄卡' },
    ])
    expect(voucher.voucher_schema_version).toBe('1.1')
    expect(voucher.rows).toEqual([
      { date: '2026-10-03', account: '现金', amount: 99, description: '预算 · 购物 回血 — 退货', ref_id: 'c' },
      { date: '2026-10-03', account: '储蓄卡', amount: -400, description: '固定支出 · 宠物粮', ref_id: 'd' },
      { date: '2026-10-02', account: '微信', amount: -18.5, description: '日常 · 咖啡 — 公司楼下', ref_id: 'a' },
      { date: '2026-10-02', account: '现金', amount: -200, description: '预算 · 购物 支出', ref_id: 'b' },
    ])
  })

  it('走账导出为转账行：金额为正、含 from/to 账户与 ref_id', () => {
    const { voucher, skipped } = buildFamilyLedgerVoucher([
      { id: 't', ts: ts('2026-10-02'), kind: 'transfer', from: '现金', to: '储蓄卡', amount: 500, note: '' },
    ])
    expect(voucher.voucher_schema_version).toBe('1.1')
    expect(voucher.rows).toEqual([
      { date: '2026-10-02', from_account: '现金', to_account: '储蓄卡', amount: 500, description: '走账 · 现金 → 储蓄卡', ref_id: 't' },
    ])
    expect(skipped).toBe(0)
    expect(voucher.meta.transfers).toBe(1)
  })

  it('走账备注附加在描述后；未付固定支出不导出；无账户记录跳过并计数', () => {
    const { voucher, skipped } = buildFamilyLedgerVoucher([
      { id: 't', ts: ts('2026-10-03'), kind: 'transfer', from: '储蓄卡', to: '备用金', amount: 200, note: '月底归集' },
      { id: 'u', ts: ts('2026-10-02'), kind: 'fixed', item: '物业费', amount: 3000, periodKey: '2026-10', paid: false, account: '储蓄卡' },
      { id: 'n', ts: ts('2026-10-02'), kind: 'routine', category: '咖啡', amount: 18, note: '', account: '' } as MoneyRecord,
      { id: 'm', ts: ts('2026-10-02'), kind: 'transfer', from: '', to: '储蓄卡', amount: 100, note: '' },
      { id: 'p', ts: ts('2026-10-01'), kind: 'fixed', item: '宠物粮', amount: 400, periodKey: '2026-10', paid: true, account: '储蓄卡' },
    ])
    expect(voucher.rows).toEqual([
      { date: '2026-10-03', from_account: '储蓄卡', to_account: '备用金', amount: 200, description: '走账 · 储蓄卡 → 备用金 — 月底归集', ref_id: 't' },
      { date: '2026-10-01', account: '储蓄卡', amount: -400, description: '固定支出 · 宠物粮', ref_id: 'p' },
    ])
    expect(skipped).toBe(2)
    expect(voucher.meta.rows).toBe(2)
    expect(voucher.meta.transfers).toBe(1)
    expect(voucher.meta.skipped_no_account).toBe(2)
  })

  it('金额非正的走账跳过并计数，不产出非法转账行', () => {
    const { voucher, skipped } = buildFamilyLedgerVoucher([
      { id: 'z', ts: ts('2026-10-02'), kind: 'transfer', from: '现金', to: '储蓄卡', amount: 0, note: '' },
      { id: 'n', ts: ts('2026-10-02'), kind: 'transfer', from: '现金', to: '储蓄卡', amount: -5, note: '' },
    ])
    expect(voucher.rows).toEqual([])
    expect(skipped).toBe(2)
    expect(voucher.meta.transfers).toBe(0)
    expect(voucher.meta.skipped_no_account).toBe(2)
  })
})
