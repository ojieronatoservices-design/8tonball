-- NUCLEAR FIX: Guaranteed Ticket Generation & Random Winner Logic
-- Run this in Supabase SQL Editor

-- 1. Ensure ticket_number exists and is tracked correctly
ALTER TABLE entries ADD COLUMN IF NOT EXISTS ticket_number TEXT;

-- 2. NUCLEAR FIX: enter_raffle (v4 - Force 3L3N Ticket)
CREATE OR REPLACE FUNCTION enter_raffle(p_raffle_id UUID, p_user_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_cost INTEGER;
    v_user_balance BIGINT;
    v_status TEXT;
    v_host_id TEXT;
    v_ticket TEXT;
    v_exists BOOLEAN;
    v_letters TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    v_numbers TEXT := '0123456789';
    v_attempts INTEGER := 0;
BEGIN
    -- Get cost, raffle status, and host ID
    SELECT entry_cost_tibs, status, host_user_id INTO v_cost, v_status, v_host_id FROM raffles WHERE id = p_raffle_id;
    
    IF v_status != 'open' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Raffle is no longer open');
    END IF;

    IF p_user_id = v_host_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Hosts cannot enter their own raffles');
    END IF;

    -- Check user balance
    SELECT tibs_balance INTO v_user_balance FROM profiles WHERE id = p_user_id;
    
    IF v_user_balance < v_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient Tibs balance');
    END IF;

    -- Generate Unique 3L3N Ticket
    WHILE v_ticket IS NULL LOOP
        v_ticket := (
            substr(v_letters, floor(random() * 26)::int + 1, 1) ||
            substr(v_letters, floor(random() * 26)::int + 1, 1) ||
            substr(v_letters, floor(random() * 26)::int + 1, 1) ||
            substr(v_numbers, floor(random() * 10)::int + 1, 1) ||
            substr(v_numbers, floor(random() * 10)::int + 1, 1) ||
            substr(v_numbers, floor(random() * 10)::int + 1, 1)
        );

        SELECT EXISTS(SELECT 1 FROM entries WHERE raffle_id = p_raffle_id AND ticket_number = v_ticket) INTO v_exists;
        IF v_exists THEN v_ticket := NULL; END IF;
        
        v_attempts := v_attempts + 1;
        IF v_attempts > 1000 THEN 
             RETURN jsonb_build_object('success', false, 'message', 'Ticket generation deadlock - Please try again');
        END IF;
    END LOOP;

    -- Deduct balance
    UPDATE profiles SET tibs_balance = tibs_balance - v_cost, total_tibs_spent = total_tibs_spent + v_cost WHERE id = p_user_id;

    -- Create entry with GUARANTEED ticket
    INSERT INTO entries (raffle_id, user_id, ticket_number) VALUES (p_raffle_id, p_user_id, v_ticket);

    RETURN jsonb_build_object('success', true, 'new_balance', v_user_balance - v_cost, 'ticket_number', v_ticket);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. NUCLEAR FIX: draw_raffle_winner_v3 (True Ticket Selection)
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
    -- 1. Get Event Data
    SELECT is_admin INTO v_is_admin FROM profiles WHERE id = p_admin_id;
    SELECT host_user_id, title INTO v_host_id, v_event_title FROM raffles WHERE id = p_raffle_id;

    IF NOT v_is_admin AND p_admin_id != v_host_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    -- 2. RANDOM TICKET SELECTION (The Core Fix)
    SELECT id, user_id INTO v_winning_entry_id, v_winner_id
    FROM entries WHERE raffle_id = p_raffle_id
    ORDER BY random() LIMIT 1;

    IF v_winning_entry_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No valid entries found in this event');
    END IF;

    -- 3. Calculate Money
    SELECT COALESCE(SUM(r.entry_cost_tibs), 0) INTO v_pot_tibs
    FROM entries e JOIN raffles r ON e.raffle_id = r.id WHERE e.raffle_id = p_raffle_id;
    
    v_fee_tibs := floor(v_pot_tibs * 0.10);
    v_payout_tibs := v_pot_tibs - v_fee_tibs;

    -- 4. Execute Payout & Status Update
    UPDATE profiles SET tibs_balance = tibs_balance + v_payout_tibs WHERE id = v_host_id;

    UPDATE raffles SET 
        status = 'drawn',
        winner_user_id = v_winner_id,
        winning_entry_id = v_winning_entry_id,
        drawn_at = NOW()
    WHERE id = p_raffle_id;

    -- 5. Notify Winner
    INSERT INTO notifications (user_id, message, type)
    VALUES (v_winner_id, '🏆 You won "' || v_event_title || '"! Your ticket was the winner!', 'win');

    RETURN jsonb_build_object(
        'success', true, 
        'winner_id', v_winner_id, 
        'winning_entry_id', v_winning_entry_id,
        'payout_tibs', v_payout_tibs
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. BACKFILL: Fix any current entries that are missing ticket numbers
DO $$
DECLARE
    r_entry RECORD;
    v_ticket TEXT;
    v_letters TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    v_numbers TEXT := '0123456789';
BEGIN
    FOR r_entry IN SELECT id, raffle_id FROM entries WHERE ticket_number IS NULL OR ticket_number = '' LOOP
        v_ticket := NULL;
        WHILE v_ticket IS NULL LOOP
             v_ticket := (
                substr(v_letters, floor(random() * 26)::int + 1, 1) ||
                substr(v_letters, floor(random() * 26)::int + 1, 1) ||
                substr(v_letters, floor(random() * 26)::int + 1, 1) ||
                substr(v_numbers, floor(random() * 10)::int + 1, 1) ||
                substr(v_numbers, floor(random() * 10)::int + 1, 1) ||
                substr(v_numbers, floor(random() * 10)::int + 1, 1)
            );
            IF EXISTS(SELECT 1 FROM entries WHERE raffle_id = r_entry.raffle_id AND ticket_number = v_ticket) THEN
                v_ticket := NULL;
            END IF;
        END LOOP;
        UPDATE entries SET ticket_number = v_ticket WHERE id = r_entry.id;
    END LOOP;
END $$;
