"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendRestaurantCreationNotification = exports.sendUserRegistrationNotification = exports.sendTelegramNotification = void 0;
const axios_1 = __importDefault(require("axios"));
// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = "8686471631:AAFucOmVrYrjGFNvgyRmV1KHRNNYBPIL7qs";
const TELEGRAM_CHAT_ID = "8320313089";
const TELEGRAM_API_BASE_URL = "https://api.telegram.org/bot";
/**
 * Format notification details into a readable string
 */
const formatDetails = (details) => {
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
const sendTelegramNotification = async (options) => {
    try {
        const { title, message, details } = options;
        // Create formatted message with HTML
        const messageText = `
<b>🔔 ${title}</b>

${message}${formatDetails(details)}
    `.trim();
        const response = await axios_1.default.post(`${TELEGRAM_API_BASE_URL}${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: messageText,
            parse_mode: "HTML",
        });
        if (response.status === 200) {
            console.log("✅ Telegram notification sent successfully");
            return true;
        }
        else {
            console.error("❌ Failed to send Telegram notification:", response.status);
            return false;
        }
    }
    catch (error) {
        console.error("❌ Error sending Telegram notification:", error.message);
        // Don't throw - log error but allow operation to continue
        return false;
    }
};
exports.sendTelegramNotification = sendTelegramNotification;
/**
 * Send user registration notification
 */
const sendUserRegistrationNotification = async (userData) => {
    await (0, exports.sendTelegramNotification)({
        title: "👤 New User Registered",
        message: "A new user has successfully registered an account",
        details: {
            "Email": userData.email,
            "Name": userData.name || "Not provided",
            "Timestamp": new Date().toLocaleString(),
        },
    });
};
exports.sendUserRegistrationNotification = sendUserRegistrationNotification;
/**
 * Send restaurant creation notification
 */
const sendRestaurantCreationNotification = async (restaurantData) => {
    const details = {
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
    await (0, exports.sendTelegramNotification)({
        title: "🍽️ New Restaurant Created",
        message: "A new restaurant has been created",
        details,
    });
};
exports.sendRestaurantCreationNotification = sendRestaurantCreationNotification;
//# sourceMappingURL=telegramService.js.map