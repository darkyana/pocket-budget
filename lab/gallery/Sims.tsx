import { Receipt, Settings, Sun, type LucideIcon } from 'lucide-react'
import { useApp, type Tab } from '../app/store'
import { Today } from '../app/pages/Today'
import { Records } from '../app/pages/Records'
import { SettingsPage } from '../app/pages/Settings'
import { QuickRetro } from '../app/pages/QuickRetro'

const TABS: Array<{ key: Tab; Icon: LucideIcon; label: string }> = [
  { key: 'today', Icon: Sun, label: '今日' },
  { key: 'records', Icon: Receipt, label: '流水' },
  { key: 'settings', Icon: Settings, label: '设置' },
]

export function Sims() {
  const ready = useApp((s) => s.ready)
  const tab = useApp((s) => s.tab)
  const overlay = useApp((s) => s.overlay)
  const goTab = useApp((s) => s.goTab)

  if (!ready) return null
  return (
    <div className="lab-stage">
      <div className="phone">
        <span className="expe-tag">设计实验室 · mock 数据</span>
        <div>
          {overlay === 'quickRetro' ? (
            <QuickRetro />
          ) : (
            <>
              {tab === 'today' && <Today />}
              {tab === 'records' && <Records />}
              {tab === 'settings' && <SettingsPage />}
            </>
          )}
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
      </div>
    </div>
  )
}
