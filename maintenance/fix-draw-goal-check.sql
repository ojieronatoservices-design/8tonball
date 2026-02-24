-- Maintenance Script: Add Unmet Goal Outcome to Draw Logic

CREATE OR REPLACE FUNCTION draw_raffle_winner_v4(p_event_id TEXT, p_admin_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_event_uuid UUID;
    v_winning_entry_id UUID;
    v_winner_id TEXT;
    v_host_id TEXT;
    v_pot_tibs BIGINT;
    v_fee_tibs BIGINT;
    v_payout_tibs BIGINT;
    v_title TEXT;
    v_is_admin BOOLEAN;
    v_goal_tibs BIGINT;
BEGIN
    -- Cast input to UUID safely
    v_event_uuid := p_event_id::UUID;

    -- Security Check
    SELECT is_admin INTO v_is_admin FROM profiles WHERE id = p_admin_id;
    SELECT host_user_id, title, COALESCE(goal_tibs, 0) INTO v_host_id, v_title, v_goal_tibs FROM raffles WHERE id = v_event_uuid;

    IF v_host_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Event not found');
    END IF;

    IF NOT v_is_admin AND p_admin_id != v_host_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    -- CHECK GOAL
    SELECT COALESCE(SUM(r.entry_cost_tibs), 0) INTO v_pot_tibs
    FROM entries e JOIN raffles r ON e.raffle_id = r.id WHERE e.raffle_id = v_event_uuid;

    IF v_goal_tibs > 0 AND v_pot_tibs < v_goal_tibs THEN
        -- UNMET GOAL OUTCOME
        UPDATE raffles SET status = 'closed', updated_at = NOW() WHERE id = v_event_uuid;
        
        -- Refund participants directly
        UPDATE profiles
        SET tibs_balance = tibs_balance + refund.total_refund
        FROM (
            SELECT e.user_id, SUM(r.entry_cost_tibs) as total_refund
            FROM entries e
            JOIN raffles r ON e.raffle_id = r.id
            WHERE e.raffle_id = v_event_uuid
            GROUP BY e.user_id
        ) AS refund
        WHERE profiles.id = refund.user_id;

        -- Optionally, we could send a notification to host/participants here.
        -- For now we just return the new successful alternate outcome.
        RETURN jsonb_build_object('success', true, 'outcome', 'unsuccessful', 'message', 'Event Unsuccessful — No Winner Selected');
    END IF;

    -- SELECT WINNING TICKET
    SELECT id, user_id INTO v_winning_entry_id, v_winner_id
    FROM entries WHERE raffle_id = v_event_uuid
    ORDER BY random() LIMIT 1;

    IF v_winning_entry_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No valid entries in this event');
    END IF;
    
    v_fee_tibs := floor(v_pot_tibs * 0.10);
    v_payout_tibs := v_pot_tibs - v_fee_tibs;

    -- ATOMIC UPDATE
    UPDATE raffles SET 
        status = 'drawn',
        winner_user_id = v_winner_id,
        winning_entry_id = v_winning_entry_id,
        drawn_at = NOW()
    WHERE id = v_event_uuid;

    -- Pay Host
    UPDATE profiles SET tibs_balance = tibs_balance + v_payout_tibs WHERE id = v_host_id;

    -- Notify
    INSERT INTO notifications (user_id, message, type)
    VALUES (v_winner_id, '🏆 Event Won! "' || v_title || '" ticket confirmed.', 'win');

    RETURN jsonb_build_object(
        'success', true, 
        'winner_id', v_winner_id, 
        'winning_entry_id', v_winning_entry_id,
        'payout_tibs', v_payout_tibs,
        'ticket_number', (SELECT ticket_number FROM entries WHERE id = v_winning_entry_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aliasing draw_winner_and_payout
CREATE OR REPLACE FUNCTION draw_winner_and_payout(p_raffle_id TEXT, p_admin_id TEXT)
RETURNS JSONB AS $$ BEGIN RETURN draw_raffle_winner_v4(p_raffle_id, p_admin_id); END; $$ LANGUAGE plpgsql SECURITY DEFINER;
