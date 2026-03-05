-- Phase 2: Business Campaign Codes Migration

-- 1. Add requires_code to raffles
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS requires_code BOOLEAN DEFAULT false;

-- 2. Create campaign_codes table
DROP TABLE IF EXISTS public.campaign_codes CASCADE;
CREATE TABLE IF NOT EXISTS public.campaign_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    host_user_id TEXT REFERENCES public.profiles(id) NOT NULL,
    raffle_id UUID REFERENCES public.raffles(id) ON DELETE CASCADE,
    code VARCHAR NOT NULL,
    is_used BOOLEAN DEFAULT false,
    used_by TEXT REFERENCES public.profiles(id),
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(host_user_id, code)
);

-- Index for fast lookup by code
CREATE INDEX IF NOT EXISTS idx_campaign_codes_lookup ON public.campaign_codes(host_user_id, code);

-- Enable RLS for campaign_codes
ALTER TABLE public.campaign_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaign_codes
-- Admins can do anything
CREATE POLICY "Admins have full access to campaign codes" ON public.campaign_codes
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()::text AND is_admin = true));

-- Hosts can view and manage their own event's codes
CREATE POLICY "Hosts can manage their campaign codes" ON public.campaign_codes
    USING (EXISTS (SELECT 1 FROM public.raffles WHERE id = raffle_id AND host_user_id = auth.uid()::text));

-- Anyone can READ a code to verify it exists/is valid (but we only expose this through the RPC function logic ideally, so actually maybe no public SELECT. Let's let the RPC function bypass RLS using SECURITY DEFINER)

-- 3. Create the REDEEM function
CREATE OR REPLACE FUNCTION redeem_campaign_code(p_raffle_id UUID, p_code VARCHAR, p_user_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_status TEXT;
    v_host_id TEXT;
    v_requires_code BOOLEAN;
    v_max_entries INTEGER;
    v_current_entries INTEGER;
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
    SELECT status, host_user_id, requires_code, max_entries_per_user
    INTO v_status, v_host_id, v_requires_code, v_max_entries
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
    WHERE code = p_code AND host_user_id = v_host_id AND (raffle_id IS NULL OR raffle_id = p_raffle_id)
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
