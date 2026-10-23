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
 *   4. 占位：阶梯检查（票 17）、内联样式检查（票 18），待后续票填充
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

function checkScale() {
  // TODO: 阶梯检查（票 17）——阴影/间距等档位的机器断言
}

function checkInlineStyles() {
  // TODO: 内联样式检查（票 18）——src/app/** 内联 style 的颜色等字面量
}

checkAppColors()
checkStylesColors()
checkThemeColor()
checkScale()
checkInlineStyles()

if (hits.length) {
  console.error(`设计扫描：命中 ${hits.length} 处`)
  for (const h of hits) console.error('  ' + h)
  console.error('处理：改用 :root token 或 color-mix 派生；例外须登记 docs/design/unicon.md')
  process.exit(1)
}
console.log(`设计扫描通过（${staged ? '暂存区' : '全部跟踪文件'}）`)
