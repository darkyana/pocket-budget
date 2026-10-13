import type { MoneyRecord, PersistedState, Settings } from '../core/types'
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
  const blob = new Blob([JSON.stringify(buildVoucher(state), null, 2)], { type: 'application/json' })
  const name = `凭证-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.json`
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
  return name
}
