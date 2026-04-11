/**
 * Error codes thrown by {@link OOStruct}.
 */
export type CRStructErrorCode =
  | 'DEFAULTS_NOT_CLONEABLE'
  | 'VALUE_NOT_CLONEABLE'
  | 'VALUE_TYPE_MISMATCH'

/**
 * Represents a typed CR-Struct runtime error.
 */
export class CRStructError extends Error {
  /**
   * The semantic error code for the failure.
   */
  readonly code: CRStructErrorCode

  /**
   * Creates a typed CR-Struct error.
   *
   * @param code - The semantic error code.
   * @param message - An optional human-readable detail message.
   */
  constructor(code: CRStructErrorCode, message?: string) {
    const detail = message ?? code
    super(`{@sovereignbase/convergent-replicated-struct} ${detail}`)
    this.code = code
    this.name = 'CRStructError'
  }
}
