import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { getMyActivity } from "../controllers/activity.controller.js";

const router = express.Router();

router.use(verifyToken);

router.get("/", getMyActivity);

export default router;
