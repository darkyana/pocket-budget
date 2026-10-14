import { useEffect } from 'react'
import { Receipt, Settings, Sun, type LucideIcon } from 'lucide-react'
import { useApp, type Tab } from './app/store'
import { useToast } from './app/toast'
import { Today } from './app/pages/Today'
import { Records } from './app/pages/Records'
import { SettingsPage } from './app/pages/Settings'

const TABS: Array<{ key: Tab; Icon: LucideIcon; label: string }> = [
  { key: 'today', Icon: Sun, label: '今日' },
  { key: 'records', Icon: Receipt, label: '流水' },
  { key: 'settings', Icon: Settings, label: '设置' },
]

/** 构建时注入的代码最近更新时间（vite define，见 vite.config.ts） */
declare const __CODE_UPDATED_AT__: number

const pad = (n: number) => String(n).padStart(2, '0')
const updatedAt = new Date(__CODE_UPDATED_AT__)
const updatedLabel = `${pad(updatedAt.getMonth() + 1)}/${pad(updatedAt.getDate())} ${pad(updatedAt.getHours())}:${pad(updatedAt.getMinutes())}`

export function App() {
  const ready = useApp((s) => s.ready)
  const init = useApp((s) => s.init)
  const tab = useApp((s) => s.tab)
  const goTab = useApp((s) => s.goTab)
  const toastMsg = useToast((s) => s.msg)

  useEffect(() => {
    void init()
  }, [init])

  if (!ready) return null
  return (
    <div className="phone">
      <span className="expe-tag">实验版 最近更新 {updatedLabel}</span>
      <div>
        {tab === 'today' && <Today />}
        {tab === 'records' && <Records />}
        {tab === 'settings' && <SettingsPage />}
      </div>
      <nav className="tabs">
        {TABS.map(({ key, Icon, label }) => (
          <button type="button" key={key} className={tab === key ? 'on' : ''} onClick={() => goTab(key)}>
            <span className="ic">
              <Icon size={22} strokeWidth={2} />
            </span>
            {label}
          </button>
        ))}
      </nav>
      {toastMsg ? <div className="toast">{toastMsg}</div> : null}
    </div>
  )
}
