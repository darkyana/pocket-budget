import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useApp } from './store'
import { freshState } from '../storage/migrate'

vi.mock('../storage/db', () => ({
  saveState: vi.fn(async () => {}),
  loadState: vi.fn(async () => freshState()),
  requestPersistence: vi.fn(async () => {}),
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 23, 0, 15))
  useApp.setState({ ...freshState() })
})
afterEach(() => vi.useRealTimers())

describe('openQuickRetro 定位', () => {
  it('默认打开回顾页不带定位', () => {
    useApp.getState().openQuickRetro()
    expect(useApp.getState().overlay).toBe('quickRetro')
    expect(useApp.getState().retroFocus).toBeNull()
  })

  it('带 budget 定位打开；回顾页消费后清空，重复打开不再定位', () => {
    useApp.getState().openQuickRetro('budget')
    expect(useApp.getState().overlay).toBe('quickRetro')
    expect(useApp.getState().retroFocus).toBe('budget')
    expect(useApp.getState().consumeRetroFocus()).toBe('budget')
    expect(useApp.getState().retroFocus).toBeNull()
    expect(useApp.getState().consumeRetroFocus()).toBeNull()
  })

  it('关闭覆盖层时定位一并清空', () => {
    useApp.getState().openQuickRetro('budget')
    useApp.getState().closeOverlay()
    expect(useApp.getState().overlay).toBeNull()
    expect(useApp.getState().retroFocus).toBeNull()
  })
})
