# Client Project Dashboard with Role-Based Access

A full-stack project management dashboard built around a simple idea: **different people should see and do different things depending on their role**.

The application helps a company manage clients, projects, tasks, team members, activity, notifications, and project progress from one place.

It also includes real-time updates using WebSockets, so users don't have to keep refreshing the page to see what changed.

## Live Demo

**Frontend:** https://project-manager-omega-kohl.vercel.app/

**Backend:** https://project-manager-71yg.onrender.com

> The backend is an API server, so opening its root URL directly may return `404`. The frontend communicates with its API endpoints.

---

## What is this project?

Imagine a small software company working with multiple clients.

A Project Manager creates projects, assigns work to developers, and keeps track of progress. Developers work only on the tasks assigned to them. An Admin has a broader view of the entire system.

The main goal of this project is to keep those responsibilities separated.

For example:

- A Developer should not be able to open another developer's task just by changing an ID in the API request.
- A Project Manager should only manage projects they own.
- An Admin should be able to see the complete system.
- When a task changes, other relevant users should see the update in real time.
- Notifications should remain available even after refreshing the page.
- If a user disconnects and reconnects, recent activity should not simply disappear.

This is why the project is more than just a CRUD dashboard. The backend is responsible for authentication, authorization, data validation, persistence, background jobs, notifications, and real-time communication.

---

# Main Features

### Authentication

- JWT-based authentication
- Short-lived access token
- Refresh token stored in an **HttpOnly cookie**
- Protected API routes
- Logout support
- Password hashing with bcrypt

### Role-Based Access Control

Three roles are supported:

- `Admin`
- `Project Manager`
- `Developer`

Authorization is enforced on the **backend**, not only in the React UI.

### Project Management

- Create projects
- Update projects
- Delete projects
- Assign projects to clients
- Project ownership through the Project Manager
- Project-level task management

### Task Management

Tasks contain:

- Title
- Description
- Assigned developer
- Status
- Priority
- Due date
- Overdue flag
- Creation/update timestamps

Supported statuses:

```text
To Do
In Progress
In Review
Done
```

Supported priorities:

```text
Low
Medium
High
Critical
```

### Real-Time Activity

Socket.IO is used for real-time communication.

Users can receive events such as:

- Task created
- Task updated
- Task deleted
- Project created
- Project updated
- Project deleted
- Activity logged
- Notification created
- User online/offline presence

### Persistent Notifications

Notifications are stored in PostgreSQL.

Examples:

- A developer is assigned a task.
- A developer moves a task to `In Review`, notifying the relevant Project Manager.

Users can:

- View notifications
- See unread count
- Mark one notification as read
- Mark all notifications as read

### Background Overdue Job

Overdue tasks are checked by a scheduled background job.

The application does **not** depend on the frontend being opened for overdue detection.

The job is implemented with `node-cron`.

### Task Filters

Tasks can be filtered using query parameters such as:

- Status
- Priority
- Due-date range

### PostgreSQL Database

The project uses PostgreSQL because the data has clear relationships between:

- Users
- Clients
- Projects
- Tasks
- Task history
- Activities
- Notifications

Foreign keys and indexes are used to keep those relationships consistent and improve common queries.

---

# Technology Stack

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Axios
- Socket.IO Client

## Backend

- Node.js
- Express
- JavaScript
- JWT
- bcrypt
- Socket.IO
- node-cron
- Joi validation
- PostgreSQL
- pg

## Database

- PostgreSQL

## Deployment

- Vercel — frontend
- Render — backend
- Render PostgreSQL — database

---

# Project Structure

```text
project-manager/
│
├── client/
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   │
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── index.css
│       ├── vite-env.d.ts
│       │
│       ├── components/
│       │   └── Layout.tsx
│       │
│       ├── contexts/
│       │   ├── AuthContext.tsx
│       │   └── WebSocketContext.tsx
│       │
│       ├── lib/
│       │   └── api.ts
│       │
│       ├── pages/
│       │   ├── Dashboard.tsx
│       │   ├── ProjectView.tsx
│       │   ├── ProjectView-broken.tsx
│       │   └── Register.tsx
│       │
│       └── types/
│           └── index.ts
│
├── server/
│   ├── index.js
│   ├── test-setup.js
│   │
│   ├── controllers/
│   │   ├── activity.controller.js
│   │   ├── analytics.controller.js
│   │   ├── auth.controller.js
│   │   ├── notifications.controller.js
│   │   ├── projects.controller.js
│   │   └── tasks.controller.js
│   │
│   ├── db/
│   │   ├── index.js
│   │   ├── migrate.js
│   │   └── seed.js
│   │
│   ├── jobs/
│   │   └── overdue.job.js
│   │
│   ├── middleware/
│   │   ├── auth.js
│   │   └── validation.js
│   │
│   ├── routes/
│   │   ├── activity.routes.js
│   │   ├── analytics.routes.js
│   │   ├── auth.routes.js
│   │   ├── notifications.routes.js
│   │   ├── projects.routes.js
│   │   └── tasks.routes.js
│   │
│   ├── services/
│   │   ├── activity.service.js
│   │   ├── analytics.service.js
│   │   ├── notification.service.js
│   │   └── task-status.service.js
│   │
│   ├── websocket/
│   │   └── index.js
│   │
│   ├── __tests__/
│   │   ├── analytics.test.js
│   │   ├── auth.test.js
│   │   ├── filters.test.js
│   │   ├── notifications.test.js
│   │   ├── projects.test.js
│   │   ├── rbac.test.js
│   │   └── tasks.test.js
│   │
│   └── tests/
│
├── .env.example
├── .gitignore
├── package.json
└── package-lock.json
```

---

# Understanding the Architecture

The project is intentionally split into different layers instead of putting everything into one large file.

A simplified request looks like this:

```text
React Frontend
      │
      │ HTTP / Axios
      ▼
Express Route
      │
      │ Authentication
      ▼
JWT Middleware
      │
      │ Role Authorization
      ▼
Controller
      │
      │ Business logic
      ▼
Service
      │
      ▼
PostgreSQL
```

Real-time updates use a separate WebSocket connection:

```text
React
  │
  │ Socket.IO
  ▼
WebSocket Server
  │
  ├── User rooms
  ├── Role rooms
  └── Project rooms
          │
          ▼
      Relevant users
```

The idea is simple:

**HTTP is used for normal API operations. WebSockets are used for live events. PostgreSQL remains the source of truth.**

---

# Role-Based Access Control

## 1. Admin

The Admin has the broadest access.

### Admin can:

- View clients
- View projects
- Manage projects
- View users
- View system activity
- View project/task information
- Access administrative dashboard information
- Receive global real-time activity
- See online user presence

The Admin is useful for someone who needs an overall picture of the organization rather than working on only one project.

### Admin flow

```text
Login
  ↓
Admin Dashboard
  ↓
View overall project/task statistics
  ↓
Manage projects
  ↓
Monitor activity
  ↓
Monitor users/presence
```

---

# 2. Project Manager

The Project Manager is responsible for projects they own.

### Project Manager can:

- Create projects
- Manage their own projects
- Assign tasks
- Assign developers to tasks
- Set task priority
- Set due dates
- Update task information
- View activity related to their projects
- Receive notifications when developers move their tasks to `In Review`

A Project Manager should not be able to manage another Project Manager's projects.

This rule is enforced by the backend.

### Project Manager flow

```text
Login
  ↓
Project Manager Dashboard
  ↓
View owned projects
  ↓
Open a project
  ↓
Create/manage tasks
  ↓
Assign developer
  ↓
Track task progress
  ↓
Receive real-time activity
```

---

# 3. Developer

The Developer has the most restricted project visibility.

### Developer can:

- View tasks assigned to them
- View relevant task information
- Update the status of their assigned tasks
- Move a task through the workflow
- Receive task assignment notifications
- See relevant activity

The Developer cannot use the API to access another developer's tasks simply by changing a task ID.

### Developer flow

```text
Login
  ↓
Developer Dashboard
  ↓
View assigned tasks
  ↓
Open task
  ↓
Update status
  ↓
Activity is recorded
  ↓
Project Manager receives notification when task enters In Review
```

---

# Task Workflow

A typical task moves through this workflow:

```text
To Do
  ↓
In Progress
  ↓
In Review
  ↓
Done
```

For example:

```text
Project Manager creates task
        ↓
Assigns it to Developer
        ↓
Developer starts working
        ↓
Developer → In Progress
        ↓
Developer finishes implementation
        ↓
Developer → In Review
        ↓
Project Manager gets notification
        ↓
Task is reviewed
        ↓
Task → Done
```

Every important status change can be recorded in the task status history/activity system.

---

# Real-Time Activity Flow

Suppose a developer changes a task from:

```text
In Progress
```

to:

```text
In Review
```

The backend:

1. Validates the authenticated user.
2. Checks that the developer owns the task.
3. Updates the task in PostgreSQL.
4. Records the status change.
5. Creates the relevant activity entry.
6. Creates a notification for the Project Manager.
7. Emits real-time Socket.IO events to the relevant users/rooms.

The frontend receives the event without needing to poll the server.

Conceptually:

```text
Developer
    │
    │ PATCH task
    ▼
Express API
    │
    ├── Auth check
    ├── RBAC check
    ├── Validation
    │
    ▼
PostgreSQL
    │
    ├── Update task
    ├── Save history
    ├── Save activity
    └── Save notification
            │
            ▼
       Socket.IO
            │
            ├── Project Manager
            └── Other authorized clients
```

---

# Authentication Flow

The application uses two JWT tokens.

### Access Token

The access token is short-lived and is used when calling protected APIs.

```text
Login
  ↓
Backend verifies credentials
  ↓
Access JWT returned
  ↓
Frontend uses access token for API requests
```

### Refresh Token

The refresh token is stored in an **HttpOnly cookie**.

This means JavaScript running in the browser cannot directly read the refresh token.

```text
Login
  ↓
Access Token
+
HttpOnly Refresh Cookie
```

When the access token expires, the client can use the refresh endpoint to obtain a new access token.

---

# Backend Security

Security is handled at the API level.

A typical protected route follows this pattern:

```text
Request
  ↓
JWT verification
  ↓
Identify user
  ↓
Check role
  ↓
Check ownership/access
  ↓
Validate request data
  ↓
Controller
  ↓
Database
```

This is important because hiding a button in React is not real authorization.

For example, even if the frontend hides the "Delete Project" button from a Developer, the backend still needs to reject a Developer who manually sends:

```http
DELETE /projects/<project-id>
```

The backend is therefore the final authority.

---

# Database Design

The main relational entities are:

```text
users
  │
  ├──────────────┐
  │              │
  ▼              ▼
projects       tasks
  │              │
  │              ├── task_status_history
  │              │
  │              └── notifications
  │
  └── activity_logs

clients
  │
  └── projects
```

### Main tables

#### users

Stores:

- User identity
- Email
- Password hash
- Role
- Creation timestamp

#### clients

Stores client information.

#### projects

Stores:

- Project name
- Description
- Project Manager/owner
- Client
- Timestamps

#### tasks

Stores:

- Project
- Title
- Description
- Creator
- Assigned developer
- Status
- Priority
- Due date
- Overdue state
- Timestamps

#### task_status_history

Stores task status changes and when they happened.

#### activity_logs

Stores user activity that can be shown in the activity feed.

#### notifications

Stores persistent user notifications and read/unread state.

---

# Why PostgreSQL?

PostgreSQL fits this application well because most of the data is relational.

A task belongs to a project.

A project belongs to a client and has an owner.

A task can be assigned to a developer.

An activity belongs to a user and can reference project/task information.

Using a relational database lets us enforce these relationships using foreign keys instead of relying only on application code.

Indexes are also used on frequently queried fields to make common lookups faster.

---

# Background Job

Overdue tasks are handled by a scheduled backend job.

The job periodically checks tasks whose due dates have passed and updates their overdue state.

The important part is that this is handled by the server:

```text
node-cron
   ↓
Scheduled check
   ↓
Find overdue tasks
   ↓
Update PostgreSQL
```

The frontend does not have to be open for the database state to be updated.

---

# Notifications

Notifications are persisted in PostgreSQL.

Example:

```text
Developer is assigned:
"Fix login API"
        ↓
Notification created
        ↓
Developer receives real-time event
        ↓
Notification appears in UI
```

Another example:

```text
Developer changes task
"In Progress → In Review"
        ↓
Notification created for Project Manager
        ↓
PM receives real-time notification
```

Because notifications are stored in the database, they don't disappear when the user refreshes the page.

---

# Seed Data

The project includes a database seed script.

The seed data is intended to provide a useful environment for testing the application instead of starting with an empty dashboard.

It includes:

- Admin user
- Project Managers
- Developers
- Multiple clients
- Multiple projects
- Multiple tasks
- Different task statuses
- Different priorities
- Overdue tasks
- Existing activity data

Seed accounts and their current credentials are defined in:

```text
server/db/seed.js
```

If you change the seed credentials, update the values there rather than putting credentials into this README.

---

# Running the Project Locally

## Prerequisites

Install:

- Node.js
- npm
- PostgreSQL

Check your versions:

```bash
node --version
npm --version
psql --version
```

---

## 1. Clone the repository

```bash
git clone https://github.com/abhirajkr16/Project-Manager.git
cd Project-Manager
```

---

## 2. Install backend dependencies

From the project root:

```bash
npm install
```

---

## 3. Install frontend dependencies

```bash
cd client
npm install
cd ..
```

---

# Environment Variables

Create a `.env` file in the project root.

Use `.env.example` as the reference.

Example:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/rajdashboard

JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=15m

REFRESH_TOKEN_SECRET=your-refresh-token-secret

PORT=3001
NODE_ENV=development

CLIENT_URL=http://localhost:5173

BCRYPT_ROUNDS=12
```

Do not commit `.env` to Git.

Secrets should stay in environment variables.

---

# Frontend Environment Variables

Create:

```text
client/.env
```

Example:

```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=http://localhost:3001
```

For production, these point to the deployed backend.

Example:

```env
VITE_API_URL=https://project-manager-71yg.onrender.com
VITE_WS_URL=https://project-manager-71yg.onrender.com
```

---

# Database Setup

Create the PostgreSQL database first.

For example:

```sql
CREATE DATABASE rajdashboard;
```

Then run the migrations:

```bash
node server/db/migrate.js
```

After the schema is created, seed the database:

```bash
node server/db/seed.js
```

The seed script creates the sample users, clients, projects, tasks and activity needed to test the application.

---

# Start the Backend

From the project root:

```bash
npm start
```

The backend normally runs on:

```text
http://localhost:3001
```

---

# Start the Frontend

Open another terminal:

```bash
cd client
npm run dev
```

The frontend normally runs on:

```text
http://localhost:5173
```

Open the URL shown by Vite in the terminal.

---

# Development Workflow

A normal development workflow looks like:

```text
1. Start PostgreSQL
        ↓
2. Start backend
        ↓
3. Start frontend
        ↓
4. Login using seeded account
        ↓
5. Test role-specific features
        ↓
6. Test API authorization
        ↓
7. Test WebSocket updates
        ↓
8. Run tests
```

---

# Testing

Backend tests are located in:

```text
server/__tests__/
```

Run:

```bash
npm test
```

The test suite covers areas including:

- Authentication
- RBAC
- Projects
- Tasks
- Task filters
- Notifications
- Analytics

The important thing about the RBAC tests is that they test backend authorization, rather than only checking whether a frontend button is visible.

---

# API Structure

The backend is organized into route groups.

```text
/auth
/projects
/tasks
/analytics
/activity
/notifications
```

Examples:

```text
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me

GET    /projects
POST   /projects
PUT    /projects/:id
DELETE /projects/:id

GET    /tasks/my
GET    /tasks/projects/:projectId/tasks
POST   /tasks/projects/:projectId/tasks
PUT    /tasks/:id
DELETE /tasks/:id

GET    /analytics/projects/:id/summary
GET    /analytics/projects/:id/snapshot

GET    /activity

GET    /notifications
PATCH  /notifications/:id/read
PATCH  /notifications/read-all
```

Protected endpoints require authentication, and role/ownership checks are applied where required.

---

# Folder Responsibilities

## `client/src/components`

Reusable UI components.

Example:

```text
Layout.tsx
```

handles common application layout/navigation.

## `client/src/contexts`

Global React state and real-time application state.

```text
AuthContext.tsx
WebSocketContext.tsx
```

## `client/src/lib`

Frontend utilities and API communication.

```text
api.ts
```

contains Axios/API calls.

## `client/src/pages`

Page-level UI.

Examples:

```text
Dashboard.tsx
ProjectView.tsx
Register.tsx
```

## `client/src/types`

TypeScript interfaces and types shared by the frontend.

---

## `server/controllers`

Controllers handle HTTP requests and responses.

They should not become a dumping ground for unrelated application logic.

## `server/routes`

Defines API endpoints and connects them to middleware/controllers.

## `server/middleware`

Cross-cutting request handling such as:

- Authentication
- Authorization
- Validation

## `server/services`

Business logic that is better kept separate from HTTP request handling.

Examples:

```text
activity.service.js
notification.service.js
task-status.service.js
analytics.service.js
```

## `server/db`

Database connection, migrations and seed data.

## `server/websocket`

Socket.IO setup, authentication, rooms, presence and real-time event handling.

## `server/jobs`

Background scheduled jobs.

---

# Important Design Decisions

## 1. Why JWT?

JWT provides a straightforward way to authenticate API requests without keeping a traditional server-side session for every request.

The access token is short-lived, while the refresh token allows the user to continue their session.

---

## 2. Why HttpOnly refresh cookies?

The refresh token is more sensitive because it can be used to obtain new access tokens.

Keeping it in an HttpOnly cookie prevents normal browser JavaScript from directly reading it.

---

## 3. Why WebSockets instead of polling?

Polling would mean repeatedly asking the server:

```text
"Anything new?"
"Anything new?"
"Anything new?"
```

That works, but it is unnecessary for a dashboard that needs live updates.

With WebSockets:

```text
Something changes
       ↓
Server sends event
       ↓
Client updates
```

This is more natural for activity feeds, notifications and online presence.

---

## 4. Why store activity in PostgreSQL?

WebSocket memory is temporary.

If the server restarts, in-memory events disappear.

Database-backed activity gives us persistence and allows the application to recover recent activity instead of relying only on whatever happened while a socket connection was alive.

---

## 5. Why enforce RBAC on the backend?

Frontend restrictions are not security.

A user can always attempt to call an API directly.

Therefore:

```text
Frontend restriction = user experience
Backend authorization = security
```

This project uses backend middleware and ownership checks so unauthorized API requests are rejected.

---

## 6. Why separate controllers and services?

Keeping everything inside controllers makes code harder to understand and maintain.

The project separates:

```text
Routes
   ↓
Middleware
   ↓
Controllers
   ↓
Services
   ↓
Database
```

This makes it easier to change business logic without rewriting the HTTP layer.

---

# Example User Scenario

Here is a simple end-to-end example.

### Step 1 — Project Manager creates a project

The PM logs in and creates:

```text
Website Redesign
```

The project is connected to a client.

### Step 2 — PM creates a task

```text
Task:
Build login page

Priority:
High

Due date:
Tomorrow

Assigned developer:
Developer A
```

### Step 3 — Developer receives notification

Developer A immediately sees the assignment notification.

### Step 4 — Developer starts work

The developer changes:

```text
To Do → In Progress
```

The activity is recorded.

### Step 5 — Developer submits for review

The developer changes:

```text
In Progress → In Review
```

The Project Manager receives a notification.

### Step 6 — PM reviews

The PM sees the live activity update and can move the task forward after review.

---

# Production Deployment

The current deployment uses:

```text
React/Vite
     ↓
Vercel

Node/Express/Socket.IO
     ↓
Render

PostgreSQL
     ↓
Render PostgreSQL
```

For production, configure the environment variables in the hosting platforms rather than committing secrets to Git.

### Frontend

Set:

```env
VITE_API_URL=https://project-manager-71yg.onrender.com
VITE_WS_URL=https://project-manager-71yg.onrender.com
```

### Backend

Set the backend environment variables including:

```env
DATABASE_URL=...
JWT_SECRET=...
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=...
PORT=...
NODE_ENV=production
CLIENT_URL=https://client-h4pwfnoss-abhirajmait16-5065s-projects.vercel.app
BCRYPT_ROUNDS=12
```

The exact database connection string and secrets should remain private.

---

# Security Notes

Do not commit:

```text
.env
client/.env
database passwords
JWT secrets
refresh token secrets
private credentials
```

The repository uses `.gitignore` to keep local environment files out of Git.

If a secret is ever accidentally committed, rotate it rather than simply deleting it from the latest commit.

---

# Current Limitations / Future Improvements

This project is intentionally built as a focused assessment/resume project rather than a huge enterprise platform.

Possible future improvements include:

- More advanced project analytics
- Better activity-feed pagination
- More granular permissions
- File attachments
- Comments on tasks
- Email notifications
- Better audit reporting
- Redis-backed Socket.IO scaling
- Job queues such as BullMQ
- Automated CI/CD
- More extensive integration and end-to-end tests
- Improved mobile experience

The current architecture leaves room for these features without needing to rewrite the entire application.

---

# Why I Built It This Way

I wanted the project to demonstrate more than just a React interface.

The important part for me was understanding how a real application behaves when multiple users have different responsibilities.

A developer should not see another developer's work. A Project Manager should not suddenly get access to another PM's projects. An Admin should be able to see the bigger picture.

Then there is the real-time side.

If one person changes something, everyone who is allowed to know about that change should see it without refreshing the page.

That led to the main architecture of this project:

```text
React + TypeScript
        +
Express API
        +
PostgreSQL
        +
JWT Authentication
        +
Backend RBAC
        +
Socket.IO
        +
Background Jobs
        +
Persistent Notifications
```

The goal was not to build the biggest possible project.

The goal was to build a clean, understandable system where the important engineering decisions are actually implemented rather than only described.

---

# Git Workflow

Feature development can be organized with separate branches:

```bash
git checkout -b feature/<feature-name>
```

After completing and testing a feature:

```bash
git add .
git commit -m "Add <feature>"
git push origin feature/<feature-name>
```

Then merge the feature into `main`.

Keep `main` in a working state as much as possible.

---

# Author

**Abhiraj**

Computer Science / Software Development

This project was built as a full-stack portfolio and hiring-assessment project with a focus on:

- Backend development
- REST APIs
- PostgreSQL
- Authentication
- RBAC
- Real-time systems
- React + TypeScript
- Clean project architecture
- Testing
