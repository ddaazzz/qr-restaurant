import { Request, Response, NextFunction } from "express";
import pool from "../config/db";

/**
 * Feature flag middleware factory.
 * Returns Express middleware that blocks requests if the specified feature
 * is disabled for the restaurant.
 *
 * Usage:
 *   router.get("/restaurants/:restaurantId/bookings", requireFeature("bookings"), async (req, res) => { ... });
 *
 * Default behavior: if the flag is NOT set in the restaurant's feature_flags JSONB,
 * the feature is considered ENABLED (opt-out model, not opt-in).
 */
export function requireFeature(featureName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId =
        req.params.restaurantId || req.params.id || req.headers["x-restaurant-id"];

      if (!restaurantId) {
        return next(); // No restaurant context — skip check
      }

      const result = await pool.query(
        "SELECT feature_flags FROM restaurants WHERE id = $1",
        [restaurantId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      const flags = result.rows[0].feature_flags || {};

      // Feature is enabled by default unless explicitly set to false
      if (flags[featureName] === false) {
        return res.status(403).json({
          error: `Feature "${featureName}" is not enabled for this restaurant`,
          feature: featureName,
          enabled: false,
        });
      }

      next();
    } catch (err) {
      console.error(`Feature flag check failed for "${featureName}":`, err);
      next(); // Fail open — don't block on DB errors
    }
  };
}
