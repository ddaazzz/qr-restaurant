import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    let folder = "uploads";

    // Route-based destination
    if (req.originalUrl.includes("/menu-items")) {
      folder = "uploads/menu";
    } else if (req.originalUrl.includes("/logo")) {
      folder = "uploads/restaurants";
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
