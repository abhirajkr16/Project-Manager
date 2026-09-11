import express from "express";
import {
  getMyActivity,
} from "../controllers/activity.controller.js";
import {
  verifyToken,
  requireRole,
} from "../middleware/auth.js";

const router = express.Router();

router.use(verifyToken);

router.get(
  "/",
  requireRole(
    "admin",
    "project_manager",
    "developer",
  ),
  getMyActivity,
);

export default router;