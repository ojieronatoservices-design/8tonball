-- FORCE ENABLE REALTIME
-- Run this in Supabase SQL Editor to fix the missing notifications

BEGIN;

-- 1. Reset Realtime Publication
DROP PUBLICATION IF EXISTS supabase_realtime;

CREATE PUBLICATION supabase_realtime FOR TABLE 
    profiles,
    raffles,
    entries,
    notifications;

-- 2. Verify it worked (create a helper function we can call from code)
CREATE OR REPLACE FUNCTION get_realtime_setup()
RETURNS JSONB AS $$
DECLARE
    v_tables TEXT[];
BEGIN
    SELECT array_agg(tablename::TEXT) INTO v_tables
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime';
    
    RETURN jsonb_build_object(
        'publication_exists', (v_tables IS NOT NULL),
        'tables', v_tables
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- Output the status immediately for the user running the SQL
SELECT * FROM get_realtime_setup();
