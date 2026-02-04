-- ULTRABOLT FIX: One Logic to Rule Them All
-- Run this in Supabase SQL Editor and THEN REFRESH YOUR BROWSER TABS

-- 1. PURGE LEGACY FUNCTIONS (Avoid any double-logic)
DROP FUNCTION IF EXISTS draw_winner(UUID, TEXT);
DROP FUNCTION IF EXISTS draw_winner_and_payout(UUID, TEXT);
DROP FUNCTION IF EXISTS draw_raffle_winner(UUID, TEXT);
DROP FUNCTION IF EXISTS draw_raffle_winner_v2(UUID, TEXT);

-- 2. THE FINAL ATOMIC LOGIC (v3)
CREATE OR REPLACE FUNCTION draw_raffle_winner_v3(p_raffle_id UUID, p_admin_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_winning_entry_id UUID;
    v_winner_id TEXT;
    v_host_id TEXT;
    v_pot_tibs BIGINT;
    v_fee_tibs BIGINT;
    v_payout_tibs BIGINT;
    v_event_title TEXT;
    v_is_admin BOOLEAN;
BEGIN
    -- Security Check
    SELECT is_admin INTO v_is_admin FROM profiles WHERE id = p_admin_id;
    SELECT host_user_id, title INTO v_host_id, v_event_title FROM raffles WHERE id = p_raffle_id;

    IF NOT v_is_admin AND p_admin_id != v_host_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    -- SELECT WINNING TICKET (Random Entry)
    SELECT id, user_id INTO v_winning_entry_id, v_winner_id
    FROM entries WHERE raffle_id = p_raffle_id
    ORDER BY random() LIMIT 1;

    IF v_winning_entry_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No valid entries found');
    END IF;

    -- Calculate Money
    SELECT COALESCE(SUM(r.entry_cost_tibs), 0) INTO v_pot_tibs
    FROM entries e JOIN raffles r ON e.raffle_id = r.id WHERE e.raffle_id = p_raffle_id;
    
    v_fee_tibs := floor(v_pot_tibs * 0.10);
    v_payout_tibs := v_pot_tibs - v_fee_tibs;

    -- PAY THE HOST
    UPDATE profiles SET tibs_balance = tibs_balance + v_payout_tibs WHERE id = v_host_id;

    -- SAVE THE LINK (The crucial part)
    UPDATE raffles SET 
        status = 'drawn',
        winner_user_id = v_winner_id,
        winning_entry_id = v_winning_entry_id,
        drawn_at = NOW()
    WHERE id = p_raffle_id;

    -- Notify Winner
    INSERT INTO notifications (user_id, message, type)
    VALUES (v_winner_id, '🏆 You won "' || v_event_title || '"! Ticket confirmed.', 'win');

    RETURN jsonb_build_object(
        'success', true, 
        'winner_id', v_winner_id, 
        'winning_entry_id', v_winning_entry_id,
        'payout_tibs', v_payout_tibs
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. ALIAS FOR LEGACY CALLS (If an old tab is still open, it will now use the NEW logic)
CREATE OR REPLACE FUNCTION draw_winner_and_payout(p_raffle_id UUID, p_admin_id TEXT)
RETURNS JSONB AS $$
BEGIN
    RETURN draw_raffle_winner_v3(p_raffle_id, p_admin_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. EMERGENCY REPAIR (Fix all current "Ghost" winners)
DO $$
DECLARE
    r_raffle RECORD;
    v_entry_id UUID;
BEGIN
    FOR r_raffle IN 
        SELECT id, winner_user_id 
        FROM raffles 
        WHERE status = 'drawn' AND winning_entry_id IS NULL AND winner_user_id IS NOT NULL 
    LOOP
        SELECT id INTO v_entry_id FROM entries WHERE raffle_id = r_raffle.id AND user_id = r_raffle.winner_user_id LIMIT 1;
        IF v_entry_id IS NOT NULL THEN
            UPDATE raffles SET winning_entry_id = v_entry_id WHERE id = r_raffle.id;
        END IF;
    END LOOP;
END $$;
