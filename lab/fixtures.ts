import { defaultSettings } from './core/seed'
import { monthKeyOf, yearKeyOf } from './core/time'
import { SCHEMA_VERSION, type MoneyRecord, type PersistedState } from './core/types'

let seq = 0
const uid = () => `lab-${(++seq).toString(36)}`

export function fixtureState(now = new Date()): PersistedState {
  const at = (dayOffset: number, hour = 12) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset, hour).getTime()
  const settings = {
    ...defaultSettings(now),
    accounts: ['现金', '储蓄卡', '备用金', '电子钱包'],
    lastAccount: '储蓄卡',
    lastTransferTo: '备用金',
  }
  const records: MoneyRecord[] = [
    { id: uid(), ts: at(0, 8), kind: 'routine', category: '三餐', amount: 12, note: '豆浆油条', account: '现金' },
    { id: uid(), ts: at(0, 13), kind: 'routine', category: '咖啡', amount: 18, note: '', account: '电子钱包' },
    { id: uid(), ts: at(1, 9), kind: 'routine', category: '交通', amount: 6, note: '' },
    { id: uid(), ts: at(1, 12), kind: 'routine', category: '三餐', amount: 28, note: '', account: '电子钱包' },
    { id: uid(), ts: at(2, 19), kind: 'routine', category: '日用', amount: 45, note: '示例日用品', account: '储蓄卡' },
    { id: uid(), ts: at(3, 12), kind: 'routine', category: '三餐', amount: 32, note: '', account: '电子钱包' },
    { id: uid(), ts: at(4, 15), kind: 'routine', category: '咖啡', amount: 22, note: '示例咖啡馆', account: '电子钱包' },
    { id: uid(), ts: at(5, 15), kind: 'budget', budget: '购物', dir: 'out', amount: 129, note: '示例收纳盒', account: '储蓄卡' },
    { id: uid(), ts: at(8, 20), kind: 'budget', budget: '娱乐', dir: 'out', amount: 89, note: '', account: '电子钱包' },
    { id: uid(), ts: at(9, 10), kind: 'budget', budget: '学习', dir: 'in', amount: 50, note: '示例返现', account: '储蓄卡' },
    { id: uid(), ts: at(12, 14), kind: 'budget', budget: '购物', dir: 'out', amount: 76, note: '', account: '现金' },
    { id: uid(), ts: at(4, 21), kind: 'transfer', from: '储蓄卡', to: '备用金', amount: 500, note: '月底归集' },
    { id: uid(), ts: at(6, 10), kind: 'fixed', item: '物业费', amount: 3000, periodKey: monthKeyOf(now), paid: true, account: '储蓄卡' },
    { id: uid(), ts: at(6, 11), kind: 'fixed', item: '会员年费', amount: 200, periodKey: yearKeyOf(now), paid: true, account: '电子钱包' },
  ]
  return { schemaVersion: SCHEMA_VERSION, settings, records }
}
