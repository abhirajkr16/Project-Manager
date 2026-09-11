import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import type {
  Task,
  Project,
  ActivityLog,
  Notification,
} from "@/types";

const WS_URL =
  (import.meta.env.VITE_WS_URL as string) ||
  "http://localhost:3001";

interface OnlineUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ActivityCursor {
  createdAt: string;
  id: string;
}

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: OnlineUser[];
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
}

const WebSocketContext =
  createContext<WebSocketContextType | undefined>(
    undefined,
  );

const getActivityCursorKey = (userId: string) => {
  return `activity:last-seen:${userId}`;
};

const getLastActivityCursor = (
  userId: string,
): ActivityCursor | null => {
  const stored = localStorage.getItem(
    getActivityCursorKey(userId),
  );

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

const saveActivityCursor = (
  userId: string,
  activity: ActivityLog,
) => {
  localStorage.setItem(
    getActivityCursorKey(userId),
    JSON.stringify({
      createdAt: activity.created_at,
      id: activity.id,
    }),
  );
};

const addActivityToCache = (
  queryClient: ReturnType<typeof useQueryClient>,
  activity: ActivityLog,
) => {
  queryClient.setQueryData<ActivityLog[]>(
    ["activity"],
    (old = []) => {
      const exists = old.some(
        (item) => item.id === activity.id,
      );

      if (exists) {
        return old;
      }

      return [activity, ...old].slice(0, 20);
    },
  );
};

export const WebSocketProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [socket, setSocket] =
    useState<Socket | null>(null);

  const [isConnected, setIsConnected] =
    useState(false);

  const [onlineUsers, setOnlineUsers] =
    useState<OnlineUser[]>([]);

  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }

      setIsConnected(false);
      setOnlineUsers([]);

      return;
    }

    const newSocket = io(WS_URL, {
      path: "/ws",
      auth: {
        token,
      },
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      console.log("WebSocket connected");
      setIsConnected(true);

      const lastSeen =
        getLastActivityCursor(user.id);

      newSocket.emit("get_missed_events", {
        lastSeenAt:
          lastSeen?.createdAt || null,
        lastSeenId:
          lastSeen?.id || null,
      });
    });

    newSocket.on("disconnect", () => {
      console.log("WebSocket disconnected");
      setIsConnected(false);
    });

    newSocket.on("error", (error) => {
      console.error("WebSocket error:", error);
    });

    newSocket.on(
      "presence_state",
      ({ users }: { users: OnlineUser[] }) => {
        setOnlineUsers(users);
      },
    );

    newSocket.on(
      "user_online",
      ({ user }: { user: OnlineUser }) => {
        setOnlineUsers((currentUsers) => {
          const exists = currentUsers.some(
            (item) => item.id === user.id,
          );

          if (exists) {
            return currentUsers;
          }

          return [...currentUsers, user];
        });
      },
    );

    newSocket.on(
      "user_offline",
      ({ user }: { user: OnlineUser }) => {
        setOnlineUsers((currentUsers) =>
          currentUsers.filter(
            (item) => item.id !== user.id,
          ),
        );
      },
    );

    newSocket.on(
      "missed_events",
      ({
        activities,
      }: {
        activities: ActivityLog[];
      }) => {
        const orderedActivities = [
          ...activities,
        ].reverse();

        for (const activity of orderedActivities) {
          addActivityToCache(
            queryClient,
            activity,
          );

          saveActivityCursor(
            user.id,
            activity,
          );
        }

        queryClient.invalidateQueries({
          queryKey: ["analytics"],
        });
      },
    );

    newSocket.on(
      "task_created",
      ({ task }: { task: Task }) => {
        queryClient.setQueryData<Task[]>(
          ["tasks", task.project_id],
          (old = []) => {
            const exists = old.some(
              (item) => item.id === task.id,
            );

            if (exists) {
              return old;
            }

            return [task, ...old];
          },
        );
      },
    );

    newSocket.on(
      "task_updated",
      ({ task }: { task: Task }) => {
        queryClient.setQueryData<Task[]>(
          ["tasks", task.project_id],
          (old = []) => {
            const exists = old.some(
              (item) => item.id === task.id,
            );

            if (!exists) {
              return [task, ...old];
            }

            return old.map((item) =>
              item.id === task.id ? task : item,
            );
          },
        );
      },
    );

    newSocket.on(
      "task_deleted",
      ({
        taskId,
        projectId,
      }: {
        taskId: string;
        projectId?: string;
      }) => {
        if (projectId) {
          queryClient.setQueryData<Task[]>(
            ["tasks", projectId],
            (old = []) =>
              old.filter(
                (task) => task.id !== taskId,
              ),
          );

          return;
        }

        queryClient.setQueriesData<Task[]>(
          { queryKey: ["tasks"] },
          (old) =>
            old
              ? old.filter(
                  (task) => task.id !== taskId,
                )
              : [],
        );
      },
    );

    newSocket.on(
      "project_deleted",
      ({
        projectId,
      }: {
        projectId: string;
      }) => {
        queryClient.setQueryData<Project[]>(
          ["projects"],
          (old = []) =>
            old.filter(
              (project) => project.id !== projectId,
            ),
        );
      },
    );

    newSocket.on(
      "activity_logged",
      ({
        activity,
      }: {
        activity: ActivityLog;
      }) => {
        addActivityToCache(
          queryClient,
          activity,
        );

        saveActivityCursor(
          user.id,
          activity,
        );

        queryClient.invalidateQueries({
          queryKey: ["analytics"],
        });
      },
    );

    newSocket.on(
      "notification_created",
      ({
        notification,
      }: {
        notification: Notification;
      }) => {
        queryClient.setQueryData<{
          notifications: Notification[];
          unreadCount: number;
        }>(
          ["notifications"],
          (old) => {
            if (!old) {
              return {
                notifications: [notification],
                unreadCount: 1,
              };
            }

            const exists =
              old.notifications.some(
                (item) =>
                  item.id === notification.id,
              );

            if (exists) {
              return old;
            }

            return {
              notifications: [
                notification,
                ...old.notifications,
              ].slice(0, 50),
              unreadCount:
                old.unreadCount + 1,
            };
          },
        );
      },
    );

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token, user, queryClient]);

  const joinProject = useCallback(
    (projectId: string) => {
      if (socket && isConnected) {
        socket.emit(
          "join_project",
          projectId,
        );
      }
    },
    [socket, isConnected],
  );

  const leaveProject = useCallback(
    (projectId: string) => {
      if (socket && isConnected) {
        socket.emit(
          "leave_project",
          projectId,
        );
      }
    },
    [socket, isConnected],
  );

  return (
    <WebSocketContext.Provider
      value={{
        socket,
        isConnected,
        onlineUsers,
        joinProject,
        leaveProject,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(
    WebSocketContext,
  );

  if (context === undefined) {
    throw new Error(
      "useWebSocket must be used within a WebSocketProvider",
    );
  }

  return context;
};