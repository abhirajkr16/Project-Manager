
import { createServer } from "http";
import dotenv from "dotenv";

import app from "./app.js";
import { initializeWebSocket } from "./websocket/index.js";
import { startOverdueJob } from "./jobs/overdue.job.js";

dotenv.config();

const PORT = process.env.PORT || 3001;
const server = createServer(app);

if (process.env.NODE_ENV !== "test") {
  initializeWebSocket(server);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
    startOverdueJob();
  });
}

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");

  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

export { app, server };
export default app;
