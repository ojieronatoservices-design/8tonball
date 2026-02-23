-- RESTORE ALL APP FUNCTIONALITY
-- Adds missing UPDATE and INSERT policies for notifications, host events, and admin actions.

-- 1. NOTIFICATIONS (Fix the "Persistent Red Dot")
-- Users must be able to mark their own notifications as read.
DROP POLICY IF EXISTS "Users update own notifications" ON notifications;
CREATE POLICY "Users update own notifications" ON notifications 
FOR UPDATE 
USING (auth_uid_text() = user_id)
WITH CHECK (auth_uid_text() = user_id);

-- 2. RAFFLES (Restore Host Event Creation/Management)
-- Non-admin hosts need to be able to create and update their own events.
DROP POLICY IF EXISTS "Hosts manage own raffles" ON raffles;
CREATE POLICY "Hosts manage own raffles" ON raffles 
FOR ALL 
USING (auth_uid_text() = host_user_id)
WITH CHECK (auth_uid_text() = host_user_id);

-- 3. MEDIA (Fix Uploads)
-- Users need to insert records into the media table when they upload images.
DROP POLICY IF EXISTS "Users insert own media" ON media;
CREATE POLICY "Users insert own media" ON media 
FOR INSERT 
WITH CHECK (auth_uid_text() = owner_id);

-- 4. ADMIN ACTIONS (Ensure Full Control)
-- Explicitly grant ALL permissions to admins for processing requests.
DROP POLICY IF EXISTS "Admin manage notifications" ON notifications;
CREATE POLICY "Admin manage notifications" ON notifications FOR ALL USING (check_is_admin());

DROP POLICY IF EXISTS "Admin manage kyc_requests" ON kyc_requests;
CREATE POLICY "Admin manage kyc_requests" ON kyc_requests FOR ALL USING (check_is_admin());

DROP POLICY IF EXISTS "Admin manage payout_requests" ON payout_requests;
CREATE POLICY "Admin manage payout_requests" ON payout_requests FOR ALL USING (check_is_admin());

DROP POLICY IF EXISTS "Admin manage transactions" ON transactions;
CREATE POLICY "Admin manage transactions" ON transactions FOR ALL USING (check_is_admin());

-- 5. ENTRIES (Allow users to enter raffles)
-- The enter_raffle function is SECURITY DEFINER, but direct table access should also be allowed for Select/Insert.
DROP POLICY IF EXISTS "Users create own entries" ON entries;
CREATE POLICY "Users create own entries" ON entries 
FOR INSERT 
WITH CHECK (auth_uid_text() = user_id);

-- Final Verification
SELECT 'RLS Actions Restored' as status;
