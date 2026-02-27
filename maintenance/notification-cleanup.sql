-- CLEANUP NOTIFICATIONS: Fix redirection and remove old verbiage
-- 1. Remove "Check your email" from win notifications
UPDATE notifications 
SET message = REPLACE(message, ' Check your email for details.', '') 
WHERE type = 'win';

-- 2. Backfill raffle_id for wins (matching by message title)
UPDATE notifications n
SET raffle_id = r.id
FROM raffles r
WHERE n.type = 'win' 
  AND n.raffle_id IS NULL
  AND n.message LIKE '%' || r.title || '%';

-- 3. Delete obsolete social notifications
DELETE FROM notifications 
WHERE type IN ('comment', 'reply', 'vote_up', 'vote_down');

-- 4. Set raffle_id for existing entry notifications
UPDATE notifications n
SET raffle_id = r.id
FROM raffles r
WHERE n.type = 'entry'
  AND n.raffle_id IS NULL
  AND n.message LIKE '%' || r.title || '%';
