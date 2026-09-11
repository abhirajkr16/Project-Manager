import { useState } from "react";
import {
  Link,
  Outlet,
  useNavigate,
} from "react-router-dom";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Activity,
  Bell,
  Check,
  LayoutDashboard,
  LogOut,
  User,
  Wifi,
  WifiOff,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useWebSocket } from "@/contexts/WebSocketContext";
import {
  activityApi,
  notificationsApi,
} from "@/lib/api";

import type {
  ActivityLog,
  Notification,
} from "@/types";

export default function Layout() {
  const { user, logout } = useAuth();
  const { isConnected } = useWebSocket();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showActivity, setShowActivity] =
    useState(false);

  const [showNotifications, setShowNotifications] =
    useState(false);

  const {
    data: activities = [],
  } = useQuery<ActivityLog[]>({
    queryKey: ["activity"],
    queryFn: () =>
      activityApi.getMyActivity(20),
    enabled: !!user,
  });

  const {
    data: notificationData,
  } = useQuery<{
    notifications: Notification[];
    unreadCount: number;
  }>({
    queryKey: ["notifications"],
    queryFn:
      notificationsApi.getNotifications,
    enabled: !!user,
  });

  const notifications =
    notificationData?.notifications || [];

  const unreadCount =
    notificationData?.unreadCount || 0;

  const markReadMutation =
    useMutation({
      mutationFn:
        notificationsApi.markRead,

      onSuccess: (notification) => {
        queryClient.setQueryData<{
          notifications: Notification[];
          unreadCount: number;
        }>(
          ["notifications"],
          (old) => {
            if (!old) {
              return old;
            }

            const previous =
              old.notifications.find(
                (item) =>
                  item.id ===
                  notification.id,
              );

            const wasUnread =
              previous?.read_at === null;

            return {
              notifications:
                old.notifications.map(
                  (item) =>
                    item.id ===
                    notification.id
                      ? notification
                      : item,
                ),

              unreadCount: wasUnread
                ? Math.max(
                    0,
                    old.unreadCount - 1,
                  )
                : old.unreadCount,
            };
          },
        );
      },
    });

  const markAllReadMutation =
    useMutation({
      mutationFn:
        notificationsApi.markAllRead,

      onSuccess: () => {
        queryClient.setQueryData<{
          notifications: Notification[];
          unreadCount: number;
        }>(
          ["notifications"],
          (old) => {
            if (!old) {
              return old;
            }

            return {
              notifications:
                old.notifications.map(
                  (notification) => ({
                    ...notification,
                    read_at:
                      notification.read_at ||
                      new Date().toISOString(),
                  }),
                ),
              unreadCount: 0,
            };
          },
        );
      },
    });

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getActivityText = (
    activity: ActivityLog,
  ) => {
    const metadata =
      activity.metadata || {};

    const actor =
      activity.user_name || "System";

    switch (activity.action) {
      case "create_project":
        return `${actor} created project "${metadata.title || "project"}"`;

      case "update_project":
        return `${actor} updated a project`;

      case "delete_project":
        return `${actor} deleted project "${metadata.projectTitle || "project"}"`;

      case "create_task":
        return `${actor} created task "${metadata.taskTitle || "task"}"`;

      case "update_task":
        return `${actor} updated task "${metadata.taskTitle || "task"}"`;

      case "update_task_status":
        return `${actor} changed "${metadata.taskTitle || "task"}" from ${metadata.oldStatus || "unknown"} to ${metadata.newStatus || "unknown"}`;

      case "delete_task":
        return `${actor} deleted task "${metadata.taskTitle || "task"}"`;

      case "task_overdue":
        return `Task "${metadata.taskTitle || "task"}" became overdue`;

      default:
        return `${actor} performed ${activity.action.replace(/_/g, " ")}`;
    }
  };

  const formatTime = (
    date: string,
  ) => {
    return new Date(
      date,
    ).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link
                to="/"
                className="flex items-center space-x-2"
              >
                <LayoutDashboard className="h-6 w-6 text-primary-600" />

                <span className="text-xl font-bold text-gray-900">
                  Developer Dashboard
                </span>
              </Link>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm">
                {isConnected ? (
                  <>
                    <Wifi className="h-4 w-4 text-green-500" />
                    <span className="text-gray-600">
                      Connected
                    </span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-red-500" />
                    <span className="text-gray-600">
                      Disconnected
                    </span>
                  </>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => {
                    setShowNotifications(
                      !showNotifications,
                    );
                    setShowActivity(false);
                  }}
                  className="relative p-2 rounded-lg hover:bg-gray-100"
                  title="Notifications"
                >
                  <Bell className="h-5 w-5 text-gray-600" />

                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 flex items-center justify-center text-xs bg-red-500 text-white rounded-full">
                      {unreadCount > 99
                        ? "99+"
                        : unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                      <div>
                        <h2 className="font-semibold text-gray-900">
                          Notifications
                        </h2>

                        <p className="text-xs text-gray-500 mt-1">
                          {unreadCount} unread
                        </p>
                      </div>

                      {unreadCount > 0 && (
                        <button
                          onClick={() =>
                            markAllReadMutation.mutate()
                          }
                          disabled={
                            markAllReadMutation.isPending
                          }
                          className="text-xs font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center">
                          <Bell className="h-8 w-8 mx-auto text-gray-300" />

                          <p className="mt-2 text-sm text-gray-500">
                            No notifications yet.
                          </p>
                        </div>
                      ) : (
                        notifications.map(
                          (notification) => {
                            const isUnread =
                              notification.read_at ===
                              null;

                            return (
                              <div
                                key={
                                  notification.id
                                }
                                className={`px-4 py-3 border-b border-gray-100 ${
                                  isUnread
                                    ? "bg-blue-50"
                                    : "bg-white"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">
                                      {
                                        notification.title
                                      }
                                    </p>

                                    <p className="text-sm text-gray-600 mt-1">
                                      {
                                        notification.message
                                      }
                                    </p>

                                    <p className="text-xs text-gray-400 mt-2">
                                      {formatTime(
                                        notification.created_at,
                                      )}
                                    </p>
                                  </div>

                                  {isUnread && (
                                    <button
                                      onClick={() =>
                                        markReadMutation.mutate(
                                          notification.id,
                                        )
                                      }
                                      disabled={
                                        markReadMutation.isPending
                                      }
                                      className="p-1.5 rounded-md hover:bg-white text-gray-500 hover:text-green-600"
                                      title="Mark as read"
                                    >
                                      <Check className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          },
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setShowActivity(
                    !showActivity,
                  );
                  setShowNotifications(false);
                }}
                className="relative p-2 rounded-lg hover:bg-gray-100"
                title="Activity"
              >
                <Activity className="h-5 w-5 text-gray-600" />
              </button>

              <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-100">
                <User className="h-4 w-4 text-gray-600" />

                <span className="text-sm font-medium text-gray-900">
                  {user?.name}
                </span>

                {user?.role === "admin" && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-primary-100 text-primary-800">
                    Admin
                  </span>
                )}
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {showActivity && (
        <div className="fixed right-4 top-20 w-96 max-h-[70vh] bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">
              Recent Activity
            </h2>

            <p className="text-xs text-gray-500 mt-1">
              Latest 20 activities
            </p>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {activities.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                No activity yet.
              </div>
            ) : (
              activities.map(
                (activity) => (
                  <div
                    key={activity.id}
                    className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50"
                  >
                    <p className="text-sm text-gray-800">
                      {getActivityText(
                        activity,
                      )}
                    </p>

                    <p className="text-xs text-gray-400 mt-1">
                      {formatTime(
                        activity.created_at,
                      )}
                    </p>
                  </div>
                ),
              )
            )}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
