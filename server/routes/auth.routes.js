import express from "express";
import rateLimit from "express-rate-limit";
import {
  register,
  login,
  refreshToken,
  logout,
  getCurrentUser,
} from "../controllers/auth.controller.js";
import { validate, schemas } from "../middleware/validation.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many authentication attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", authLimiter, validate(schemas.register), register);

router.post("/login", authLimiter, validate(schemas.login), login);

router.post("/refresh", refreshToken);

router.post("/logout", logout);

router.get("/me", verifyToken, getCurrentUser);

export default router;
