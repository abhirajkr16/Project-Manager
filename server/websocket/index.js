import { Server } from "socket.io";
import { verifySocketToken } from "../middleware/auth.js";
import { query } from "../db/index.js";
import { getMissedActivityLogs } from "../services/activity.service.js";
let io;

const projectRooms = new Map();
const onlineUsers = new Map();

const addOnlineUser = (user, socketId) => {
  if (!onlineUsers.has(user.id)) {
    onlineUsers.set(user.id, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      sockets: new Set(),
    });
  }

  onlineUsers.get(user.id).sockets.add(socketId);
};

const removeOnlineUser = (userId, socketId) => {
  const user = onlineUsers.get(userId);

  if (!user) {
    return false;
  }

  user.sockets.delete(socketId);

  if (user.sockets.size === 0) {
    onlineUsers.delete(userId);
    return true;
  }

  return false;
};

const listOnlineUsers = () => {
  return Array.from(onlineUsers.values()).map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  }));
};

const emitPresenceState = () => {
  if (!io) {
    return;
  }

  io.to("role:admin").emit("presence_state", {
    users: listOnlineUsers(),
  });
};

export const initializeWebSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      credentials: true,
    },
    path: "/ws",
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const user = verifySocketToken(token);

    if (!user) {
      return next(new Error("Invalid access token"));
    }

    socket.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  });

  io.on("connection", async (socket) => {
    const user = socket.user;

    console.log(`User ${user.name} (${user.id}) connected:`, socket.id);

    const wasAlreadyOnline = onlineUsers.has(user.id);

    addOnlineUser(user, socket.id);

    socket.join(`user:${user.id}`);
    socket.join(`role:${user.role}`);

    socket.emit("socket_ready", {
      userId: user.id,
      role: user.role,
    });

    if (user.role === "admin") {
      socket.join("role:admin");

      socket.emit("presence_state", {
        users: listOnlineUsers(),
      });
    }

    if (!wasAlreadyOnline) {
      io.to("role:admin").emit("user_online", {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    }
    socket.on(
      "get_missed_events",
      async ({ lastSeenAt = null, lastSeenId = null } = {}) => {
        try {
          const activities = await getMissedActivityLogs(
            user,
            lastSeenAt,
            lastSeenId,
            20,
          );

          socket.emit("missed_events", {
            activities,
          });
        } catch (error) {
          console.error("Missed events error:", error);

          socket.emit("error", {
            message: "Failed to fetch missed activity",
          });
        }
      },
    );
    socket.on("join_project", async (projectId) => {
      try {
        const result = await query(
          `
          SELECT id, owner_id
          FROM projects
          WHERE id = $1
          `,
          [projectId],
        );

        if (result.rows.length === 0) {
          socket.emit("error", {
            message: "Project not found",
          });
          return;
        }

        const project = result.rows[0];

        const hasAccess =
          user.role === "admin" ||
          (user.role === "project_manager" && project.owner_id === user.id);

        if (!hasAccess) {
          socket.emit("error", {
            message: "Access denied",
          });
          return;
        }

        const roomName = `project:${projectId}`;

        socket.join(roomName);

        if (!projectRooms.has(projectId)) {
          projectRooms.set(projectId, new Set());
        }

        projectRooms.get(projectId).add(socket.id);

        socket.emit("joined_project", {
          projectId,
        });

        socket.to(roomName).emit("user_joined", {
          userId: user.id,
          userName: user.name,
          projectId,
        });

        console.log(`User ${user.name} joined project ${projectId}`);
      } catch (error) {
        console.error("Join project error:", error);

        socket.emit("error", {
          message: "Failed to join project",
        });
      }
    });

    socket.on("leave_project", (projectId) => {
      const roomName = `project:${projectId}`;

      socket.leave(roomName);

      if (projectRooms.has(projectId)) {
        projectRooms.get(projectId).delete(socket.id);

        if (projectRooms.get(projectId).size === 0) {
          projectRooms.delete(projectId);
        }
      }

      socket.to(roomName).emit("user_left", {
        userId: user.id,
        userName: user.name,
        projectId,
      });

      console.log(`User ${user.name} left project ${projectId}`);
    });

    socket.on("disconnect", () => {
      console.log(`User ${user.name} disconnected:`, socket.id);

      projectRooms.forEach((sockets, projectId) => {
        if (!sockets.has(socket.id)) {
          return;
        }

        sockets.delete(socket.id);

        if (sockets.size === 0) {
          projectRooms.delete(projectId);
        }

        socket.to(`project:${projectId}`).emit("user_left", {
          userId: user.id,
          userName: user.name,
          projectId,
        });
      });

      const becameOffline = removeOnlineUser(user.id, socket.id);

      if (becameOffline) {
        io.to("role:admin").emit("user_offline", {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        });
      }
    });

    socket.on("ping", () => {
      socket.emit("pong");
    });
  });

  console.log("WebSocket server initialized");

  return io;
};

export const emitToProject = (projectId, event, data) => {
  if (!io) {
    console.warn("WebSocket not initialized");
    return;
  }

  io.to(`project:${projectId}`).emit(event, data);
};

export const emitToUser = (userId, event, data) => {
  if (!io) {
    console.warn("WebSocket not initialized");
    return;
  }

  io.to(`user:${userId}`).emit(event, data);
};

export const emitToRole = (role, event, data) => {
  if (!io) {
    console.warn("WebSocket not initialized");
    return;
  }

  io.to(`role:${role}`).emit(event, data);
};

export const emitToProjectAndRole = (projectId, role, event, data) => {
  if (!io) {
    console.warn("WebSocket not initialized");
    return;
  }

  io.to(`project:${projectId}`).to(`role:${role}`).emit(event, data);
};

export const getProjectClientCount = (projectId) => {
  return projectRooms.get(projectId)?.size || 0;
};

export const getOnlineUserCount = () => {
  return onlineUsers.size;
};

export const getOnlineUsers = () => {
  return listOnlineUsers();
};

export const getIO = () => io;

export default {
  initializeWebSocket,
  emitToProject,
  emitToUser,
  emitToRole,
  emitToProjectAndRole,
  getProjectClientCount,
  getOnlineUserCount,
  getOnlineUsers,
  getIO,
};
