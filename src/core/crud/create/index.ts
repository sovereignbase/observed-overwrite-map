import { CRStructSnapshot } from '../../../.types/index.js'

export function __create<T extends Record<string, unknown>>(
  defaults: T,
  snapshot?: CRStructSnapshot<T>
): CRStructState<T> {
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
