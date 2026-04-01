/**Replica State*/

export type OOStructStateEntry<V> = {
  __uuidv7: string
  __value: V
  __after: string
  __overwrites: Set<string>
}

export type OOStructState<T extends Record<string, unknown>> = {
  [K in keyof T]: OOStructStateEntry<T[K]>
}

/**Serlialized projection of replica state*/
export type OOStructSnapshotEntry<V> = {
  __uuidv7: string
  __value: V
  __after: string
  __overwrites: Array<string>
}

export type OOStructSnapshot<T extends Record<string, unknown>> = {
  [K in keyof T]: OOStructSnapshotEntry<T[K]>
}

/**Resolved projection of replica state*/
export type OOStructChange<T extends Record<string, unknown>> = Partial<T>
/**(T)*/

/**A "report" on what the replica has seen*/
export type OOStructAcknowledgementFrontier<K extends string> = Record<
  K,
  string
>

/**Partial changes to gossip*/
export type OOStructDelta<T extends Record<string, unknown>> = Partial<
  OOStructSnapshot<T>
>

export type OOStructAck<T extends Record<string, unknown>> = Partial<
  OOStructAcknowledgementFrontier<Extract<keyof T, string>>
>

/***/

export type OOStructEventMap<T extends Record<string, unknown>> = {
  /** STATE / PROJECTION */
  snapshot: OOStructSnapshot<T>
  change: OOStructChange<T>

  /** GOSSIP / PROTOCOL */
  delta: OOStructDelta<T>
  ack: OOStructAck<T>
}

export type OOStructEventListener<
  T extends Record<string, unknown>,
  K extends keyof OOStructEventMap<T>,
> =
  | ((event: CustomEvent<OOStructEventMap<T>[K]>) => void)
  | { handleEvent(event: CustomEvent<OOStructEventMap<T>[K]>): void }

export type OOStructEventListenerFor<
  T extends Record<string, unknown>,
  K extends string,
> = K extends keyof OOStructEventMap<T>
  ? OOStructEventListener<T, K>
  : EventListenerOrEventListenerObject
