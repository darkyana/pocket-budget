import { useRef } from 'react'
import { useDragSort, useLongPress } from './components/dragSort'
import { Sheet } from './components/Sheet'
import { ConfirmButton } from './components/ConfirmButton'
import { useApp } from './store'
import { useToast } from './toast'

function arrayMove<T>(arr: T[], from: number, to: number) {
  const [x] = arr.splice(from, 1)
  arr.splice(to, 0, x)
}

export function AccountSettingsSheet({ onClose }: { onClose(): void }) {
  const accounts = useApp((s) => s.settings.accounts)
  const records = useApp((s) => s.records)
  const updateSettings = useApp((s) => s.updateSettings)
  const removeAccount = useApp((s) => s.removeAccount)
  const jumpToRecords = useApp((s) => s.jumpToRecords)
  const toast = useToast((s) => s.show)

  const dragAccount = useDragSort(accounts.length, (from, to) =>
    updateSettings((s) => {
      arrayMove(s.accounts, from, to)
    }),
  )
  const pressRef = useRef('')
  const pressAccount = useLongPress(() => {
    jumpToRecords([], pressRef.current)
    toast(`流水已筛选：${pressRef.current}`)
    onClose()
  })

  return (
    <Sheet title="账户" onClose={onClose}>
      {accounts.map((a, i) => {
        const used = records.filter((e) =>
          (e.kind !== 'transfer' && e.account === a) ||
          (e.kind === 'transfer' && (e.from === a || e.to === a)),
        ).length
        const p = dragAccount.rowProps(i)
        return (
          <div key={a} {...p}>
            <button
              type="button"
              className="setrow-main"
              onPointerDown={(e) => {
                pressRef.current = a
                pressAccount.onPointerDown(e)
              }}
              onPointerMove={pressAccount.onPointerMove}
              onPointerUp={pressAccount.onPointerUp}
              onPointerCancel={pressAccount.onPointerCancel}
              onContextMenu={pressAccount.onContextMenu}
              onClick={() => pressAccount.guardClick()}
            >
              {a} <span className="small muted">{used > 0 ? `${used} 笔流水` : '未使用'}</span>
            </button>
            <ConfirmButton
              label="删"
              confirmLabel="确认删？"
              onConfirm={() => {
                try {
                  removeAccount(a)
                  toast('已删')
                } catch (error) {
                  toast(error instanceof Error ? error.message : '删除失败')
                }
              }}
            />
          </div>
        )
      })}
    </Sheet>
  )
}
