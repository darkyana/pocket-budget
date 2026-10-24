import { createInterface } from 'node:readline'
import { applySync, syncPlan } from './lab-pair.mjs'

const args = process.argv.slice(2)
const yes = args.includes('--yes')
const rootIdx = args.indexOf('--root')
const root = rootIdx !== -1 ? args[rootIdx + 1] : process.cwd()

const statusLabel = {
  clean: '一致',
  update: '将更新 lab（src 演进）',
  merge: '将合并进 lab（两侧各改不同规则）',
  drift: 'lab 漂移（保留，不动）',
  conflict: '⚠ 冲突（两侧同改，需人工裁决）',
}

function brief(text) {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length > 60 ? `${one.slice(0, 57)}…` : one
}

const plan = syncPlan(root)
for (const entry of plan.entries) {
  if (entry.status === 'clean') continue
  console.log(`${entry.src} — ${statusLabel[entry.status]}`)
  for (const change of entry.changes) {
    const mark = change.kind === 'conflict' ? '  ⚠ 冲突' : '  变更'
    console.log(`${mark} [${change.key}]`)
    if (change.from) console.log(`    旧: ${brief(change.from)}`)
    console.log(`    新: ${brief(change.to)}`)
    if (change.kind === 'conflict' && change.srcTo !== undefined) console.log(`    src 侧: ${brief(change.srcTo)}`)
  }
}

if (!plan.hasUpdates && !plan.hasConflicts) {
  console.log('lab 与 src 无需对齐。')
  process.exit(0)
}

async function confirm() {
  if (yes) return true
  if (!process.stdin.isTTY) {
    console.log('以上变更未写入；确认后加 --yes 执行。')
    return false
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise((resolve) => {
    rl.question('写入以上非冲突变更到 lab？(y/N) ', resolve)
  })
  rl.close()
  return answer.trim().toLowerCase() === 'y'
}

if (await confirm()) {
  const result = applySync(root, plan)
  for (const src of result.written) console.log(`已写入 lab：${src}`)
  for (const src of result.skipped) console.log(`未触碰：${src}`)
  console.log(`基线已更新：lab/BASELINE.json`)
}
process.exit(plan.hasConflicts ? 1 : 0)
