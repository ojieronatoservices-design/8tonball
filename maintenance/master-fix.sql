-- MASTER FIX: Restore Schema Relationships and Functions
BEGIN;

-- 1. Ensure campaigns table exists
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    host_user_id TEXT NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add campaign_id to campaign_codes if missing
ALTER TABLE public.campaign_codes ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE;

-- 3. Add campaign_id and banner_color to raffles if missing
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS banner_color TEXT DEFAULT '#39FF14';

-- 4. Update the redem_campaign_code function to be robust
CREATE OR REPLACE FUNCTION redeem_campaign_code(p_raffle_id UUID, p_code VARCHAR, p_user_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_status TEXT;
    v_host_id TEXT;
    v_requires_code BOOLEAN;
    v_max_entries INTEGER;
    v_current_entries INTEGER;
    v_campaign_id UUID;
    v_code_id UUID;
    v_is_used BOOLEAN;
    v_ticket TEXT;
    v_exists BOOLEAN;
    v_letters TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    v_numbers TEXT := '0123456789';
    v_char_count INTEGER := 3;
    v_num_count INTEGER := 3;
    v_max_attempts INTEGER := 100;
    v_attempts INTEGER := 0;
BEGIN
    -- 1. Get raffle data
    SELECT status, host_user_id, requires_code, max_entries_per_user, campaign_id
    INTO v_status, v_host_id, v_requires_code, v_max_entries, v_campaign_id
    FROM raffles WHERE id = p_raffle_id;
    
    IF v_status != 'open' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Raffle is no longer open');
    END IF;

    IF v_requires_code = false THEN
        RETURN jsonb_build_object('success', false, 'message', 'This event does not require a code');
    END IF;

    -- 2. Check user validity
    IF p_user_id = v_host_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Hosts cannot enter their own raffles');
    END IF;

    IF (SELECT is_admin FROM profiles WHERE id = p_user_id) = TRUE THEN
        RETURN jsonb_build_object('success', false, 'message', 'Admins are restricted from entering raffles');
    END IF;

    -- 3. Check max entries
    IF v_max_entries IS NOT NULL THEN
        SELECT COUNT(*) INTO v_current_entries
        FROM entries WHERE raffle_id = p_raffle_id AND user_id = p_user_id;
        
        IF v_current_entries >= v_max_entries THEN
            RETURN jsonb_build_object('success', false, 'message', 'Maximum entries reached (' || v_max_entries || ')');
        END IF;
    END IF;

    -- 4. Verify and lock the code atomically
    SELECT id, is_used INTO v_code_id, v_is_used
    FROM campaign_codes 
    WHERE code = p_code 
      AND host_user_id = v_host_id 
      AND (
          raffle_id IS NULL 
          OR raffle_id = p_raffle_id 
          OR (v_campaign_id IS NOT NULL AND campaign_id = v_campaign_id)
      )
    FOR UPDATE; -- Atomic lock

    IF v_code_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid code');
    END IF;

    IF v_is_used THEN
        RETURN jsonb_build_object('success', false, 'message', 'This code has already been used');
    END IF;

    -- 5. Generate Progressive 3L3N Ticket ID
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

    -- 6. Mark code as used and link to raffle if it was a campaign-level code
    UPDATE campaign_codes 
    SET is_used = true, 
        used_by = p_user_id, 
        used_at = NOW(),
        raffle_id = COALESCE(raffle_id, p_raffle_id)
    WHERE id = v_code_id;

    -- 7. Create entry
    INSERT INTO entries (raffle_id, user_id, ticket_number) 
    VALUES (p_raffle_id, p_user_id, v_ticket);

    RETURN jsonb_build_object(
        'success', true, 
        'ticket_number', v_ticket,
        'message', 'Code redeemed successfully!'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMIT;
