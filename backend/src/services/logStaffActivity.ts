import pool from "../config/db";
import { STAFF_ACTIONS } from "../constants/staffActions";

type StaffAction = typeof STAFF_ACTIONS[keyof typeof STAFF_ACTIONS];

interface LogStaffActivityInput {
  restaurantId: number;
  staffId?: number;
  action: StaffAction;
  meta?: Record<string, any>;
}

export async function logStaffActivity({
  restaurantId,
  staffId,
  action,
  meta = {},
}: LogStaffActivityInput): Promise<void> {
  if (!restaurantId || !action) return;

  try {
    await pool.query(
      `
      INSERT INTO staff_activity_logs
        (restaurant_id, staff_id, action, meta)
      VALUES
        ($1, $2, $3, $4)
      `,
      [
        restaurantId,
        staffId ?? null,
        action,
        meta,
      ]
    );
  } catch (err) {
    // Logging must never break app flow
    console.error("Staff activity log failed:", err);
  }
}
