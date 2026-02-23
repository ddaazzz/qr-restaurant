# Email Configuration for Chuio.io

Add the following environment variables to your `.env` file in the `backend/` directory:

## SMTP Configuration Variables

```env
# Chuio Email Setup
CHUIO_EMAIL_ADDRESS=restaurantname.Support@chuio.io
CHUIO_SMTP_HOST=smtp.chuio.io
CHUIO_SMTP_PORT=587
CHUIO_SMTP_USER=restaurantname.Support@chuio.io
CHUIO_SMTP_PASSWORD=your_chuio_password_here
```

## How to Get Your Chuio SMTP Credentials

1. Log in to your Chuio dashboard
2. Navigate to Email Settings
3. Find SMTP Configuration
4. Copy the SMTP host, port, username, and password
5. Add them to the `.env` file as shown above

## Important Notes

- **SMTP Port**: Usually 587 (TLS) or 465 (SSL). Chuio.io typically uses 587
- **From Address**: Must match your Chuio verified email address
- **Password**: Use your Chuio SMTP password (may differ from login password)
- **Email Format**: `restaurantname.Support@chuio.io` (or whatever your domain/subdomain is)

## Testing Email Functionality

After setting environment variables:

1. Restart the backend: `npm run dev`
2. Go to Admin Dashboard → Orders
3. Click the ✉️ Email button on an order
4. Enter a test email and submit
5. Check if receipt was received

## Troubleshooting

### "Failed to send email" error
- Verify SMTP credentials in `.env`
- Check that the email address is verified in Chuio
- Ensure SMTP port is correct (587 for TLS)
- Check network connectivity to smtp.chuio.io

### Email not arriving
- Check spam/junk folder
- Verify recipient email address is correct
- Check Chuio SMTP logs for delivery failures
- Ensure CHUIO_EMAIL_ADDRESS matches your verified domain

### "Invalid email format"
- Ensure customer email has correct format (user@domain.com)
- Check for extra spaces in the input

## Email Features

The system supports:
- ✅ Receipt emails with formatted order details
- ✅ HTML and plain text versions
- ✅ Professional email templates with restaurant name
- ✅ Order number in subject line
- ✅ Print receipt button (client-side)
- ✅ Delivery status notifications

## API Endpoint

```
POST /restaurants/{restaurantId}/orders/{orderId}/send-receipt

Body:
{
  "email": "customer@example.com",
  "content": "... formatted receipt text ..."
}

Response:
{
  "success": true,
  "message": "Receipt sent successfully",
  "messageId": "..."
}
```
