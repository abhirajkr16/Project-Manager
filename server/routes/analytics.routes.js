import express from "express";
import {
  getProjectSummary,
  getUserActivity,
  getProjectSnapshot,
} from "../controllers/analytics.controller.js";
import { verifyToken, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.use(verifyToken);

router.get(
  "/projects/:id/summary",
  requireRole("admin", "project_manager"),
  getProjectSummary,
);

router.get(
  "/projects/:id/snapshot",
  requireRole("admin", "project_manager"),
  getProjectSnapshot,
);

router.get(
  "/users/:id/activity",
  requireRole("admin", "project_manager", "developer"),
  getUserActivity,
);

export default router;
