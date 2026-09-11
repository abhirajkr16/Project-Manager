import bcrypt from 'bcrypt';
import { query, transaction } from './index.js';

async function seed() {
  console.log('🌱 Seeding database...\n');

  try {
    await transaction(async (client) => {
      // Create admin user
      const adminPassword = await bcrypt.hash('admin123', 12);
      const adminResult = await client.query(
        `INSERT INTO users (name, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        ['Admin User', 'admin@example.com', adminPassword, 'admin']
      );
      
      // Create regular users
      const userPassword = await bcrypt.hash('user123', 12);
      const user1Result = await client.query(
        `INSERT INTO users (name, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        ['Alice Johnson', 'alice@example.com', userPassword, 'user']
      );
      
      const user2Result = await client.query(
        `INSERT INTO users (name, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        ['Bob Smith', 'bob@example.com', userPassword, 'user']
      );

      console.log('✓ Created users');

      if (user1Result.rows.length > 0) {
        const userId = user1Result.rows[0].id;

        // Create projects
        const project1 = await client.query(
          `INSERT INTO projects (owner_id, title, description) 
           VALUES ($1, $2, $3) RETURNING id`,
          [userId, 'Website Redesign', 'Complete overhaul of company website with modern UI/UX']
        );

        const project2 = await client.query(
          `INSERT INTO projects (owner_id, title, description) 
           VALUES ($1, $2, $3) RETURNING id`,
          [userId, 'Mobile App Development', 'Native mobile app for iOS and Android']
        );

        console.log('✓ Created projects');

        const projectId = project1.rows[0].id;

        // Create tasks with various statuses
        const tasks = [
          { title: 'Create wireframes', status: 'done', priority: 'high', daysAgo: 10 },
          { title: 'Design mockups', status: 'done', priority: 'high', daysAgo: 8 },
          { title: 'Implement homepage', status: 'in-progress', priority: 'high', daysAgo: 5 },
          { title: 'Build contact form', status: 'in-progress', priority: 'medium', daysAgo: 3 },
          { title: 'Set up analytics', status: 'todo', priority: 'medium', daysAgo: 0 },
          { title: 'Write documentation', status: 'todo', priority: 'low', daysAgo: 0 },
          { title: 'Conduct user testing', status: 'todo', priority: 'high', daysAgo: 0 },
        ];

        for (const task of tasks) {
          const createdAt = new Date(Date.now() - task.daysAgo * 24 * 60 * 60 * 1000);
          let startedAt = null;
          let completedAt = null;

          if (task.status === 'in-progress' || task.status === 'done') {
            startedAt = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000); // 2 hours after creation
          }

          if (task.status === 'done') {
            completedAt = new Date(startedAt.getTime() + (12 + Math.random() * 24) * 60 * 60 * 1000); // 12-36 hours after start
          }

          await client.query(
            `INSERT INTO tasks (project_id, title, status, priority, created_by, created_at, started_at, completed_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [projectId, task.title, task.status, task.priority, userId, createdAt, startedAt, completedAt]
          );

          // Log activity
          await client.query(
            `INSERT INTO activity_logs (user_id, project_id, action, metadata, created_at) 
             VALUES ($1, $2, $3, $4, $5)`,
            [
              userId,
              projectId,
              'create_task',
              JSON.stringify({ title: task.title, status: task.status }),
              createdAt
            ]
          );
        }

        console.log('✓ Created tasks and activity logs');
      }
    });

    console.log('\n✅ Database seeded successfully!');
    console.log('\nTest credentials:');
    console.log('  Admin: admin@example.com / admin123');
    console.log('  User:  alice@example.com / user123');
    console.log('  User:  bob@example.com / user123');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
