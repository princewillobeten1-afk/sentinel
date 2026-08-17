type LogMeta = Record<string, unknown> | undefined;

class Logger {
  private formatMessage(level: string, message: string, meta?: LogMeta) {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(meta ? { meta } : {}),
    };

    return JSON.stringify(payload);
  }

  info(message: string, meta?: LogMeta) {
    console.info(this.formatMessage('info', message, meta));
  }

  warn(message: string, meta?: LogMeta) {
    console.warn(this.formatMessage('warn', message, meta));
  }

  error(message: string, meta?: LogMeta) {
    console.error(this.formatMessage('error', message, meta));
  }

  debug(message: string, meta?: LogMeta) {
    if (['development', 'test'].includes(process.env.NODE_ENV ?? 'development')) {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }
}

export const logger = new Logger();
