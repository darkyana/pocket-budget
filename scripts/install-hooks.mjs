#!/usr/bin/env node
/**
 * 安装 git 钩子：把 scripts/hooks/ 下的钩子复制进 .git/hooks/ 并赋予执行权限。
 *
 * 用法：npm run hooks:install
 */
import { execFileSync } from 'node:child_process'
import { cpSync, chmodSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const src = join(root, 'scripts', 'hooks')
const dest = join(root, '.git', 'hooks')

if (!existsSync(src)) {
  console.error('未找到 scripts/hooks/，无可安装的钩子')
  process.exit(1)
}

for (const name of readdirSync(src)) {
  cpSync(join(src, name), join(dest, name))
  chmodSync(join(dest, name), 0o755)
  console.log(`已安装 ${name}`)
}
