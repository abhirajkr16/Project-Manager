import { query } from './index.js';

const migrations = [
  // Users table
  `
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','user')) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );
  `,
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
  
  // Projects table
  `
  CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );
  `,
  `CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);`,
  
  // Tasks table
  `
  CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK (status IN ('todo','in-progress','done')) DEFAULT 'todo',
    priority TEXT NOT NULL CHECK (priority IN ('low','medium','high')) DEFAULT 'medium',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
  );
  `,
  `CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status);`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at);`,
  
  // Activity logs table
  `
  CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    project_id UUID REFERENCES projects(id),
    action TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
  );
  `,
  `CREATE INDEX IF NOT EXISTS idx_activity_project_time ON activity_logs(project_id, created_at);`,
  `CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);`,
];

async function runMigrations() {
  console.log('🚀 Running database migrations...\n');
  
  try {
    for (let i = 0; i < migrations.length; i++) {
      console.log(`Running migration ${i + 1}/${migrations.length}...`);
      await query(migrations[i]);
      console.log(`✓ Migration ${i + 1} completed\n`);
    }
    
    console.log('✅ All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
