import type {
  OOStructStateEntry,
  OOStructSnapshotEntry,
} from '../../.types/index.js'

/**
 * Serializes a field state entry into a snapshot entry.
 *
 * @param stateEntry - The internal state entry to serialize.
 * @returns The serialized snapshot entry.
 */
export function parseStateEntryToSnapshotEntry<K>(
  stateEntry: OOStructStateEntry<K>
): OOStructSnapshotEntry<K> {
  return {
    __uuidv7: stateEntry.__uuidv7,
    __value: structuredClone(stateEntry.__value),
    __after: stateEntry.__after,
    __overwrites: Array.from(stateEntry.__overwrites),
  }
}
