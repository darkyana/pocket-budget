import { openDB, type IDBPDatabase } from 'idb'
import type { PersistedState } from '../core/types'
import { freshState, migrate } from './migrate'

const DB_NAME = 'pocket-budget'
const STORE = 'state'
const KEY = 'main'

let dbp: Promise<IDBPDatabase> | null = null

function db(): Promise<IDBPDatabase> {
  dbp ??= openDB(DB_NAME, 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE)
    },
  })
  return dbp
}

export async function loadState(): Promise<PersistedState> {
  const raw = await (await db()).get(STORE, KEY)
  const state = migrate(raw)
  if (state !== raw) await saveState(state)
  return state
}

export async function saveState(state: PersistedState): Promise<void> {
  await (await db()).put(STORE, state, KEY)
}

export async function requestPersistence(): Promise<void> {
  if (typeof navigator === 'undefined') return
  try {
    await navigator.storage?.persist?.()
  } catch {}
}

export { freshState }
