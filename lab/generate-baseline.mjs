import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
  commit = execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], { cwd: ROOT, encoding: 'utf8' }).trim()
} catch {
  console.error(`generate-baseline: 无法解析 git 引用 "${ref}"（在 ${ROOT} 下）`)
  process.exit(1)
}

const FIXED_FILES = [
  'src/styles.css',
  'src/app/format.ts',
  'src/app/statusColor.ts',
  'src/app/store.ts',
  'src/app/toast.ts',
  'src/storage/migrate.ts',
  'src/storage/voucher.ts',
]

function dir(rel) {
  return readdirSync(join(ROOT, rel))
    .filter((name) => /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name))
    .map((name) => `${rel}/${name}`)
    .sort()
}

const srcs = [
  ...FIXED_FILES,
  ...dir('src/app/components'),
  ...dir('src/app/pages'),
  ...dir('src/core'),
].sort()

const files = srcs.map((src) => ({
  src,
  hash: `sha256:${createHash('sha256').update(readFileSync(join(ROOT, src))).digest('hex')}`,
}))

const baseline = { commit, files }
writeFileSync(join(ROOT, 'lab', 'BASELINE.json'), `${JSON.stringify(baseline, null, 2)}\n`)
console.log(`lab/BASELINE.json: ${files.length} files @ ${commit}`)
