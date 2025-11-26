export class ProductFetchError extends Error {
  public context: Record<string, unknown>;

  constructor(
    message: string,
    public statusCode: number,
    options?: { cause?: unknown; context?: Record<string, unknown> },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = 'ProductFetchError';
    this.context = options?.context ?? {};
  }
}
