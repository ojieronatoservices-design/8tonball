-- REALTIME FIX: Enable Supabase Realtime for required tables
-- Run this in the Supabase SQL Editor

-- 1. Ensure the 'supabase_realtime' publication includes our tables
-- First, check if publication exists and drop/recreate with all tables

-- Drop existing if any (safe to run)
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Create publication with all tables that need realtime
CREATE PUBLICATION supabase_realtime FOR TABLE 
    profiles,
    raffles,
    entries,
    notifications;

-- 2. Alternative: If the above fails, add tables individually
-- ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
-- ALTER PUBLICATION supabase_realtime ADD TABLE raffles;
-- ALTER PUBLICATION supabase_realtime ADD TABLE entries;
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 3. Verify the publication includes our tables
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- NOTE: After running this, you may need to:
-- 1. Go to Supabase Dashboard > Database > Replication
-- 2. Ensure "supabase_realtime" publication is enabled
-- 3. Check that the tables (profiles, raffles, entries, notifications) are listed
