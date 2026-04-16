import type {
  CRStructState,
  CRStructSnapshot,
  CRStructStateEntry,
} from '../../../.types/index.js'
import { transformStateEntryToSnapshotEntry } from '../../../.helpers/index.js'

/**
 * Creates the current serializable snapshot projection from replica state.
 *
 * Each processed state entry is converted into its serializable snapshot form.
 *
 * @param crStructReplica - The replica state to project into a snapshot.
 *
 * @returns
 * The current serializable snapshot projection of the replica state.
 *
 * Time complexity: O(k + t + c), worst case O(k + t + c)
 *
 * k = state entry count processed into snapshot entries
 * t = tombstone count copied into snapshot entries
 * c = cloned payload size across snapshot values
 *
 * Space complexity: O(k + t + c)
 */
export function __snapshot<T extends Record<string, unknown>>(
  crStructReplica: CRStructState<T>
): CRStructSnapshot<T> {
  const snapshot = {} as CRStructSnapshot<T>

  for (const [key, value] of Object.entries(crStructReplica.entries)) {
    snapshot[key as keyof T] = transformStateEntryToSnapshotEntry(
      value as CRStructStateEntry<T[keyof T]>
    )
  }
  return snapshot
}
