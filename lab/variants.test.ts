import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const variantsDir = fileURLToPath(new URL('./variants/', import.meta.url))
const baselineCss = readFileSync(join(variantsDir, '..', 'styles.css'), 'utf8')

describe('主题变体文件', () => {
  it('variants 目录存在至少一个非 baseline 变体', () => {
    expect(existsSync(variantsDir)).toBe(true)
    const ids = readdirSync(variantsDir)
      .filter((f) => f.endsWith('.css') && f !== 'baseline.css')
      .map((f) => f.slice(0, -4))
    expect(ids.length).toBeGreaterThanOrEqual(1)
  })

  it('每个变体是完整样式表：含 :root token 块且与基线有差异', () => {
    const files = readdirSync(variantsDir).filter((f) => f.endsWith('.css'))
    expect(files.length).toBeGreaterThanOrEqual(1)
    for (const f of files) {
      const css = readFileSync(join(variantsDir, f), 'utf8')
      expect(css, `${f} 应含 :root`).toContain(':root')
      expect(css === baselineCss, `${f} 应与基线有可感知差异`).toBe(false)
    }
  })

  it('变体含类规则改动（不止 token）', () => {
    const files = readdirSync(variantsDir).filter((f) => f.endsWith('.css') && f !== 'baseline.css')
    for (const f of files) {
      const css = readFileSync(join(variantsDir, f), 'utf8')
      const classRules = css.match(/\.[\w-]+\s*\{/g) ?? []
      expect(classRules.length, `${f} 应含类规则`).toBeGreaterThan(0)
    }
  })
})
