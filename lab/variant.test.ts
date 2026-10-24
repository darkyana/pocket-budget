import { describe, expect, it } from 'vitest'
import { variantFromSearch, variantIdsFromFiles, searchWithVariant, BASELINE_VARIANT } from './variant'

describe('variantFromSearch', () => {
  it('无参数时返回 baseline', () => {
    expect(variantFromSearch('')).toBe(BASELINE_VARIANT)
    expect(variantFromSearch('?foo=1')).toBe(BASELINE_VARIANT)
  })

  it('读取 variant 参数', () => {
    expect(variantFromSearch('?variant=harbor-dusk')).toBe('harbor-dusk')
    expect(variantFromSearch('?foo=1&variant=noon-tide&bar=2')).toBe('noon-tide')
  })

  it('variant 为空或 baseline 时返回 baseline', () => {
    expect(variantFromSearch('?variant=')).toBe(BASELINE_VARIANT)
    expect(variantFromSearch('?variant=baseline')).toBe(BASELINE_VARIANT)
  })
})

describe('searchWithVariant', () => {
  it('非 baseline 时写入参数并保留其余参数', () => {
    expect(searchWithVariant('?foo=1', 'harbor-dusk')).toBe('?foo=1&variant=harbor-dusk')
    expect(searchWithVariant('?variant=old&foo=1', 'noon-tide')).toBe('?foo=1&variant=noon-tide')
  })

  it('baseline 时移除参数', () => {
    expect(searchWithVariant('?variant=harbor-dusk&foo=1', BASELINE_VARIANT)).toBe('?foo=1')
    expect(searchWithVariant('', BASELINE_VARIANT)).toBe('')
  })
})

describe('variantIdsFromFiles', () => {
  it('从 css 文件名提取 id，按字典序稳定排列', () => {
    expect(variantIdsFromFiles(['noon-tide.css', 'harbor-dusk.css'])).toEqual(['harbor-dusk', 'noon-tide'])
  })

  it('忽略非 css 文件与保留名 baseline', () => {
    expect(variantIdsFromFiles(['README.md', 'baseline.css', 'demo.css'])).toEqual(['demo'])
  })

  it('接受 import.meta.glob 的相对路径 key', () => {
    expect(variantIdsFromFiles(['../variants/harbor-dusk.css', '../variants/noon-tide.css'])).toEqual([
      'harbor-dusk',
      'noon-tide',
    ])
  })
})
