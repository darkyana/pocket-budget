import { pushbackPlan, writePushback } from './lab-pair.mjs'

const args = process.argv.slice(2)
const rootIdx = args.indexOf('--root')
const root = rootIdx !== -1 ? args[rootIdx + 1] : process.cwd()

const plan = pushbackPlan(root)
if (plan.changed.length === 0) {
  console.log('lab 无漂移，未生成补丁。')
  process.exit(0)
}

const { patchFile, checklistFile } = writePushback(root, plan)
console.log(`补丁：${patchFile}`)
console.log(`落地清单：${checklistFile}`)
console.log('')
console.log('落地清单：')
for (const item of plan.checklist) console.log(`- [ ] ${item.hint}`)
console.log('')
console.log('审查 patch.diff 后走正常 PR 落地（design-scan 必须通过）；落地后运行 pnpm lab:sync -- --yes 复位 lab。')
