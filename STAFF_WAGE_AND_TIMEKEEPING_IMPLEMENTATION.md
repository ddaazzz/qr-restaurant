# Staff Wage and Timekeeping Implementation

## Overview
Added complete wage tracking and timekeeping features to the staff management system, allowing admins to:
- Set hourly wage rates for each staff member
- Track clock in/out times
- View work hours and shifts
- Display staff statistics in a detail modal

## Database Changes

### Migration: 021_add_staff_wage_and_timekeeping.sql
Creates the infrastructure for wage and timekeeping:

**Table: users** (modified)
- Added `hourly_rate_cents BIGINT` - Stores hourly wage in cents (supports decimals: $15.50 = 1550)

**Table: staff_timekeeping** (new)
- `id` - Primary key
- `user_id` - Foreign key to staff member
- `restaurant_id` - For multi-tenant isolation
- `clock_in_at TIMESTAMP` - When staff clocked in
- `clock_out_at TIMESTAMP` - When staff clocked out (NULL if still working)
- `duration_minutes INTEGER` - Total minutes worked (calculated on clock out)
- Indexes for fast lookups by user, restaurant, and date

## Backend Changes

### File: backend/src/routes/auth.routes.ts

#### POST /restaurants/:restaurantId/staff (Create Staff)
- Added `hourly_rate_cents` parameter (optional)
- Validates hourly rate is non-negative

#### GET /restaurants/:restaurantId/staff (List Staff)
- Added `hourly_rate_cents` field to response
- Added `currently_clocked_in` boolean subquery to show live clock status

#### GET /restaurants/:restaurantId/staff/:staffId (Get Single Staff)
- **NEW**: Includes timekeeping data:
  - `hourly_rate_cents` - Hourly wage
  - `currently_clocked_in` - Boolean for active clock-in
  - `timekeeping` - Array of last 30 days' shifts (5 fields each)
  - `stats` - Object with `total_shifts` and `total_hours` (last 30 days)

#### PATCH /restaurants/:restaurantId/staff/:staffId (Update Staff)
- Added `hourly_rate_cents` parameter (optional)
- Validates hourly rate is non-negative

#### POST /restaurants/:restaurantId/staff/:staffId/clock-in (New Endpoint)
- Creates new timekeeping record with current timestamp
- Checks for existing active clock-in (prevents double clocking)
- Returns created record with ID and clock_in_at

#### POST /restaurants/:restaurantId/staff/:staffId/clock-out (New Endpoint)
- Finds active timekeeping record (clock_out_at IS NULL)
- Calculates duration in minutes
- Updates record with clock_out_at and duration_minutes
- Returns updated record

#### GET /restaurants/:restaurantId/staff/:staffId/timekeeping (New Endpoint)
- Returns completed shifts only (clock_out_at IS NOT NULL)
- Supports pagination: `limit` and `offset` query params
- Includes formatted date for frontend display
- Orders by clock_in_at DESC (most recent first)

## Frontend Changes

### File: frontend/admin-staff.html

#### Staff Form Updates
- Added new form field: "Hourly Rate (Optional)"
- Input type: number with step 0.01 and min 0
- Located after Role field in the form

#### Staff Detail Modal (New Section)
New modal (#staff-detail-modal) with comprehensive staff information:

**Info Section**
- Staff name, role, PIN (masked in UI)
- Hourly rate display ($XX.XX/hr format)
- Current clock status (🟢 Clocked In or ⚪ Clocked Out)

**Clock In/Out Section**
- Two buttons: "▶ Clock In" and "⏹ Clock Out"
- Only one button visible at a time based on current status
- Message area for success/error feedback
- Uses green for success, red for errors

**Work Hours Summary**
- **Days Worked**: Count of completed shifts in last 30 days
- **Total Hours**: Sum of all work hours (rounded to 1 decimal)
- Based on staff_timekeeping data with duration_minutes

**Work Log**
- Shows last 30 days of shifts
- Each entry displays:
  - Date (YYYY-MM-DD format)
  - Clock-in and clock-out times
  - Total hours worked (with "Still working" if no clock-out)
- Scrollable list with max-height 300px

**Action Buttons**
- "✏️ Edit Staff" - Opens edit form
- "🗑️ Delete Staff" - Deletes staff after confirmation

### File: frontend/admin-staff.js

#### Staff Card Click Handlers
- Staff cards now clickable (when not in edit mode)
- Cursor changes to pointer when hoverable
- Click opens detail modal for that staff member

#### loadStaff() Updates
- Added click listeners to staff cards
- Sets cursor to 'pointer' when not in edit mode
- Only add click handler if not in STAFF_EDIT_MODE

#### createOrUpdateStaff() Updates
- Reads hourly rate input value
- Validates hourly rate (positive number or empty)
- Converts dollars to cents: `Math.round(rate * 100)`
- Includes `hourly_rate_cents` in API payload

#### editStaff() Updates
- Loads hourly_rate_cents from backend
- Converts cents back to dollars for display: `(cents / 100).toFixed(2)`
- Populates hourly rate field in form

#### New Modal Functions

**openStaffDetailModal(staffId)**
- Sets CURRENT_STAFF_ID global
- Shows modal (#staff-detail-modal)
- Calls loadStaffDetailData()

**closeStaffDetailModal()**
- Hides modal
- Clears CURRENT_STAFF_ID
- Resets form state

**loadStaffDetailData()**
- Fetches single staff record with timekeeping data
- Updates all modal fields:
  - Staff name, role, PIN
  - Hourly wage (formatted)
  - Clock status and button visibility
  - Work hours summary (shifts, total hours)
  - Timekeeping list
- Handles errors gracefully

**displayTimekeepingList(records)**
- Formats timekeeping array for display
- Shows "No work history" if empty
- Renders each shift with date, times, and hours
- Shows "Still working" for records without clock_out_at

**clockInStaff()**
- POSTs to clock-in endpoint
- Shows success message (🟢 with green text)
- Reloads staff details on success
- Shows error message (✗ with red text) on failure

**clockOutStaff()**
- POSTs to clock-out endpoint
- Shows success message on completion
- Reloads staff details to update work hours
- Shows error message if fails

**editStaffFromModal()**
- Closes detail modal
- Calls editStaff() to switch to edit mode

**deleteStaffFromModal()**
- Confirms deletion
- Deletes staff record
- Closes detail modal

## API Contracts

### Clock In Request
```http
POST /restaurants/{restaurantId}/staff/{staffId}/clock-in
Content-Type: application/json

Response 201:
{
  "id": "uuid",
  "clock_in_at": "2024-02-16T10:30:00Z"
}
```

### Clock Out Request
```http
POST /restaurants/{restaurantId}/staff/{staffId}/clock-out
Content-Type: application/json

Response 200:
{
  "id": "uuid",
  "clock_in_at": "2024-02-16T10:30:00Z",
  "clock_out_at": "2024-02-16T18:45:00Z",
  "duration_minutes": 495
}
```

### Get Staff with Timekeeping
```http
GET /restaurants/{restaurantId}/staff/{staffId}

Response 200:
{
  "id": "uuid",
  "name": "John Smith",
  "role": "staff",
  "pin": "123456",
  "hourly_rate_cents": 1550,  // $15.50/hr
  "currently_clocked_in": true,
  "timekeeping": [
    {
      "id": "uuid",
      "clock_in_at": "2024-02-16T10:30:00Z",
      "clock_out_at": "2024-02-16T18:45:00Z",
      "duration_minutes": 495,
      "work_date": "2024-02-16"
    },
    // ... more shifts
  ],
  "stats": {
    "total_shifts": 12,
    "total_hours": 95.5
  }
}
```

## Data Conversion Notes

### Hourly Rate Storage
- **Database**: Stored in cents as BIGINT (1550 = $15.50)
- **Frontend Input**: User enters decimal (15.50)
- **Conversion**: 
  - To database: `Math.round(parseFloat(input) * 100)`
  - To display: `(cents / 100).toFixed(2)`

### Duration Calculation
- **Storage**: Stored in minutes as INTEGER
- **Display**: Converted to hours with 1 decimal: `(minutes / 60).toFixed(1)`
- **Calculation**: `Math.round((clockOutTime - clockInTime) / 60000)`

## Features Implemented

✅ Set hourly wage rate when creating/editing staff
✅ Clock in button creates timekeeping record
✅ Clock out button calculates work duration
✅ Prevents double clock-in
✅ Display last 30 days of work history
✅ Show total days worked and hours
✅ Display current clock status (in/out)
✅ Modal interface for staff details
✅ Click staff card to open detail modal
✅ Success/error messages for clock operations
✅ Formatted times and dates in work log

## Testing Checklist

- [ ] Create staff with hourly rate
- [ ] Create staff without hourly rate (should be optional)
- [ ] Edit staff to add/modify hourly rate
- [ ] Click staff card to open detail modal
- [ ] Clock in staff member
- [ ] Verify currently_clocked_in shows true
- [ ] Clock out staff member
- [ ] Verify work hours calculated correctly
- [ ] Check work log displays shift history
- [ ] Verify days worked and total hours in summary
- [ ] Test multiple shifts in work log
- [ ] Test clock-in error when already clocked in
- [ ] Test edit staff from modal
- [ ] Test delete staff from modal
- [ ] Test modal closes on background click
- [ ] Test close button (X) closes modal

## Migration Application

To apply the database migration:

```bash
cd backend
npx ts-node scripts/run-all-migrations.ts
```

This will:
1. Add `hourly_rate_cents` column to `users` table
2. Create `staff_timekeeping` table with indexes
3. Enable timekeeping functionality

## Known Limitations

1. Wage/timekeeping is per-restaurant (staffId is not globally unique)
2. Clock-out without clock-in returns error (staff must clock in first)
3. Timekeeping history limited to last 30 days in modal display
4. Duration is stored in minutes, not fractional hours
5. No support for manual time entry (only automatic clock in/out)

## Future Enhancements

- [ ] Add time correction/manual edit capability
- [ ] Implement break tracking (separate from total work time)
- [ ] Add payroll report generation
- [ ] Implement weekly/monthly wage calculations
- [ ] Add overtime tracking
- [ ] Implement shift scheduling
- [ ] Add mobile clock in/out QR code
- [ ] Track absences and late arrivals
- [ ] Add manager approval workflow
