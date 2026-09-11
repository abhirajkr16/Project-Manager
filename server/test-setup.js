import dotenv from "dotenv";

dotenv.config();

process.env.NODE_ENV = "test";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not configured");
}

if (!process.env.JWT_REFRESH_SECRET) {
  throw new Error("JWT_REFRESH_SECRET is not configured");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured");
}