#!/usr/bin/env node
/**
 * 隐私扫描：拦截真实个人信息进入 git 历史。
 *
 * 用法：
 *   node scripts/privacy-scan.mjs           # 扫描全部 git 跟踪文件（工作区内容）
 *   node scripts/privacy-scan.mjs --staged  # 只扫描暂存内容（pre-commit 钩子调用）
 *
 * 两层检测：
 *   1. 通用模式（内置，公开安全）：个人邮箱、.local 内网主机名、银行卡号、
 *      银行名+卡号尾数、手机号、身份证号
 *   2. 私有清单：.privacy-blocklist（已 gitignore，只留本地），每行一个真实敏感词，
 *      # 开头为注释；ASCII 词按整词匹配，中文词按子串匹配
 *
 * 有命中退出码 1（阻断提交），干净退出码 0。清单文件缺失只提示不阻断。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'

const staged = process.argv.includes('--staged')

const GENERIC = [
  [/[\w.%+-]+@(?:gmail|qq|163|126|outlook|hotmail|yahoo)\.(?:com|net|org)/i, '个人邮箱'],
  [/[\w-]+\.local\b/, '.local 内网主机名'],
  [/(?:招商|工商|光大|建设|农业|中国|交通|浦发|中信|民生|兴业|平安|邮储)银行[^\n]{0,6}\d{3,4}/, '银行名+卡号尾数'],
  [/\b\d{15,19}\b/, '疑似银行卡号'],
  [/\b1[3-9]\d{9}\b/, '疑似手机号'],
  [/\b\d{17}[\dXx]\b/, '疑似身份证号'],
]

const SKIP_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.icns', '.zip', '.woff', '.woff2', '.ttf', '.eot'])
const SKIP_FILES = new Set(['package-lock.json'])

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function loadBlocklist() {
  const FILE = '.privacy-blocklist'
  if (!existsSync(FILE)) return { terms: [], missing: true }
  const terms = readFileSync(FILE, 'utf8')
    .split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((term) => {
      const ascii = /^[\x21-\x7e]+$/.test(term)
      return { term, re: ascii ? new RegExp(`\\b${esc(term)}\\b`, 'i') : null }
    })
  return { terms, missing: false }
}

function listFiles() {
  const out = staged
    ? execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { encoding: 'utf8' })
    : execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  return out.split('\n').filter(Boolean)
    .filter((f) => !SKIP_FILES.has(f) && !SKIP_EXT.has(f.slice(f.lastIndexOf('.')).toLowerCase()))
}

function readContent(file) {
  try {
    return staged
      ? execFileSync('git', ['show', `:${file}`], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
      : readFileSync(file, 'utf8')
  } catch { return null }
}

const hits = []
const { terms, missing } = loadBlocklist()

for (const file of listFiles()) {
  const content = readContent(file)
  if (content === null) continue
  content.split('\n').forEach((line, i) => {
    for (const [re, label] of GENERIC) {
      const m = line.match(re)
      if (m) hits.push(`${file}:${i + 1} [${label}] ${m[0]}`)
    }
    for (const { term, re } of terms) {
      const hit = re ? re.test(line) : line.includes(term)
      if (hit) hits.push(`${file}:${i + 1} [私有词表] ${term}`)
    }
  })
}

if (missing) console.log('提示：未找到 .privacy-blocklist，仅启用通用模式')
if (hits.length) {
  console.error(`隐私扫描：命中 ${hits.length} 处，提交被阻断`)
  for (const h of hits) console.error('  ' + h)
  console.error('处理：替换为虚构数据；若属误报，编辑本地 .privacy-blocklist')
  process.exit(1)
}
console.log(`隐私扫描通过（${staged ? '暂存区' : '全部跟踪文件'}）`)
