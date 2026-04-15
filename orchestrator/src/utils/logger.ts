import { config } from '../config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const currentLevel = (config.logLevel as LogLevel) || 'info';

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (levelOrder[level] < levelOrder[currentLevel]) return;
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
};

