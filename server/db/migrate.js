import { query } from "./index.js";

const migrations = [
  `
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'developer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );
  `,

  `
  ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

  UPDATE users
  SET role = 'project_manager'
  WHERE role = 'user';

  ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'project_manager', 'developer'));
  `,

  `
  CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email);
  `,

  `
  CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );
  `,

  `
  CREATE INDEX IF NOT EXISTS idx_clients_email
  ON clients(email);
  `,

  `
  CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );
  `,

  `
  ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS client_id UUID;
  `,

  `
  CREATE INDEX IF NOT EXISTS idx_projects_owner
  ON projects(owner_id);
  `,

  `
  CREATE INDEX IF NOT EXISTS idx_projects_client
  ON projects(client_id);
  `,

  `
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'projects_client_id_fkey'
    ) THEN
      ALTER TABLE projects
      ADD CONSTRAINT projects_client_id_fkey
      FOREIGN KEY (client_id)
      REFERENCES clients(id)
      ON DELETE SET NULL;
    END IF;
  END
  $$;
  `,

  `
  CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT NOT NULL DEFAULT 'medium',
    due_date TIMESTAMP WITH TIME ZONE,
    overdue BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );
  `,

  `
  ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS assigned_to UUID,
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS overdue BOOLEAN NOT NULL DEFAULT false;
  `,

  `
  ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_status_check;

  ALTER TABLE tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('todo', 'in-progress', 'in-review', 'done'));
  `,

  `
  ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_priority_check;

  ALTER TABLE tasks
  ADD CONSTRAINT tasks_priority_check
  CHECK (priority IN ('low', 'medium', 'high', 'critical'));
  `,

  `
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'tasks_assigned_to_fkey'
    ) THEN
      ALTER TABLE tasks
      ADD CONSTRAINT tasks_assigned_to_fkey
      FOREIGN KEY (assigned_to)
      REFERENCES users(id)
      ON DELETE SET NULL;
    END IF;
  END
  $$;
  `,

  `
  CREATE INDEX IF NOT EXISTS idx_tasks_project_status
  ON tasks(project_id, status);
  `,

  `
  CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to
  ON tasks(assigned_to);
  `,

  `
  CREATE INDEX IF NOT EXISTS idx_tasks_priority
  ON tasks(priority);
  `,

  `
  CREATE INDEX IF NOT EXISTS idx_tasks_due_date
  ON tasks(due_date);
  `,

  `
  CREATE INDEX IF NOT EXISTS idx_tasks_overdue
  ON tasks(overdue);
  `,

  `
  CREATE TABLE IF NOT EXISTS task_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );
  `,

  `
  CREATE INDEX IF NOT EXISTS idx_task_status_history_task_time
  ON task_status_history(task_id, changed_at);
  `,

  `
  CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );
  `,

  `
  CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications(user_id, read_at);
  `,

  `
  CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);
  `,

  `
  CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );
  `,

  `
  CREATE INDEX IF NOT EXISTS idx_activity_project_time
  ON activity_logs(project_id, created_at);
  `,

  `
  CREATE INDEX IF NOT EXISTS idx_activity_user_time
  ON activity_logs(user_id, created_at);
  `,
];

async function runMigrations() {
  console.log("Running database migrations...\n");

  try {
    for (let i = 0; i < migrations.length; i++) {
      console.log(`Running migration ${i + 1}/${migrations.length}...`);

      await query(migrations[i]);

      console.log(`Migration ${i + 1} completed\n`);
    }

    console.log("All migrations completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigrations();
