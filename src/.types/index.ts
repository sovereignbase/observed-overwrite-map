/**Replica State*/

/**
 * Represents the internal replicated state for a single field.
 */
export type OOStructStateEntry<V> = {
  /**
   * The identifier of the current winning value.
   */
  __uuidv7: string

  /**
   * The current winning value.
   */
  __value: V

  /**
   * The predecessor identifier for the current winning value.
   */
  __after: string

  /**
   * Identifiers known to have been overwritten for the field.
   */
  __overwrites: Set<string>
}

/**
 * Represents the internal replicated state of an OO-Struct replica.
 */
export type OOStructState<T extends Record<string, unknown>> = {
  [K in keyof T]: OOStructStateEntry<T[K]>
}

/**Serlialized projection of replica state*/

/**
 * Represents the serialized state for a single field.
 */
export type OOStructSnapshotEntry<V> = {
  /**
   * The identifier of the current winning value.
   */
  __uuidv7: string

  /**
   * The serialized current winning value.
   */
  __value: V

  /**
   * The predecessor identifier for the current winning value.
   */
  __after: string

  /**
   * Serialized overwritten identifiers for the field.
   */
  __overwrites: Array<string>
}

/**
 * Represents a serialized snapshot of the full replica state.
 */
export type OOStructSnapshot<T extends Record<string, unknown>> = {
  [K in keyof T]: OOStructSnapshotEntry<T[K]>
}

/**Resolved projection of replica state*/

/**
 * Represents visible field values that changed during a local operation or merge.
 */
export type OOStructChange<T extends Record<string, unknown>> = Partial<T>
/**(T)*/

/**A "report" on what the replica has seen*/

/**
 * Represents the acknowledgement frontier for a set of field keys.
 */
export type OOStructAcknowledgementFrontier<K extends string> = Record<
  K,
  string
>

/**Partial changes to gossip*/

/**
 * Represents a partial serialized state projection exchanged between replicas.
 */
export type OOStructDelta<T extends Record<string, unknown>> = Partial<
  OOStructSnapshot<T>
>

/**
 * Represents the current acknowledgement frontier emitted by a replica.
 */
export type OOStructAck<T extends Record<string, unknown>> = Partial<
  OOStructAcknowledgementFrontier<Extract<keyof T, string>>
>

/***/

/**
 * Maps OO-Struct event names to their event payload shapes.
 */
export type OOStructEventMap<T extends Record<string, unknown>> = {
  /** STATE / PROJECTION */
  snapshot: OOStructSnapshot<T>
  change: OOStructChange<T>

  /** GOSSIP / PROTOCOL */
  delta: OOStructDelta<T>
  ack: OOStructAck<T>
}

/**
 * Represents a strongly typed OO-Struct event listener.
 */
export type OOStructEventListener<
  T extends Record<string, unknown>,
  K extends keyof OOStructEventMap<T>,
> =
  | ((event: CustomEvent<OOStructEventMap<T>[K]>) => void)
  | { handleEvent(event: CustomEvent<OOStructEventMap<T>[K]>): void }

/**
 * Resolves an event name to its corresponding listener type.
 */
export type OOStructEventListenerFor<
  T extends Record<string, unknown>,
  K extends string,
> = K extends keyof OOStructEventMap<T>
  ? OOStructEventListener<T, K>
  : EventListenerOrEventListenerObject
