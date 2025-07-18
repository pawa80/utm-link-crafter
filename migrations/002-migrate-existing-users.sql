-- Migration: Migrate Existing Users to Account System
-- Created: 2025-07-18
-- Purpose: Create default accounts for existing users and populate account_id fields

-- Create a default account for each existing user
DO $$
DECLARE
    user_record RECORD;
    new_account_id INTEGER;
BEGIN
    -- Loop through all existing users
    FOR user_record IN SELECT id, email FROM users LOOP
        -- Create a default account for each user
        INSERT INTO accounts (name, subscription_tier, trial_end_date)
        VALUES (
            user_record.email || '''s Account',
            'trial',
            NOW() + INTERVAL '30 days'
        )
        RETURNING id INTO new_account_id;
        
        -- Add user to their default account as super_admin
        INSERT INTO user_accounts (user_id, account_id, role)
        VALUES (user_record.id, new_account_id, 'super_admin');
        
        -- Update all existing data to reference the new account
        UPDATE source_templates 
        SET account_id = new_account_id 
        WHERE user_id = user_record.id AND account_id IS NULL;
        
        UPDATE tags 
        SET account_id = new_account_id 
        WHERE user_id = user_record.id AND account_id IS NULL;
        
        UPDATE campaign_landing_pages 
        SET account_id = new_account_id 
        WHERE user_id = user_record.id AND account_id IS NULL;
        
        UPDATE user_utm_templates 
        SET account_id = new_account_id 
        WHERE user_id = user_record.id AND account_id IS NULL;
        
        UPDATE utm_links 
        SET account_id = new_account_id 
        WHERE user_id = user_record.id AND account_id IS NULL;
        
    END LOOP;
END $$;

-- Add check constraints to ensure data integrity
ALTER TABLE source_templates ADD CONSTRAINT check_account_id_not_null CHECK (account_id IS NOT NULL);
ALTER TABLE tags ADD CONSTRAINT check_account_id_not_null CHECK (account_id IS NOT NULL);
ALTER TABLE campaign_landing_pages ADD CONSTRAINT check_account_id_not_null CHECK (account_id IS NOT NULL);
ALTER TABLE user_utm_templates ADD CONSTRAINT check_account_id_not_null CHECK (account_id IS NOT NULL);
ALTER TABLE utm_links ADD CONSTRAINT check_account_id_not_null CHECK (account_id IS NOT NULL);