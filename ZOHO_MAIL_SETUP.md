# 📧 Zoho Mail Setup for support@chuio.io

## Configuration

Your email service is now configured for **Zoho Mail**. Add these environment variables to `backend/.env`:

```env
# Zoho Mail Configuration
EMAIL_FROM_ADDRESS=support@chuio.io
EMAIL_SMTP_HOST=smtp.zoho.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=support@chuio.io
EMAIL_SMTP_PASSWORD=your_zoho_password
EMAIL_SMTP_SECURE=false
```

## Getting Zoho SMTP Credentials

### Step 1: Log in to Zoho Mail
1. Go to [mail.zoho.com](https://mail.zoho.com)
2. Log in with your account
3. Go to **Settings** (gear icon)

### Step 2: Enable SMTP
1. Click **Accounts** in the left sidebar
2. Find your email account (support@chuio.io)
3. Click on it to view settings
4. Look for **SMTP Configuration** or **SMTP Settings**

### Step 3: Get Your Password
- **Important:** Zoho may require an **App-Specific Password** for SMTP
- Go to **Security** → **App Passwords**
- Create a new app password for "Mail - SMTP"
- This password is what goes in `EMAIL_SMTP_PASSWORD`

### Step 4: Verify Settings
- **SMTP Host:** smtp.zoho.com
- **SMTP Port:** 587 (for TLS) or 465 (for SSL)
- **Username:** support@chuio.io
- **Security:** TLS (port 587) or SSL (port 465)

## Example .env Configuration

```env
# Email Configuration (Zoho Mail)
EMAIL_FROM_ADDRESS=support@chuio.io
EMAIL_SMTP_HOST=smtp.zoho.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=support@chuio.io
EMAIL_SMTP_PASSWORD=abc123xyz789
EMAIL_SMTP_SECURE=false
```

## Restart Backend

After adding the variables to `.env`:

```bash
# Stop current backend (Ctrl+C in terminal)
npm run dev
```

## Testing Email

1. Open Admin Dashboard
2. Go to **Orders** tab
3. Click **✉️ Email** button
4. Enter your email address
5. Verify receipt arrives (1-2 minutes)

## Zoho Mail Features

✅ **Professional Email**
- From: support@chuio.io
- Professional formatting
- Mobile-responsive templates

✅ **Reliable Delivery**
- Zoho's email infrastructure
- Good spam reputation
- Delivery tracking

✅ **Security**
- TLS encryption
- Secure credentials
- No plaintext passwords

## Troubleshooting

### "EAUTH" - Authentication Failed
- Verify `EMAIL_SMTP_PASSWORD` is correct
- Check if app-specific password is needed
- Try using the app password instead of account password

### "ECONNREFUSED"
- Verify SMTP host is `smtp.zoho.com`
- Verify port is `587` or `465`
- Check firewall isn't blocking SMTP

### Email Not Arriving
- Check spam folder
- Verify recipient email is correct
- Wait 1-2 minutes for delivery
- Check Zoho Mail logs

### "Invalid email format"
- Ensure recipient email has format: user@domain.com

## Getting Help

If you need to switch email providers in the future:
1. Update `EMAIL_SMTP_HOST` and credentials in `.env`
2. The rest of the code is provider-agnostic
3. Restart backend

---

**Zoho Mail is now configured! 🚀**

Send your first receipt via the Admin Dashboard.
