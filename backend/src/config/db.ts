// Connecting to postgres db and external services
import { Pool } from "pg";

const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "26334421",
  database: "qr_restaurant",
});

export default pool;
