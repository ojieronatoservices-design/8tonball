-- FIX: RESOLVE SUPABASE SECURITY ADVISOR WARNINGS (TYPE-SAFE VERSION)
-- This script hardens functions by setting an explicit search_path
-- and correctly applies RLS policies by dynamically detecting ownership columns and their types.

-- 1. HARDEN FUNCTION SEARCH PATHS
-- Prevents search-path shadowing attacks (Supabase Advisor 0011)
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
        EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public', f_record.nspname, f_record.proname, f_record.args);
    END LOOP;
END $$;

-- 2. HARDEN RLS POLICIES DYNAMICALLY (Supabase Advisor 0024)
-- This block checks each table for a suitable ownership column and applies a secure, type-safe policy.
DO $$
DECLARE
    t_name TEXT;
    target_tables TEXT[] := ARRAY['media', 'messages', 'posts', 'replies', 'rounds', 'top_up_requests'];
    col_name TEXT;
    col_type TEXT;
    cast_clause TEXT;
BEGIN
    FOR t_name IN SELECT unnest(target_tables) LOOP
        -- Skip if table doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = t_name AND schemaname = 'public') THEN
            CONTINUE;
        END IF;

        -- Try to find an ownership column and its type
        SELECT column_name, data_type INTO col_name, col_type
        FROM information_schema.columns 
        WHERE table_name = t_name 
        AND column_name IN ('user_id', 'author_id', 'sender_id', 'profile_id', 'actor_id', 'host_user_id')
        ORDER BY CASE column_name 
            WHEN 'user_id' THEN 1 
            WHEN 'author_id' THEN 2
            WHEN 'sender_id' THEN 3
            WHEN 'profile_id' THEN 4
            WHEN 'actor_id' THEN 5
            WHEN 'host_user_id' THEN 6
            ELSE 7 END
        LIMIT 1;

        -- Drop existing permissive policies
        EXECUTE format('DROP POLICY IF EXISTS "Unrestricted Insert" ON public.%I', t_name);
        EXECUTE format('DROP POLICY IF EXISTS "Auth users can create %s" ON public.%I', t_name, t_name);
        EXECUTE format('DROP POLICY IF EXISTS "Users can send their own %s" ON public.%I', t_name, t_name);
        EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can insert %s" ON public.%I', t_name, t_name);
        EXECUTE format('DROP POLICY IF EXISTS "Users can manage own %s" ON public.%I', t_name, t_name);

        IF col_name IS NOT NULL THEN
            -- Determine if we need to cast auth_uid_text()
            IF col_type = 'uuid' THEN
                cast_clause := '::uuid';
            ELSE
                cast_clause := '';
            END IF;

            -- Apply ownership-based policy with type safety
            EXECUTE format(
                'CREATE POLICY "Users can manage own %s" ON public.%I FOR ALL USING (auth_uid_text()%s = %I) WITH CHECK (auth_uid_text()%s = %I)', 
                t_name, t_name, cast_clause, col_name, cast_clause, col_name
            );
            RAISE NOTICE 'Applied type-safe policy to % using column % (%)', t_name, col_name, col_type;
        ELSE
            -- No ownership column found, apply a safe default-deny for insert/update
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t_name);
            EXECUTE format('CREATE POLICY "Admins only access for %s" ON public.%I FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth_uid_text() AND is_admin = true))', t_name, t_name);
            RAISE NOTICE 'No ownership column found for %, applied admin-only policy', t_name;
        END IF;
    END LOOP;
END $$;
