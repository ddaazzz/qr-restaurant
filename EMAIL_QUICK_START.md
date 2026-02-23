# 🚀 Email Setup - Quick Start (5 Minutes)

## Step 1: Add Environment Variables
Edit `backend/.env` and add:
```env
CHUIO_EMAIL_ADDRESS=restaurantname.Support@chuio.io
CHUIO_SMTP_HOST=smtp.chuio.io
CHUIO_SMTP_PORT=587
CHUIO_SMTP_USER=restaurantname.Support@chuio.io
CHUIO_SMTP_PASSWORD=YOUR_CHUIO_PASSWORD
```

## Step 2: Get Chuio Credentials
1. Login to chuio.io dashboard
2. Go to Settings → Email/SMTP
3. Copy the SMTP host, port, username, password
4. Paste into `.env` file above

## Step 3: Restart Backend
```bash
# Kill current backend (Ctrl+C)
npm run dev
```

## Step 4: Test It
1. Open Admin Dashboard
2. Click **Orders** tab
3. Find any order
4. Click **✉️ Email** button
5. Enter your email
6. Check your inbox for receipt!

---

## What Was Added

| Component | Location | Purpose |
|-----------|----------|---------|
| **Email Config** | `backend/src/config/emailConfig.ts` | SMTP settings |
| **Email Service** | `backend/src/services/emailService.ts` | Send emails |
| **API Endpoint** | `backend/src/routes/orders.routes.ts` | POST /send-receipt |
| **Frontend Button** | `frontend/admin-orders.js` | ✉️ Email UI |

---

## Error? Try This

❌ **"Failed to send email"**
- Check .env file has all 5 variables
- Verify CHUIO_SMTP_PASSWORD is correct
- Make sure email in CHUIO_EMAIL_ADDRESS is verified in Chuio

❌ **"Email not arriving"**
- Check spam folder
- Verify recipient email is correct
- Wait 1-2 minutes (mail delivery delay)
- Check Chuio dashboard for SMTP logs

❌ **Backend won't start**
- Run: `npm install nodemailer @types/nodemailer`
- Check for syntax errors in `.env`
- Restart with: `npm run dev`

---

## Support Files

📖 **Full Setup Guide:** `EMAIL_SETUP_GUIDE.md`
✅ **Implementation Details:** `EMAIL_IMPLEMENTATION_COMPLETE.md`
📋 **Full Checklist:** `EMAIL_SETUP_CHECKLIST.md`

---

**All set! Your customers can now receive receipts via email. 🎉**
