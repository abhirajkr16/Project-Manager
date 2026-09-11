import express from "express";
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
} from "../controllers/projects.controller.js";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validation.js";

const router = express.Router();

router.use(verifyToken);

router.get("/", requireRole("admin", "project_manager"), getProjects);

router.get("/:id", requireRole("admin", "project_manager"), getProject);

router.post(
  "/",
  requireRole("admin", "project_manager"),
  validate(schemas.createProject),
  createProject,
);

router.put(
  "/:id",
  requireRole("admin", "project_manager"),
  validate(schemas.updateProject),
  updateProject,
);

router.delete("/:id", requireRole("admin", "project_manager"), deleteProject);

export default router;
