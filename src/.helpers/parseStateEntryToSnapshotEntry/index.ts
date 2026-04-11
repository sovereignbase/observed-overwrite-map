import type {
  CRStructStateEntry,
  CRStructSnapshotEntry,
} from '../../.types/index.js'

/**
 * Serializes a field state entry into a snapshot entry.
 *
 * @param stateEntry - The internal state entry to serialize.
 * @returns The serialized snapshot entry.
 */
export function parseStateEntryToSnapshotEntry<K>(
  stateEntry: CRStructStateEntry<K>
): CRStructSnapshotEntry<K> {
  return {
    uuidv7: stateEntry.uuidv7,
    value: structuredClone(stateEntry.value),
    predecessor: stateEntry.predecessor,
    tombstones: Array.from(stateEntry.tombstones),
  }
}
