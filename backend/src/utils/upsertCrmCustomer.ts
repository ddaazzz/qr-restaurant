import pool from "../config/db";

/**
 * Upsert a customer into crm_customers based on a booking or session.
 *
 * Logic:
 *  - If a customer with the same phone already exists for this restaurant → update name/email if missing.
 *  - Otherwise if a customer with the same name (and no phone) exists → update phone/email if now provided.
 *  - Otherwise insert a new row.
 *
 * Fire-and-forget safe: errors are logged but never thrown so they never break the parent request.
 */
export async function upsertCrmCustomer(opts: {
  restaurantId: number | string;
  name: string | null | undefined;
  phone?: string | null;
  email?: string | null;
}): Promise<void> {
  const { restaurantId, name, phone, email } = opts;

  const trimmedName  = (name  || '').trim();
  const trimmedPhone = (phone || '').trim() || null;
  const trimmedEmail = (email || '').trim() || null;

  if (!trimmedName) return; // nothing to save

  try {
    await pool.query(
      `
      WITH existing AS (
        SELECT id FROM crm_customers
        WHERE restaurant_id = $1
          AND (
            ($2::text IS NOT NULL AND phone = $2)
            OR ($2 IS NULL AND name = $3 AND (phone IS NULL OR phone = ''))
          )
        LIMIT 1
      )
      INSERT INTO crm_customers (restaurant_id, name, phone, email, total_visits, created_at, updated_at)
      SELECT $1, $3, $2, $4, 1, NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM existing)
      ON CONFLICT DO NOTHING;

      UPDATE crm_customers
      SET
        phone      = COALESCE(phone,      $2),
        email      = COALESCE(email,      $4),
        name       = CASE WHEN name IS NULL OR name = '' THEN $3 ELSE name END,
        updated_at = NOW()
      WHERE restaurant_id = $1
        AND (
          ($2::text IS NOT NULL AND phone = $2)
          OR ($2 IS NULL AND name = $3 AND (phone IS NULL OR phone = ''))
        );
      `,
      [restaurantId, trimmedPhone, trimmedName, trimmedEmail]
    );
  } catch (err: any) {
    // Non-fatal — CRM sync failure must never break order/booking flows
    console.warn('[CRM] upsertCrmCustomer failed silently:', err.message);
  }
}
