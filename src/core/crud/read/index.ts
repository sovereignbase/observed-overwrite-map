import type { CRStructState } from '../../../.types/index.js'

/**
 * Reads and clones the current value of a single field.
 *
 * @param key - The field key to read.
 * @param crStructReplica - The replica state that owns the field.
 *
 * @returns
 * A cloned copy of the field's current value.
 *
 * Time complexity: O(c), worst case O(c)
 *
 * c = cloned field payload size
 *
 * Space complexity: O(c)
 */
export function __read<T extends Record<string, unknown>>(
  key: keyof T,
  crStructReplica: CRStructState<T>
): T[keyof T] {
  return structuredClone(crStructReplica.entries[key].value)
}
