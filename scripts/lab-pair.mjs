import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export function mirrorPath(srcPath) {
  return srcPath.replace(/^src\//, 'lab/')
}

const FIXED_FILES = [
  'src/styles.css',
  'src/app/AccountSettingsSheet.tsx',
  'src/app/format.ts',
  'src/app/statusColor.ts',
  'src/app/store.ts',
  'src/app/toast.ts',
  'src/storage/migrate.ts',
  'src/storage/voucher.ts',
]

const SCOPED_DIRS = ['src/app/components', 'src/app/pages', 'src/core']

export function mirrorScope(root) {
  const fixed = FIXED_FILES.filter((f) => existsSync(join(root, f)))
  const discovered = []
  for (const dir of SCOPED_DIRS) {
    let names
    try {
      names = readdirSync(join(root, dir))
    } catch {
      continue
    }
    for (const name of names) {
      if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) discovered.push(`${dir}/${name}`)
    }
  }
  return [...fixed, ...discovered].sort()
}

export function readBaseline(root) {
  return JSON.parse(readFileSync(join(root, 'lab', 'BASELINE.json'), 'utf8'))
}

function sha(content) {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`
}

function gitShow(root, commit, path) {
  try {
    return execSync(`git show ${commit}:${path}`, { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
  } catch {
    return ''
  }
}

export function parseCssUnits(css) {
  const units = []
  const lines = css.split('\n')
  let i = 0
  const selectorCounts = new Map()
  while (i < lines.length) {
    let j = i
    while (j < lines.length && lines[j].indexOf('{') === -1) j += 1
    if (j >= lines.length) break
    const preludeLines = lines.slice(i, j)
    const selector = [...preludeLines, lines[j].slice(0, lines[j].indexOf('{'))]
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (selector === ':root') {
      i = j + 1
      let depth = 1
      while (i < lines.length && depth > 0) {
        const token = lines[i].match(/^\s*(--[\w-]+)\s*:\s*([^;]*);/)
        if (token && depth === 1) units.push({ key: token[1], text: lines[i], line: i })
        depth += (lines[i].match(/\{/g) ?? []).length
        depth -= (lines[i].match(/\}/g) ?? []).length
        i += 1
      }
      continue
    }
    let depth = 1
    let end = j
    while (end + 1 < lines.length && depth > 0) {
      end += 1
      depth += (lines[end].match(/\{/g) ?? []).length
      depth -= (lines[end].match(/\}/g) ?? []).length
    }
    const count = selectorCounts.get(selector) ?? 0
    selectorCounts.set(selector, count + 1)
    const key = count === 0 ? selector : `${selector}#${count}`
    units.push({ key, text: lines.slice(i, end + 1).join('\n'), line: i })
    i = end + 1
  }
  return units
}

function unitMap(css) {
  return new Map(parseCssUnits(css).map((u) => [u.key, u.text]))
}

function isCss(path) {
  return path.endsWith('.css')
}

function unitDiff(from, to) {
  const a = unitMap(from)
  const b = unitMap(to)
  const changes = []
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const av = a.get(key)
    const bv = b.get(key)
    if (av !== bv) changes.push({ key, from: av ?? '', to: bv ?? '' })
  }
  return changes
}

function threeWayCss(base, src, lab) {
  const b = unitMap(base)
  const s = unitMap(src)
  const l = unitMap(lab)
  const keys = new Set([...b.keys(), ...s.keys(), ...l.keys()])
  const changes = []
  const conflicts = []
  const labDriftKeys = []
  for (const key of keys) {
    const bv = b.get(key)
    const sv = s.get(key)
    const lv = l.get(key)
    if (sv === lv) continue
    if (sv !== bv && lv !== bv) {
      conflicts.push({ key, from: bv ?? '', to: lv ?? '', srcTo: sv ?? '' })
    } else if (sv !== bv) {
      changes.push({ key, from: bv ?? '', to: sv ?? '', kind: 'src-evolved' })
    } else {
      changes.push({ key, from: bv ?? '', to: lv ?? '', kind: 'lab-drift' })
      labDriftKeys.push(key)
    }
  }
  return { changes, conflicts, labDriftKeys }
}

function classifyFile(srcPath, base, src, lab) {
  if (src === lab) return { status: 'clean', changes: [] }
  if (lab === base) {
    return {
      status: 'update',
      changes: isCss(srcPath) ? unitDiff(base, src) : [{ key: '<file>', from: base, to: src }],
      merged: src,
    }
  }
  if (src === base) {
    return {
      status: 'drift',
      changes: isCss(srcPath) ? unitDiff(base, lab) : [{ key: '<file>', from: base, to: lab }],
    }
  }
  if (!isCss(srcPath)) {
    return {
      status: 'conflict',
      changes: [{ key: '<file>', from: base, to: lab, kind: 'conflict', srcTo: src }],
    }
  }
  const { changes, conflicts, labDriftKeys } = threeWayCss(base, src, lab)
  if (conflicts.length > 0) {
    const conflictKeys = new Set(conflicts.map((c) => c.key))
    const marked = changes.map((c) => (conflictKeys.has(c.key) ? { ...c, kind: 'conflict' } : c))
    return { status: 'conflict', changes: [...marked, ...conflicts.map((c) => ({ ...c, kind: 'conflict' }))] }
  }
  let merged = src
  const srcUnits = parseCssUnits(src)
  const labUnits = unitMap(lab)
  for (const key of labDriftKeys) {
    const span = srcUnits.find((u) => u.key === key)
    const replacement = labUnits.get(key)
    if (span && replacement !== undefined) merged = merged.replace(span.text, replacement)
  }
  const srcKeys = new Set(srcUnits.map((u) => u.key))
  for (const key of labDriftKeys) {
    if (!srcKeys.has(key) && labUnits.get(key) !== undefined) merged = `${merged}\n${labUnits.get(key)}`
  }
  return { status: 'merge', changes, merged }
}

export function syncPlan(root) {
  const baseline = readBaseline(root)
  const entries = []
  const known = new Set()
  for (const entry of baseline.files) {
    known.add(entry.src)
    const src = readFileSync(join(root, entry.src), 'utf8')
    const lab = readFileSync(join(root, mirrorPath(entry.src)), 'utf8')
    const base = gitShow(root, baseline.commit, entry.src)
    entries.push({ src: entry.src, ...classifyFile(entry.src, base, src, lab) })
  }
  for (const src of mirrorScope(root)) {
    if (known.has(src)) continue
    const content = readFileSync(join(root, src), 'utf8')
    entries.push({
      src,
      status: 'update',
      isNew: true,
      changes: [{ key: '<new-file>', from: '', to: content }],
      merged: content,
    })
  }
  entries.sort((a, b) => (a.src < b.src ? -1 : a.src > b.src ? 1 : 0))
  return {
    entries,
    hasUpdates: entries.some((e) => e.status === 'update' || e.status === 'merge'),
    hasConflicts: entries.some((e) => e.status === 'conflict'),
  }
}

export function applySync(root, plan) {
  const written = []
  const skipped = []
  for (const entry of plan.entries) {
    if ((entry.status === 'update' || entry.status === 'merge') && entry.merged !== undefined) {
      writeFileSync(join(root, mirrorPath(entry.src)), entry.merged)
      written.push(entry.src)
    }
    if (entry.status === 'drift' || entry.status === 'conflict') skipped.push(entry.src)
  }
  if (written.length > 0) {
    const baseline = readBaseline(root)
    const bySrc = new Map(baseline.files.map((f) => [f.src, f]))
    for (const src of written) {
      const hash = sha(readFileSync(join(root, src), 'utf8'))
      const entry = bySrc.get(src)
      if (entry) entry.hash = hash
      else baseline.files.push({ src, hash })
    }
    baseline.files.sort((a, b) => (a.src < b.src ? -1 : a.src > b.src ? 1 : 0))
    try {
      baseline.commit = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim()
    } catch {
      void 0
    }
    writeFileSync(join(root, 'lab', 'BASELINE.json'), `${JSON.stringify(baseline, null, 2)}\n`)
  }
  return { written, skipped }
}

function mergeLabWins(src, base, lab) {
  const b = unitMap(base)
  const l = unitMap(lab)
  const srcUnits = parseCssUnits(src)
  let target = src
  const seen = new Set()
  for (const key of new Set([...b.keys(), ...l.keys()])) {
    const lv = l.get(key)
    const bv = b.get(key)
    if (lv === bv) continue
    seen.add(key)
    const span = srcUnits.find((u) => u.key === key)
    if (span && lv !== undefined) {
      target = target.replace(span.text, lv)
    } else if (span && lv === undefined) {
      target = target.replace(`${span.text}\n`, '').replace(span.text, '')
    }
  }
  const srcKeys = new Set(srcUnits.map((u) => u.key))
  for (const key of seen) {
    const lv = l.get(key)
    if (!srcKeys.has(key) && lv !== undefined) target = `${target}\n${lv}`
  }
  return target
}

function lcsOps(aLines, bLines) {
  const n = aLines.length
  const m = bLines.length
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = aLines[i] === bLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const ops = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (aLines[i] === bLines[j]) {
      ops.push({ type: ' ', text: aLines[i] })
      i += 1
      j += 1
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: '-', text: aLines[i] })
      i += 1
    } else {
      ops.push({ type: '+', text: bLines[j] })
      j += 1
    }
  }
  while (i < n) {
    ops.push({ type: '-', text: aLines[i] })
    i += 1
  }
  while (j < m) {
    ops.push({ type: '+', text: bLines[j] })
    j += 1
  }
  return ops
}

function unifiedDiff(from, to, fromPath, toPath) {
  const aEnds = from.endsWith('\n')
  const bEnds = to.endsWith('\n')
  const aLines = (aEnds ? from.slice(0, -1) : from).split('\n')
  const bLines = (bEnds ? to.slice(0, -1) : to).split('\n')
  const ops = lcsOps(aLines, bLines)
  if (!ops.some((op) => op.type !== ' ')) return ''
  const context = 3
  const changeIdx = ops.map((op, idx) => (op.type !== ' ' ? idx : -1)).filter((idx) => idx >= 0)
  const groups = []
  let current = [changeIdx[0], changeIdx[0]]
  for (let k = 1; k < changeIdx.length; k += 1) {
    if (changeIdx[k] - current[1] <= context * 2 + 1) current[1] = changeIdx[k]
    else {
      groups.push(current)
      current = [changeIdx[k], changeIdx[k]]
    }
  }
  groups.push(current)
  const out = [`--- a/${fromPath}`, `+++ b/${toPath}`]
  for (const [start, end] of groups) {
    const from0 = Math.max(0, start - context)
    const to0 = Math.min(ops.length - 1, end + context)
    const slice = ops.slice(from0, to0 + 1)
    let oldCount = 0
    let newCount = 0
    let oldStart = 0
    let newStart = 0
    let seenOld = false
    let seenNew = false
    slice.forEach((op, idx) => {
      if (op.type !== '+') {
        if (!seenOld) {
          oldStart = from0 + idx + 1
          seenOld = true
        }
        oldCount += 1
      }
      if (op.type !== '-') {
        if (!seenNew) {
          newStart = from0 + idx + 1
          seenNew = true
        }
        newCount += 1
      }
    })
    if (oldCount === 0) oldStart = Math.max(0, from0 + start - context === from0 ? from0 : start - context)
    if (newCount === 0) newStart = oldStart
    out.push(`@@ -${oldCount === 0 ? Math.max(1, oldStart - 1) : oldStart},${oldCount} +${newCount === 0 ? Math.max(1, newStart - 1) : newStart},${newCount} @@`)
    for (const op of slice) out.push(`${op.type}${op.text}`)
    const last = slice[slice.length - 1]
    if ((last.type === '-' && !aEnds) || (last.type === '+' && !bEnds) || (last.type === ' ' && !aEnds && !bEnds)) {
      out.push('\\ No newline at end of file')
    }
  }
  return `${out.join('\n')}\n`
}

const LADDER_PREFIXES = ['--space-', '--font-', '--radius-', '--z-', '--shadow']

export function pushbackPlan(root) {
  const baseline = readBaseline(root)
  const changed = []
  const checklist = []
  for (const entry of baseline.files) {
    const src = readFileSync(join(root, entry.src), 'utf8')
    const lab = readFileSync(join(root, mirrorPath(entry.src)), 'utf8')
    if (src === lab) continue
    const base = gitShow(root, baseline.commit, entry.src)
    if (lab === base) continue
    const target = isCss(entry.src) ? mergeLabWins(src, base, lab) : lab
    changed.push({ src: entry.src, from: src, target })
  }
  const cssChange = changed.find((c) => c.src === 'src/styles.css')
  if (cssChange) {
    const before = unitMap(cssChange.from)
    const after = unitMap(cssChange.target)
    for (const key of new Set([...before.keys(), ...after.keys()])) {
      if (before.get(key) === after.get(key)) continue
      if (key === '--accent' || key === '--bar-accent') {
        checklist.push({
          id: 'theme-color',
          hint: `index.html 的 <meta name="theme-color"> 需与 --accent 新值同步（本次 ${key} 有改动）`,
        })
      }
      if (LADDER_PREFIXES.some((p) => key.startsWith(p))) {
        checklist.push({
          id: 'design-rules-ladder',
          hint: `阶梯 token ${key} 有改动：更新 docs/design/design-rules.md 的阶梯词条与 design:scan 白名单`,
        })
      }
    }
    checklist.push({ id: 'design-scan', hint: '补丁涉及设计文件：落地 PR 必须通过 pnpm design:scan' })
  }
  const patch = changed.map((c) => unifiedDiff(c.from, c.target, c.src, c.src)).filter(Boolean).join('')
  return { changed, patch, checklist }
}

export function writePushback(root, plan) {
  if (plan.changed.length === 0) return { patchFile: null, checklistFile: null }
  const dir = join(root, 'lab', 'pushback')
  mkdirSync(dir, { recursive: true })
  const patchFile = join(dir, 'patch.diff')
  const checklistFile = join(dir, 'CHECKLIST.md')
  writeFileSync(patchFile, plan.patch)
  const lines = ['# pushback 落地清单', '', '补丁：lab/pushback/patch.diff（对当前 src 计算；人工审查后走正常 PR 落地）', '']
  if (plan.checklist.length === 0) lines.push('- 无自动触发的配套提醒')
  for (const item of plan.checklist) lines.push(`- [ ] ${item.hint}`)
  lines.push('', '落地合并后运行 `pnpm lab:sync -- --yes` 把 lab 复位回与 src 一致。')
  writeFileSync(checklistFile, `${lines.join('\n')}\n`)
  return { patchFile, checklistFile }
}
