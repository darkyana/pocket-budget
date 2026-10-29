import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mirrorScope } from '../scripts/lab-pair.mjs'

const LAB = dirname(fileURLToPath(import.meta.url))

const args = process.argv.slice(2)
function opt(name) {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}

const ROOT = opt('--root') ?? join(LAB, '..')
const ref = opt('--commit') ?? opt('--ref') ?? 'HEAD'

let commit
try {
  commit = execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim()
} catch {
  console.error(`generate-baseline: 无法解析 git 引用 "${ref}"（在 ${ROOT} 下）`)
  process.exit(1)
}

const srcs = mirrorScope(ROOT)

const files = srcs.map((src) => ({
  src,
  hash: `sha256:${createHash('sha256').update(readFileSync(join(ROOT, src))).digest('hex')}`,
}))

const baseline = { commit, files }
writeFileSync(join(ROOT, 'lab', 'BASELINE.json'), `${JSON.stringify(baseline, null, 2)}\n`)
console.log(`lab/BASELINE.json: ${files.length} files @ ${commit}`)
