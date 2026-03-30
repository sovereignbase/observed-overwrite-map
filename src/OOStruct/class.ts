import { v7 as uuidv7 } from 'uuid'
import { OOStructError } from '../.errors/class.js'
import type {
  OOStructDelta,
  OOStructEventListenerFor,
  OOStructEventMap,
  OOStructMergeResult,
  OOStructSnapshot,
  OOStructSnapshotEntry,
  OOStructState,
  OOStructStateEntry,
} from '../.types/index.js'
import { isUuidV7 } from './isUuidV7/index.js'

export class OOStruct<T extends object> {
  private readonly eventTarget = new EventTarget()
  private readonly __defaults: T
  private readonly __state: OOStructState<T>
  private __live: T

  constructor(
    defaults: { [K in keyof T]: T[K] },
    snapshot?: OOStructSnapshot<T>,
  ) {
    this.__defaults = { ...defaults } as T
    this.__live = {} as T
    this.__state = {} as OOStructState<T>

    if (snapshot === undefined) {
      for (const [rawKey, rawValue] of Object.entries(defaults)) {
        const key = rawKey as keyof T
        const value = rawValue as T[keyof T]

        this.__live[key] = value
        this.__state[key] = {
          __uuidv7: uuidv7(),
          __value: value,
          __overwrites: new Set([]),
        }
      }

      return
    }

    const seen = new Set<string>()

    for (const [rawKey, rawValue] of Object.entries(snapshot)) {
      if (!Object.hasOwn(defaults, rawKey)) {
        throw new OOStructError('BAD_SNAPSHOT', 'Malformed snapshot.')
      }

      const key = rawKey as keyof T
      const entry = this.parseSnapshotEntry(rawValue)

      this.__live[key] = entry.__value as T[keyof T]
      this.__state[key] = entry as OOStructState<T>[keyof T]
      seen.add(rawKey)
    }

    for (const rawKey of Object.keys(defaults)) {
      if (!seen.has(rawKey)) {
        throw new OOStructError('BAD_SNAPSHOT', 'Malformed snapshot.')
      }
    }
  }

  read<K extends keyof T>(key: K): T[K] {
    return this.__live[key]
  }

  write<K extends keyof T>(key: K, value: T[K]): void {
    this.overwrite(key, value)

    const delta = {} as OOStructDelta<T>
    delta[key] = this.snapshotEntry(key)
    this.dispatch('delta', delta)
  }

  reset(key?: keyof T): void {
    const delta = {} as OOStructDelta<T>

    if (key !== undefined) {
      this.overwrite(key, this.__defaults[key])
      delta[key] = this.snapshotEntry(key)
    } else {
      for (const rawKey of Object.keys(this.__defaults)) {
        const nextKey = rawKey as keyof T
        this.overwrite(nextKey, this.__defaults[nextKey])
        delta[nextKey] = this.snapshotEntry(nextKey)
      }
    }

    this.dispatch('delta', delta)
  }

  merge(ingress: Partial<OOStructSnapshot<T>>): void {
    if (!ingress || typeof ingress !== 'object' || Array.isArray(ingress)) {
      throw new OOStructError('BAD_SNAPSHOT', 'Malformed snapshot.')
    }

    const changes = {} as OOStructMergeResult<T>

    for (const [rawKey, rawValue] of Object.entries(ingress)) {
      if (!Object.hasOwn(this.__state, rawKey)) {
        throw new OOStructError('BAD_SNAPSHOT', 'Malformed snapshot.')
      }

      const key = rawKey as keyof T
      const current = this.__state[key]
      const incoming = this.parseSnapshotEntry(rawValue)
      const overwrites = new Set(current.__overwrites)

      for (const overwrite of incoming.__overwrites) {
        overwrites.add(overwrite)
      }

      let nextUuid = current.__uuidv7
      let nextValue = current.__value

      if (current.__uuidv7 !== incoming.__uuidv7) {
        if (current.__overwrites.has(incoming.__uuidv7)) {
          overwrites.add(incoming.__uuidv7)
        } else if (incoming.__overwrites.has(current.__uuidv7)) {
          nextUuid = incoming.__uuidv7
          nextValue = incoming.__value as T[keyof T]
          overwrites.add(current.__uuidv7)
        } else if (current.__uuidv7.localeCompare(incoming.__uuidv7) < 0) {
          nextUuid = incoming.__uuidv7
          nextValue = incoming.__value as T[keyof T]
          overwrites.add(current.__uuidv7)
        } else {
          overwrites.add(incoming.__uuidv7)
        }
      }

      overwrites.delete(nextUuid)

      if (!this.hasSameState(current, nextUuid, nextValue, overwrites)) {
        this.__live[key] = nextValue as T[keyof T]
        this.__state[key] = {
          __uuidv7: nextUuid,
          __value: nextValue,
          __overwrites: overwrites,
        } as OOStructState<T>[keyof T]
        changes[key] = nextValue as T[keyof T]
      }
    }

    if (Object.keys(changes).length === 0) return
    this.dispatch('merge', changes)
  }

  snapshot(): void {
    const snapshot = {} as OOStructSnapshot<T>

    for (const rawKey of Object.keys(this.__state)) {
      const key = rawKey as keyof T
      snapshot[key] = this.snapshotEntry(key)
    }

    this.dispatch('snapshot', snapshot)
  }

  /**
   * Registers an event listener.
   *
   * @param type - The event type to listen for.
   * @param listener - The listener to register.
   * @param options - Listener registration options.
   */
  addEventListener<K extends string>(
    type: K,
    listener: OOStructEventListenerFor<T, K> | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    this.eventTarget.addEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options,
    )
  }

  /**
   * Removes an event listener.
   *
   * @param type - The event type to stop listening for.
   * @param listener - The listener to remove.
   * @param options - Listener removal options.
   */
  removeEventListener<K extends string>(
    type: K,
    listener: OOStructEventListenerFor<T, K> | null,
    options?: boolean | EventListenerOptions,
  ): void {
    this.eventTarget.removeEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options,
    )
  }

  private dispatch<K extends keyof OOStructEventMap<T>>(
    type: K,
    detail: OOStructEventMap<T>[K],
  ): void {
    this.eventTarget.dispatchEvent(new CustomEvent(type, { detail }))
  }

  private overwrite<K extends keyof T>(key: K, value: T[K]): void {
    const current = this.__state[key]
    const overwrites = new Set(current.__overwrites)

    overwrites.add(current.__uuidv7)
    this.__live[key] = value
    this.__state[key] = {
      __uuidv7: uuidv7(),
      __value: value,
      __overwrites: overwrites,
    }
  }

  private parseSnapshotEntry(
    value: unknown,
  ): OOStructStateEntry<T[keyof T]> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new OOStructError('BAD_SNAPSHOT', 'Malformed snapshot.')
    }

    const entry = value as OOStructSnapshotEntry<T[keyof T]>
    if (!isUuidV7(entry.__uuidv7)) {
      throw new OOStructError('BAD_SNAPSHOT', 'Malformed snapshot.')
    }
    if (!Object.hasOwn(entry, '__value')) {
      throw new OOStructError('BAD_SNAPSHOT', 'Malformed snapshot.')
    }
    if (!Array.isArray(entry.__overwrites)) {
      throw new OOStructError('BAD_SNAPSHOT', 'Malformed snapshot.')
    }

    const overwrites = new Set<string>()
    for (const overwrite of entry.__overwrites) {
      if (!isUuidV7(overwrite)) continue
      overwrites.add(overwrite)
    }

    return {
      __uuidv7: entry.__uuidv7,
      __value: entry.__value,
      __overwrites: overwrites,
    }
  }

  private snapshotEntry<K extends keyof T>(
    key: K,
  ): OOStructSnapshotEntry<T[K]> {
    const entry = this.__state[key]

    return {
      __uuidv7: entry.__uuidv7,
      __value: entry.__value,
      __overwrites: Array.from(entry.__overwrites),
    }
  }

  private hasSameState<K extends keyof T>(
    current: OOStructStateEntry<T[K]>,
    nextUuid: string,
    nextValue: T[K],
    nextOverwrites: Set<string>,
  ): boolean {
    if (current.__uuidv7 !== nextUuid) return false
    if (current.__value !== nextValue) return false
    if (current.__overwrites.size !== nextOverwrites.size) return false

    for (const overwrite of current.__overwrites) {
      if (!nextOverwrites.has(overwrite)) return false
    }

    return true
  }
}
