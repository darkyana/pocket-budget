export const money = (n: number) => `¥${Math.round(n)}`

export const moneyExact = (n: number) => `¥${n.toFixed(2)}`

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function todayHeadline(now: Date): string {
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 周${WEEKDAYS[now.getDay()]}`
}
