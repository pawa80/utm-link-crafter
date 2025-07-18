-- Migration: Add Account Management Tables
-- Created: 2025-07-18
-- Purpose: Add multi-user account support while maintaining backwards compatibility

-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  subscription_tier TEXT NOT NULL DEFAULT 'trial',
  trial_end_date TIMESTAMP,
  feature_flags JSON DEFAULT '{}',
  usage_limits JSON DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create user_accounts junction table
CREATE TABLE IF NOT EXISTS user_accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  role TEXT NOT NULL DEFAULT 'user',
  invited_by INTEGER REFERENCES users(id),
  joined_at TIMESTAMP DEFAULT NOW()
);

-- Create invitations table
CREATE TABLE IF NOT EXISTS invitations (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add account_id columns to existing tables (nullable for backwards compatibility)
ALTER TABLE source_templates ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id);
ALTER TABLE tags ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id);
ALTER TABLE campaign_landing_pages ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id);
ALTER TABLE user_utm_templates ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id);
ALTER TABLE utm_links ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_accounts_user_id ON user_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_accounts_account_id ON user_accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_source_templates_account_id ON source_templates(account_id);
CREATE INDEX IF NOT EXISTS idx_tags_account_id ON tags(account_id);
CREATE INDEX IF NOT EXISTS idx_campaign_landing_pages_account_id ON campaign_landing_pages(account_id);
CREATE INDEX IF NOT EXISTS idx_user_utm_templates_account_id ON user_utm_templates(account_id);
CREATE INDEX IF NOT EXISTS idx_utm_links_account_id ON utm_links(account_id);