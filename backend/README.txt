Demo Restaurant Credentials:

Admin:
Admin@example.com
AdminPassword123

Staff:
Staff@example.com
StaffPassword123

Kitchen:
Kitchen@example.com
KitchenPassword123
-------------------------------------------------------------------------------------------------------------
This is the backend of the qr booking and ordering system.
It should consist of : 
🔐 Authentication & Authorization
- Restaurant owner login
- Staff login
- Role permissions (Owner vs Staff)

🍽 Menu Management
- Create/edit/delete menu items
- Toggle availability (sold out / 86)
- Categories & pricing

🪑 Table & QR Logic
- Tables per restaurant
- Table sessions
- QR token validation
- Prevent fake table IDs

🧾 Order System
- Create orders
- Attach orders to table
- Order status flow:
- Order history

💳 Payments (Later)
- Stripe payment intents
- Webhook verification
- Mark orders as paid

⚡ Real-Time Events
- Push new orders to kitchen/admin
- Update order status live

🗄 Database Access
- PostgreSQL queries
- Transactions
- Indexes