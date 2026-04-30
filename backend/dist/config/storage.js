"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.R2_BUCKET_NAME = exports.s3Client = void 0;
exports.isR2Configured = isR2Configured;
exports.uploadToR2 = uploadToR2;
exports.deleteFromR2 = deleteFromR2;
exports.getR2Folder = getR2Folder;
const client_s3_1 = require("@aws-sdk/client-s3");
const crypto_1 = __importDefault(require("crypto"));
const path_1 = __importDefault(require("path"));
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "chuio-uploads";
exports.R2_BUCKET_NAME = R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ""; // e.g. https://uploads.chuio.io
const s3Client = new client_s3_1.S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
});
exports.s3Client = s3Client;
function isR2Configured() {
    return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}
/**
 * Upload a file buffer to R2
 * @returns The public URL or /uploads/... path for the uploaded file
 */
async function uploadToR2(fileBuffer, originalFilename, folder, contentType) {
    const ext = path_1.default.extname(originalFilename);
    const filename = crypto_1.default.randomBytes(16).toString("hex") + ext;
    const key = `${folder}/${filename}`;
    await s3Client.send(new client_s3_1.PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
    }));
    // Return the public URL if configured, otherwise return a path that our proxy can serve
    if (R2_PUBLIC_URL) {
        return `${R2_PUBLIC_URL}/${key}`;
    }
    return `/uploads/${key}`;
}
/**
 * Delete a file from R2 by its key or URL
 */
async function deleteFromR2(fileUrl) {
    let key = fileUrl;
    // Strip public URL prefix if present
    if (R2_PUBLIC_URL && key.startsWith(R2_PUBLIC_URL)) {
        key = key.slice(R2_PUBLIC_URL.length + 1);
    }
    // Strip /uploads/ prefix
    if (key.startsWith("/uploads/")) {
        key = key.slice("/uploads/".length);
    }
    await s3Client.send(new client_s3_1.DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
    }));
}
/**
 * Get the R2 storage folder for a given upload type
 */
function getR2Folder(type, restaurantId) {
    switch (type) {
        case "menu":
            return `restaurants/${restaurantId}/menu`;
        case "logo":
            return `restaurants/${restaurantId}`;
        case "background":
            return `restaurants/${restaurantId}`;
        case "documents":
            return `restaurants/${restaurantId}/documents`;
    }
}
//# sourceMappingURL=storage.js.map