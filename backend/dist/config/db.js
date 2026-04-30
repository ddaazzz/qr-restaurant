"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is undefined");
}
// SSL configuration: use SSL only in production or if explicitly required
const isProduction = process.env.NODE_ENV === 'production';
const dbUrl = process.env.DATABASE_URL;
// Check if the DATABASE_URL is localhost (local development)
const isLocalhost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
const poolConfig = {
    connectionString: process.env.DATABASE_URL,
};
// Only enable SSL for production or remote databases
if (isProduction || !isLocalhost) {
    poolConfig.ssl = { rejectUnauthorized: false };
}
const pool = new pg_1.Pool(poolConfig);
exports.default = pool;
//# sourceMappingURL=db.js.map