# QR Restaurant AI - Copilot Instructions

---

## ⚠️ CRITICAL: Dev-Only Policy — Read Before Anything Else

**All code changes, commits, and deployments target the `dev` branch and `dev.chuio.io` environment ONLY.**

### Rules — enforced without exception unless user explicitly says otherwise:

1. **Branch**: Always work on `dev`. Never `git checkout main`, `git push origin main`, or merge `dev → main` unless the user explicitly says "merge to main" or "deploy to production".

2. **API URLs in code**: Use `https://dev.chuio.io` as the backend URL for any dev/test context. Never hardcode `https://chuio.io` (production) into source code unless the user explicitly requests a production change.

3. **Database**: The dev database is `chuio_dev_db` on `dpg-d7gq5j4p3tds73a44eo0-a.singapore-postgres.render.com`. Never run migrations, `psql`, or destructive queries against the production database without explicit instruction.

4. **Mobile builds**: The mobile app is a **React Native app built and run via Xcode**. It is **NOT run with Expo Go or `expo start`**. The app is compiled as a native iOS binary via Xcode — never suggest using Expo Go, `npx expo start`, or the Expo dev client to run or test the app.

   **Testing**: The app is tested by running it directly in **Xcode on the iOS Simulator** (or a connected device). There is no OTA update workflow for dev — redeploying Render **only updates the backend**. Any mobile JS/TS code change requires re-running the Xcode build to take effect. Never suggest pushing an EAS OTA update (`eas update`) as a way to deliver mobile changes during development.

   The `mobile/.env.local` file must always contain **both** of these lines for day-to-day development:
   ```
   EXPO_PUBLIC_API_URL=https://dev.chuio.io
   EXPO_PUBLIC_APP_ENV=dev
   ```
   The dev banner (`IS_DEV_BUILD`) and API URL both depend on these being set together. If `EXPO_PUBLIC_APP_ENV` is missing from `.env.local`, the build falls through to `.env.production` which sets it to `production` — causing no dev banner and pointing the app at `https://chuio.io`. Always ensure both lines are present after any script restores this file. The only exception is when running `scripts/bundle-production.sh` immediately before an Xcode App Store Archive — `scripts/bundle-dev.sh` must be run immediately after to restore both lines.

5. **Render services**: There are two Render services — `dev.chuio.io` (dev) and `chuio.io` (prod). Dev deploys from `dev` branch; prod deploys from `main` branch. Never suggest or perform actions that affect the `main`-based production Render service unless told to merge.

6. **Migrations**: Write and run new SQL migrations against the dev database only. Mirror to production only on explicit merge instruction.

7. **Secrets and environment variables**: The dev and prod environments use separate secrets. When generating `.env` snippets or editing env config, use dev values unless a production context is explicitly requested.

8. **Git operations to avoid without explicit approval**:
   - `git push origin main`
   - `git checkout main`
   - `git merge dev` (on main)
   - `git reset --hard` or `git push --force`
   - Any command that writes to the production database

### When the user says "merge to main" or "go to production":
Only then switch to `main` branch, merge `dev → main`, push, and confirm Render will redeploy `chuio.io`.

---

## System Architecture

**Frontend-Backend Split:**
- **Frontend** (`frontend/`): Vanilla JavaScript + HTML/CSS (no frameworks)
  - `admin.html/js` - Restaurant admin dashboard (menu, tables, staff, reports, settings)
  - `kitchen.html/js` - Kitchen staff dashboard (order queue by table)
  - `login.html/js` - Multi-role authentication (admin/staff/kitchen via JWT)
  - `menu.js` - Customer QR menu ordering interface
  
- **Backend** (`backend/src/`): Express.js + PostgreSQL
  - Route files map to API endpoints: `POST /api/{resource}`
  - Database: PostgreSQL with migrations in `backend/migrations/`
  - Environment: `PORT` (default 10000), `DATABASE_URL` required

**Critical Data Flow:**
1. QR scan (`POST /scan/:qrToken`) → retrieves `table_id`, `restaurant_id`, `session_id`
2. Orders placed (`POST /sessions/{id}/orders`) → creates order with variant options validated
3. Kitchen views orders (`GET /api/kitchen/items`) → filtered by `restaurant_id`
4. Session closed (`PATCH /sessions/{id}/close`) → triggers POS webhook if configured

## Multi-Restaurant Design

**Key Principle:** All data is scoped by `restaurant_id` - this is the primary isolation boundary.

- **Users** (staff/kitchen): Have `restaurant_id` column, PIN-based kitchen login uses 6-digit PIN
- **Tables/Sessions/Orders:** Link through `table_sessions.restaurant_id` 
- **Menu Items:** Store `restaurant_id` directly
- **Routes:** All admin operations validate staff belongs to requested restaurant

**localStorage Keys (Frontend):**
- `restaurantId` - Current restaurant context (CRITICAL - used in every API call)
- `token` - JWT token
- `role` - "admin" | "staff" | "kitchen" | "superadmin"

## Build & Development

**Commands:**
- `npm run dev` (root dir) - Runs backend on `:10000` with hot-reload via `ts-node-dev`
- `npm run build` - TypeScript compilation to `dist/`
- Backend serves frontend from `frontend/` directory at `/` (static files with `index: false`)
- No frontend build process - changes in `frontend/*.js` are live

**Static Files:**
- Routes mounted in `app.ts` order matters:
  1. API routes (`/api/*`)
  2. Uploads (`/uploads/*`)
  3. Frontend static files (must use `express.static` with `index: false` to avoid conflicts)
  4. Catch-all page routes

## Conventions & Patterns

**Database Queries:**
- Always use parameterized queries: `pool.query("SELECT * FROM table WHERE id = $1", [id])`
- Check `rowCount` to verify mutations: `if (res.rowCount === 0) return 404`

**Frontend API Calls:**
- Base URL: `API` variable set in `admin.js` line 3 (localhost vs production)
- Every endpoint needs `restaurantId` in the URL or body
- Translations via `data-i18n="key"` attributes + `translations.js` i18n system

**Order Variants (Complex):**
- Options stored in `menu_item_variant_options` table
- Order placement validates: required variants filled, min/max selections respected
- See `orders.routes.ts` for validation logic (~100 lines of rules per item)

**Session Management:**
- `table_sessions` created by admin/staff (not automatic on QR scan)
- Reopenable: `ended_at IS NULL` check finds active sessions
- Bill closure: saves to `bill_closures` audit table + sends webhook to POS if configured

**POS Integration:**
- Webhook URL/API key stored in `restaurants.pos_webhook_url` / `restaurants.pos_api_key`
- Sent on bill close: `POST webhookUrl` with order/payment details
- `bill_closures` table tracks webhook success/failure

## Key Files by Task

| Task | Key Files |
|------|-----------|
| Add menu item feature | `menu.routes.ts`, `admin.js` ~menu functions, `admin.html` |
| Fix kitchen dashboard order display | `kitchen.html/js`, `kitchen.routes.ts` (GET /api/kitchen/items) |
| Add staff member | `staff.routes.ts` (POST /restaurants/:id/staff), validate uniqueness per restaurant |
| Modify table settings | `tables.routes.ts`, `admin.js` loadTables/saveTables |
| Change translations | `frontend/translations.js` - add/update i18n keys, use `data-i18n="key"` in HTML |
| Debug session/order flow | `sessions.routes.ts` (start/end), `orders.routes.ts` (create/update status) |
| POS webhook testing | See `backend/migrations/003_add_bill_closure_and_pos_integration.sql` for schema |

## Common Gotchas

1. **restaurantId missing** - Most admin API calls fail silently if `restaurantId` not in URL. Check `localStorage.getItem("restaurantId")`
2. **Variant validation** - Orders validate all selected options belong to menu item variants; missing this breaks order creation
3. **Session state** - QR scan doesn't create session; admin must start it. Check `ended_at IS NULL` for active sessions
4. **Frontend hot-reload** - Works for `.js` files; restart backend if `app.ts` routes change
5. **SSL/POS webhooks** - Render deployment uses `ssl: { rejectUnauthorized: false }` in DB config
6. **Order status transitions** - Order marked "paid" only via successful webhook, never just from frontend state

## Per-Restaurant Customization (Branch Model)

**How it works:**
- `main` branch = shared platform for all default restaurants (deployed at chuio.io)
- `restaurant/<name>` branches = forked copies with their own deployment + database
- Customized restaurants are version-pinned — they don't auto-receive `main` updates
- The mobile app is a single binary; it connects to whichever `apiBaseUrl` the login response returns

**Key rule:** If you're on `main`, never make restaurant-specific changes. Use a `restaurant/` branch instead.

**Database column:** `restaurants.api_base_url` — NULL means use main platform, a URL means redirect mobile + API calls there.

**Copilot files:**
- Agent: `.github/agents/restaurant-customizer.agent.md` — use `@restaurant-customizer` for customization work
- Instructions: `.github/instructions/restaurant-customization.instructions.md`
- Prompt: `.github/prompts/customize-restaurant.prompt.md` — use `/customize-restaurant <name>`
