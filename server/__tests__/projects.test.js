import request from "supertest";
import app from "../index.js";

describe("Projects API", () => {
  let authToken;
  let projectId;

  const testUser = {
    name: "Project Test User",
    email: `project${Date.now()}@example.com`,
    password: "TestPassword123",
    role: "project_manager",
  };

  beforeAll(async () => {
    const registerResponse = await request(app)
      .post("/auth/register")
      .send(testUser)
      .expect(201);

    authToken = registerResponse.body.accessToken;

    expect(authToken).toBeDefined();
  });

  it("should reject project creation without authentication", async () => {
    await request(app)
      .post("/projects")
      .send({
        title: "Unauthorized Project",
        description: "This should fail",
      })
      .expect(401);
  });

  it("should create a new project", async () => {
    const response = await request(app)
      .post("/projects")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        title: "Test Project",
        description: "This is a test project",
      })
      .expect(201);

    expect(response.body).toHaveProperty("project");
    expect(response.body.project).toHaveProperty("id");

    expect(response.body.project.title).toBe("Test Project");
    expect(response.body.project.description).toBe("This is a test project");

    projectId = response.body.project.id;
  });

  it("should get all projects", async () => {
    const response = await request(app)
      .get("/projects")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.projects).toBeInstanceOf(Array);
    expect(response.body.projects.length).toBeGreaterThan(0);

    const project = response.body.projects.find(
      (item) => item.id === projectId,
    );

    expect(project).toBeDefined();
  });

  it("should get a single project", async () => {
    const response = await request(app)
      .get(`/projects/${projectId}`)
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty("project");
    expect(response.body.project.id).toBe(projectId);
    expect(response.body.project.title).toBe("Test Project");
  });

  it("should update a project", async () => {
    const response = await request(app)
      .put(`/projects/${projectId}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        title: "Updated Test Project",
      })
      .expect(200);

    expect(response.body).toHaveProperty("project");
    expect(response.body.project.title).toBe("Updated Test Project");
  });

  it("should reject project access without authentication", async () => {
    await request(app).get(`/projects/${projectId}`).expect(401);
  });

  it("should delete a project", async () => {
    const response = await request(app)
      .delete(`/projects/${projectId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(response.statusCode).toBe(200);
  });
});
