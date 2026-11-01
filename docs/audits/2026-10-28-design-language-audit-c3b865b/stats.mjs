import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const css = readFileSync(join(ROOT, 'src/styles.css'), 'utf8')
const html = readFileSync(join(ROOT, 'index.html'), 'utf8')

const COLOR_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|rgba?\(|hsla?\(/i

function stripComments(text, isCss) {
  if (isCss) return text.replace(/\/\*[\s\S]*?\*\//g, '')
  return text
    .split('\n')
    .map((l) => {
      let code = l
      const b = code.indexOf('/*'); if (b !== -1) code = code.slice(0, b)
      const c = code.indexOf('//'); if (c !== -1) code = code.slice(0, c)
      return code
    })
    .join('\n')
}

const rootMatch = css.match(/:root\s*\{([\s\S]*?)\n\}/)
const tokens = [...rootMatch[0].matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => ({ name: '--' + m[1], value: m[2].trim() }))
const cat = (n) => n.startsWith('--space-') ? 'spacing' : n.startsWith('--font-') ? 'font' : n.startsWith('--radius-') ? 'radius' : n.startsWith('--z-') ? 'z' : (n.startsWith('--shadow-') || n === '--scrim') ? 'shadow' : 'color'
const tokenByCat = {}
for (const t of tokens) tokenByCat[cat(t.name)] = (tokenByCat[cat(t.name)] || 0) + 1

const cssOutside = stripComments(css, true).replace(rootMatch[0], '')
const literalsOutside = [...cssOutside.matchAll(/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi)].map((m) => m[0])
const colorMixCount = (cssOutside.match(/color-mix\(/g) || []).length
const varRefCount = (cssOutside.match(/var\(--/g) || []).length

const decls = [...cssOutside.matchAll(/([a-zA-Z-]+)\s*:\s*([^;{}]+);/g)].map((m) => ({ prop: m[1], value: m[2].trim() }))
const isSpacing = (p) => /^(margin|padding)(-(top|right|bottom|left))?$/.test(p) || p === 'gap' || p === 'row-gap' || p === 'column-gap'

const dim = { spacing: { var: 0, bare: [] }, font: { var: 0, bare: [] }, radius: { var: 0, bare: [] }, z: { var: 0, bare: [] }, shadow: { var: 0, bare: 0 } }
for (const d of decls) {
  let k = null
  if (isSpacing(d.prop)) k = 'spacing'
  else if (d.prop === 'font-size') k = 'font'
  else if (d.prop === 'border-radius') k = 'radius'
  else if (d.prop === 'z-index') k = 'z'
  else if (d.prop === 'box-shadow') k = 'shadow'
  if (!k) continue
  if (k === 'shadow') { if (/var\(--(shadow|scrim)/.test(d.value)) dim.shadow.var++; else if (d.value !== 'none') dim.shadow.bare++; continue }
  if (d.prop === 'z-index') {
    if (/var\(--z-/.test(d.value)) dim.z.var++
    else { const n = d.value.match(/^-?\d+$/); if (n) dim.z.bare.push(Number(n[0])) }
    continue
  }
  const hasVar = /var\(--/.test(d.value)
  const barePx = [...d.value.matchAll(/(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])).filter(() => !hasVar)
  if (hasVar) dim[k].var++
  if (barePx.length) dim[k].bare.push(...barePx)
}
const freq = (arr) => arr.reduce((a, n) => { a[n] = (a[n] || 0) + 1; return a }, {})

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}
const appFiles = walk(join(ROOT, 'src/app')).filter((f) => /\.(ts|tsx)$/.test(f))

const INLINE_STATIC_KEYS = new Set(['margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'fontSize', 'lineHeight', 'textAlign', 'gap', 'whiteSpace', 'flex'])
function topLevelSplit(text) {
  const parts = []; let depth = 0; let q = null; let s = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue }
    if (c === '"' || c === "'" || c === '`') { q = c; continue }
    if (c === '{' || c === '(' || c === '[') depth++
    else if (c === '}' || c === ')' || c === ']') depth--
    else if (c === ',' && depth === 0) { parts.push(text.slice(s, i)); s = i + 1 }
  }
  parts.push(text.slice(s)); return parts
}
const isDyn = (v) => v.includes('`') || v.includes('?') || /\w\s*\(/.test(v)

const perFile = {}
let inlineTotal = 0, inlineStatic = 0, inlineDynamic = 0, segHits = 0, formBtnsHits = 0, appColorHits = 0
for (const f of appFiles) {
  const rel = f.replace(ROOT + '/', '')
  const content = readFileSync(f, 'utf8')
  const code = stripComments(content, false)
  const colorHits = code.match(new RegExp(COLOR_RE.source, 'gi')) || []
  if (colorHits.length && rel !== 'src/app/format.ts') appColorHits += colorHits.length
  if (rel.endsWith('.tsx')) {
    segHits += (content.match(/className[^>\n]*[."'`\s]seg[\s"'`]/g) || []).length
    formBtnsHits += (content.match(/className[^>\n]*form-btns/g) || []).length
  }
  let idx = 0; let fileInline = 0
  while (true) {
    const start = content.indexOf('style={{', idx)
    if (start === -1) break
    let depth = 0; let end = -1
    for (let i = start + 6; i < content.length; i++) {
      if (content[i] === '{') depth++
      else if (content[i] === '}') { depth--; if (depth === 0) { end = i; break } }
    }
    if (end === -1) break
    const body = content.slice(start + 8, end - 1)
    fileInline++
    for (const p of topLevelSplit(body)) {
      const m = p.match(/^\s*(\w+)\s*:\s*([\s\S]+)$/)
      if (!m) continue
      inlineTotal++
      if (INLINE_STATIC_KEYS.has(m[1]) && !isDyn(m[2])) inlineStatic++
      else inlineDynamic++
    }
    idx = end + 1
  }
  if (fileInline) perFile[rel] = fileInline
}

const classes = new Set()
for (const m of cssOutside.matchAll(/\.([a-zA-Z][\w-]*)/g)) classes.add(m[1])

const compDir = join(ROOT, 'src/app/components')
const comps = readdirSync(compDir).map((n) => ({ name: n, loc: readFileSync(join(compDir, n), 'utf8').split('\n').length }))

const statusColorUses = appFiles.filter((f) => readFileSync(f, 'utf8').includes('statusColor(') && !f.endsWith('statusColor.ts')).map((f) => f.replace(ROOT + '/', ''))
const tabularNums = (css.match(/tabular-nums/g) || []).length
const moneyUses = appFiles.flatMap((f) => {
  const t = readFileSync(f, 'utf8')
  const n = (t.match(/money(Exact)?\(/g) || []).length
  return n && !f.endsWith('format.ts') && !f.endsWith('format.test.ts') ? [{ f: f.replace(ROOT + '/', ''), n }] : []
})
const yenOutside = appFiles.filter((f) => !f.endsWith('format.ts') && !f.endsWith('format.test.ts') && /¥|toFixed|toLocaleString/.test(readFileSync(f, 'utf8'))).map((f) => f.replace(ROOT + '/', ''))
const btnPrimary = appFiles.reduce((a, f) => a + ((readFileSync(f, 'utf8').match(/btn-primary/g) || []).length), 0)
const themeColor = html.match(/<meta\s+name="theme-color"\s+content="([^"]*)"/)?.[1]
const motionRefs = {
  transition: (css.match(/transition:/g) || []).length,
  animation: (css.match(/animation:/g) || []).length,
  'reduced-motion': (css.match(/prefers-reduced-motion/g) || []).length,
}
const iconsInApp = appFiles.reduce((a, f) => a + ((readFileSync(f, 'utf8').match(/from 'lucide-react'/g) || []).length), 0)

const spaceRefs = {}
for (const m of css.matchAll(/var\((--space-[\w-]+)\)/g)) spaceRefs[m[1]] = (spaceRefs[m[1]] || 0) + 1
const fontRefs = {}
for (const m of css.matchAll(/var\((--font-[\w-]+)\)/g)) fontRefs[m[1]] = (fontRefs[m[1]] || 0) + 1
const radiusRefs = {}
for (const m of css.matchAll(/var\((--radius-[\w-]+)\)/g)) radiusRefs[m[1]] = (radiusRefs[m[1]] || 0) + 1

console.log(JSON.stringify({
  tokens: tokens.length, tokenByCat,
  literalsOutside: literalsOutside.length, colorMixCount, varRefCount, cssClassCount: classes.size,
  dims: {
    spacing: { varRefs: dim.spacing.var, bareFreq: freq(dim.spacing.bare), ladderUsage: spaceRefs },
    font: { varRefs: dim.font.var, bareFreq: freq(dim.font.bare), ladderUsage: fontRefs },
    radius: { varRefs: dim.radius.var, bareFreq: freq(dim.radius.bare), ladderUsage: radiusRefs },
    z: { varRefs: dim.z.var, bareFreq: freq(dim.z.bare) },
    shadow: { varRefs: dim.shadow.var, bare: dim.shadow.bare },
  },
  inline: { total: inlineTotal, static: inlineStatic, dynamic: inlineDynamic, perFile },
  g3: { segInTsx: segHits, formBtnsInTsx: formBtnsHits },
  appColorHits, statusColorUses, tabularNums, moneyUses, yenOutside, btnPrimary, themeColor, motionRefs, iconsInApp, comps,
}, null, 1))
