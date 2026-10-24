import { useEffect, useMemo, useState } from 'react'
import { Palette, X } from 'lucide-react'
import { BASELINE_VARIANT, searchWithVariant, variantFromSearch, variantIdsFromFiles } from '../variant'
import baselineCss from '../styles.css?raw'

const variantTexts = import.meta.glob('../variants/*.css', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

type Variant = { id: string; label: string; css: string }

const LABELS: Record<string, string> = {
  [BASELINE_VARIANT]: '基线（现行样式）',
  'harbor-dusk': '港暮（演示：冷调 + 胶囊按钮 + 浮坞导航）',
  'night-ledger': '夜账（深色模式：墨蓝底 + 薄荷绿）',
  'ink-checkbook': '墨水账本（蓝黑墨水 + 直角细线 + 纸感扁平）',
  'cream-mint': '薄荷（现代 fintech：中性灰面，绿只作主色/选中态，浮坞胶囊导航）',
}

export function useVariants(): Variant[] {
  return useMemo(() => {
    const variants: Variant[] = [{ id: BASELINE_VARIANT, label: LABELS[BASELINE_VARIANT], css: baselineCss }]
    for (const id of variantIdsFromFiles(Object.keys(variantTexts))) {
      variants.push({ id, label: LABELS[id] ?? id, css: variantTexts[`../variants/${id}.css`] })
    }
    return variants
  }, [])
}

export function VariantStyle({ css }: { css: string }) {
  return <style>{css}</style>
}

export function VariantSwitcher({ variants, active, onSelect }: { variants: Variant[]; active: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="variant-dock">
      {open ? (
        <div className="variant-panel">
          <div className="variant-panel-head">
            <span>样式变体</span>
            <button type="button" aria-label="关闭" onClick={() => setOpen(false)}>
              <X size={16} strokeWidth={2} />
            </button>
          </div>
          {variants.map((v) => (
            <button type="button" key={v.id} className={v.id === active ? 'on' : ''} onClick={() => onSelect(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
      ) : null}
      <button type="button" className="variant-fab" aria-label="切换样式变体" onClick={() => setOpen((o) => !o)}>
        <Palette size={20} strokeWidth={2} />
      </button>
    </div>
  )
}

export function useVariantState(variants: Variant[]) {
  const [active, setActive] = useState(() => variantFromSearch(window.location.search))
  useEffect(() => {
    const onPop = () => setActive(variantFromSearch(window.location.search))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const css = variants.find((v) => v.id === active)?.css ?? variants[0].css
  const select = (id: string) => {
    setActive(id)
    window.history.replaceState(null, '', searchWithVariant(window.location.search, id) + window.location.hash)
  }
  const effective = variants.some((v) => v.id === active) ? active : variants[0].id
  return { active: effective, css, select }
}
