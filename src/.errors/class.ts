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
  readonly code: OOStructErrorCode

  constructor(code: OOStructErrorCode, message?: string) {
    const detail = message ?? code
    super(`{@sovereignbase/observed-overwrite-struct} ${detail}`)
    this.code = code
    this.name = 'OOStructError'
  }
}
