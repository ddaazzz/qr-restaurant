# Multi-Restaurant Support Implementation

## Overview
The system now properly supports multiple restaurant clients with complete data isolation and role-based access control.

## Key Changes

### 1. **Authentication & Role-Based Access**
- `POST /api/auth/login` - Admin/Staff login by email/password
- `POST /api/auth/staff-login` - Kitchen staff PIN-based login
- Returns: `{ token, role, restaurantId }`
- Roles: `admin`, `staff`, `kitchen`

### 2. **Staff Management** (Admin Only)
- `POST /api/restaurants/:restaurantId/staff` - Create staff/kitchen staff
  - Validates: Email unique per restaurant
  - Validates: PIN is 6 digits
  - Validates: Restaurant exists
  - Only `admin` role can create staff
  
- `GET /api/restaurants/:restaurantId/staff` - List staff for restaurant
  - Returns only `staff` and `kitchen` roles
  - Filters by `restaurant_id`
  
- `DELETE /api/restaurants/:restaurantId/staff/:staffId` - Delete staff
  - Validates staff belongs to restaurant
  - Prevents cross-restaurant deletion

### 3. **Kitchen Dashboard** (Kitchen Role)
- `GET /api/kitchen/items` - Get orders for kitchen
  - Returns all orders with `restaurant_id`
  - Frontend filters by logged-in kitchen staff's `restaurantId`
  - Orders show: table name, items, variants, status, timestamps
  
- `PATCH /api/order-items/:id/status` - Update item status
  - Statuses: `pending`, `preparing`, `served`

### 4. **Data Isolation**
- **Users Table**: `restaurant_id` column ties staff to restaurant
- **Orders/Sessions**: Include `restaurant_id` through `table_sessions`
- **Menu Items**: Restaurant-specific via foreign key relationships
- **Tables**: Restaurant-specific via `restaurant_id`

### 5. **Frontend Validation**
- Admin dashboard: Stored in `localStorage`
  - `token` - JWT token
  - `role` - admin/staff
  - `restaurantId` - restaurant ID (crucial)
  
- Kitchen dashboard: Stored in `sessionStorage`
  - `kitchenStaffLogged` - authentication flag
  - `restaurantId` - restaurant ID
  - `kitchenToken` - JWT token (PIN login)

- Staff/Kitchen login automatically:
  1. Sets `restaurantId` in storage
  2. Redirects based on role
  3. Kitchen role → `/kitchen.html`
  4. Admin role → `/admin.html`

## Security Features

✅ **Email Uniqueness Per Restaurant** - Prevents duplicate emails within same restaurant
✅ **Restaurant Ownership Validation** - Staff deletion only within their restaurant
✅ **Role-Based Route Protection** - Kitchen can only access kitchen orders
✅ **PIN-Based Login** - Secondary authentication for kitchen staff
✅ **Database Constraints** - Role check ensures valid roles only

## Testing Checklist

- [ ] Create staff for restaurant 1
- [ ] Create kitchen staff for restaurant 1
- [ ] Login as kitchen staff - should see kitchen dashboard
- [ ] Kitchen orders filtered by restaurant_id
- [ ] Update order status (pending → preparing → served)
- [ ] Create admin for restaurant 2
- [ ] Verify restaurant 2 has no orders from restaurant 1
- [ ] Delete staff validates restaurant ownership
- [ ] PIN login works correctly

## Future Enhancements

1. Add role-based authorization middleware
2. Implement staff per-restaurant permissions
3. Multi-restaurant admin dashboard
4. Cross-restaurant reporting (for super-admin)
5. Staff activity logging per restaurant
