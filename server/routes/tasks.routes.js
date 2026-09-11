import express from "express";
import {
  getTasks,
  getMyTasks,
  createTask,
  updateTask,
  deleteTask,
} from "../controllers/tasks.controller.js";

import { verifyToken, requireRole } from "../middleware/auth.js";

import { validate, validateQuery, schemas } from "../middleware/validation.js";

const router = express.Router();

router.use(verifyToken);

router.get("/my", requireRole("developer"), getMyTasks);

router.get(
  "/projects/:projectId/tasks",
  requireRole("admin", "project_manager"),
  validateQuery(schemas.taskFilters),
  getTasks,
);

router.post(
  "/projects/:projectId/tasks",
  requireRole("admin", "project_manager"),
  validate(schemas.createTask),
  createTask,
);

router.put(
  "/:id",
  requireRole("admin", "project_manager", "developer"),
  validate(schemas.updateTask),
  updateTask,
);

router.delete("/:id", requireRole("admin", "project_manager"), deleteTask);

export default router;
