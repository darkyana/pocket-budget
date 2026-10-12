// 生成 PWA 图标：npm run icons（一次性，产物已入库；改设计后重跑）
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

// 图标：口袋（绿）+ 半露出的硬币（奶油底），沿用应用配色
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#f4f2ee"/>
  <circle cx="256" cy="196" r="64" fill="#f4f2ee" stroke="#2f6f4f" stroke-width="14"/>
  <rect x="104" y="180" width="304" height="236" rx="64" fill="#2f6f4f"/>
  <rect x="136" y="228" width="150" height="20" rx="10" fill="#f4f2ee" opacity="0.85"/>
</svg>`

mkdirSync('public/icons', { recursive: true })

const targets = [
  [192, 'public/icons/icon-192.png'],
  [512, 'public/icons/icon-512.png'],
  [512, 'public/icons/maskable-512.png'],
  [180, 'public/apple-touch-icon.png'],
]
for (const [size, file] of targets) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(file)
  console.log(`生成 ${file} (${size}x${size})`)
}
