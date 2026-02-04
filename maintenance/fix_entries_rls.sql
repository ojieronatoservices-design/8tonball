-- Allow everyone to view entry records (needed for accurate public entry counts)
-- We don't need to hide these as they only contain raffle_id, user_id, and ticket_number
DROP POLICY IF EXISTS "Users can view own entries" ON entries;
DROP POLICY IF EXISTS "Everyone can view entries" ON entries;

CREATE POLICY "Everyone can view entries" ON entries
FOR SELECT USING (TRUE);

-- Ensure profiles can be viewed by others so names show up next to entries if needed
-- (Though currently we mostly use it for the winner)
DROP POLICY IF EXISTS "Everyone can view public profiles" ON profiles;
CREATE POLICY "Everyone can view public profiles" ON profiles
FOR SELECT USING (TRUE);
