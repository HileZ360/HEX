export class PreviewStorageError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'PreviewStorageError';
  }
}

export class TryOnProviderError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'TryOnProviderError';
  }
}
