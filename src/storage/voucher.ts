import type { MoneyRecord, PersistedState, Settings } from '../core/types'
import { dayKeyOf } from '../core/time'
import { effectiveRecords } from '../core/derive'
import { migrate } from './migrate'

export const VOUCHER_FORMAT = 'pocket-budget/voucher'

export interface VoucherFile {
  format: string
  schemaVersion: number
  exported_at: string
  settings: Settings
  records: MoneyRecord[]
}

export function buildVoucher(state: PersistedState): VoucherFile {
  return {
    format: VOUCHER_FORMAT,
    schemaVersion: state.schemaVersion,
    exported_at: new Date().toISOString(),
    settings: state.settings,
    records: state.records,
  }
}

export function parseVoucher(text: string): PersistedState {
  const v = JSON.parse(text) as VoucherFile
  const records = v.records ?? (v as any).events
  if (!v || v.format !== VOUCHER_FORMAT || !Array.isArray(records) || !v.settings) {
    throw new Error('不是有效的口袋账房凭证文件')
  }
  return migrate({ schemaVersion: v.schemaVersion, settings: v.settings, records })
}

export function downloadVoucherFile(state: PersistedState): string {
  return downloadJson(buildVoucher(state), `凭证-${stamp()}.json`)
}

function downloadJson(obj: unknown, name: string): string {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
  return name
}

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')

export interface FamilyLedgerRow {
  date: string
  account: string
  amount: number
  description: string
  ref_id: string
}

export interface FamilyLedgerVoucher {
  voucher_schema_version: '1.0'
  meta: { source: string; exported_at: string; rows: number; skipped_no_account: number }
  rows: FamilyLedgerRow[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function buildFamilyLedgerVoucher(records: MoneyRecord[]): { voucher: FamilyLedgerVoucher; skipped: number } {
  const rows: FamilyLedgerRow[] = []
  let skipped = 0
  for (const e of effectiveRecords(records)) {
    if (e.kind === 'transfer') continue
    if (e.kind === 'fixed' && !e.paid) continue
    const account = e.account?.trim()
    if (!account) {
      skipped++
      continue
    }
    const date = dayKeyOf(e.ts)
    const suffix = 'note' in e && e.note.trim() ? ` — ${e.note.trim()}` : ''
    const amount = round2(e.amount)
    if (e.kind === 'routine') {
      rows.push({ date, account, amount: -amount, description: `日常 · ${e.category}${suffix}`, ref_id: e.id })
    } else if (e.kind === 'budget') {
      rows.push({
        date,
        account,
        amount: e.dir === 'in' ? amount : -amount,
        description: `预算 · ${e.budget}${e.dir === 'in' ? ' 回血' : ' 支出'}${suffix}`,
        ref_id: e.id,
      })
    } else {
      rows.push({ date, account, amount: -amount, description: `固定支出 · ${e.item}`, ref_id: e.id })
    }
  }
  rows.sort((a, b) => b.date.localeCompare(a.date))
  return {
    voucher: {
      voucher_schema_version: '1.0',
      meta: {
        source: '口袋账房 pocket-budget 记账凭证导出',
        exported_at: new Date().toISOString(),
        rows: rows.length,
        skipped_no_account: skipped,
      },
      rows,
    },
    skipped,
  }
}

export function downloadFamilyLedgerVoucher(records: MoneyRecord[]): { name: string; rows: number; skipped: number } {
  const { voucher, skipped } = buildFamilyLedgerVoucher(records)
  if (voucher.rows.length === 0) throw new Error('没有可导出的记账凭证（需要带账户的收支记录）')
  const name = downloadJson(voucher, `记账凭证-${stamp()}.json`)
  return { name, rows: voucher.rows.length, skipped }
}
