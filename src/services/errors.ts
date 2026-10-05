export class NotFoundError extends Error {
  constructor(message = 'Item tidak ditemukan.') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  readonly fieldErrors: Record<string, string>;

  constructor(fieldErrors: Record<string, string>) {
    super('Data task tidak valid.');
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors;
  }
}

/** The only error type that reaches a component. */
export class TaskServiceError extends Error {
  override readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'TaskServiceError';
    this.cause = cause;
  }}
