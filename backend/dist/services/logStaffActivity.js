"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logStaffActivity = logStaffActivity;
const db_1 = __importDefault(require("../config/db"));
async function logStaffActivity({ restaurantId, staffId, action, meta = {}, }) {
    if (!restaurantId || !action)
        return;
    try {
        await db_1.default.query(`
      INSERT INTO staff_activity_logs
        (restaurant_id, staff_id, action, meta)
      VALUES
        ($1, $2, $3, $4)
      `, [
            restaurantId,
            staffId ?? null,
            action,
            meta,
        ]);
    }
    catch (err) {
        // Logging must never break app flow
        console.error("Staff activity log failed:", err);
    }
}
//# sourceMappingURL=logStaffActivity.js.map