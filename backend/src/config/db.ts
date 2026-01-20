// Connecting to postgres db and external services
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // from Render environment variable
  ssl: {
    rejectUnauthorized: false, // required for Render PostgreSQL
  },
});


//Switch back to local if necessary
const poollocal = new Pool({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "26334421",
  database: "qr_restaurant",
});

export default pool;
