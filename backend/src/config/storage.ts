import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import path from "path";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "chuio-uploads";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ""; // e.g. https://uploads.chuio.io

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}

/**
 * Upload a file buffer to R2
 * @returns The public URL or /uploads/... path for the uploaded file
 */
export async function uploadToR2(
  fileBuffer: Buffer,
  originalFilename: string,
  folder: string,
  contentType: string
): Promise<string> {
  const ext = path.extname(originalFilename);
  const filename = crypto.randomBytes(16).toString("hex") + ext;
  const key = `${folder}/${filename}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    })
  );

  // Return the public URL if configured, otherwise return a path that our proxy can serve
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${key}`;
  }
  return `/uploads/${key}`;
}

/**
 * Delete a file from R2 by its key or URL
 */
export async function deleteFromR2(fileUrl: string): Promise<void> {
  let key = fileUrl;
  // Strip public URL prefix if present
  if (R2_PUBLIC_URL && key.startsWith(R2_PUBLIC_URL)) {
    key = key.slice(R2_PUBLIC_URL.length + 1);
  }
  // Strip /uploads/ prefix
  if (key.startsWith("/uploads/")) {
    key = key.slice("/uploads/".length);
  }

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })
  );
}

/**
 * Get the R2 storage folder for a given upload type
 */
export function getR2Folder(type: "menu" | "logo" | "background" | "documents", restaurantId: string): string {
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

export { s3Client, R2_BUCKET_NAME };
