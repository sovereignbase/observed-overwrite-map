/**
 * Error codes thrown by {@link OOStruct}.
 */
export type OOStructErrorCode =
  | 'DEFAULTS_NOT_CLONEABLE'
  | 'VALUE_NOT_CLONEABLE'
  | 'VALUE_TYPE_MISMATCH'

/**
 * Represents a typed OO-Struct runtime error.
 */
export class OOStructError extends Error {
  /**
   * The semantic error code for the failure.
   */
  readonly code: OOStructErrorCode

  /**
   * Creates a typed OO-Struct error.
   *
   * @param code - The semantic error code.
   * @param message - An optional human-readable detail message.
   */
  constructor(code: OOStructErrorCode, message?: string) {
    const detail = message ?? code
    super(`{@sovereignbase/observed-overwrite-struct} ${detail}`)
    this.code = code
    this.name = 'OOStructError'
  }
}
