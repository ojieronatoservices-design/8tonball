-- AD REWARD SYSTEM DB SETUP
BEGIN;

-- 1. Support fractional Tibs for precise 80% rewards
ALTER TABLE profiles 
  ALTER COLUMN tibs_balance TYPE NUMERIC,
  ALTER COLUMN total_tibs_spent TYPE NUMERIC;

-- 2. Create ad_rewards audit table
CREATE TABLE IF NOT EXISTS ad_rewards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    ad_value_php NUMERIC NOT NULL,
    reward_tibs NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for ad_rewards
ALTER TABLE ad_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ad rewards" ON ad_rewards FOR SELECT USING (auth_uid_text() = user_id);

-- 3. Secure Reward Function (Calculates 80% on server)
CREATE OR REPLACE FUNCTION reward_watch_ad(p_ad_value_php NUMERIC, p_user_id TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_user_id TEXT;
    v_reward_tibs NUMERIC;
    v_tibs_per_php CONSTANT NUMERIC := 8.0;
    v_rev_share CONSTANT NUMERIC := 0.8; -- 80% share
BEGIN
    -- Use provided user_id if called from service role/API, otherwise use auth_uid_text()
    v_user_id := COALESCE(p_user_id, auth_uid_text());
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    -- Calculate: (PHP Value * 0.8) * 8 Tibs/PHP
    v_reward_tibs := (p_ad_value_php * v_rev_share) * v_tibs_per_php;
    v_reward_tibs := round(v_reward_tibs, 2);

    UPDATE profiles SET tibs_balance = tibs_balance + v_reward_tibs WHERE id = v_user_id;

    INSERT INTO ad_rewards (user_id, ad_value_php, reward_tibs)
    VALUES (v_user_id, p_ad_value_php, v_reward_tibs);

    INSERT INTO notifications (user_id, message, type)
    VALUES (v_user_id, '💎 You earned ' || v_reward_tibs || ' Tibs for watching an ad!', 'payment');

    RETURN jsonb_build_object(
        'success', true, 
        'reward_tibs', v_reward_tibs,
        'new_balance', (SELECT tibs_balance FROM profiles WHERE id = v_user_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Override existing functions to support NUMERIC
CREATE OR REPLACE FUNCTION enter_raffle(p_raffle_id UUID, p_user_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_cost INTEGER;
    v_user_balance NUMERIC; -- Changed from BIGINT
    v_status TEXT;
BEGIN
    SELECT entry_cost_tibs, status INTO v_cost, v_status FROM raffles WHERE id = p_raffle_id;
    IF v_status != 'open' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Raffle is no longer open');
    END IF;

    SELECT tibs_balance INTO v_user_balance FROM profiles WHERE id = p_user_id;
    IF v_user_balance < v_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient Tibs balance');
    END IF;

    UPDATE profiles 
    SET 
        tibs_balance = tibs_balance - v_cost,
        total_tibs_spent = total_tibs_spent + v_cost,
        is_host_eligible = (total_tibs_spent + v_cost >= 8000)
    WHERE id = p_user_id;

    INSERT INTO entries (raffle_id, user_id) VALUES (p_raffle_id, p_user_id);
    RETURN jsonb_build_object('success', true, 'new_balance', v_user_balance - v_cost);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION approve_transaction(p_transaction_id UUID, p_admin_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_user_id TEXT;
    v_tibs NUMERIC; -- Changed from INTEGER
    v_status TEXT;
BEGIN
    IF NOT (SELECT is_admin FROM profiles WHERE id = p_admin_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    SELECT user_id, requested_tibs, status INTO v_user_id, v_tibs, v_status FROM transactions WHERE id = p_transaction_id;
    IF v_status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Transaction already processed');
    END IF;

    UPDATE transactions SET status = 'approved', processed_at = NOW(), processed_by = p_admin_id WHERE id = p_transaction_id;
    UPDATE profiles SET tibs_balance = tibs_balance + v_tibs WHERE id = v_user_id;
    INSERT INTO notifications (user_id, message) VALUES (v_user_id, 'Your purchase of ' || v_tibs || ' Tibs has been approved!');

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION draw_winner_and_payout(p_raffle_id UUID, p_admin_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_host_id TEXT;
    v_total_entries BIGINT;
    v_entry_cost INTEGER;
    v_total_pot NUMERIC; -- Changed from BIGINT
    v_fee NUMERIC; -- Changed from BIGINT
    v_payout NUMERIC; -- Changed from BIGINT
    v_winner_id TEXT;
    v_winning_entry_id UUID;
    v_event_title TEXT;
    v_is_admin BOOLEAN;
BEGIN
    SELECT is_admin INTO v_is_admin FROM profiles WHERE id = p_admin_id;
    SELECT host_user_id, title, entry_cost_tibs INTO v_host_id, v_event_title, v_entry_cost FROM raffles WHERE id = p_raffle_id;

    IF NOT v_is_admin AND p_admin_id != v_host_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized to draw winner');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM raffles WHERE id = p_raffle_id AND status = 'open') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Raffle is not open');
    END IF;

    SELECT id, user_id INTO v_winning_entry_id, v_winner_id FROM entries WHERE raffle_id = p_raffle_id ORDER BY random() LIMIT 1;
    IF v_winning_entry_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No entries found');
    END IF;

    SELECT count(*) INTO v_total_entries FROM entries WHERE raffle_id = p_raffle_id;
    v_total_pot := v_total_entries * v_entry_cost;
    v_fee := floor(v_total_pot * 0.10);
    v_payout := v_total_pot - v_fee;

    UPDATE profiles SET tibs_balance = tibs_balance + v_payout WHERE id = v_host_id;
    UPDATE raffles SET status = 'drawn', winner_user_id = v_winner_id, winning_entry_id = v_winning_entry_id, drawn_at = NOW() WHERE id = p_raffle_id;
    INSERT INTO notifications (user_id, message, type) VALUES (v_winner_id, '🎉 Congratulations! You won "' || v_event_title || '"!', 'win');

    RETURN jsonb_build_object('success', true, 'winner_id', v_winner_id, 'payout_tibs', v_payout);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
