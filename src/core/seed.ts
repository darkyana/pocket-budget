import type { Settings } from './types'

export function defaultSettings(now: Date): Settings {
  const weekend = now.getDay() === 0 || now.getDay() === 6
  return {
    dayType: weekend ? '周末日' : '工作日',
    dayPlans: {
      工作日: [
        { name: '三餐', expect: 50 },
        { name: '交通', expect: 10 },
        { name: '咖啡', expect: 20 },
        { name: '日用', expect: 30 },
        { name: '其他', expect: 20 },
      ],
      周末日: [
        { name: '三餐', expect: 500 },
        { name: '交通', expect: 50 },
        { name: '咖啡', expect: 120 },
        { name: '日用', expect: 80 },
        { name: '其他', expect: 80 },
      ],
    },
    budgets: [
      { name: '购物', month: 800 },
      { name: '学习', month: 300 },
      { name: '娱乐', month: 400 },
    ],
    fixedExpenses: [
      { name: '家政服务', amount: 2000 },
      { name: '宠物粮', amount: 400 },
      { name: '物业费', amount: 3000 },
      { name: '会员年费', amount: 200, cycle: 'yearly' },
    ],
    accounts: ['现金', '储蓄卡', '备用金'],
  }
}
