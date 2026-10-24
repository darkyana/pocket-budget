import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function srcFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name)
    if (name.isDirectory()) out.push(...srcFiles(p))
    else if (/\.(ts|tsx)$/.test(name.name)) out.push(p)
  }
  return out
}

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim()

describe('lab 隔离守卫', () => {
  it('主 tsconfig 不包含 lab', () => {
    const tsconfig = JSON.parse(readFileSync(join(ROOT, 'tsconfig.json'), 'utf8'))
    const includes: string[] = tsconfig.include ?? []
    expect(includes.some((i) => i.includes('lab'))).toBe(false)
  })

  it('src 不 import lab', () => {
    const offenders: string[] = []
    for (const file of srcFiles(join(ROOT, 'src'))) {
      const text = readFileSync(file, 'utf8')
      if (/(from\s+|import\s*\(?\s*['"])(\.\.\/)*lab\//.test(text)) offenders.push(file)
    }
    expect(offenders).toEqual([])
  })

  it('主构建脚本不引用 lab', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    expect(pkg.scripts.build.includes('lab')).toBe(false)
  })
})

describe('lab 基线', () => {
  const baselinePath = join(ROOT, 'lab', 'BASELINE.json')

  it('BASELINE.json 存在且格式稳定', () => {
    expect(existsSync(baselinePath)).toBe(true)
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
    expect(typeof baseline.commit).toBe('string')
    expect(baseline.commit).toMatch(/^[0-9a-f]{7,40}$/)
    expect(Array.isArray(baseline.files)).toBe(true)
    for (const entry of baseline.files) {
      expect(entry.src).toMatch(/^src\//)
      expect(entry.hash).toMatch(/^sha256:[0-9a-f]{64}$/)
    }
  })

  it('镜像文件与基线哈希一致（token 表、样式表、全部组件与页面）', () => {
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
    const srcs = baseline.files.map((f: { src: string }) => f.src)
    expect(srcs).toContain('src/styles.css')
    for (const name of readdirSync(join(ROOT, 'src/app/components'))) {
      expect(srcs).toContain(`src/app/components/${name}`)
    }
    for (const name of readdirSync(join(ROOT, 'src/app/pages'))) {
      expect(srcs).toContain(`src/app/pages/${name}`)
    }
    for (const { src, hash } of baseline.files) {
      const labPath = join(ROOT, 'lab', src.replace(/^src\//, ''))
      expect(existsSync(labPath), labPath).toBe(true)
      const digest = createHash('sha256').update(readFileSync(labPath)).digest('hex')
      expect(`sha256:${digest}`).toBe(hash)
    }
  })
})
