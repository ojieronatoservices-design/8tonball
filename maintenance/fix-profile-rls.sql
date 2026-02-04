-- 8TONBALL: Fix RLS Policy for New User Profile Creation
-- Run this in Supabase SQL Editor

-- Allow users to INSERT their own profile during first login sync
CREATE POLICY "Users can insert own profile" ON profiles 
FOR INSERT 
WITH CHECK (auth_uid_text() = id);

-- Also allow users to UPDATE their own profile (for display name changes etc)
CREATE POLICY "Users can update own profile" ON profiles 
FOR UPDATE 
USING (auth_uid_text() = id)
WITH CHECK (auth_uid_text() = id);
