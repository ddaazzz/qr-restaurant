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

// Schema validation is only enforced during development
if (process.env.APP_STAGE === "development") {
  console.log("✅ Running in development mode");
}

