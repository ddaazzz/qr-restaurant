import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { Request } from "express";
import { isR2Configured } from "./storage";

const getRestaurantIdForUpload = (req: Request): string | null => {
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

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    let folder = "uploads";
    const restaurantId = getRestaurantIdForUpload(req);

    // Extract restaurantId from URL path for restaurant-specific folders
    if (req.originalUrl.includes("/logo")) {
      folder = restaurantId ? `uploads/restaurants/${restaurantId}` : "uploads/restaurants";
    } else if (req.originalUrl.includes("/background")) {
      folder = restaurantId ? `uploads/restaurants/${restaurantId}` : "uploads/restaurants";
    } else if (req.originalUrl.includes("/menu-items")) {
      folder = restaurantId ? `uploads/restaurants/${restaurantId}/menu` : "uploads/menu";
    } else if (req.originalUrl.includes("/payment-terminal-applications")) {
      folder = restaurantId ? `uploads/restaurants/${restaurantId}/documents` : "uploads/documents";
    }

    // Ensure folder exists
    fs.mkdirSync(folder, { recursive: true });

    cb(null, folder);
  },

  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = crypto.randomBytes(16).toString("hex");
    cb(null, `${name}${ext}`);
  }
});

export const upload = multer({
  storage: isR2Configured() ? multer.memoryStorage() : storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only images allowed"));
    } else {
      cb(null, true);
    }
  }
});

// Upload config for documents (PDFs + images) - used for payment terminal applications
export const uploadDocuments = multer({
  storage: isR2Configured() ? multer.memoryStorage() : storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for documents
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/") && file.mimetype !== "application/pdf") {
      cb(new Error("Only images and PDF files are allowed"));
    } else {
      cb(null, true);
    }
  }
});
