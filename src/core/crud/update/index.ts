import type {
  CRStructChange,
  CRStructDelta,
  CRStructState,
} from '../../../.types/index.js'
import { safeStructuredClone, prototype } from '@sovereignbase/utils'
import { CRStructError } from '../../../.errors/class.js'
import { overwriteAndReturnSnapshotEntry } from '../../../.helpers/index.js'

/**
 * Overwrites a field with a new value and emits the resulting projections.
 *
 * The incoming value is cloned first, validated against the default field
 * runtime type, and then written back as the current winning value for the
 * target field.
 *
 * @param key - The field key to overwrite.
 * @param value - The next value for the field.
 * @param crStructReplica - The replica state that owns the field.
 *
 * @returns
 * The visible change projection and serializable delta for the overwrite.
 *
 * @throws {CRStructError} Thrown when the value is not supported by `structuredClone`.
 * @throws {CRStructError} Thrown when the value runtime type does not match the default value runtime type.
 *
 * Time complexity: O(c + t), worst case O(c + t)
 *
 * c = cloned payload size across the updated value and emitted delta entry
 * t = tombstone count copied into the emitted delta entry
 *
 * Space complexity: O(c + t)
 */
export function __update<T extends Record<string, unknown>>(
  key: keyof T,
  value: T[keyof T],
  crStructReplica: CRStructState<T>
): { change: CRStructChange<T>; delta: CRStructDelta<T> } | false {
  const [cloned, copiedValue] = safeStructuredClone(value)
  if (!cloned)
    throw new CRStructError(
      'VALUE_NOT_CLONEABLE',
      'Updated values must be supported by structuredClone.'
    )

  if (prototype(copiedValue) !== prototype(crStructReplica.defaults[key]))
    throw new CRStructError(
      'VALUE_TYPE_MISMATCH',
      'Updated value must match the default value runtime type.'
    )
  const delta: CRStructDelta<T> = {}
  const change: CRStructChange<T> = {}
  delta[key] = overwriteAndReturnSnapshotEntry(
    key,
    copiedValue,
    crStructReplica
  )
  change[key] = structuredClone(copiedValue)
  return { change, delta }
}
