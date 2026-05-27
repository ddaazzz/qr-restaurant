import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is undefined");
}

// SSL configuration: use SSL only in production or if explicitly required
const isProduction = process.env.NODE_ENV === 'production';
const dbUrl = process.env.DATABASE_URL;

// Check if the DATABASE_URL is localhost (local development)
const isLocalhost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');

const poolConfig: any = {
  connectionString: process.env.DATABASE_URL,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  max: 10,
};

// Only enable SSL for production or remote databases
if (isProduction || !isLocalhost) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

// Prevent uncaught exceptions when the pool's idle clients get reset/dropped by the remote DB
pool.on('error', (err: Error) => {
  console.warn('[DB Pool] Idle client error (will reconnect):', err.message);
});

/** Check if an error is a transient connectivity error worth retrying */
function isTransientError(err: any): boolean {
  if (!err) return false;
  const transientCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EPIPE'];
  if (transientCodes.includes(err.code)) return true;
  const msg: string = err.message || '';
  return (
    msg.includes('Connection terminated') ||
    msg.includes('connection timeout') ||
    msg.includes('Client was closed') ||
    msg.includes('terminating connection')
  );
}

// Patch pool.query to auto-retry once on transient connection errors.
// This fixes 500s caused by Render dropping idle DB connections without changing any route code.
const _origQuery = pool.query.bind(pool);
(pool as any).query = async function (...args: any[]) {
  try {
    return await (_origQuery as any)(...args);
  } catch (err: any) {
    if (isTransientError(err)) {
      await new Promise(r => setTimeout(r, 500));
      return await (_origQuery as any)(...args);
    }
    throw err;
  }
};

/**
 * Wrapper around pool.query that retries once on transient connection errors.
 * Drop-in replacement: pool.query(text, values) → queryWithRetry(text, values)
 */
export async function queryWithRetry(text: string, values?: any[]): Promise<any> {
  return pool.query(text, values);
}

export default pool;
