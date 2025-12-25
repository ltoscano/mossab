#!/usr/bin/env node

/**
 * Database Initialization Script
 * Creates admin user and sample data
 */

require('dotenv').config();
const path = require('path');
const MarketplaceDB = require('../models/database');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/marketplace.db');

console.log('🔄 Initializing database...');
const db = new MarketplaceDB(DB_PATH);

// Create admin user
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@mossab.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';

console.log(`\n📝 Creating admin user: ${ADMIN_USERNAME}`);

try {
  const adminUser = db.createUser(ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD);

  // Set as admin
  db.db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(adminUser.id);

  console.log('✅ Admin user created successfully!');
  console.log(`   Username: ${ADMIN_USERNAME}`);
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   API Key: ${adminUser.api_key}`);
  console.log(`\n⚠️  SAVE THIS API KEY! You'll need it to publish items.`);
} catch (error) {
  if (error.message.includes('UNIQUE constraint')) {
    console.log('ℹ️  Admin user already exists');

    const existingAdmin = db.getUserByUsername(ADMIN_USERNAME);
    console.log(`   API Key: ${existingAdmin.api_key}`);
  } else {
    console.error('❌ Error creating admin user:', error.message);
  }
}

// Add sample items (optional)
console.log('\n📦 Creating sample items...');

try {
  const admin = db.getUserByUsername(ADMIN_USERNAME);

  // Sample agent
  const sampleAgent = {
    type: 'agent',
    name: 'code-reviewer',
    version: '1.0.0',
    author_id: admin.id,
    author_name: admin.username,
    title: 'Code Reviewer Agent',
    description: 'AI agent specialized in reviewing code for bugs, security issues, and best practices',
    content: {
      model: 'claude-sonnet-4-5',
      tools: ['code_analyzer', 'web_search'],
      thoroughness: 'high',
      system_prompt: 'You are an expert code reviewer...'
    },
    category: 'development',
    tags: ['code-review', 'quality', 'security']
  };

  db.createItem(sampleAgent);
  console.log('✅ Created sample agent: code-reviewer');

  // Sample workflow
  const sampleWorkflow = {
    type: 'workflow',
    name: 'full-stack-review',
    version: '1.0.0',
    author_id: admin.id,
    author_name: admin.username,
    title: 'Full Stack Review Workflow',
    description: 'Complete review pipeline for full-stack applications',
    content: {
      mode: 'sequential',
      steps: [
        {
          name: 'Frontend Review',
          agent: 'code-reviewer',
          task: 'Review frontend code',
          stopOnFailure: false
        },
        {
          name: 'Backend Review',
          agent: 'security-audit',
          task: 'Review backend security',
          stopOnFailure: true
        }
      ]
    },
    category: 'workflow',
    tags: ['full-stack', 'review', 'quality']
  };

  db.createItem(sampleWorkflow);
  console.log('✅ Created sample workflow: full-stack-review');

} catch (error) {
  if (error.message.includes('already exists')) {
    console.log('ℹ️  Sample items already exist');
  } else {
    console.error('❌ Error creating sample items:', error.message);
  }
}

// Stats
const stats = db.getStats();
console.log('\n📊 Database Stats:');
console.log(`   Users: ${stats.users}`);
console.log(`   Items: ${stats.items} (${stats.agents} agents, ${stats.workflows} workflows)`);
console.log(`   Downloads: ${stats.downloads}`);

console.log('\n✅ Database initialization complete!');
console.log(`📁 Database location: ${DB_PATH}\n`);

db.close();
