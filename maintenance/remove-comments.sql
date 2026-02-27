-- Remove Comment and Social Action Triggers
DROP TRIGGER IF EXISTS tr_on_comment ON comments;
DROP TRIGGER IF EXISTS tr_on_reply ON comments;
DROP TRIGGER IF EXISTS tr_on_vote ON comment_votes;

-- Remove corresponding functions if no longer needed
DROP FUNCTION IF EXISTS notify_on_comment();
DROP FUNCTION IF EXISTS notify_on_reply();
DROP FUNCTION IF EXISTS notify_on_vote();

-- Note: We keep the upsert_notification and tr_on_entry as they are used for Win and Entry notifications.
