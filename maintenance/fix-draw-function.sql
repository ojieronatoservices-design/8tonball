-- Force update the draw_winner_and_payout function to ensure winning_entry_id is set
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

    -- 6. Update Raffle Status - CRITICAL: Ensure winning_entry_id is set!
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
        'platform_fee', v_fee,
        'winning_entry_id', v_winning_entry_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
