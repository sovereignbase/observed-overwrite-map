/**
 * The CR-Struct replica implementation.
 */
export { CRStruct } from './CRStruct/class.js'

/**
 * The public CR-Struct error code union.
 */
export type { CRStructErrorCode } from './.errors/class.js'

/**
 * Public CR-Struct types.
 */
export type {
  CRStructEventMap,
  CRStructEventListener,
  CRStructEventListenerFor,
  /***/
  CRStructState,
  CRStructStateEntry,
  /***/
  CRStructSnapshot,
  CRStructSnapshotEntry,
  /***/
  CRStructChange,
  /***/
  CRStructDelta,
  CRStructAck,
} from './.types/index.js'

/**
 * Public advanced exports, CR-Struct primitives.
 */
