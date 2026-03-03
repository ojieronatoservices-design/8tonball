-- FREE EVENTS MIGRATION
-- Phase 1: Allow events with entry_cost_tibs = 0 and add max_entries_per_user

-- 1. RELAX THE CONSTRAINT
-- Current: CHECK (entry_cost_tibs > 0)  →  New: CHECK (entry_cost_tibs >= 0)
ALTER TABLE public.raffles DROP CONSTRAINT IF EXISTS raffles_entry_cost_tibs_check;
ALTER TABLE public.raffles ADD CONSTRAINT raffles_entry_cost_tibs_check CHECK (entry_cost_tibs >= 0);

-- 2. ADD MAX ENTRIES PER USER COLUMN (NULL = unlimited)
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS max_entries_per_user INTEGER DEFAULT NULL;

-- 3. UPDATED enter_raffle — handles free events + max entries enforcement
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
    v_char_count INTEGER := 3;
    v_num_count INTEGER := 3;
    v_max_attempts INTEGER := 100;
    v_attempts INTEGER := 0;
    v_max_entries INTEGER;
    v_current_entries INTEGER;
BEGIN
    -- 1. Get raffle data
    SELECT entry_cost_tibs, status, host_user_id, max_entries_per_user
    INTO v_cost, v_status, v_host_id, v_max_entries
    FROM raffles WHERE id = p_raffle_id;
    
    IF v_status != 'open' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Raffle is no longer open');
    END IF;

    -- 1b. Check if user is host or admin
    IF p_user_id = v_host_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Hosts cannot enter their own raffles');
    END IF;

    IF (SELECT is_admin FROM profiles WHERE id = p_user_id) = TRUE THEN
        RETURN jsonb_build_object('success', false, 'message', 'Admins are restricted from entering raffles');
    END IF;

    -- 1c. CHECK MAX ENTRIES PER USER
    IF v_max_entries IS NOT NULL THEN
        SELECT COUNT(*) INTO v_current_entries
        FROM entries WHERE raffle_id = p_raffle_id AND user_id = p_user_id;
        
        IF v_current_entries >= v_max_entries THEN
            RETURN jsonb_build_object('success', false, 'message', 'Maximum entries reached (' || v_max_entries || ')');
        END IF;
    END IF;

    -- 2. Check balance (SKIP for free events)
    IF v_cost > 0 THEN
        SELECT tibs_balance INTO v_user_balance FROM profiles WHERE id = p_user_id;
        
        IF v_user_balance < v_cost THEN
            RETURN jsonb_build_object('success', false, 'message', 'Insufficient Tibs balance');
        END IF;
    ELSE
        -- Free event: set balance to current for the return value
        SELECT tibs_balance INTO v_user_balance FROM profiles WHERE id = p_user_id;
    END IF;

    -- 3. Generate Progressive 3L3N Ticket ID
    WHILE v_ticket IS NULL LOOP
        v_ticket := '';
        
        FOR i IN 1..v_char_count LOOP
            v_ticket := v_ticket || substr(v_letters, floor(random() * 26)::int + 1, 1);
        END LOOP;
        
        FOR i IN 1..v_num_count LOOP
            v_ticket := v_ticket || substr(v_numbers, floor(random() * 10)::int + 1, 1);
        END LOOP;

        SELECT EXISTS(SELECT 1 FROM entries WHERE raffle_id = p_raffle_id AND ticket_number = v_ticket) INTO v_exists;
        
        IF v_exists THEN
            v_ticket := NULL;
            v_attempts := v_attempts + 1;
            
            IF v_attempts > v_max_attempts THEN
                v_char_count := v_char_count + 1;
                v_attempts := 0;
            END IF;
        END IF;
    END LOOP;

    -- 4. Deduct balance (SKIP for free events)
    IF v_cost > 0 THEN
        UPDATE profiles 
        SET 
            tibs_balance = tibs_balance - v_cost,
            total_tibs_spent = total_tibs_spent + v_cost
        WHERE id = p_user_id;
    END IF;

    -- 5. Create entry
    INSERT INTO entries (raffle_id, user_id, ticket_number) 
    VALUES (p_raffle_id, p_user_id, v_ticket);

    RETURN jsonb_build_object(
        'success', true, 
        'new_balance', CASE WHEN v_cost > 0 THEN v_user_balance - v_cost ELSE v_user_balance END, 
        'ticket_number', v_ticket
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. UPDATED DRAW FUNCTION — handles free events (no host payout)
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
    v_entry_cost INTEGER;
BEGIN
    -- Cast input to UUID safely
    BEGIN
        v_event_uuid := p_event_id::UUID;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid event ID format');
    END;

    -- Security Check & Get Raffle Data
    SELECT is_admin INTO v_is_admin FROM profiles WHERE id = p_admin_id;
    SELECT host_user_id, title, COALESCE(goal_tibs, 0), status, entry_cost_tibs
    INTO v_host_id, v_title, v_goal_tibs, v_status, v_entry_cost
    FROM raffles 
    WHERE id = v_event_uuid;

    IF v_host_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Event not found');
    END IF;

    IF v_status != 'open' THEN
        RETURN jsonb_build_object('success', false, 'message', 'This event has already been ' || v_status);
    END IF;

    IF NOT v_is_admin AND p_admin_id != v_host_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    -- Calculate current pot
    SELECT COALESCE(SUM(r.entry_cost_tibs), 0) INTO v_pot_tibs
    FROM entries e JOIN raffles r ON e.raffle_id = r.id WHERE e.raffle_id = v_event_uuid;

    -- CHECK GOAL (only for paid events with goals)
    IF v_entry_cost > 0 AND v_goal_tibs > 0 AND v_pot_tibs < v_goal_tibs THEN
        -- UNMET GOAL: Close and Refund
        UPDATE raffles SET status = 'closed', updated_at = NOW() WHERE id = v_event_uuid;
        
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

    -- SELECT WINNER
    SELECT id, user_id INTO v_winning_entry_id, v_winner_id
    FROM entries WHERE raffle_id = v_event_uuid
    ORDER BY random() LIMIT 1;

    IF v_winning_entry_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No entries found in this event');
    END IF;
    
    -- CALCULATE PAYOUT (0 for free events)
    IF v_pot_tibs > 0 THEN
        v_fee_tibs := floor(v_pot_tibs * 0.10);
        v_payout_tibs := v_pot_tibs - v_fee_tibs;
    ELSE
        v_fee_tibs := 0;
        v_payout_tibs := 0;
    END IF;

    -- UPDATE RAFFLE
    UPDATE raffles SET 
        status = 'drawn',
        winner_user_id = v_winner_id,
        winning_user_id = v_winner_id,
        winning_entry_id = v_winning_entry_id,
        drawn_at = NOW(),
        updated_at = NOW()
    WHERE id = v_event_uuid;

    -- PAY HOST (SKIP for free events)
    IF v_payout_tibs > 0 THEN
        UPDATE profiles SET tibs_balance = tibs_balance + v_payout_tibs WHERE id = v_host_id;
    END IF;

    -- NOTIFY WINNER
    INSERT INTO notifications (user_id, message, type, raffle_id)
    VALUES (v_winner_id, '🎉 Congratulations! You won "' || v_title || '"!', 'win', v_event_uuid);

    RETURN jsonb_build_object(
        'success', true, 
        'winner_id', v_winner_id, 
        'payout_tibs', v_payout_tibs,
        'ticket_number', (SELECT ticket_number FROM entries WHERE id = v_winning_entry_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Overwrite alias
CREATE OR REPLACE FUNCTION draw_winner_and_payout(p_raffle_id TEXT, p_admin_id TEXT)
RETURNS JSONB AS $$ BEGIN RETURN draw_raffle_winner_v5(p_raffle_id, p_admin_id); END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
