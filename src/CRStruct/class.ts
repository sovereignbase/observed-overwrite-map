import { v7 as uuidv7 } from 'uuid'
import type {
  CRStructChange,
  CRStructDelta,
  CRStructEventListenerFor,
  CRStructEventMap,
  CRStructSnapshot,
  CRStructSnapshotEntry,
  CRStructState,
  CRStructStateEntry,
  CRStructAck,
} from '../.types/index.js'
import { CRStructError } from '../.errors/class.js'
import { parseSnapshotEntryToStateEntry } from '../.helpers/parseSnapshotEntryToStateEntry/index.js'
import { parseStateEntryToSnapshotEntry } from '../.helpers/parseStateEntryToSnapshotEntry/index.js'
import { isUuidV7, prototype, safeStructuredClone } from '@sovereignbase/utils'

import { __snapshot } from '../core/mags/index.js'

/**
 * Represents an observed-overwrite struct replica.
 *
 * The struct shape is fixed by the provided default values.
 */
export class CRStruct<T extends Record<string, unknown>> {
  [key: keyof T]: T[keyof T]
  private readonly eventTarget = new EventTarget()
  private readonly defaults: T
  private readonly state: CRStructState<T>
  private live: T

  /**
   * Creates a replica from default values and an optional snapshot.
   *
   * @param defaults - The default field values that define the struct shape.
   * @param snapshot - An optional serialized snapshot used for hydration.
   * @throws {CRStructError} Thrown when the default values are not supported by `structuredClone`.
   */
  constructor(
    defaults: { [K in keyof T]: T[K] },
    snapshot?: CRStructSnapshot<T>
  ) {
    const [cloned, copiedDefaults] = safeStructuredClone(defaults)
    if (!cloned)
      throw new CRStructError(
        'DEFAULTS_NOT_CLONEABLE',
        'Default values must be supported by structuredClone.'
      )
    this.defaults = copiedDefaults
    this.state = {} as CRStructState<T>
    this.live = {} as T

    const snapshotIsObject = snapshot && prototype(snapshot) === 'record'

    for (const key of Object.keys(this.defaults)) {
      const defaultValue = this.defaults[key as keyof T]
      if (snapshotIsObject && Object.hasOwn(snapshot, key)) {
        const valid = parseSnapshotEntryToStateEntry(
          defaultValue,
          snapshot[key as keyof T]
        )
        if (valid) {
          this.live[key as keyof T] = valid.value
          this.state[key as keyof T] = valid
          continue
        }
      }
      this.live[key as keyof T] = defaultValue
      const root = uuidv7()
      this.state[key as keyof T] = {
        uuidv7: uuidv7(),
        predecessor: root,
        value: defaultValue,
        tombstones: new Set([root]),
      }
    }
  }

  /**CRUD*/
  /**
   * Creates a new replica.
   *
   * @param defaults - The default field values that define the struct shape.
   * @param snapshot - An optional serialized snapshot used for hydration.
   * @returns A new OO-Struct replica.
   */
  static create<T extends Record<string, unknown>>(
    defaults: { [K in keyof T]: T[K] },
    snapshot?: CRStructSnapshot<T>
  ): CRStruct<T> {
    return new CRStruct(defaults, snapshot)
  }

  /**
   * Reads the current value of a field.
   *
   * @param key - The field key to read.
   * @returns A cloned copy of the field's current value.
   */
  read<K extends keyof T>(key: K): T[K] {
    return structuredClone(this.live[key])
  }

  /**
   * Overwrites a field with a new value.
   *
   * @param key - The field key to overwrite.
   * @param value - The next value for the field.
   * @throws {CRStructError} Thrown when the value is not supported by `structuredClone`.
   * @throws {CRStructError} Thrown when the value runtime type does not match the default value runtime type.
   */
  update<K extends keyof T>(key: K, value: T[K]): void {
    const [cloned, copiedValue] = safeStructuredClone(value)
    if (!cloned)
      throw new CRStructError(
        'VALUE_NOT_CLONEABLE',
        'Updated values must be supported by structuredClone.'
      )

    if (prototype(copiedValue) !== prototype(this.defaults[key]))
      throw new CRStructError(
        'VALUE_TYPE_MISMATCH',
        'Updated value must match the default value runtime type.'
      )
    const delta: CRStructDelta<T> = {}
    const change: CRStructChange<T> = {}
    delta[key] = this.overwriteAndReturnSnapshotEntry(key, copiedValue)
    change[key] = structuredClone(copiedValue)
    this.eventTarget.dispatchEvent(new CustomEvent('delta', { detail: delta }))
    this.eventTarget.dispatchEvent(
      new CustomEvent('change', { detail: change })
    )
  }

  /**
   * Resets one field or the entire struct back to default values.
   *
   * @param key - The optional field key to reset. When omitted, every field is reset.
   */
  delete<K extends keyof T>(key?: K): void {
    const delta: CRStructDelta<T> = {}
    const change: CRStructChange<T> = {}

    if (key !== undefined) {
      if (!Object.hasOwn(this.defaults, key)) return
      const value = this.defaults[key]
      delta[key] = this.overwriteAndReturnSnapshotEntry(key, value)
      change[key] = structuredClone(value)
    } else {
      for (const [key, value] of Object.entries(this.defaults)) {
        delta[key as K] = this.overwriteAndReturnSnapshotEntry(
          key as K,
          value as T[K]
        )
        change[key as K] = structuredClone(value as T[K])
      }
    }
    this.eventTarget.dispatchEvent(new CustomEvent('delta', { detail: delta }))
    this.eventTarget.dispatchEvent(
      new CustomEvent('change', { detail: change })
    )
  }

  /**MAGS*/
  /**
   * Merges an incoming delta into the current replica.
   *
   * @param replica - The incoming partial snapshot projection to merge.
   */
  merge<K extends keyof T>(replica: CRStructDelta<T>): void {
    if (!replica || typeof replica !== 'object' || Array.isArray(replica))
      return

    const delta: CRStructDelta<T> = {}
    const change: CRStructChange<T> = {}
    let hasDelta = false
    let hasChange = false

    for (const [key, value] of Object.entries(replica)) {
      if (!Object.hasOwn(this.state, key)) continue

      const candidate = parseSnapshotEntryToStateEntry(
        this.defaults[key as K],
        value as CRStructSnapshotEntry<T[K]>
      )
      if (!candidate) continue

      const target = this.state[key as K]
      const current = { ...target }
      let frontier = ''
      for (const overwrite of target.tombstones) {
        if (frontier < overwrite) frontier = overwrite
      }

      for (const overwrite of candidate.tombstones) {
        if (overwrite <= frontier || target.tombstones.has(overwrite)) continue
        target.tombstones.add(overwrite)
      }

      if (target.tombstones.has(candidate.uuidv7)) continue

      if (current.uuidv7 === candidate.uuidv7) {
        if (current.predecessor < candidate.predecessor) {
          target.value = candidate.value
          target.predecessor = candidate.predecessor
          target.tombstones.add(candidate.predecessor)
          this.live[key as K] = candidate.value
          change[key as K] = structuredClone(candidate.value)
          hasChange = true
        } else {
          delta[key as K] = this.overwriteAndReturnSnapshotEntry(
            key as K,
            current.value
          )
          hasDelta = true
        }
        continue
      }

      if (
        current.uuidv7 === candidate.predecessor ||
        target.tombstones.has(current.uuidv7) ||
        candidate.uuidv7 > current.uuidv7
      ) {
        target.uuidv7 = candidate.uuidv7
        target.value = candidate.value
        target.predecessor = candidate.predecessor
        target.tombstones.add(candidate.predecessor)
        target.tombstones.add(current.uuidv7)
        this.live[key as K] = candidate.value
        change[key as K] = structuredClone(candidate.value)
        hasChange = true
        continue
      }

      target.tombstones.add(candidate.uuidv7)
      delta[key as K] = parseStateEntryToSnapshotEntry(target)
      hasDelta = true
    }
    if (hasDelta)
      this.eventTarget.dispatchEvent(
        new CustomEvent('delta', { detail: delta })
      )
    if (hasChange)
      this.eventTarget.dispatchEvent(
        new CustomEvent('change', { detail: change })
      )
  }

  /**
   * Emits the current acknowledgement frontier for each field.
   */
  acknowledge<K extends Extract<keyof T, string>>(): void {
    const ack: CRStructAck<T> = {}
    for (const [key, value] of Object.entries(this.state)) {
      let max = ''
      for (const overwrite of (value as CRStructStateEntry<T[K]>).tombstones) {
        if (max < overwrite) max = overwrite
      }
      ack[key as K] = max
    }
    this.eventTarget.dispatchEvent(new CustomEvent('ack', { detail: ack }))
  }

  /**
   * Removes overwritten identifiers that every provided frontier has acknowledged.
   *
   * @param frontiers - A collection of acknowledgement frontiers to compact against.
   */
  garbageCollect<K extends Extract<keyof T, string>>(
    frontiers: Array<CRStructAck<T>>
  ): void {
    if (!Array.isArray(frontiers) || frontiers.length < 1) return
    const smallestAcknowledgementsPerKey: CRStructAck<T> = {}

    for (const frontier of frontiers) {
      for (const [key, value] of Object.entries(frontier)) {
        if (!Object.hasOwn(this.state, key) || !isUuidV7(value)) continue

        const current = smallestAcknowledgementsPerKey[key as K]
        if (typeof current === 'string' && current <= value) continue
        smallestAcknowledgementsPerKey[key as K] = value
      }
    }

    for (const [key, value] of Object.entries(smallestAcknowledgementsPerKey)) {
      const target = this.state[key]
      const smallest = value as string
      for (const uuidv7 of target.tombstones) {
        if (uuidv7 === target.predecessor || uuidv7 > smallest) continue
        target.tombstones.delete(uuidv7)
      }
    }
  }

  /**
   * Emits a serialized snapshot of the current replica state.
   */
  snapshot(): void {
    const snapshot = __snapshot<T>(this.state)
    if (snapshot) {
      this.eventTarget.dispatchEvent(
        new CustomEvent('snapshot', { detail: snapshot })
      )
    }
  }

  /**ADDITIONAL*/

  /**
   * Returns the struct field keys.
   *
   * @returns The field keys in the current replica.
   */
  keys<K extends keyof T>(): Array<K> {
    return Object.keys(this.live) as Array<K>
  }

  /**
   * Returns cloned copies of the current field values.
   *
   * @returns The current field values.
   */
  values<K extends keyof T>(): Array<T[K]> {
    return Object.values(this.live).map((value) =>
      structuredClone(value)
    ) as Array<T[K]>
  }

  /**
   * Returns cloned key-value pairs for the current replica state.
   *
   * @returns The current field entries.
   */
  entries<K extends keyof T>(): Array<[K, T[K]]> {
    return Object.entries(this.live).map(([key, value]) => [
      key as K,
      structuredClone(value as T[K]),
    ])
  }

  /**EVENTS*/

  /**
   * Registers an event listener.
   *
   * @param type - The event type to listen for.
   * @param listener - The listener to register.
   * @param options - Listener registration options.
   */
  addEventListener<K extends keyof CRStructEventMap<T>>(
    type: K,
    listener: CRStructEventListenerFor<T, K> | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.eventTarget.addEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options
    )
  }

  /**
   * Removes an event listener.
   *
   * @param type - The event type to stop listening for.
   * @param listener - The listener to remove.
   * @param options - Listener removal options.
   */
  removeEventListener<K extends keyof CRStructEventMap<T>>(
    type: K,
    listener: CRStructEventListenerFor<T, K> | null,
    options?: boolean | EventListenerOptions
  ): void {
    this.eventTarget.removeEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options
    )
  }

  /**HELPERS*/

  /**
   * Overwrites a field and returns the serialized delta entry for that overwrite.
   *
   * @param key - The field key to overwrite.
   * @param value - The next value for the field.
   * @returns The serialized snapshot entry for the new winning value.
   */
  private overwriteAndReturnSnapshotEntry<K extends keyof T>(
    key: K,
    value: T[K]
  ): CRStructSnapshotEntry<T[K]> {
    const target = this.state[key]
    const old = { ...target }
    target.uuidv7 = uuidv7()
    target.value = value
    target.predecessor = old.uuidv7
    target.tombstones.add(old.uuidv7)
    this.live[key] = value
    return parseStateEntryToSnapshotEntry(target)
  }
  /**
   * Returns a serializable snapshot representation of this list.
   *
   * Called automatically by `JSON.stringify`.
   */
  toJSON(): CRStructSnapshot<T> {
    return __snapshot<T>(this.state)
  }
  /**
   * Returns this list as a JSON string.
   */
  toString(): string {
    return JSON.stringify(this)
  }
  /**
   * Returns the Node.js console inspection representation.
   */
  [Symbol.for('nodejs.util.inspect.custom')](): CRStructSnapshot<T> {
    return this.toJSON()
  }
  /**
   * Returns the Deno console inspection representation.
   */
  [Symbol.for('Deno.customInspect')](): CRStructSnapshot<T> {
    return this.toJSON()
  }
  /**
   * Iterates over the current live values in index order.
   */
  *[Symbol.iterator](): IterableIterator<T> {
    for (let index = 0; index < this.size; index++) {
      const value = this[index]
      yield value
    }
  }
}
