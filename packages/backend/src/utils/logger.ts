import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

const LOG_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');
const MAX_SIZE = 5 * 1024 * 1024;

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function rotateIfNeeded() {
  try {
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > MAX_SIZE) {
      const rotated = path.join(LOG_DIR, `app_${new Date().toISOString().slice(0, 10)}.log`);
      fs.renameSync(LOG_FILE, rotated);
    }
  } catch {
    // ignore rotation errors
  }
}

function formatMessage(level: string, module: string, message: string, data?: any): string {
  const ts = new Date().toISOString();
  const dataStr = data !== undefined ? ` | ${typeof data === 'string' ? data : JSON.stringify(data)}` : '';
  return `[${ts}] [${level}] [${module}] ${message}${dataStr}\n`;
}

function write(level: string, module: string, message: string, data?: any) {
  try {
    ensureLogDir();
    rotateIfNeeded();
    fs.appendFileSync(LOG_FILE, formatMessage(level, module, message, data), 'utf8');
  } catch {
    // fail silently if can't write to log file
  }
}

export const logger = {
  info(module: string, message: string, data?: any) {
    write('INFO', module, message, data);
  },

  warn(module: string, message: string, data?: any) {
    write('WARN', module, message, data);
  },

  error(module: string, message: string, data?: any) {
    write('ERROR', module, message, data);
  },

  debug(module: string, message: string, data?: any) {
    if (env.NODE_ENV !== 'production') {
      write('DEBUG', module, message, data);
    }
  },

  request(method: string, url: string, status: number, ip: string, ms: number) {
    write('INFO', 'HTTP', `${method} ${url} ${status} ${ms}ms`, { ip });
  },

  getLogPath() {
    return LOG_FILE;
  },
};
