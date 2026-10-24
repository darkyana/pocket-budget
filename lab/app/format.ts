const LOCALE = 'zh-CN'

export const money = (n: number) => {
  const rounded = Math.round(n)
  return `¥${(rounded === 0 ? 0 : rounded).toLocaleString(LOCALE)}`
}

export const moneyExact = (n: number) =>
  `¥${(Math.abs(n) < 0.005 ? 0 : n).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function todayHeadline(now: Date): string {
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 周${WEEKDAYS[now.getDay()]}`
}
