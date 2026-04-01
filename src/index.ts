/**
 * The OO-Struct replica implementation.
 */
export { OOStruct } from './OOStruct/class.js'

/**
 * The public OO-Struct error code union.
 */
export type { OOStructErrorCode } from './.errors/class.js'

/**
 * Public OO-Struct types.
 */
export type {
  OOStructEventMap,
  OOStructEventListener,
  OOStructEventListenerFor,
  /***/
  OOStructState,
  OOStructStateEntry,
  /***/
  OOStructSnapshot,
  OOStructSnapshotEntry,
  /***/
  OOStructChange,
  /***/
  OOStructDelta,
  OOStructAck,
  /***/
  OOStructAcknowledgementFrontier,
} from './.types/index.js'
