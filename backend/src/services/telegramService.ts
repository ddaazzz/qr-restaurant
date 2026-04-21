import axios from "axios";

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = "8686471631:AAFucOmVrYrjGFNvgyRmV1KHRNNYBPIL7qs";
const TELEGRAM_CHAT_ID = "8320313089";
const TELEGRAM_API_BASE_URL = "https://api.telegram.org/bot";

interface TelegramNotificationOptions {
  title: string;
  message: string;
  details?: Record<string, string | number>;
}

/**
 * Format notification details into a readable string
 */
const formatDetails = (details?: Record<string, string | number>): string => {
  if (!details || Object.keys(details).length === 0) {
    return "";
  }

  const formattedLines = Object.entries(details)
    .map(([key, value]) => `<b>${key}:</b> ${value}`)
    .join("\n");

  return `\n\n${formattedLines}`;
};

/**
 * Send a notification to the Telegram chat
 */
export const sendTelegramNotification = async (
  options: TelegramNotificationOptions
): Promise<boolean> => {
  try {
    const { title, message, details } = options;

    // Create formatted message with HTML
    const messageText = `
<b>🔔 ${title}</b>

${message}${formatDetails(details)}
    `.trim();

    const response = await axios.post(
      `${TELEGRAM_API_BASE_URL}${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: messageText,
        parse_mode: "HTML",
      }
    );

    if (response.status === 200) {
      console.log("✅ Telegram notification sent successfully");
      return true;
    } else {
      console.error("❌ Failed to send Telegram notification:", response.status);
      return false;
    }
  } catch (error: any) {
    console.error("❌ Error sending Telegram notification:", error.message);
    // Don't throw - log error but allow operation to continue
    return false;
  }
};

/**
 * Send user registration notification
 */
export const sendUserRegistrationNotification = async (userData: {
  email: string;
  name?: string;
}): Promise<void> => {
  await sendTelegramNotification({
    title: "👤 New User Registered",
    message: "A new user has successfully registered an account",
    details: {
      "Email": userData.email,
      "Name": userData.name || "Not provided",
      "Timestamp": new Date().toLocaleString(),
    },
  });
};

/**
 * Send restaurant creation notification
 */
export const sendRestaurantCreationNotification = async (restaurantData: {
  restaurantName: string;
  address?: string;
  phone?: string;
  country?: string;
  email?: string;
}): Promise<void> => {
  const details: Record<string, string | number> = {
    "Restaurant Name": restaurantData.restaurantName,
  };

  if (restaurantData.address) {
    details["Address"] = restaurantData.address;
  }
  if (restaurantData.phone) {
    details["Phone"] = restaurantData.phone;
  }
  if (restaurantData.country) {
    details["Country"] = restaurantData.country;
  }
  if (restaurantData.email) {
    details["Created By"] = restaurantData.email;
  }

  details["Timestamp"] = new Date().toLocaleString();

  await sendTelegramNotification({
    title: "🍽️ New Restaurant Created",
    message: "A new restaurant has been created",
    details,
  });
};
