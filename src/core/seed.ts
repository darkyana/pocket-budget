import type { Settings } from './types'

/** 首次启动的样例设置：沿用原型 DEFAULTS 的真实感数据；流水从空开始，绝不预埋假数据 */
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
      { name: '阿姨工资', amount: 2600 },
      { name: '狗粮', amount: 420 },
      { name: '房租', amount: 2600 },
      { name: '视频会员年费', amount: 199, cycle: 'yearly' },
    ],
    accounts: ['现金', '工资卡', '投资账户'],
  }
}
