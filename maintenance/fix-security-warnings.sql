-- FIX SECURITY WARNINGS: FUNCTION SEARCH PATH
-- This script hardens Postgres functions by setting an explicit search_path.
-- This prevents "search path hijacking" and resolves Supabase Security Advisor warnings.

DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Loop through the functions that were flagged in the security report
    -- We filter by name and ensure they are in the 'public' schema
    FOR func_record IN 
        SELECT 
            n.nspname as schema_name,
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as identity_args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname IN (
            'auth_uid_text',
            'notify_on_comment',
            'notify_on_entry',
            'notify_on_reply',
            'auto_draw_expired_events',
            'draw_raffle_winner_v4',
            'draw_raffle_winner_v5',
            'reward_watch_ad',
            'approve_transaction',
            'draw_winner_and_payout',
            'notify_on_vote',
            'get_realtime_setup',
            'upsert_notification',
            'enter_raffle',
            'increment_balance',
            'increment_wins'
        )
    LOOP
        -- Apply the fix: SET search_path = public
        EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public', 
            func_record.schema_name, 
            func_record.function_name, 
            func_record.identity_args);
            
        RAISE NOTICE 'Hardened function: %.%(%)', 
            func_record.schema_name, 
            func_record.function_name, 
            func_record.identity_args;
    END LOOP;
END $$;
