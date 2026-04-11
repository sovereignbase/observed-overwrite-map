import type {
  CRStructState,
  CRStructSnapshot,
  CRStructStateEntry,
} from '../../../.types/index.js'
import { parseStateEntryToSnapshotEntry } from '../../../.helpers/parseStateEntryToSnapshotEntry/index.js'

export function __snapshot<T extends Record<string, unknown>>(
  crStructReplica: CRStructState<T>
): CRStructSnapshot<T> {
  const snapshot = {} as CRStructSnapshot<T>

  for (const [key, value] of Object.entries(crStructReplica)) {
    snapshot[key as keyof T] = parseStateEntryToSnapshotEntry(
      value as CRStructStateEntry<T[keyof T]>
    )
  }
  return snapshot
}
