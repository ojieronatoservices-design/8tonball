-- Social Features: Comments & Public Profiles (ROBUST REALTIME PATCH)

-- 1. Helper Function (Ensures Clerk ID integration is active)
CREATE OR REPLACE FUNCTION auth_uid_text() 
RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::TEXT;
$$ LANGUAGE sql STABLE;

-- 2. Create/Update Comments Table
CREATE TABLE IF NOT EXISTS comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    raffle_id UUID REFERENCES raffles(id) ON DELETE CASCADE NOT NULL,
    user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add parent_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comments' AND column_name='parent_id') THEN
        ALTER TABLE comments ADD COLUMN parent_id UUID REFERENCES comments(id) ON DELETE CASCADE;
    END IF;
END
$$;

-- 4. Set Replica Identity (CRITICAL for Realtime updates)
ALTER TABLE comments REPLICA IDENTITY FULL;

-- 5. Robust Realtime Publication Setup
DO $$
BEGIN
    -- Create publication if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
    
    -- Try to add table, ignore if already exists
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE comments;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
END $$;

-- 6. Enable RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 7. Comments Policies
DROP POLICY IF EXISTS "Everyone can view comments" ON comments;
DROP POLICY IF EXISTS "Authenticated users can post comments" ON comments;
DROP POLICY IF EXISTS "Users can edit/delete their own comments" ON comments;

CREATE POLICY "Everyone can view comments" ON comments
    FOR SELECT USING (TRUE);

CREATE POLICY "Authenticated users can post comments" ON comments
    FOR INSERT WITH CHECK (auth_uid_text() = user_id);

CREATE POLICY "Users can edit/delete their own comments" ON comments
    FOR ALL USING (auth_uid_text() = user_id);

-- 8. Profiles: Ensure public visibility for stats
DROP POLICY IF EXISTS "Everyone can view profiles" ON profiles;
CREATE POLICY "Everyone can view profiles" ON profiles
    FOR SELECT USING (TRUE);
