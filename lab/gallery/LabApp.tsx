import { useEffect, useState } from 'react'
import { useApp } from '../app/store'
import { useToast } from '../app/toast'
import { SegmentedControl } from '../app/components/SegmentedControl'
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
      <div className="lab">
        <header className="lab-head">
          <h1>口袋账房 · 设计实验室</h1>
          <div className="sub">
            主库设计资产的逐字镜像，基线记录于 lab/BASELINE.json；交互均为真实组件。当前变体：{active}
          </div>
          <SegmentedControl<LabView>
            value={view}
            options={[
              { value: 'gallery', label: '组件画廊' },
              { value: 'sims', label: '页面仿真' },
            ]}
            onChange={setView}
          />
        </header>
        {view === 'gallery' ? <Gallery /> : <Sims />}
        {toastMsg ? <div className="toast">{toastMsg}</div> : null}
      </div>
      <VariantSwitcher variants={variants} active={active} onSelect={select} />
    </>
  )
}
