-- Social Features: Comments & Public Profiles

-- 1. Create Comments Table
CREATE TABLE IF NOT EXISTS comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    raffle_id UUID REFERENCES raffles(id) ON DELETE CASCADE NOT NULL,
    user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE comments;

-- 3. Enable RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 4. Comments Policies
CREATE POLICY "Everyone can view comments" ON comments
    FOR SELECT USING (TRUE);

CREATE POLICY "Authenticated users can post comments" ON comments
    FOR INSERT WITH CHECK (auth_uid_text() = user_id);

CREATE POLICY "Users can edit/delete their own comments" ON comments
    FOR ALL USING (auth_uid_text() = user_id);

-- 5. Update Profile RLS to allow public visibility
-- We need to check if the policy already exists to avoid errors
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Everyone can view profiles'
    ) THEN
        CREATE POLICY "Everyone can view profiles" ON profiles
            FOR SELECT USING (TRUE);
    END IF;
END
$$;
