-- FINAL APP RESTORATION: FIX RECURSION & RESTORE SECURITY
-- This script fixes the "infinite loading" hang by using a non-recursive admin check.

-- 1. BASELINE AUTH FUNCTION
-- Ensures auth_uid_text is correctly defined for Clerk IDs.
CREATE OR REPLACE FUNCTION auth_uid_text() 
RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::TEXT;
$$ LANGUAGE sql STABLE;

-- IMPORTANT: Reset search path to avoid blocking internal table lookups
ALTER FUNCTION auth_uid_text() RESET search_path;

-- 2. SAFE ADMIN CHECK (NON-RECURSIVE)
-- Using SECURITY DEFINER bypasses RLS on the profiles table during the check.
CREATE OR REPLACE FUNCTION check_is_admin() 
RETURNS BOOLEAN AS $$
    SELECT is_admin FROM public.profiles WHERE id = auth_uid_text();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- 3. COMPREHENSIVE POLICY RESET
-- Forcefully clean up all experimental policies to ensure a clean slate.
DO $$
DECLARE
    table_rec RECORD;
    policy_rec RECORD;
    core_tables TEXT[] := ARRAY['profiles', 'raffles', 'entries', 'transactions', 'notifications', 'kyc_requests', 'payout_requests', 'media', 'messages', 'posts', 'replies', 'rounds', 'top_up_requests'];
BEGIN
    FOR table_rec IN SELECT unnest(core_tables) AS t_name LOOP
        IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = table_rec.t_name AND schemaname = 'public') THEN
            -- Re-enable RLS just in case it was disabled
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_rec.t_name);
            
            -- Drop all policies on the table
            FOR policy_rec IN (SELECT policyname FROM pg_policies WHERE tablename = table_rec.t_name AND schemaname = 'public') LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_rec.policyname, table_rec.t_name);
            END LOOP;
        END IF;
    END LOOP;
END $$;

-- 4. RE-APPLY BASELINE POLICIES (USING NEW check_is_admin() HELPER)

-- PROFILES
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth_uid_text() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth_uid_text() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth_uid_text() = id);
CREATE POLICY "Public profile viewing" ON profiles FOR SELECT USING (true);
CREATE POLICY "Admin manage all profiles" ON profiles FOR ALL USING (check_is_admin());

-- RAFFLES
CREATE POLICY "Everyone can view raffles" ON raffles FOR SELECT USING (TRUE);
CREATE POLICY "Admin manage raffles" ON raffles FOR ALL USING (check_is_admin());

-- ENTRIES
CREATE POLICY "Users can view own entries" ON entries FOR SELECT USING (auth_uid_text() = user_id);
CREATE POLICY "Admin view all entries" ON entries FOR SELECT USING (check_is_admin());

-- TRANSACTIONS
CREATE POLICY "Users view own transactions" ON transactions FOR SELECT USING (auth_uid_text() = user_id);
CREATE POLICY "Admin manage transactions" ON transactions FOR ALL USING (check_is_admin());

-- NOTIFICATIONS
CREATE POLICY "Users view own notifications" ON notifications FOR SELECT USING (auth_uid_text() = user_id);

-- KYC_REQUESTS
CREATE POLICY "Users view own kyc" ON kyc_requests FOR SELECT USING (auth_uid_text() = user_id);
CREATE POLICY "Users create own kyc" ON kyc_requests FOR INSERT WITH CHECK (auth_uid_text() = user_id);
CREATE POLICY "Admin manage kyc" ON kyc_requests USING (check_is_admin());

-- PAYOUT_REQUESTS
CREATE POLICY "Users view own payouts" ON payout_requests FOR SELECT USING (auth_uid_text() = user_id);
CREATE POLICY "Users create own payouts" ON payout_requests FOR INSERT WITH CHECK (auth_uid_text() = user_id);
CREATE POLICY "Admin manage payouts" ON payout_requests FOR ALL USING (check_is_admin());

-- 5. SOCIAL TABLES (FORCE VIEWABLE)
DO $$
DECLARE
    t_name TEXT;
    social_tables TEXT[] := ARRAY['media', 'messages', 'posts', 'replies', 'rounds', 'top_up_requests'];
BEGIN
    FOR t_name IN SELECT unnest(social_tables) LOOP
        IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = t_name AND schemaname = 'public') THEN
            EXECUTE format('CREATE POLICY "Public view %s" ON public.%I FOR SELECT USING (true)', t_name, t_name);
        END IF;
    END LOOP;
END $$;

-- VERIFICATION
SELECT check_is_admin();
