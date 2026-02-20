-- EMERGENCY FIX: RESTORE PROFILE LOADING (IDEMPOTENT)
-- This script was used to resolve the loading hang caused by RLS recursive loops.

-- 1. Temporarily disable the complex admin check that causes loops
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profile viewing" ON public.profiles;

-- 2. Restore basic owner access
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth_uid_text() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth_uid_text() = id);

-- 3. Add public viewing (Required for the app to show Host names/avatars)
CREATE POLICY "Public profile viewing" ON public.profiles FOR SELECT USING (true);

-- 4. Re-enable security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. Final check of your Auth Function
CREATE OR REPLACE FUNCTION auth_uid_text() 
RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::TEXT;
$$ LANGUAGE sql STABLE;
ALTER FUNCTION auth_uid_text() RESET search_path;
