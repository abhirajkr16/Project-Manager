import express from "express";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notifications.controller.js";
import { verifyToken, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.use(verifyToken);

router.get(
  "/",
  requireRole("admin", "project_manager", "developer"),
  getNotifications,
);

router.patch(
  "/:id/read",
  requireRole("admin", "project_manager", "developer"),
  markNotificationRead,
);

router.patch(
  "/read-all",
  requireRole("admin", "project_manager", "developer"),
  markAllNotificationsRead,
);

export default router;
