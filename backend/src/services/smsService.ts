import twilio from "twilio";

let _client: ReturnType<typeof twilio> | null = null;

function getTwilioClient() {
  if (_client) return _client;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio credentials not configured");
  _client = twilio(sid, token);
  return _client;
}

/**
 * Send a 6-digit OTP via SMS using Twilio.
 * Returns true on success, false on failure.
 */
export async function sendSmsOtp(phone: string, code: string): Promise<boolean> {
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  if (!fromNumber) {
    console.error("[SMS] TWILIO_FROM_NUMBER not set");
    return false;
  }
  try {
    const client = getTwilioClient();
    await client.messages.create({
      body: `Your verification code is: ${code}`,
      from: fromNumber,
      to: phone,
    });
    return true;
  } catch (err) {
    console.error("[SMS] Failed to send OTP:", err);
    return false;
  }
}
