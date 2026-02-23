# 📧 Email Setup - Quick Reference

## Current Configuration: Zoho Mail

Your system is now configured for **Zoho Mail** with support@chuio.io

### Add to backend/.env

```env
EMAIL_FROM_ADDRESS=support@chuio.io
EMAIL_SMTP_HOST=smtp.zoho.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=support@chuio.io
EMAIL_SMTP_PASSWORD=your_app_password_from_zoho
EMAIL_SMTP_SECURE=false
```

### Get Zoho Credentials

1. Log in to [mail.zoho.com](https://mail.zoho.com)
2. Go to **Settings** → **Accounts** → select your email
3. Find **SMTP Configuration**
4. For password, create **App Password** in Security settings
5. Copy credentials to `.env`

### Restart Backend

```bash
npm run dev
```

### Test Email

1. Admin Dashboard → Orders
2. Click ✉️ Email on any order
3. Enter your email
4. Check inbox ✅

---

## For Other Email Providers

The system supports any SMTP provider by changing these variables:

```env
EMAIL_FROM_ADDRESS=your_email@domain.com
EMAIL_SMTP_HOST=smtp.provider.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your_username
EMAIL_SMTP_PASSWORD=your_password
EMAIL_SMTP_SECURE=false  # true for port 465, false for 587
```

**Supported Providers:**
- ✅ Zoho Mail (default)
- ✅ Gmail (with app password)
- ✅ Office 365
- ✅ SendGrid
- ✅ AWS SES
- ✅ Any SMTP provider

---

**See also:** [ZOHO_MAIL_SETUP.md](ZOHO_MAIL_SETUP.md) for detailed Zoho configuration
