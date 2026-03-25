import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV === 'development' && {
    transport: { target: 'pino-pretty', options: { colorize: true } },
  }),
  redact: {
    paths: [
      'req.headers.authorization',
      'body.password',
      'body.credentials',
      '*.apiKey',
      '*.api_key',
      '*.secret',
      '*.door_code',
      '*.wifi_password',
    ],
    censor: '[REDACTED]',
  },
});
