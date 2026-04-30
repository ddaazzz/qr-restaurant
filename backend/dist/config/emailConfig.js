"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmailFromAddress = exports.getEmailTransporter = void 0;
const nodemailer = __importStar(require("nodemailer"));
const emailConfig = {
    smtp: {
        host: process.env.EMAIL_SMTP_HOST || "smtp.zoho.com",
        port: parseInt(process.env.EMAIL_SMTP_PORT || "587"),
        secure: process.env.EMAIL_SMTP_SECURE === "true" ? true : false, // true for 465, false for 587
        auth: {
            user: process.env.EMAIL_SMTP_USER || process.env.EMAIL_FROM_ADDRESS,
            pass: process.env.EMAIL_SMTP_PASSWORD,
        },
    },
    from: process.env.EMAIL_FROM_ADDRESS || "noreply@zoho.com",
};
// Create transporter once (reusable)
let transporter = null;
const getEmailTransporter = () => {
    if (!transporter) {
        transporter = nodemailer.createTransport(emailConfig.smtp);
    }
    return transporter;
};
exports.getEmailTransporter = getEmailTransporter;
const getEmailFromAddress = () => emailConfig.from;
exports.getEmailFromAddress = getEmailFromAddress;
exports.default = emailConfig;
//# sourceMappingURL=emailConfig.js.map