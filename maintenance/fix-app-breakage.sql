-- RECOVERY: RESTORE APP FUNCTIONALITY
-- This script reverts restrictive search_paths and removes potentially broken RLS policies.

-- 1. RESET FUNCTION SEARCH PATHS
-- Reverts the search_path restriction to ensure core functions can access all necessary schemas.
DO $$ 
DECLARE
    f_record RECORD;
BEGIN
    FOR f_record IN (
        SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.proname IN (
            'auth_uid_text', 'get_realtime_setup', 'upsert_notification', 
            'notify_on_comment', 'notify_on_reply', 'notify_on_entry', 'notify_on_vote',
            'draw_raffle_winner_v4', 'draw_winner_and_payout', 'enter_raffle', 
            'approve_transaction', 'reward_watch_ad', 'auto_draw_expired_events',
            'increment_wins', 'increment_balance'
        )
    ) LOOP
        EXECUTE format('ALTER FUNCTION %I.%I(%s) RESET search_path', f_record.nspname, f_record.proname, f_record.args);
    END LOOP;
END $$;

-- 2. REMOVE POTENTIALLY BROKEN DYNAMIC POLICIES
-- Removes the policies that may be throwing "invalid input syntax for type uuid" errors.
DO $$
DECLARE
    t_name TEXT;
    target_tables TEXT[] := ARRAY['media', 'messages', 'posts', 'replies', 'rounds', 'top_up_requests'];
BEGIN
    FOR t_name IN SELECT unnest(target_tables) LOOP
        -- Skip if table doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = t_name AND schemaname = 'public') THEN
            CONTINUE;
        END IF;

        -- Drop the experimental ownership-based policies
        EXECUTE format('DROP POLICY IF EXISTS "Users can manage own %s" ON public.%I', t_name, t_name);
        EXECUTE format('DROP POLICY IF EXISTS "Admins only access for %s" ON public.%I', t_name, t_name);
        
        -- Restore public viewing if it was a social/public table (conservative assumption)
        IF t_name IN ('messages', 'posts', 'replies') THEN
            EXECUTE format('DROP POLICY IF EXISTS "Anyone can view %s" ON public.%I', t_name, t_name);
            EXECUTE format('CREATE POLICY "Anyone can view %s" ON public.%I FOR SELECT USING (TRUE)', t_name, t_name);
        END IF;
    END LOOP;
END $$;

-- 3. VERIFY BASELINE AUTH
-- Ensure auth_uid_text is working correctly
SELECT auth_uid_text();
