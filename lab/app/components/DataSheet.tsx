import { useRef } from 'react'
import { SCHEMA_VERSION, type PersistedState } from '../../core/types'
import { downloadFamilyLedgerVoucher, downloadVoucherFile } from '../../storage/voucher'
import { useApp } from '../store'
import { useToast } from '../toast'
import { ConfirmButton } from './ConfirmButton'
import { Sheet } from './Sheet'

export function DataSheet({ onClose }: { onClose(): void }) {
  const settings = useApp((s) => s.settings)
  const records = useApp((s) => s.records)
  const clearRecords = useApp((s) => s.clearRecords)
  const importVoucher = useApp((s) => s.importVoucher)
  const toast = useToast((s) => s.show)
  const fileRef = useRef<HTMLInputElement>(null)

  function onExportBackup() {
    const state: PersistedState = { schemaVersion: SCHEMA_VERSION, settings, records }
    toast(`已导出 ${downloadVoucherFile(state)}`)
  }

  function onExportLedgerVoucher() {
    try {
      const { rows, skipped } = downloadFamilyLedgerVoucher(records)
      toast(skipped > 0 ? `已导出记账凭证 · ${rows} 行，${skipped} 笔无账户被跳过` : `已导出记账凭证 · ${rows} 行`)
    } catch (err) {
      toast(err instanceof Error ? err.message : '导出失败')
    }
  }

  async function onImport(file: File) {
    try {
      importVoucher(await file.text())
      toast('已导入凭证（整包替换）')
      onClose()
    } catch (err) {
      toast(err instanceof Error ? `导入失败：${err.message}` : '导入失败')
    }
  }

  return (
    <Sheet title="数据管理" onClose={onClose}>
      <div className="dm-label">导出</div>
      <div className="dm-actions">
        <div>
          <button type="button" onClick={onExportBackup}>
            导出备份数据
          </button>
          <div className="dm-hint">全量 JSON（设置 + 全部流水），换设备搬家 / 恢复用</div>
        </div>
        <div>
          <button type="button" onClick={onExportLedgerVoucher}>
            导出记账凭证
          </button>
          <div className="dm-hint">family ledger 可导入的凭证格式；不含走账</div>
        </div>
      </div>
      <div className="dm-label">导入</div>
      <div className="dm-actions">
        <div>
          <button type="button" onClick={() => fileRef.current?.click()}>
            导入备份数据
          </button>
          <div className="dm-hint">整包替换当前数据（设置 + 流水）</div>
        </div>
      </div>
      <div className="dm-label">清空</div>
      <div className="dm-actions">
        <ConfirmButton
          label="清空全部记录"
          confirmLabel="确认清空？"
          onConfirm={() => {
            clearRecords()
            toast('已清空全部记录（设置保留）')
            onClose()
          }}
        />
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onImport(f)
          e.target.value = ''
        }}
      />
    </Sheet>
  )
}
