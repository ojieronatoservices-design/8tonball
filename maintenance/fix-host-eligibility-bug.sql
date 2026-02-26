-- FIX: enter_raffle RPC Eligibility and Ticket Number Bug
-- This script fixes two issues caused by recent migrations overriding each other:
-- 1. It removes the 'is_host_eligible' auto-toggling that was accidentally re-introduced, which was demoting verified hosts back to normal users.
-- 2. It restores the progressive ticket number generation (3L3N) that was accidentally removed.
-- 3. It retains the NUMERIC type support for user balances.

CREATE OR REPLACE FUNCTION enter_raffle(p_raffle_id UUID, p_user_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_cost INTEGER;
    v_user_balance NUMERIC; -- Uses NUMERIC to support fractional Tibs
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
BEGIN
    -- 1. Get cost, raffle status, and host ID
    SELECT entry_cost_tibs, status, host_user_id INTO v_cost, v_status, v_host_id FROM raffles WHERE id = p_raffle_id;
    
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

    -- 2. Check user balance
    SELECT tibs_balance INTO v_user_balance FROM profiles WHERE id = p_user_id;
    
    IF v_user_balance < v_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient Tibs balance');
    END IF;

    -- 3. Generate Progressive 3L3N Ticket ID
    WHILE v_ticket IS NULL LOOP
        v_ticket := '';
        
        -- Add Letters
        FOR i IN 1..v_char_count LOOP
            v_ticket := v_ticket || substr(v_letters, floor(random() * 26)::int + 1, 1);
        END LOOP;
        
        -- Add Numbers
        FOR i IN 1..v_num_count LOOP
            v_ticket := v_ticket || substr(v_numbers, floor(random() * 10)::int + 1, 1);
        END LOOP;

        -- Check if ticket already exists for THIS raffle
        SELECT EXISTS(SELECT 1 FROM entries WHERE raffle_id = p_raffle_id AND ticket_number = v_ticket) INTO v_exists;
        
        IF v_exists THEN
            v_ticket := NULL;
            v_attempts := v_attempts + 1;
            
            -- If we hit attempt threshold (collisions high), expand the ID
            IF v_attempts > v_max_attempts THEN
                v_char_count := v_char_count + 1;
                v_attempts := 0;
            END IF;
        END IF;
    END LOOP;

    -- 4. Deduct balance and update total spent
    -- CRITICAL FIX: Removed is_host_eligible auto-toggle so it doesn't demote verified hosts.
    UPDATE profiles 
    SET 
        tibs_balance = tibs_balance - v_cost,
        total_tibs_spent = total_tibs_spent + v_cost
    WHERE id = p_user_id;

    -- 5. Create entry
    INSERT INTO entries (raffle_id, user_id, ticket_number) 
    VALUES (p_raffle_id, p_user_id, v_ticket);

    RETURN jsonb_build_object('success', true, 'new_balance', v_user_balance - v_cost, 'ticket_number', v_ticket);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
