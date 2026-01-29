import app from "./app";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
dotenv.config();

const PORT = Number(process.env.PORT) || 10000;

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});

if (process.env.NODE_ENV !== "production") {
  
  console.log("ENV:", {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT
  });
}

if (process.env.APP_STAGE !== "development") {
  console.error("❌ This app is not in DEVELOPMENT mode");
  throw new Error("Schema changes are blocked outside development");

}

