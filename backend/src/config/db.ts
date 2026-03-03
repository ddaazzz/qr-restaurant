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
};

// Only enable SSL for production or remote databases
if (isProduction || !isLocalhost) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

export default pool;
