"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireFeature = requireFeature;
const db_1 = __importDefault(require("../config/db"));
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
function requireFeature(featureName) {
    return async (req, res, next) => {
        try {
            const restaurantId = req.params.restaurantId || req.params.id || req.headers["x-restaurant-id"];
            if (!restaurantId) {
                return next(); // No restaurant context — skip check
            }
            let flags = {};
            try {
                const result = await db_1.default.query("SELECT feature_flags FROM restaurants WHERE id = $1", [restaurantId]);
                if (result.rowCount === 0) {
                    return res.status(404).json({ error: "Restaurant not found" });
                }
                flags = result.rows[0].feature_flags || {};
            }
            catch (dbErr) {
                // If the feature_flags column doesn't exist, treat flags as an empty object (enabled by default)
                if (dbErr.message && dbErr.message.includes("feature_flags")) {
                    console.warn("feature_flags column missing in restaurants table, defaulting to all enabled.");
                    flags = {};
                }
                else {
                    // Re-throw other DB errors to be caught por the outer catch block
                    throw dbErr;
                }
            }
            // Feature is enabled by default unless explicitly set to false
            if (flags[featureName] === false) {
                return res.status(403).json({
                    error: `Feature "${featureName}" is not enabled for this restaurant`,
                    feature: featureName,
                    enabled: false,
                });
            }
            next();
        }
        catch (err) {
            console.error(`Feature flag check failed for "${featureName}":`, err);
            next(); // Fail open — don't block on DB errors
        }
    };
}
//# sourceMappingURL=featureFlags.js.map