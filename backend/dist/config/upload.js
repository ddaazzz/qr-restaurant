"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadDocuments = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const storage_1 = require("./storage");
const getRestaurantIdForUpload = (req) => {
    const routeParamId = req.params?.restaurantId || req.params?.id;
    if (typeof routeParamId === "string" && routeParamId.trim()) {
        return routeParamId;
    }
    const urlMatch = req.originalUrl.match(/\/restaurants\/(\d+)/);
    if (urlMatch?.[1]) {
        return urlMatch[1];
    }
    const bodyRestaurantId = req.body?.restaurantId;
    if (typeof bodyRestaurantId === "string" && bodyRestaurantId.trim()) {
        return bodyRestaurantId;
    }
    const headerRestaurantId = req.headers["x-restaurant-id"];
    if (typeof headerRestaurantId === "string" && headerRestaurantId.trim()) {
        return headerRestaurantId;
    }
    return null;
};
const storage = multer_1.default.diskStorage({
    destination: (req, _file, cb) => {
        let folder = "uploads";
        const restaurantId = getRestaurantIdForUpload(req);
        // Extract restaurantId from URL path for restaurant-specific folders
        if (req.originalUrl.includes("/logo")) {
            folder = restaurantId ? `uploads/restaurants/${restaurantId}` : "uploads/restaurants";
        }
        else if (req.originalUrl.includes("/background")) {
            folder = restaurantId ? `uploads/restaurants/${restaurantId}` : "uploads/restaurants";
        }
        else if (req.originalUrl.includes("/menu-items")) {
            folder = restaurantId ? `uploads/restaurants/${restaurantId}/menu` : "uploads/menu";
        }
        else if (req.originalUrl.includes("/payment-terminal-applications")) {
            folder = restaurantId ? `uploads/restaurants/${restaurantId}/documents` : "uploads/documents";
        }
        // Ensure folder exists
        fs_1.default.mkdirSync(folder, { recursive: true });
        cb(null, folder);
    },
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        const name = crypto_1.default.randomBytes(16).toString("hex");
        cb(null, `${name}${ext}`);
    }
});
exports.upload = (0, multer_1.default)({
    storage: (0, storage_1.isR2Configured)() ? multer_1.default.memoryStorage() : storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            cb(new Error("Only images allowed"));
        }
        else {
            cb(null, true);
        }
    }
});
// Upload config for documents (PDFs + images) - used for payment terminal applications
exports.uploadDocuments = (0, multer_1.default)({
    storage: (0, storage_1.isR2Configured)() ? multer_1.default.memoryStorage() : storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for documents
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith("image/") && file.mimetype !== "application/pdf") {
            cb(new Error("Only images and PDF files are allowed"));
        }
        else {
            cb(null, true);
        }
    }
});
//# sourceMappingURL=upload.js.map