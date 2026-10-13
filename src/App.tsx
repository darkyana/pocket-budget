import { useEffect, useState } from 'react'
import { Receipt, Settings, Sun, type LucideIcon } from 'lucide-react'
import { useApp } from './app/store'
import { useToast } from './app/toast'
import { Today } from './app/pages/Today'
import { Records } from './app/pages/Records'
import { SettingsPage } from './app/pages/Settings'

type Tab = 'today' | 'records' | 'settings'
const TABS: Array<{ key: Tab; Icon: LucideIcon; label: string }> = [
  { key: 'today', Icon: Sun, label: '今日' },
  { key: 'records', Icon: Receipt, label: '流水' },
  { key: 'settings', Icon: Settings, label: '设置' },
]

export function App() {
  const ready = useApp((s) => s.ready)
  const init = useApp((s) => s.init)
  const toastMsg = useToast((s) => s.msg)
  const [tab, setTab] = useState<Tab>('today')

  useEffect(() => {
    void init()
  }, [init])

  if (!ready) return null
  return (
    <div className="phone">
      <span className="expe-tag">实验版 · 数据在本机</span>
      <div>
        {tab === 'today' && <Today />}
        {tab === 'records' && <Records />}
        {tab === 'settings' && <SettingsPage />}
      </div>
      <nav className="tabs">
        {TABS.map(({ key, Icon, label }) => (
          <button type="button" key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>
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
