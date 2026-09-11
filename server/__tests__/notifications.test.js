import request from "supertest";
import app from "../index.js";

const login = async (email, password) => {
  const response = await request(app).post("/auth/login").send({
    email,
    password,
  });

  expect(response.statusCode).toBe(200);

  return response.body.accessToken;
};

describe("Notifications API", () => {
  let developerToken;
  let developer2Token;

  beforeAll(async () => {
    developerToken = await login("ravi@example.com", "user123");

    developer2Token = await login("amit@example.com", "user123");
  });

  test("authenticated user can retrieve notifications", async () => {
    const response = await request(app)
      .get("/notifications")
      .set("Authorization", `Bearer ${developerToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("notifications");
    expect(response.body.notifications).toBeInstanceOf(Array);
    expect(response.body).toHaveProperty("unreadCount");
  });

  test("unauthenticated user cannot retrieve notifications", async () => {
    const response = await request(app).get("/notifications");

    expect(response.statusCode).toBe(401);
  });

  test("user cannot mark another user's notification as read", async () => {
    const otherUserNotifications = await request(app)
      .get("/notifications")
      .set("Authorization", `Bearer ${developer2Token}`);

    expect(otherUserNotifications.statusCode).toBe(200);
    expect(otherUserNotifications.body.notifications).toBeInstanceOf(Array);

    if (otherUserNotifications.body.notifications.length === 0) {
      return;
    }

    const notificationId =
      otherUserNotifications.body.notifications[0].id;

    const response = await request(app)
      .patch(`/notifications/${notificationId}/read`)
      .set("Authorization", `Bearer ${developerToken}`);

    expect([403, 404]).toContain(response.statusCode);
  });

  test("mark all notifications as read", async () => {
    const response = await request(app)
      .patch("/notifications/read-all")
      .set("Authorization", `Bearer ${developerToken}`);

    expect(response.statusCode).toBe(200);
  });

  test("invalid notification id is rejected", async () => {
    const response = await request(app)
      .patch(
        "/notifications/00000000-0000-0000-0000-000000000000/read",
      )
      .set("Authorization", `Bearer ${developerToken}`);

    expect([400, 404]).toContain(response.statusCode);
  });
});