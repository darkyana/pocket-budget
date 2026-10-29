export interface SyncChange {
  key: string
  from: string
  to: string
  kind?: 'src-evolved' | 'lab-drift' | 'conflict'
  srcTo?: string
}

export interface SyncEntry {
  src: string
  status: 'clean' | 'update' | 'merge' | 'drift' | 'conflict'
  changes: SyncChange[]
  merged?: string
  isNew?: boolean
}

export interface SyncPlan {
  entries: SyncEntry[]
  hasUpdates: boolean
  hasConflicts: boolean
}

export interface ChecklistItem {
  id: string
  hint: string
}

export interface PushbackPlan {
  changed: { src: string; from: string; target: string }[]
  patch: string
  checklist: ChecklistItem[]
}

export declare function mirrorPath(srcPath: string): string
export declare function mirrorScope(root: string): string[]
export declare function readBaseline(root: string): { commit: string; files: { src: string; hash: string }[] }
export declare function parseCssUnits(css: string): { key: string; text: string; line: number }[]
export declare function syncPlan(root: string): SyncPlan
export declare function applySync(root: string, plan: SyncPlan): { written: string[]; skipped: string[] }
export declare function pushbackPlan(root: string): PushbackPlan
export declare function writePushback(root: string, plan: PushbackPlan): { patchFile: string | null; checklistFile: string | null }
