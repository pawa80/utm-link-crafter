// Setup script for new template system
// This will create the new tables and migrate data
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function setupNewTemplateSystem() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Setting up new template system...');

    // Step 1: Create base_utm_templates table
    console.log('1. Creating base_utm_templates table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS base_utm_templates (
        id SERIAL PRIMARY KEY,
        utm_source TEXT NOT NULL,
        utm_medium TEXT NOT NULL,
        utm_content TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Step 2: Create user_utm_templates table
    console.log('2. Creating user_utm_templates table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_utm_templates (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        utm_source TEXT NOT NULL,
        utm_medium TEXT NOT NULL,
        utm_content TEXT NOT NULL,
        description TEXT,
        is_archived BOOLEAN DEFAULT false,
        is_custom BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Step 3: Migrate existing utm_templates data to base_utm_templates (if utm_templates exists)
    console.log('3. Migrating existing utm_templates to base_utm_templates...');
    try {
      await client.query(`
        INSERT INTO base_utm_templates (utm_source, utm_medium, utm_content, description, is_active, created_at)
        SELECT utm_source, utm_medium, utm_content, description, true, created_at
        FROM utm_templates
        ON CONFLICT DO NOTHING
      `);
      console.log('   ✓ Migrated existing utm_templates data');
    } catch (error) {
      if (error.code === '42P01') { // Table does not exist
        console.log('   ⚠ utm_templates table does not exist, skipping migration');
      } else {
        throw error;
      }
    }

    // Step 4: Create user template copies for existing users
    console.log('4. Creating user template copies for existing users...');
    const usersResult = await client.query('SELECT id FROM users');
    const users = usersResult.rows;

    for (const user of users) {
      await client.query(`
        INSERT INTO user_utm_templates (user_id, utm_source, utm_medium, utm_content, description, is_archived, is_custom, created_at)
        SELECT $1, utm_source, utm_medium, utm_content, description, false, false, NOW()
        FROM base_utm_templates
        WHERE is_active = true
        ON CONFLICT DO NOTHING
      `, [user.id]);
    }

    console.log(`   ✓ Created user template copies for ${users.length} users`);

    await client.query('COMMIT');
    console.log('✅ New template system setup completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Template system setup failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

setupNewTemplateSystem().catch(console.error);