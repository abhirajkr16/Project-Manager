import express from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes.js";
import projectsRoutes from "./routes/projects.routes.js";
import tasksRoutes from "./routes/tasks.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import activityRoutes from "./routes/activity.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";

import { initializeWebSocket } from "./websocket/index.js";
import { startOverdueJob } from "./jobs/overdue.job.js";

dotenv.config();

const app = express();
const server = createServer(app);

if (process.env.NODE_ENV !== "test") {
  initializeWebSocket(server);
}

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });

  next();
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use("/auth", authRoutes);
app.use("/projects", projectsRoutes);
app.use("/tasks", tasksRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/activity", activityRoutes);
app.use("/notifications", notificationsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
    startOverdueJob();
  });
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");

  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

export { app, server };
export default app;
