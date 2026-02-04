-- OMEGA FIX: Complete Logic Reset
-- Run this in Supabase SQL Editor and REFRESH ALL TABS

-- 1. THE ULTIMATE PURGE (Deletes every possible version of the draw functions)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT oid::regprocedure as f_name 
        FROM pg_proc 
        WHERE proname IN ('draw_winner', 'draw_winner_and_payout', 'draw_raffle_winner', 'draw_raffle_winner_v2', 'draw_raffle_winner_v3')
    ) 
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.f_name;
    END LOOP;
END $$;

-- 2. BULLETPROOF V4 LOGIC
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
BEGIN
    -- Cast input to UUID safely
    v_event_uuid := p_event_id::UUID;

    -- Security Check
    SELECT is_admin INTO v_is_admin FROM profiles WHERE id = p_admin_id;
    SELECT host_user_id, title INTO v_host_id, v_title FROM raffles WHERE id = v_event_uuid;

    IF v_host_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Event not found');
    END IF;

    IF NOT v_is_admin AND p_admin_id != v_host_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    -- SELECT WINNING TICKET
    SELECT id, user_id INTO v_winning_entry_id, v_winner_id
    FROM entries WHERE raffle_id = v_event_uuid
    ORDER BY random() LIMIT 1;

    IF v_winning_entry_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No valid entries in this event');
    END IF;

    -- Calculate Payout
    SELECT COALESCE(SUM(r.entry_cost_tibs), 0) INTO v_pot_tibs
    FROM entries e JOIN raffles r ON e.raffle_id = r.id WHERE e.raffle_id = v_event_uuid;
    
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

-- 3. ALIAS FOR OLD CODE (Accepts TEXT or UUID)
CREATE OR REPLACE FUNCTION draw_winner_and_payout(p_raffle_id TEXT, p_admin_id TEXT)
RETURNS JSONB AS $$ BEGIN RETURN draw_raffle_winner_v4(p_raffle_id, p_admin_id); END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. EMERGENCY DATA RECOVERY (Run immediately)
DO $$
DECLARE
    r RECORD;
    v_eid UUID;
BEGIN
    FOR r IN SELECT id, winner_user_id FROM raffles WHERE status = 'drawn' AND winning_entry_id IS NULL AND winner_user_id IS NOT NULL LOOP
        SELECT id INTO v_eid FROM entries WHERE raffle_id = r.id AND user_id = r.winner_user_id LIMIT 1;
        IF v_eid IS NOT NULL THEN UPDATE raffles SET winning_entry_id = v_eid WHERE id = r.id; END IF;
    END LOOP;
END $$;
