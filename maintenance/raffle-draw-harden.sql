-- HARDENED RAFFLE DRAW FUNCTION
-- This script fixes the "misleading win notification" bug by:
-- 1. Ensuring status = 'open' check is mandatory (prevents duplicate draws)
-- 2. Correctly linking raffle_id in notifications for redirection
-- 3. Updating both winner_user_id and winning_user_id columns for compatibility

CREATE OR REPLACE FUNCTION draw_raffle_winner_v5(p_event_id TEXT, p_admin_id TEXT)
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
    v_status TEXT;
BEGIN
    -- Cast input to UUID safely
    BEGIN
        v_event_uuid := p_event_id::UUID;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid event ID format');
    END;

    -- Security Check & Get Raffle Data
    SELECT is_admin INTO v_is_admin FROM profiles WHERE id = p_admin_id;
    SELECT host_user_id, title, COALESCE(goal_tibs, 0), status 
    INTO v_host_id, v_title, v_goal_tibs, v_status 
    FROM raffles 
    WHERE id = v_event_uuid;

    IF v_host_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Event not found');
    END IF;

    -- CRITICAL FIX: Block draws if not open
    IF v_status != 'open' THEN
        RETURN jsonb_build_object('success', false, 'message', 'This event has already been ' || v_status);
    END IF;

    IF NOT v_is_admin AND p_admin_id != v_host_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    -- Calculate current pot
    SELECT COALESCE(SUM(r.entry_cost_tibs), 0) INTO v_pot_tibs
    FROM entries e JOIN raffles r ON e.raffle_id = r.id WHERE e.raffle_id = v_event_uuid;

    -- CHECK GOAL
    IF v_goal_tibs > 0 AND v_pot_tibs < v_goal_tibs THEN
        -- UNMET GOAL: Close and Refund
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

        RETURN jsonb_build_object('success', true, 'outcome', 'unsuccessful', 'message', 'Event Unsuccessful (Goal not met) — All participants refunded.');
    END IF;

    -- SELECT LUCKY WINNER
    SELECT id, user_id INTO v_winning_entry_id, v_winner_id
    FROM entries WHERE raffle_id = v_event_uuid
    ORDER BY random() LIMIT 1;

    IF v_winning_entry_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No entries found in this event');
    END IF;
    
    v_fee_tibs := floor(v_pot_tibs * 0.10);
    v_payout_tibs := v_pot_tibs - v_fee_tibs;

    -- ATOMIC UPDATE OF RAFFLE
    -- We update both columns to ensure frontend compatibility
    UPDATE raffles SET 
        status = 'drawn',
        winner_user_id = v_winner_id,
        winning_user_id = v_winner_id, -- Compatibility
        winning_entry_id = v_winning_entry_id,
        drawn_at = NOW(),
        updated_at = NOW()
    WHERE id = v_event_uuid;

    -- Pay the Host
    UPDATE profiles SET tibs_balance = tibs_balance + v_payout_tibs WHERE id = v_host_id;

    -- CREATE NOTIFICATION (WITH RAFFLE_ID)
    INSERT INTO notifications (user_id, message, type, raffle_id)
    VALUES (v_winner_id, '🎉 Congratulations! You won "' || v_title || '"!', 'win', v_event_uuid);

    RETURN jsonb_build_object(
        'success', true, 
        'winner_id', v_winner_id, 
        'payout_tibs', v_payout_tibs,
        'ticket_number', (SELECT ticket_number FROM entries WHERE id = v_winning_entry_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Overwrite alias for consistency
CREATE OR REPLACE FUNCTION draw_winner_and_payout(p_raffle_id TEXT, p_admin_id TEXT)
RETURNS JSONB AS $$ BEGIN RETURN draw_raffle_winner_v5(p_raffle_id, p_admin_id); END; $$ LANGUAGE plpgsql SECURITY DEFINER;
