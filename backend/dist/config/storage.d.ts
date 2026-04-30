import { S3Client } from "@aws-sdk/client-s3";
declare const R2_BUCKET_NAME: string;
declare const s3Client: S3Client;
export declare function isR2Configured(): boolean;
/**
 * Upload a file buffer to R2
 * @returns The public URL or /uploads/... path for the uploaded file
 */
export declare function uploadToR2(fileBuffer: Buffer, originalFilename: string, folder: string, contentType: string): Promise<string>;
/**
 * Delete a file from R2 by its key or URL
 */
export declare function deleteFromR2(fileUrl: string): Promise<void>;
/**
 * Get the R2 storage folder for a given upload type
 */
export declare function getR2Folder(type: "menu" | "logo" | "background" | "documents", restaurantId: string): string;
export { s3Client, R2_BUCKET_NAME };
//# sourceMappingURL=storage.d.ts.map