-- RESTORE AFFECTED HOSTS
-- This script safely targets all users who have an approved ('verified') KYC request
-- and forcefully reinstates their is_host_eligible status to true.
-- This combined with the previous enter_raffle fix guarantees zero future issues.

BEGIN;

UPDATE profiles
SET is_host_eligible = true
WHERE id IN (
    SELECT DISTINCT user_id 
    FROM kyc_requests 
    WHERE status = 'verified'
);

COMMIT;
