import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    let folder = "uploads";
    let restaurantId: string | null | undefined = undefined;

    // Extract restaurantId from URL path for restaurant-specific folders
    if (req.originalUrl.includes("/logo")) {
      // Pattern: /restaurants/:id/logo
      const match = req.originalUrl.match(/\/restaurants\/(\d+)\/logo/);
      restaurantId = match ? match[1] : null;
      folder = restaurantId ? `uploads/restaurants/${restaurantId}` : "uploads/restaurants";
    } else if (req.originalUrl.includes("/background")) {
      // Pattern: /restaurants/:restaurantId/background
      const match = req.originalUrl.match(/\/restaurants\/(\d+)\/background/);
      restaurantId = match ? match[1] : null;
      folder = restaurantId ? `uploads/restaurants/${restaurantId}` : "uploads/restaurants";
    } else if (req.originalUrl.includes("/menu-items")) {
      // Pattern: /restaurants/:restaurantId/menu/menu-items/:menuItemId/image
      const match = req.originalUrl.match(/\/restaurants\/(\d+)\/menu\/menu-items/);
      restaurantId = match ? match[1] : null;
      folder = restaurantId ? `uploads/restaurants/${restaurantId}/menu` : "uploads/menu";
    } else if (req.originalUrl.includes("/payment-terminal-applications")) {
      // Pattern: /restaurants/:restaurantId/payment-terminal-applications
      const match = req.originalUrl.match(/\/restaurants\/(\d+)\/payment-terminal-applications/);
      restaurantId = match ? match[1] : null;
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
  storage,
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
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for documents
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/") && file.mimetype !== "application/pdf") {
      cb(new Error("Only images and PDF files are allowed"));
    } else {
      cb(null, true);
    }
  }
});
