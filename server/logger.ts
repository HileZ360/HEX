export type ParseLogger = {
  debug?: (message: string, meta?: Record<string, unknown>) => void;
  info?: (message: string, meta?: Record<string, unknown>) => void;
  warn?: (message: string, meta?: Record<string, unknown>) => void;
  error?: (message: string, meta?: Record<string, unknown>) => void;
};

const noop = () => {};

const wrap = (logger: ParseLogger | undefined, level: keyof ParseLogger) => {
  const method = logger?.[level]?.bind(logger);

  return (message: string, meta?: Record<string, unknown>) => {
    if (!method) return;

    const needsMetaFirst = method.length >= 2;
    if (meta && needsMetaFirst) {
      method.call(logger, meta, message);
      return;
    }

    if (meta) {
      method.call(logger, `${message} ${JSON.stringify(meta)}` as any);
      return;
    }

    method.call(logger, message as any);
  };
};

export const resolveLogger = (logger?: ParseLogger) => ({
  debug: wrap(logger, 'debug'),
  info: wrap(logger, 'info'),
  warn: wrap(logger, 'warn'),
  error: wrap(logger, 'error'),
});
