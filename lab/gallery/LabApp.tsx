import { useEffect, useState } from 'react'
import { useApp } from '../app/store'
import { useToast } from '../app/toast'
import { Gallery } from './Gallery'
import { Sims } from './Sims'
import { useVariants, useVariantState, VariantStyle, VariantSwitcher } from './Variants'

type LabView = 'gallery' | 'sims'

export function LabApp() {
  const [view, setView] = useState<LabView>('gallery')
  const init = useApp((s) => s.init)
  const toastMsg = useToast((s) => s.msg)
  const variants = useVariants()
  const { active, css, select } = useVariantState(variants)

  useEffect(() => {
    void init()
  }, [init])

  return (
    <>
      <VariantStyle css={css} />
      <div className="lab-shell">
        <aside className="lab-side">
          <h1>口袋账房 · 设计实验室</h1>
          <p className="lab-desc">
            主库设计资产的逐字镜像，基线记录于 lab/BASELINE.json；交互均为真实组件。当前变体：{active}
          </p>
          <nav className="lab-nav">
            <button type="button" className={view === 'gallery' ? 'on' : ''} onClick={() => setView('gallery')}>
              组件画廊
            </button>
            <button type="button" className={view === 'sims' ? 'on' : ''} onClick={() => setView('sims')}>
              页面仿真
            </button>
          </nav>
        </aside>
        <main className="lab-main">
          {view === 'gallery' ? <Gallery /> : <Sims />}
        </main>
      </div>
      {toastMsg ? <div className="toast">{toastMsg}</div> : null}
      <VariantSwitcher variants={variants} active={active} onSelect={select} />
    </>
  )
}
