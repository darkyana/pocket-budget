import type { MoneyRecord, PersistedState, Settings } from '../core/types'
import { dayKeyOf } from '../core/time'
import { effectiveRecords } from '../core/derive'
import { migrate } from './migrate'

/**
 * 凭证文件：本工具与账本正本的接口。
 * 全量事实导出（设置 + 流水），目标是能被正式产品无损接收——格式迭代记录在 git 历史里。
 */
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

/** 导入凭证：整包替换当前状态，并迁移到当前 schemaVersion */
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

/**
 * 记账凭证：family ledger「增加凭证」可导入的第三方格式（voucher 1.0）。
 * 对接说明：initial-input/voucher-import-integration.md
 * 换算口径——
 * - 日常/预算支出/已付固定支出 → 负数（该账户扣款）；预算回血 → 正数（该账户入账）
 * - 走账不导出：该格式一行只能表达一个账户的净变动，写两侧会重复口径（对接说明明确要求）
 * - 未付固定支出不导出：钱还没动；无账户的记录跳过（格式要求 account 非空），计数进 meta
 */
export interface FamilyLedgerRow {
  date: string
  account: string
  amount: number
  description: string
  /** 本工具原始流水 id：账面不生效，文件重读/排查有据可查 */
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
  rows.sort((a, b) => b.date.localeCompare(a.date)) // 新日期在前，与对接示例一致
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
