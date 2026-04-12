import { overwriteAndReturnSnapshotEntry } from '../../../.helpers/index.js'
import type {
  CRStructState,
  CRStructDelta,
  CRStructChange,
} from '../../../.types/index.js'

/**
 * Resets one field or the entire struct back to default values.
 *
 * Each touched field is overwritten from the replica defaults and contributes a
 * visible change projection plus a serialized delta describing the reset.
 *
 * @param crStructReplica - The replica state to reset.
 * @param key - The optional field key to reset. When omitted, every field is reset.
 *
 * @returns
 * The visible change projection and serialized delta for the reset, or `false`
 * when a keyed reset targets a field outside the replica.
 *
 * Time complexity: O(k + c + t), worst case O(k + c + t)
 *
 * k = number of fields being reset
 * c = cloned and serialized payload size across reset field values
 * t = tombstone count serialized across reset fields
 *
 * Space complexity: O(k + c + t)
 */
export function __delete<T extends Record<string, unknown>>(
  crStructReplica: CRStructState<T>,
  key?: keyof T
): { change: CRStructChange<T>; delta: CRStructDelta<T> } | false {
  const delta: CRStructDelta<T> = {}
  const change: CRStructChange<T> = {}

  if (key !== undefined) {
    if (!Object.hasOwn(crStructReplica.defaults, key)) return false
    const value = crStructReplica.defaults[key]
    delta[key] = overwriteAndReturnSnapshotEntry<T>(key, value, crStructReplica)
    change[key] = structuredClone(value)
  } else {
    for (const [key, value] of Object.entries(crStructReplica.defaults)) {
      delta[key as keyof T] = overwriteAndReturnSnapshotEntry<T>(
        key,
        value as T[keyof T],
        crStructReplica
      )
      change[key as keyof T] = structuredClone(value as T[keyof T])
    }
  }
  return { change, delta }
}
