import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim()

interface Pair {
  root: string
  write(rel: string, content: string): void
  read(rel: string): string
}

const pairs: string[] = []

function makePair(): Pair {
  const root = mkdtempSync(join(tmpdir(), 'lab-pair-'))
  pairs.push(root)
  mkdirSync(join(root, 'src', 'app'), { recursive: true })
  mkdirSync(join(root, 'lab', 'app'), { recursive: true })
  const css = readFileSync(join(ROOT, 'src', 'styles.css'), 'utf8')
  const ts = readFileSync(join(ROOT, 'src', 'app', 'format.ts'), 'utf8')
  writeFileSync(join(root, 'src', 'styles.css'), css)
  writeFileSync(join(root, 'src', 'app', 'format.ts'), ts)
  writeFileSync(join(root, 'lab', 'styles.css'), css)
  writeFileSync(join(root, 'lab', 'app', 'format.ts'), ts)
  writeBaseline(root)
  return {
    root,
    write: (rel, content) => writeFileSync(join(root, rel), content),
    read: (rel) => readFileSync(join(root, rel), 'utf8'),
  }
}

function sha256(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`
}

function writeBaseline(root: string, files: string[] = ['src/app/format.ts', 'src/styles.css']): string {
  execSync('git init -q && git add src lab && git -c user.email=t@t -c user.name=t commit -qm base', { cwd: root })
  const commit = execSync('git rev-parse HEAD', { cwd: root }).toString().trim()
  const baseline = {
    commit,
    files: files.map((src) => ({ src, hash: sha256(readFileSync(join(root, src), 'utf8')) })),
  }
  writeFileSync(join(root, 'lab', 'BASELINE.json'), `${JSON.stringify(baseline, null, 2)}\n`)
  return commit
}

const lib = () => import('../scripts/lab-pair.mjs')

const accentOf = (css: string) => css.match(/--accent: [^;]+;/)![0]
const swapAccent = (css: string, to: string) => css.replace(accentOf(css), `--accent: ${to};`)
const inkOf = (css: string) => css.match(/--ink: [^;]+;/)![0]
const swapInk = (css: string, to: string) => css.replace(inkOf(css), `--ink: ${to};`)

afterEach(() => {
  for (const root of pairs) rmSync(root, { recursive: true, force: true })
})

describe('sync：目录对重新对齐', () => {
  it('src 与 lab 无漂移时报告为空且不写入', async () => {
    const pair = makePair()
    const before = pair.read('lab/styles.css')
    const baselineBefore = pair.read('lab/BASELINE.json')
    const { syncPlan, applySync } = await lib()
    const plan = syncPlan(pair.root)
    expect(plan.entries.every((e: any) => e.status === 'clean')).toBe(true)
    expect(plan.hasUpdates).toBe(false)
    expect(plan.hasConflicts).toBe(false)
    const result = applySync(pair.root, plan)
    expect(result.written).toEqual([])
    expect(pair.read('lab/styles.css')).toBe(before)
    expect(pair.read('lab/BASELINE.json')).toBe(baselineBefore)
  })

  it('src 演进、lab 未动：报告逐规则变更，确认后 lab 与 src 逐字一致且基线更新', async () => {
    const pair = makePair()
    const src = pair.read('src/styles.css')
    const accentBefore = accentOf(src)
    const evolved = swapAccent(src, '#31567a')
      .replace('body {\n  background: var(--bg-outside);', 'body {\n  background: var(--bg-outside);\n  min-height: 100dvh;')
    pair.write('src/styles.css', evolved)
    pair.write('src/app/format.ts', pair.read('src/app/format.ts').replace('¥', '￥'))
    const { syncPlan, applySync } = await lib()
    const plan = syncPlan(pair.root)
    const cssEntry = plan.entries.find((e: any) => e.src === 'src/styles.css')!
    expect(cssEntry.status).toBe('update')
    const keys = cssEntry.changes.map((c: any) => c.key)
    expect(keys).toContain('--accent')
    expect(keys).toContain('body')
    expect(cssEntry.changes.find((c: any) => c.key === '--accent')!.from).toContain(accentBefore)
    const tsEntry = plan.entries.find((e: any) => e.src === 'src/app/format.ts')!
    expect(tsEntry.status).toBe('update')
    const result = applySync(pair.root, plan)
    expect(result.written).toContain('src/styles.css')
    expect(pair.read('lab/styles.css')).toBe(evolved)
    expect(pair.read('lab/app/format.ts')).toBe(pair.read('src/app/format.ts'))
    const baseline = JSON.parse(pair.read('lab/BASELINE.json'))
    for (const f of baseline.files) {
      expect(f.hash).toBe(sha256(readFileSync(join(pair.root, f.src), 'utf8')))
    }
  })

  it('两侧同改同一 token：显式冲突，不静默覆盖 lab', async () => {
    const pair = makePair()
    const base = pair.read('lab/styles.css')
    const accentBefore = accentOf(base)
    pair.write('src/styles.css', swapAccent(base, '#111111'))
    pair.write('lab/styles.css', swapAccent(base, '#222222'))
    const { syncPlan, applySync } = await lib()
    const plan = syncPlan(pair.root)
    const cssEntry = plan.entries.find((e: any) => e.src === 'src/styles.css')!
    expect(cssEntry.status).toBe('conflict')
    const conflict = cssEntry.changes.find((c: any) => c.key === '--accent')!
    expect(conflict.kind).toBe('conflict')
    expect(conflict.from).toContain(accentBefore)
    expect(conflict.to).toContain('#222222')
    applySync(pair.root, plan)
    expect(pair.read('lab/styles.css')).toBe(swapAccent(base, '#222222'))
  })

  it('css 混合演进：src 改 token、lab 改另一规则 → 合并两侧，无冲突', async () => {
    const pair = makePair()
    const base = pair.read('lab/styles.css')
    pair.write('src/styles.css', swapAccent(base, '#31567a'))
    const drifted = base.replace(
      'body {\n  background: var(--bg-outside);',
      'body {\n  background: var(--bg-outside);\n  min-height: 100dvh;',
    )
    pair.write('lab/styles.css', drifted)
    const { syncPlan, applySync } = await lib()
    const plan = syncPlan(pair.root)
    const cssEntry = plan.entries.find((e: any) => e.src === 'src/styles.css')!
    expect(cssEntry.status).toBe('merge')
    expect(plan.hasConflicts).toBe(false)
    applySync(pair.root, plan)
    const merged = pair.read('lab/styles.css')
    expect(merged).toContain('--accent: #31567a;')
    expect(merged).toContain('min-height: 100dvh;')
    expect(merged).toBe(swapAccent(drifted, '#31567a'))
  })

  it('lab 新增规则、src 未动 → 漂移保留；src 演进 + lab 新增规则 → 新增规则并入', async () => {
    const pair = makePair()
    const base = pair.read('lab/styles.css')
    const withNewRule = `${base}\n.lab-demo-flag {\n  border: 2px solid var(--accent);\n}\n`
    pair.write('lab/styles.css', withNewRule)
    pair.write('src/styles.css', swapAccent(base, '#31567a'))
    const { syncPlan, applySync } = await lib()
    const plan = syncPlan(pair.root)
    const cssEntry = plan.entries.find((e: any) => e.src === 'src/styles.css')!
    expect(cssEntry.status).toBe('merge')
    const driftKeys = cssEntry.changes.filter((c: any) => c.kind === 'lab-drift').map((c: any) => c.key)
    expect(driftKeys).toContain('.lab-demo-flag')
    applySync(pair.root, plan)
    const merged = pair.read('lab/styles.css')
    expect(merged).toContain('--accent: #31567a;')
    expect(merged).toContain('.lab-demo-flag')
  })

  it('ts 文件两侧同改 → 整文件冲突，不写入', async () => {
    const pair = makePair()
    pair.write('src/app/format.ts', pair.read('src/app/format.ts').replace('¥', '￥'))
    pair.write('lab/app/format.ts', pair.read('lab/app/format.ts').replace('¥', '¤'))
    const labBefore = pair.read('lab/app/format.ts')
    const { syncPlan, applySync } = await lib()
    const plan = syncPlan(pair.root)
    const tsEntry = plan.entries.find((e: any) => e.src === 'src/app/format.ts')!
    expect(tsEntry.status).toBe('conflict')
    expect(tsEntry.changes[0].kind).toBe('conflict')
    applySync(pair.root, plan)
    expect(pair.read('lab/app/format.ts')).toBe(labBefore)
  })
})

describe('pushback：lab→src 补丁与落地清单', () => {
  it('lab 漂移、src 未动：补丁应用到 src 后与目标一致，清单触发对应提示', async () => {
    const pair = makePair()
    const base = pair.read('src/styles.css')
    const drifted = swapAccent(base, '#31567a')
      .replace('--space-3: 12px;', '--space-3: 14px;')
    pair.write('lab/styles.css', drifted)
    pair.write('lab/app/format.ts', pair.read('src/app/format.ts').replace('¥', '￥'))
    const { pushbackPlan, writePushback } = await lib()
    const plan = pushbackPlan(pair.root)
    writePushback(pair.root, plan)
    expect(plan.changed.map((c: any) => c.src)).toEqual(['src/app/format.ts', 'src/styles.css'])
    expect(plan.patch).toContain('--accent')
    const triggerIds = plan.checklist.map((c: any) => c.id)
    expect(triggerIds).toContain('theme-color')
    expect(triggerIds).toContain('design-rules-ladder')
    expect(triggerIds).toContain('design-scan')
    execSync(`git apply ${join(pair.root, 'lab', 'pushback', 'patch.diff')}`, { cwd: pair.root })
    expect(pair.read('src/styles.css')).toBe(drifted)
    expect(pair.read('src/app/format.ts')).toBe(pair.read('lab/app/format.ts'))
  })

  it('两侧都动过：补丁基于当前 src 计算，src 独有更新被吸收而非回退', async () => {
    const pair = makePair()
    const base = pair.read('src/styles.css')
    const accentBefore = accentOf(base)
    pair.write('src/styles.css', swapInk(base, '#241f18'))
    pair.write('lab/styles.css', swapAccent(base, '#31567a'))
    const { pushbackPlan, writePushback } = await lib()
    const plan = pushbackPlan(pair.root)
    writePushback(pair.root, plan)
    expect(plan.changed.map((c: any) => c.src)).toEqual(['src/styles.css'])
    execSync(`git apply ${join(pair.root, 'lab', 'pushback', 'patch.diff')}`, { cwd: pair.root })
    const src = pair.read('src/styles.css')
    expect(src).toContain('--ink: #241f18;')
    expect(src).toContain('--accent: #31567a;')
    expect(src).not.toContain(accentBefore)
  })

  it('无漂移时不产补丁', async () => {
    const pair = makePair()
    const { pushbackPlan } = await lib()
    const plan = pushbackPlan(pair.root)
    expect(plan.changed).toEqual([])
    expect(plan.patch).toBe('')
    expect(plan.checklist).toEqual([])
  })
})

describe('CLI 入口', () => {
  it('lab-sync 无 --yes 时只报告不写入；--yes 后写入', async () => {
    const pair = makePair()
    const evolved = swapAccent(pair.read('src/styles.css'), '#31567a')
    pair.write('src/styles.css', evolved)
    const script = join(ROOT, 'scripts', 'lab-sync.mjs')
    const dry = execSync(`node ${JSON.stringify(script)} --root ${JSON.stringify(pair.root)}`).toString()
    expect(dry).toContain('--accent')
    expect(dry).toContain('未写入')
    expect(pair.read('lab/styles.css')).not.toContain('--accent: #31567a;')
    execSync(`node ${JSON.stringify(script)} --root ${JSON.stringify(pair.root)} --yes`)
    expect(pair.read('lab/styles.css')).toBe(evolved)
  })

  it('lab-sync 有冲突时退出码非 0；lab-pushback 产出补丁与清单文件', async () => {
    const pair = makePair()
    const base = pair.read('lab/styles.css')
    pair.write('src/styles.css', swapAccent(base, '#111111'))
    pair.write('lab/styles.css', swapAccent(base, '#222222'))
    const syncScript = join(ROOT, 'scripts', 'lab-sync.mjs')
    let conflictExit = 0
    try {
      execSync(`node ${JSON.stringify(syncScript)} --root ${JSON.stringify(pair.root)} --yes`)
    } catch (e: any) {
      conflictExit = e.status
    }
    expect(conflictExit).toBe(1)
    expect(pair.read('lab/styles.css')).toContain('--accent: #222222;')
    const pushbackScript = join(ROOT, 'scripts', 'lab-pushback.mjs')
    const out = execSync(`node ${JSON.stringify(pushbackScript)} --root ${JSON.stringify(pair.root)}`).toString()
    expect(out).toContain('patch.diff')
    expect(existsSync(join(pair.root, 'lab', 'pushback', 'CHECKLIST.md'))).toBe(true)
  })
})
