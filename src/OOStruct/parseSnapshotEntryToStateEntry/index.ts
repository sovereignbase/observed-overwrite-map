import type {
  OOStructSnapshotEntry,
  OOStructStateEntry,
} from '../../.types/index.js'
import { isUuidV7, prototype, safeStructuredClone } from '@sovereignbase/utils'

/**
 * Validates and converts a serialized field entry into internal replica state.
 *
 * Invalid entries are rejected by returning `false`.
 *
 * @param defaultValue - The default value for the field used for runtime type comparison.
 * @param snapshotEntry - The serialized entry to validate and parse.
 * @returns The parsed state entry, or `false` when the entry is invalid.
 */
export function parseSnapshotEntryToStateEntry<V>(
  defaultValue: V,
  snapshotEntry: OOStructSnapshotEntry<V>
): OOStructStateEntry<V> | false {
  if (
    prototype(snapshotEntry) !== 'record' ||
    !Object.hasOwn(snapshotEntry, '__value') ||
    !isUuidV7(snapshotEntry.__uuidv7) ||
    !isUuidV7(snapshotEntry.__after) ||
    !Array.isArray(snapshotEntry.__overwrites)
  )
    return false

  const [cloned, copiedValue] = safeStructuredClone(snapshotEntry.__value)
  if (!cloned || prototype(copiedValue) !== prototype(defaultValue))
    return false

  const overwrites = new Set<string>([])
  for (const overwrite of snapshotEntry.__overwrites) {
    if (
      !isUuidV7(overwrite) ||
      overwrite ===
        snapshotEntry.__uuidv7 /**if it was actually overwritten the current uuid would be different so this must be malicious*/
    )
      continue
    overwrites.add(overwrite)
  }

  if (!overwrites.has(snapshotEntry.__after)) return false

  return {
    __uuidv7: snapshotEntry.__uuidv7,
    __value: copiedValue,
    __after: snapshotEntry.__after,
    __overwrites: overwrites,
  }
}
