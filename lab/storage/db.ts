import type { PersistedState } from '../core/types'
import { fixtureState } from '../fixtures'

let saved: PersistedState | null = null

export async function loadState(): Promise<PersistedState> {
  return saved ?? fixtureState()
}

export async function saveState(state: PersistedState): Promise<void> {
  saved = state
}

export async function requestPersistence(): Promise<void> {}

export { freshState } from './migrate'
