-- Comment Voting System Setup

-- 1. Create comment_votes table
CREATE TABLE IF NOT EXISTS comment_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE NOT NULL,
    user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    vote_type SMALLINT CHECK (vote_type IN (1, -1)), -- 1 for upvote, -1 for downvote
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, user_id) -- One vote per user per comment
);

-- 2. Enable RLS
ALTER TABLE comment_votes ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
DROP POLICY IF EXISTS "Everyone can view votes" ON comment_votes;
DROP POLICY IF EXISTS "Authenticated users can vote" ON comment_votes;
DROP POLICY IF EXISTS "Users can change/delete their own votes" ON comment_votes;

CREATE POLICY "Everyone can view votes" ON comment_votes
    FOR SELECT USING (TRUE);

CREATE POLICY "Authenticated users can vote" ON comment_votes
    FOR INSERT WITH CHECK (auth_uid_text() = user_id);

CREATE POLICY "Users can change/delete their own votes" ON comment_votes
    FOR ALL USING (auth_uid_text() = user_id);

-- 4. Set Replica Identity for Realtime
ALTER TABLE comment_votes REPLICA IDENTITY FULL;

-- 5. Add to Realtime Publication
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE comment_votes;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
