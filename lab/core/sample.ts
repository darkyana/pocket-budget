import { isRestDay } from './holidays'
import { monthKeyOf, yearKeyOf } from './time'
import type { MoneyRecord, RoutineBucket } from './types'
import { defaultSettings } from './seed'

const DAY_RATIOS = [0.58, 1.2, 0.95, 0.6, 1.05, 0.45, 0.84, 0.72, 1.3, 0.5, 0.9, 0.68, 1.12, 0.35, 0.78, 0.55, 1.42, 0.92, 0.4, 0.65, 1.24, 0.86, 0.52]

const SIDE_WEIGHTS: Array<Record<string, number>> = [
  { 交通: 1.3, 日用: 0.9, 其他: 0.8 },
  { 交通: 0.7, 日用: 1.6, 其他: 0.7 },
  { 交通: 0.9, 日用: 0.6, 其他: 1.5 },
  { 交通: 1.1, 日用: 0.9, 其他: 1.0 },
]

const WORK_NOTES: Record<string, string[]> = {
  三餐: ['', '', '外卖', '和朋友聚餐'],
  咖啡: ['', '', '续杯'],
  交通: ['地铁', '', '公交'],
  日用: ['超市采购', '日用品'],
  其他: ['快递', ''],
}

const REST_NOTES: Record<string, string[]> = {
  三餐: ['家庭聚餐', '早午餐', '买菜做饭', ''],
  咖啡: ['', '', '续杯'],
  交通: ['打车', ''],
  日用: ['超市采购', ''],
  其他: ['快递', ''],
}

const TODAY_RATIOS = [0.55, 0.96, 1.4, 0, 0]

export function sampleRecords(now: Date): MoneyRecord[] {
  const plans = defaultSettings(now).dayPlans
  let n = 0
  const nid = () => `seed-${(n += 1)}`
  const at = (dayOffset: number, hour: number, minute = 0) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset, hour, minute).getTime()
  const planFor = (d: Date): RoutineBucket[] =>
    (isRestDay(d) ? plans['周末日'] : plans['工作日']) ?? Object.values(plans)[0]
  const noteOf = (rest: boolean, name: string, seed: number) => {
    const pool = (rest ? REST_NOTES : WORK_NOTES)[name] ?? ['']
    return pool[seed % pool.length]
  }
  const accountOf = (name: string, amount: number, seed: number) =>
    name === '三餐' && amount >= 300 ? '储蓄卡' : seed % 2 === 0 ? '现金' : '储蓄卡'
  const records: MoneyRecord[] = []

  for (let d = Math.min(DAY_RATIOS.length, now.getDate() - 1); d >= 1; d--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d)
    const rest = isRestDay(date)
    const buckets = planFor(date)
    const ratio = DAY_RATIOS[(d - 1) % DAY_RATIOS.length]
    const weights = SIDE_WEIGHTS[(d - 1) % SIDE_WEIGHTS.length]
    const target = Math.round(buckets.reduce((s, b) => s + b.expect, 0) * ratio)
    const kept = buckets.filter((b) => b.name === '三餐' || keepBucket(b.name, d, rest))
    const raw = kept.map((b) => b.expect * ratio * (weights[b.name] ?? 1))
    const scale = raw.length > 0 ? target / raw.reduce((s, x) => s + x, 0) : 0
    const parts = kept.map((b, i) => ({ name: b.name, amt: Math.round(raw[i] * scale) }))
    const meal = parts.find((p) => p.name === '三餐')
    if (meal) meal.amt += target - parts.reduce((s, p) => s + p.amt, 0)
    for (const p of parts) {
      if (p.amt < 1) continue
      const account = accountOf(p.name, p.amt, d)
      if (p.name === '三餐' && p.amt >= 150) {
        const first = Math.round(p.amt * 0.6)
        records.push({ id: nid(), ts: at(d, 12, 10), kind: 'routine', category: p.name, amount: first, note: noteOf(rest, p.name, d), account })
        records.push({ id: nid(), ts: at(d, 19, 5), kind: 'routine', category: p.name, amount: p.amt - first, note: '', account })
      } else if (p.name === '咖啡' && p.amt >= 100) {
        const first = Math.round(p.amt * 0.55)
        records.push({ id: nid(), ts: at(d, 14, 25), kind: 'routine', category: p.name, amount: first, note: noteOf(rest, p.name, d), account })
        records.push({ id: nid(), ts: at(d, 16, 15), kind: 'routine', category: p.name, amount: p.amt - first, note: '', account })
      } else {
        const hour = p.name === '交通' ? 9 : p.name === '日用' ? 18 : p.name === '其他' ? 20 : 12
        records.push({ id: nid(), ts: at(d, hour, (d * 17 + hour * 3) % 60), kind: 'routine', category: p.name, amount: p.amt, note: noteOf(rest, p.name, d + hour), account })
      }
    }
  }

  const todayRest = isRestDay(now)
  planFor(now).forEach((b, i) => {
    const amt = Math.round(b.expect * (TODAY_RATIOS[i] ?? 0))
    if (amt < 1) return
    if (b.name === '三餐' && amt >= 150) {
      const first = Math.round(amt * 0.6)
      records.push({ id: nid(), ts: at(0, 11, 30), kind: 'routine', category: b.name, amount: first, note: todayRest ? '早午餐' : '', account: '储蓄卡' })
      records.push({ id: nid(), ts: at(0, 18, 40), kind: 'routine', category: b.name, amount: amt - first, note: '', account: '现金' })
    } else if (b.name === '咖啡' && amt >= 100) {
      const first = Math.round(amt * 0.55)
      records.push({ id: nid(), ts: at(0, 14, 10), kind: 'routine', category: b.name, amount: first, note: '和朋友', account: '现金' })
      records.push({ id: nid(), ts: at(0, 16, 20), kind: 'routine', category: b.name, amount: amt - first, note: '', account: '现金' })
    } else {
      const hour = b.name === '三餐' ? 12 : 15
      records.push({ id: nid(), ts: at(0, hour, 5), kind: 'routine', category: b.name, amount: amt, note: b.name === '交通' ? (todayRest ? '打车' : '地铁') : '', account: '现金' })
    }
  })

  const weekAgo = (now.getDay() + 6) % 7
  const weekHalf = Math.floor(weekAgo / 2)
  const weekThird = Math.floor(weekAgo / 3)
  const budget = (offset: number, hour: number, name: string, dir: 'out' | 'in', amount: number, note: string, account: string) => {
    records.push({ id: nid(), ts: at(offset, hour), kind: 'budget', budget: name, dir, amount, note, account })
  }
  budget(weekAgo, 20, '购物', 'out', 128, '台灯', '储蓄卡')
  budget(weekHalf, 15, '购物', 'out', 52, '收纳盒', '现金')
  budget(weekThird, 19, '学习', 'out', 22, '网课', '储蓄卡')
  budget(weekHalf, 20, '娱乐', 'out', 88, '电影票', '现金')
  budget(weekAgo, 21, '娱乐', 'out', 45, '桌游', '现金')
  budget(15, 14, '购物', 'out', 96, '网购', '储蓄卡')
  budget(12, 11, '购物', 'in', 60, '退款', '储蓄卡')
  budget(18, 16, '学习', 'out', 68, '书', '储蓄卡')
  budget(9, 19, '娱乐', 'out', 60, '演出票', '现金')

  const paidAt = Math.max(0, Math.min(6, now.getDate() - 1))
  records.push({ id: nid(), ts: at(paidAt, 10), kind: 'fixed', item: '物业费', amount: 3000, periodKey: monthKeyOf(now), paid: true, account: '储蓄卡' })
  records.push({ id: nid(), ts: at(paidAt, 11), kind: 'fixed', item: '会员年费', amount: 200, periodKey: yearKeyOf(now), paid: true, account: '现金' })

  records.push({ id: nid(), ts: at(4, 21), kind: 'transfer', from: '储蓄卡', to: '备用金', amount: 500, note: '月底归集' })
  records.push({ id: nid(), ts: at(10, 9), kind: 'transfer', from: '现金', to: '储蓄卡', amount: 300, note: '' })

  const cap = now.getTime()
  for (const r of records) if (r.ts > cap) r.ts = cap
  return records
}

function keepBucket(name: string, d: number, rest: boolean): boolean {
  if (name === '咖啡') return d % 3 !== 0
  if (name === '交通') return !rest || d % 2 === 0
  if (name === '日用') return rest || d % 4 === 0
  if (name === '其他') return d % 5 === 0
  return true
}
