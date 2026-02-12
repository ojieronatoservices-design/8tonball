-- Activity Center & Collective Notifications Setup

-- 1. Enhance notifications table
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS raffle_id UUID REFERENCES raffles(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS actor_id TEXT REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Function to upsert notifications (Collective Logic)
CREATE OR REPLACE FUNCTION upsert_notification(
    p_user_id TEXT,
    p_type TEXT,
    p_raffle_id UUID,
    p_comment_id UUID,
    p_actor_id TEXT,
    p_message TEXT
) RETURNS VOID AS $$
DECLARE
    v_existing_id UUID;
    v_actor_name TEXT;
    v_total_actors INTEGER;
    v_new_message TEXT;
    v_metadata JSONB;
BEGIN
    -- Get actor name
    SELECT display_name INTO v_actor_name FROM profiles WHERE id = p_actor_id;
    
    -- Check for existing unread notification of same type and object
    SELECT id, metadata INTO v_existing_id, v_metadata 
    FROM notifications 
    WHERE user_id = p_user_id 
      AND type = p_type 
      AND is_read = false
      AND (raffle_id = p_raffle_id OR (raffle_id IS NULL AND p_raffle_id IS NULL))
      AND (comment_id = p_comment_id OR (comment_id IS NULL AND p_comment_id IS NULL))
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        -- Increase count
        v_total_actors := (COALESCE(v_metadata->>'total_actors', '1'))::INTEGER + 1;
        
        -- Build collective message
        -- Example: "James, Kimberly and 102 others upvoted your comment"
        IF v_total_actors = 2 THEN
            v_new_message := v_actor_name || ' and 1 other ' || p_message;
        ELSE
            v_new_message := v_actor_name || ' and ' || (v_total_actors - 1) || ' others ' || p_message;
        END IF;

        UPDATE notifications 
        SET 
            message = v_new_message,
            metadata = jsonb_build_object(
                'total_actors', v_total_actors,
                'last_actor_name', v_actor_name
            ),
            created_at = NOW() -- Bring to top
        WHERE id = v_existing_id;
    ELSE
        -- Create new notification
        INSERT INTO notifications (user_id, type, raffle_id, comment_id, actor_id, message, metadata)
        VALUES (
            p_user_id, 
            p_type, 
            p_raffle_id, 
            p_comment_id, 
            p_actor_id, 
            v_actor_name || ' ' || p_message,
            jsonb_build_object('total_actors', 1, 'last_actor_name', v_actor_name)
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Triggers for Social Actions

-- 3.1 New Comment (Notifies Host)
CREATE OR REPLACE FUNCTION notify_on_comment() RETURNS TRIGGER AS $$
DECLARE
    v_host_id TEXT;
BEGIN
    SELECT host_user_id INTO v_host_id FROM raffles WHERE id = NEW.raffle_id;
    
    -- Don't notify if host is the one commenting
    IF v_host_id != NEW.user_id AND NEW.parent_id IS NULL THEN
        PERFORM upsert_notification(
            v_host_id,
            'comment',
            NEW.raffle_id,
            NULL,
            NEW.user_id,
            'commented on your event'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_on_comment ON comments;
CREATE TRIGGER tr_on_comment AFTER INSERT ON comments FOR EACH ROW EXECUTE FUNCTION notify_on_comment();

-- 3.2 New Reply (Notifies Parent Author)
CREATE OR REPLACE FUNCTION notify_on_reply() RETURNS TRIGGER AS $$
DECLARE
    v_parent_user_id TEXT;
BEGIN
    IF NEW.parent_id IS NOT NULL THEN
        SELECT user_id INTO v_parent_user_id FROM comments WHERE id = NEW.parent_id;
        
        -- Don't notify if replying to own comment
        IF v_parent_user_id != NEW.user_id THEN
            PERFORM upsert_notification(
                v_parent_user_id,
                'reply',
                NEW.raffle_id,
                NEW.parent_id,
                NEW.user_id,
                'replied to your comment'
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_on_reply ON comments;
CREATE TRIGGER tr_on_reply AFTER INSERT ON comments FOR EACH ROW EXECUTE FUNCTION notify_on_reply();

-- 3.3 New Entry (Notifies Host - Collective)
CREATE OR REPLACE FUNCTION notify_on_entry() RETURNS TRIGGER AS $$
DECLARE
    v_host_id TEXT;
BEGIN
    SELECT host_user_id INTO v_host_id FROM raffles WHERE id = NEW.raffle_id;
    
    -- Don't notify host of own entries (if testing)
    IF v_host_id != NEW.user_id THEN
        PERFORM upsert_notification(
            v_host_id,
            'entry',
            NEW.raffle_id,
            NULL,
            NEW.user_id,
            'added entries to your event'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_on_entry ON entries;
CREATE TRIGGER tr_on_entry AFTER INSERT ON entries FOR EACH ROW EXECUTE FUNCTION notify_on_entry();

-- 3.4 New Vote (Notifies Comment Author - Collective)
CREATE OR REPLACE FUNCTION notify_on_vote() RETURNS TRIGGER AS $$
DECLARE
    v_author_id TEXT;
    v_raffle_id UUID;
    v_type TEXT;
BEGIN
    SELECT user_id, raffle_id INTO v_author_id, v_raffle_id FROM comments WHERE id = NEW.comment_id;
    
    -- Don't notify if voting on own comment
    IF v_author_id != NEW.user_id THEN
        v_type := CASE WHEN NEW.vote_type = 1 THEN 'vote_up' ELSE 'vote_down' END;
        PERFORM upsert_notification(
            v_author_id,
            v_type,
            v_raffle_id,
            NEW.comment_id,
            NEW.user_id,
            CASE WHEN NEW.vote_type = 1 THEN 'upvoted your comment' ELSE 'downvoted your comment' END
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_on_vote ON comment_votes;
CREATE TRIGGER tr_on_vote AFTER INSERT OR UPDATE ON comment_votes FOR EACH ROW EXECUTE FUNCTION notify_on_vote();
