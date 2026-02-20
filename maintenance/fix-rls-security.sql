-- FIX: RESOLVE SUPABASE RLS SECURITY ALERTS (v3 - Metadata Error Fix)
-- This script enables Row Level Security (RLS) on all flagged tables
-- and ensures proper security policies are applied.

-- 1. Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin All Access Profiles" ON profiles;
DROP POLICY IF EXISTS "Everyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Public Read Profiles" ON profiles;
DROP POLICY IF EXISTS "User Create Self" ON profiles;
DROP POLICY IF EXISTS "User Update Self" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

CREATE POLICY "Everyone can view profiles" ON profiles FOR SELECT USING (TRUE);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth_uid_text() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth_uid_text() = id);
CREATE POLICY "Admin All Access Profiles" ON profiles FOR ALL USING ((SELECT is_admin FROM profiles WHERE id = auth_uid_text()) = TRUE);

-- 2. Raffles
ALTER TABLE raffles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin All Access Raffles" ON raffles;
DROP POLICY IF EXISTS "Eligible hosts can insert raffles" ON raffles;
DROP POLICY IF EXISTS "Hosts can update own open raffles" ON raffles;
DROP POLICY IF EXISTS "Public Read Raffles" ON raffles;
DROP POLICY IF EXISTS "Everyone can view raffles" ON raffles;
DROP POLICY IF EXISTS "Admin can modify raffles" ON raffles;

CREATE POLICY "Public Read Raffles" ON raffles FOR SELECT USING (TRUE);
CREATE POLICY "Eligible hosts can insert raffles" ON raffles FOR INSERT WITH CHECK (
    auth_uid_text() = host_user_id AND 
    (SELECT is_host_eligible FROM profiles WHERE id = auth_uid_text()) = TRUE
);
CREATE POLICY "Hosts can update own open raffles" ON raffles FOR UPDATE USING (
    auth_uid_text() = host_user_id AND 
    status = 'open' AND 
    (SELECT is_host_eligible FROM profiles WHERE id = auth_uid_text()) = TRUE
);
CREATE POLICY "Admin All Access Raffles" ON raffles FOR ALL USING ((SELECT is_admin FROM profiles WHERE id = auth_uid_text()) = TRUE);

-- 3. Entries
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin All Access Entries" ON entries;
DROP POLICY IF EXISTS "Everyone can view entries" ON entries;
DROP POLICY IF EXISTS "Public Read Entries" ON entries;
DROP POLICY IF EXISTS "User Create Entry" ON entries;
DROP POLICY IF EXISTS "Users can view own entries" ON entries;
DROP POLICY IF EXISTS "Admin can view all entries" ON entries;

CREATE POLICY "Public Read Entries" ON entries FOR SELECT USING (TRUE);
CREATE POLICY "User Create Entry" ON entries FOR INSERT WITH CHECK (auth_uid_text() = user_id);
CREATE POLICY "Admin All Access Entries" ON entries FOR ALL USING ((SELECT is_admin FROM profiles WHERE id = auth_uid_text()) = TRUE);

-- 4. Transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin All Access Transactions" ON transactions;
DROP POLICY IF EXISTS "User Create Transaction" ON transactions;
DROP POLICY IF EXISTS "User Read Own Transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Admin can manage transactions" ON transactions;

CREATE POLICY "User Read Own Transactions" ON transactions FOR SELECT USING (auth_uid_text() = user_id);
CREATE POLICY "User Create Transaction" ON transactions FOR INSERT WITH CHECK (auth_uid_text() = user_id);
CREATE POLICY "Admin All Access Transactions" ON transactions FOR ALL USING ((SELECT is_admin FROM profiles WHERE id = auth_uid_text()) = TRUE);

-- 5. Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Admin All Access Notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth_uid_text() = user_id);
CREATE POLICY "Admin All Access Notifications" ON notifications FOR ALL USING ((SELECT is_admin FROM profiles WHERE id = auth_uid_text()) = TRUE);

-- 6. Follows
-- Just enable RLS. Since we don't know the schema and it's not in the codebase,
-- enabling RLS with no policies effectively denies all public access (Safest).
ALTER TABLE IF EXISTS follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own follows" ON follows;

-- 7. Reactions
-- Just enable RLS.
ALTER TABLE IF EXISTS reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own reactions" ON reactions;

-- 8. Comments
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
