-- NUCLEAR RESTORE: RESET EVERYTHING TO BASELINE
-- This script forcefully restores the original RLS policies and function signatures.

-- 1. RESTORE CORE HELPER FUNCTION
-- Re-defines auth_uid_text exactly as required for Clerk integration.
CREATE OR REPLACE FUNCTION auth_uid_text() 
RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::TEXT;
$$ LANGUAGE sql STABLE;

-- Ensure it has no restrictive search_path
ALTER FUNCTION auth_uid_text() RESET search_path;

-- 2. RESET RLS FOR CORE TABLES
-- We drop ALL policies on core tables and re-apply the baseline ones.
DO $$
DECLARE
    t_name TEXT;
    core_tables TEXT[] := ARRAY['profiles', 'raffles', 'entries', 'transactions', 'notifications', 'kyc_requests', 'refund_queue'];
BEGIN
    FOR t_name IN SELECT unnest(core_tables) LOOP
        -- Skip if table doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = t_name AND schemaname = 'public') THEN
            CONTINUE;
        END IF;

        -- Temporarily disable RLS to ensure baseline access if query fails
        EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t_name);
        
        -- Drop all possible policies we might have created or modified
        -- (Using a wildcard approach if possible, but PG requires specific names)
        -- We'll just re-enable RLS and add the baseline ones.
    END LOOP;
END $$;

-- 3. RE-APPLY BASELINE POLICIES (From supabase-schema.sql and kyc_and_refunds.sql)

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth_uid_text() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth_uid_text() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth_uid_text() = id) WITH CHECK (auth_uid_text() = id);
CREATE POLICY "Admin can view all profiles" ON profiles FOR ALL USING ((SELECT is_admin FROM profiles WHERE id = auth_uid_text()));

-- RAFFLES
ALTER TABLE public.raffles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can view raffles" ON raffles;
DROP POLICY IF EXISTS "Admin can modify raffles" ON raffles;
CREATE POLICY "Everyone can view raffles" ON raffles FOR SELECT USING (TRUE);
CREATE POLICY "Admin can modify raffles" ON raffles FOR ALL USING ((SELECT is_admin FROM profiles WHERE id = auth_uid_text()));

-- ENTRIES
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own entries" ON entries;
DROP POLICY IF EXISTS "Admin can view all entries" ON entries;
CREATE POLICY "Users can view own entries" ON entries FOR SELECT USING (auth_uid_text() = user_id);
CREATE POLICY "Admin can view all entries" ON entries FOR SELECT USING ((SELECT is_admin FROM profiles WHERE id = auth_uid_text()));

-- TRANSACTIONS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Admin can manage transactions" ON transactions;
CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth_uid_text() = user_id);
CREATE POLICY "Admin can manage transactions" ON transactions FOR ALL USING ((SELECT is_admin FROM profiles WHERE id = auth_uid_text()));

-- NOTIFICATIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth_uid_text() = user_id);

-- KYC_REQUESTS
ALTER TABLE public.kyc_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own kyc" ON kyc_requests;
DROP POLICY IF EXISTS "Users can create own kyc" ON kyc_requests;
DROP POLICY IF EXISTS "Admins can manage kyc" ON kyc_requests;
CREATE POLICY "Users can view own kyc" ON kyc_requests FOR SELECT USING (auth_uid_text() = user_id);
CREATE POLICY "Users can create own kyc" ON kyc_requests FOR INSERT WITH CHECK (auth_uid_text() = user_id);
CREATE POLICY "Admins can manage kyc" ON kyc_requests USING ((SELECT is_admin FROM profiles WHERE id = auth_uid_text()));

-- REFUND_QUEUE
ALTER TABLE public.refund_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage refund queue" ON refund_queue;
CREATE POLICY "Admins can manage refund queue" ON refund_queue USING ((SELECT is_admin FROM profiles WHERE id = auth_uid_text()));

-- 4. CLEAN UP BROKEN POLICIES ON SOCIAL TABLES (Ensuring they are at least viewable)
DO $$
DECLARE
    t_name TEXT;
    social_tables TEXT[] := ARRAY['media', 'messages', 'posts', 'replies', 'rounds', 'top_up_requests'];
BEGIN
    FOR t_name IN SELECT unnest(social_tables) LOOP
        IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = t_name AND schemaname = 'public') THEN
            EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t_name);
            EXECUTE format('DROP POLICY IF EXISTS "Users can manage own %s" ON public.%I', t_name, t_name);
            EXECUTE format('DROP POLICY IF EXISTS "Anyone can view %s" ON public.%I', t_name, t_name);
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t_name);
            EXECUTE format('CREATE POLICY "Anyone can view %s" ON public.%I FOR SELECT USING (TRUE)', t_name, t_name);
        END IF;
    END LOOP;
END $$;
