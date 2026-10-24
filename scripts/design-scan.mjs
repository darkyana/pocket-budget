#!/usr/bin/env node
/**
 * 设计扫描：颜色护栏（docs/design/design-rules.md G1 的机器检查）。
 *
 * 用法：
 *   node scripts/design-scan.mjs           # 扫描全部 git 跟踪文件（工作区内容）
 *   node scripts/design-scan.mjs --staged  # 只检查暂存内容（pre-commit 钩子调用；
 *                                          # 未进暂存区的文件回退读工作区版本）
 *
 * 检查项：
 *   1. src/app/** 的 tsx/ts 无颜色字面量（#hex / rgb() / hsl()；注释文字不计）
 *   2. src/styles.css 的 :root 块之外无颜色字面量（已登记豁免值除外，
 *      豁免登记见 docs/design/unicon.md）
 *   3. index.html 的 <meta name="theme-color"> 与 styles.css :root 的
 *      --accent 值一致（HTML 无法引用 CSS 变量，由本扫描看住这处重复）
 *   4. src/styles.css 的间距（margin/padding/gap）、字号（font-size）、圆角
 *      （border-radius）、z-index 取值 ∈ 阶梯白名单（calc()/env()/百分比/var()
 *      不拦；登记例外：.phone 底部 padding 130、.toast bottom 92）
 *   5. src/app/** 的 tsx 内联 style 仅允许数据驱动值：margin、padding 各向、
 *      fontSize、lineHeight、textAlign、gap、whiteSpace、flex 等静态键命中即报
 *      （值为模板串、三元或函数调用算动态放行；width/height/background/color/
 *      textDecoration/opacity/accentColor/transform 等数据驱动键不拦）
 *   6. src/app/** 的 tsx 禁止在 className 属性手写 seg / form-btns 组件类名
 *      token（含模板串/三元里的同 token），组件内部白名单：SegmentedControl.tsx、
 *      FormFooter.tsx（G3 的机器检查）
 *
 * 有命中退出码 1（阻断），干净退出码 0。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const staged = process.argv.includes('--staged')

const COLOR_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|rgba?\(|hsla?\(/i

const STYLE_EXEMPT = new Set(['#a05a2c', '#f7ecd9'])

const hits = []

function readStaged(file) {
  try {
    return execFileSync('git', ['show', `:${file}`], { encoding: 'utf8' })
  } catch {
    return null
  }
}

function readWorktree(file) {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

function read(file) {
  if (!staged) return readWorktree(file)
  return readStaged(file) ?? readWorktree(file)
}

function listFiles() {
  const out = staged
    ? execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { encoding: 'utf8' })
    : execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  return out.split('\n').filter(Boolean)
}

function forEachCssLine(content, fn) {
  let inComment = false
  content.split('\n').forEach((raw, i) => {
    let line = raw
    if (inComment) {
      const end = line.indexOf('*/')
      if (end === -1) return
      line = line.slice(end + 2)
      inComment = false
    }
    const open = line.indexOf('/*')
    if (open !== -1) {
      const close = line.indexOf('*/', open)
      if (close === -1) {
        line = line.slice(0, open)
        inComment = true
      } else {
        line = line.slice(0, open) + line.slice(close + 2)
      }
    }
    fn(line, i)
  })
}

const G3_WHITELIST = new Set(['src/app/components/SegmentedControl.tsx', 'src/app/components/FormFooter.tsx'])

const G3_CLASS_TOKEN_RE = /(?:^|[^\w-])(seg|form-btns)(?![\w-])/g

function classNameValueRange(content, valueStart) {
  let i = valueStart
  while (i < content.length && /\s/.test(content[i])) i++
  const q = content[i]
  if (q !== '"' && q !== "'" && q !== '{') return null
  if (q === '"' || q === "'") {
    const end = content.indexOf(q, i + 1)
    if (end === -1) return null
    return [i, end + 1]
  }
  let depth = 0
  for (let j = i; j < content.length; j++) {
    if (content[j] === '{') depth++
    else if (content[j] === '}') {
      depth--
      if (depth === 0) return [i, j + 1]
    }
  }
  return null
}

function checkComponentClasses() {
  for (const file of listFiles()) {
    if (!file.startsWith('src/app/') || !file.endsWith('.tsx')) continue
    if (G3_WHITELIST.has(file)) continue
    const content = read(file)
    if (content === null) continue
    let idx = 0
    while (true) {
      const at = content.indexOf('className', idx)
      if (at === -1) break
      const eq = at + 'className'.length
      if (content[eq] !== '=') {
        idx = eq
        continue
      }
      const range = classNameValueRange(content, eq + 1)
      if (!range) {
        idx = eq + 1
        continue
      }
      const value = content.slice(range[0], range[1])
      const tokens = [...new Set(value.match(G3_CLASS_TOKEN_RE))]
      if (tokens.length) {
        const line = content.slice(0, at).split('\n').length
        const names = [...new Set(tokens.map((t) => t.replace(/^[^\w-]+/, '')))]
        hits.push(`${file}:${line} [G3 手写组件类] ${names.join(', ')} 请用 SegmentedControl / FormFooter`)
      }
      idx = range[1]
    }
  }
}

function checkAppColors() {
  for (const file of listFiles()) {
    if (!file.startsWith('src/app/') || !/\.(ts|tsx)$/.test(file)) continue
    const content = read(file)
    if (content === null) continue
    content.split('\n').forEach((raw, i) => {
      if (/^\s*\*/.test(raw)) return
      let code = raw
      const blockComment = code.indexOf('/*')
      if (blockComment !== -1) code = code.slice(0, blockComment)
      const lineComment = code.indexOf('//')
      if (lineComment !== -1) code = code.slice(0, lineComment)
      const m = code.match(COLOR_RE)
      if (m) hits.push(`${file}:${i + 1} [app 颜色字面量] ${m[0]}`)
    })
  }
}

function checkStylesColors() {
  const file = 'src/styles.css'
  const content = read(file)
  if (content === null) return
  let inRoot = false
  let rootDepth = 0
  forEachCssLine(content, (line, i) => {
    if (/^\s*:root\s*\{/.test(line)) inRoot = true
    if (inRoot) {
      rootDepth += (line.match(/\{/g) || []).length
      rootDepth -= (line.match(/\}/g) || []).length
      if (rootDepth <= 0) inRoot = false
      return
    }
    const m = line.match(COLOR_RE)
    if (m && !STYLE_EXEMPT.has(m[0].toLowerCase())) {
      hits.push(`${file}:${i + 1} [:root 外颜色字面量] ${m[0]}`)
    }
  })
}

function checkThemeColor() {
  const html = read('index.html')
  const css = read('src/styles.css')
  if (html === null || css === null) return
  const theme = html.match(/<meta\s+name="theme-color"\s+content="([^"]*)"/)
  const accent = css.match(/^[ \t]*--accent:[ \t]*([^;\s]+)[ \t]*;/m)
  if (!theme || !accent) {
    hits.push('index.html [theme-color 检查] 未找到 meta theme-color 或 :root --accent 定义')
    return
  }
  if (theme[1].toLowerCase() !== accent[1].toLowerCase()) {
    hits.push(`index.html [theme-color 检查] theme-color="${theme[1]}" 与 :root --accent=${accent[1]} 不一致`)
  }
}

const SCALE_WHITELIST = {
  spacing: new Set([2, 4, 8, 12, 16, 24, 32]),
  font: new Set([12, 13, 14, 16, 20, 28]),
  radius: new Set([6, 12, 18, 24, 999]),
  z: new Set([5, 10, 30, 40, 50, 60]),
}

const SCALE_EXEMPT = new Set(['.phone|padding|130', '.toast|bottom|92'])

function scaleKind(prop) {
  if (/^(?:margin|padding)(?:-(?:top|right|bottom|left))?$/.test(prop)) return 'spacing'
  if (prop === 'gap' || prop === 'row-gap' || prop === 'column-gap') return 'spacing'
  if (prop === 'font-size') return 'font'
  if (prop === 'border-radius') return 'radius'
  if (prop === 'z-index') return 'z'
  return null
}

function stripParens(value) {
  let v = value
  let prev
  do {
    prev = v
    v = v.replace(/\([^()]*\)/g, '')
  } while (v !== prev)
  return v
}

function checkScale() {
  const file = 'src/styles.css'
  const content = read(file)
  if (content === null) return
  let selector = ''
  forEachCssLine(content, (line, i) => {
    const sel = line.match(/^\s*([^{}]+)\{\s*$/)
    if (sel) selector = sel[1].trim()
    const decl = line.match(/^\s*([a-zA-Z-]+)\s*:\s*([^;]+);/)
    if (!decl) return
    const kind = scaleKind(decl[1])
    if (!kind) return
    const value = stripParens(decl[2])
    if (kind === 'z') {
      const zm = value.match(/^\s*(-?\d+)\s*$/)
      if (zm && !SCALE_WHITELIST.z.has(Number(zm[1]))) {
        hits.push(`${file}:${i + 1} [阶梯越档] ${selector} z-index: ${zm[1]}`)
      }
      return
    }
    for (const m of value.matchAll(/(\d+(?:\.\d+)?)px/g)) {
      const n = Number(m[1])
      if (SCALE_WHITELIST[kind].has(n)) continue
      if (SCALE_EXEMPT.has(`${selector}|${decl[1]}|${n}`)) continue
      hits.push(`${file}:${i + 1} [阶梯越档] ${selector} ${decl[1]}: ${m[1]}px`)
    }
  })
}

const INLINE_STATIC_KEYS = new Set([
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'padding',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'fontSize',
  'lineHeight',
  'textAlign',
  'gap',
  'whiteSpace',
  'flex',
])

function splitTopLevel(text) {
  const parts = []
  let depth = 0
  let quote = null
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c
      continue
    }
    if (c === '{' || c === '(' || c === '[') depth++
    else if (c === '}' || c === ')' || c === ']') depth--
    else if (c === ',' && depth === 0) {
      parts.push(text.slice(start, i))
      start = i + 1
    }
  }
  parts.push(text.slice(start))
  return parts
}

function isDynamicValue(value) {
  if (value.includes('`')) return true
  if (value.includes('?')) return true
  return /\w\s*\(/.test(value)
}

function checkInlineStyles() {
  for (const file of listFiles()) {
    if (!file.startsWith('src/app/') || !file.endsWith('.tsx')) continue
    const content = read(file)
    if (content === null) continue
    let idx = 0
    while (true) {
      const start = content.indexOf('style={{', idx)
      if (start === -1) break
      let depth = 0
      let end = -1
      for (let i = start + 'style='.length; i < content.length; i++) {
        if (content[i] === '{') depth++
        else if (content[i] === '}') {
          depth--
          if (depth === 0) {
            end = i
            break
          }
        }
      }
      if (end === -1) break
      const body = content.slice(start + 'style={{'.length, end - 1)
      const line = content.slice(0, start).split('\n').length
      for (const prop of splitTopLevel(body)) {
        const m = prop.match(/^\s*(\w+)\s*:\s*([\s\S]+)$/)
        if (!m) continue
        const [, key, value] = m
        if (INLINE_STATIC_KEYS.has(key) && !isDynamicValue(value)) {
          hits.push(`${file}:${line} [静态内联样式] ${key}: ${value.trim()}`)
        }
      }
      idx = end + 1
    }
  }
}

checkAppColors()
checkStylesColors()
checkThemeColor()
checkScale()
checkInlineStyles()
checkComponentClasses()

if (hits.length) {
  console.error(`设计扫描：命中 ${hits.length} 处`)
  for (const h of hits) console.error('  ' + h)
  console.error('处理：颜色改用 :root token 或 color-mix 派生；间距/字号/圆角/z-index 走 var(--space-*/--font-*/--radius-*/--z-*) 阶梯档位；例外须登记（颜色见 docs/design/unicon.md，阶梯见 design-scan 的 SCALE_EXEMPT）')
  process.exit(1)
}
console.log(`设计扫描通过（${staged ? '暂存区' : '全部跟踪文件'}）`)
