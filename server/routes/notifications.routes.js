import express from "express";

import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notifications.controller.js";

import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.use(verifyToken);

router.get("/", getNotifications);

router.patch("/:id/read", markNotificationRead);

router.patch("/read-all", markAllNotificationsRead);

export default router;