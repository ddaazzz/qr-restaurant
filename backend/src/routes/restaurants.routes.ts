import { Router } from "express";
import pool from "../config/db";

const router = Router();

router.get("/", async (_req, res) => {
  const result = await pool.query("SELECT * FROM restaurants");
  res.json(result.rows);
});

export default router;
