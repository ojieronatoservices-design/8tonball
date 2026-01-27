-- 1. Create Payout Requests table
CREATE TABLE IF NOT EXISTS payout_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    amount_tibs BIGINT NOT NULL CHECK (amount_tibs > 0),
    gcash_number TEXT NOT NULL,
    gcash_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    processed_by TEXT REFERENCES profiles(id)
);

-- 2. Add RLS for Payout Requests
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payout requests" ON payout_requests
    FOR SELECT USING (auth_uid_text() = user_id);

CREATE POLICY "Users can create own payout requests" ON payout_requests
    FOR INSERT WITH CHECK (auth_uid_text() = user_id);

CREATE POLICY "Admin can manage all payout requests" ON payout_requests
    FOR ALL USING (
        (SELECT is_admin FROM profiles WHERE id = auth_uid_text()) = TRUE
    );

-- 3. Atomic Draw Winner and Payout RPC
CREATE OR REPLACE FUNCTION draw_winner_and_payout(p_raffle_id UUID, p_admin_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_host_id TEXT;
    v_total_entries BIGINT;
    v_entry_cost INTEGER;
    v_total_pot BIGINT;
    v_fee BIGINT;
    v_payout BIGINT;
    v_winner_id TEXT;
    v_winning_entry_id UUID;
    v_event_title TEXT;
    v_is_admin BOOLEAN;
BEGIN
    -- 1. Check permissions (must be admin or the host)
    SELECT is_admin INTO v_is_admin FROM profiles WHERE id = p_admin_id;
    SELECT host_user_id, title, entry_cost_tibs INTO v_host_id, v_event_title, v_entry_cost 
    FROM raffles WHERE id = p_raffle_id;

    IF NOT v_is_admin AND p_admin_id != v_host_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized to draw winner');
    END IF;

    -- 2. Check raffle status
    IF NOT EXISTS (SELECT 1 FROM raffles WHERE id = p_raffle_id AND status = 'open') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Raffle is not open');
    END IF;

    -- 3. Get pick winner entry
    SELECT id, user_id INTO v_winning_entry_id, v_winner_id
    FROM entries WHERE raffle_id = p_raffle_id
    ORDER BY random() LIMIT 1;

    IF v_winning_entry_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No entries found');
    END IF;

    -- 4. Calculate Payout
    -- Total entries already fetched in step 3 but let's be sure
    SELECT count(*) INTO v_total_entries FROM entries WHERE raffle_id = p_raffle_id;
    v_total_pot := v_total_entries * v_entry_cost;
    v_fee := floor(v_total_pot * 0.10); -- 10% Platform Fee
    v_payout := v_total_pot - v_fee;

    -- 5. Update Host Balance
    UPDATE profiles SET tibs_balance = tibs_balance + v_payout WHERE id = v_host_id;

    -- 6. Update Raffle Status
    UPDATE raffles SET 
        status = 'drawn',
        winner_user_id = v_winner_id,
        winning_entry_id = v_winning_entry_id,
        drawn_at = NOW()
    WHERE id = p_raffle_id;

    -- 7. Create Winner Notification
    INSERT INTO notifications (user_id, message, type)
    VALUES (v_winner_id, '🎉 Congratulations! You won "' || v_event_title || '"! Check your email for details.', 'win');

    RETURN jsonb_build_object(
        'success', true, 
        'winner_id', v_winner_id, 
        'payout_tibs', v_payout,
        'platform_fee', v_fee
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
