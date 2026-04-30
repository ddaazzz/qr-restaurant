import { Request, Response, NextFunction } from "express";
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
export declare function requireFeature(featureName: string): (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
//# sourceMappingURL=featureFlags.d.ts.map