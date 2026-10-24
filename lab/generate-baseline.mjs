import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const LAB = dirname(fileURLToPath(import.meta.url))
const ROOT = join(LAB, '..')

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

const commit = execSync('git rev-parse lab/25-design-lab', { cwd: ROOT }).toString().trim()

const baseline = { commit, files }
writeFileSync(join(LAB, 'BASELINE.json'), `${JSON.stringify(baseline, null, 2)}\n`)
console.log(`lab/BASELINE.json: ${files.length} files @ ${commit}`)
