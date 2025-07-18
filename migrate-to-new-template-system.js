// Migration script to move from old template system to new user-specific template system
// This script will:
// 1. Migrate existing utm_templates to base_utm_templates 
// 2. Create user_utm_templates copies for all existing users
// 3. Clean up old tables

const { Pool } = require('pg');

async function migrateTemplateSystem() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Starting template system migration...');

    // Step 1: Create base_utm_templates from existing utm_templates
    console.log('1. Migrating utm_templates to base_utm_templates...');
    await client.query(`
      INSERT INTO base_utm_templates (utm_source, utm_medium, utm_content, description, is_active, created_at)
      SELECT utm_source, utm_medium, utm_content, description, true, created_at
      FROM utm_templates
      ON CONFLICT DO NOTHING
    `);

    // Step 2: Get all users
    console.log('2. Getting all users...');
    const usersResult = await client.query('SELECT id FROM users');
    const users = usersResult.rows;

    // Step 3: Create user_utm_templates for each user based on base templates
    console.log('3. Creating user template copies for all users...');
    for (const user of users) {
      await client.query(`
        INSERT INTO user_utm_templates (user_id, utm_source, utm_medium, utm_content, description, is_archived, is_custom, created_at)
        SELECT $1, utm_source, utm_medium, utm_content, description, false, false, NOW()
        FROM base_utm_templates
        WHERE is_active = true
        ON CONFLICT DO NOTHING
      `, [user.id]);
    }

    // Step 4: Drop old tables (will be done after confirming everything works)
    console.log('4. Migration completed successfully!');
    console.log(`   - Created base templates for admins`);
    console.log(`   - Created user template copies for ${users.length} users`);
    console.log('   - Old tables preserved for now (drop manually after verification)');

    await client.query('COMMIT');
    console.log('Migration completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  migrateTemplateSystem().catch(console.error);
}

module.exports = { migrateTemplateSystem };