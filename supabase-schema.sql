-- 8TONBALL MVP SCHEMA (CLERK INTEGRATED)
-- Minimal, production-safe raffle platform

-- 1. Profiles (extending Clerk Auth)
CREATE TABLE profiles (
    id TEXT PRIMARY KEY, -- Clerk User ID
    email TEXT,
    display_name TEXT,
    tibs_balance BIGINT DEFAULT 0 CHECK (tibs_balance >= 0),
    is_admin BOOLEAN DEFAULT FALSE,
    is_host_eligible BOOLEAN DEFAULT FALSE,
    total_tibs_spent BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Raffles
CREATE TABLE raffles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    media_urls TEXT[] DEFAULT '{}',
    entry_cost_tibs INTEGER NOT NULL CHECK (entry_cost_tibs > 0),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'drawn')),
    winning_user_id TEXT REFERENCES profiles(id),
    winning_entry_id UUID REFERENCES entries(id),
    host_user_id TEXT REFERENCES profiles(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ends_at TIMESTAMPTZ,
    drawn_at TIMESTAMPTZ
);

-- 3. Entries
CREATE TABLE entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    raffle_id UUID REFERENCES raffles(id) ON DELETE CASCADE NOT NULL,
    user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Transactions (Tibs purchases)
CREATE TABLE transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    requested_tibs INTEGER NOT NULL CHECK (requested_tibs > 0),
    proof_image_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    processed_by TEXT REFERENCES profiles(id)
);

-- 5. Notifications
CREATE TABLE notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'win', 'payment')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Setup RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE raffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to get Clerk ID from JWT
CREATE OR REPLACE FUNCTION auth_uid_text() 
RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::TEXT;
$$ LANGUAGE sql STABLE;

-- Profiles: Users can view, insert, and update their own
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth_uid_text() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth_uid_text() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth_uid_text() = id) WITH CHECK (auth_uid_text() = id);
CREATE POLICY "Admin can view all profiles" ON profiles FOR ALL USING (
    (SELECT is_admin FROM profiles WHERE id = auth_uid_text()) = TRUE
);

-- Raffles: Everyone can view
CREATE POLICY "Everyone can view raffles" ON raffles FOR SELECT USING (TRUE);
CREATE POLICY "Admin can modify raffles" ON raffles FOR ALL USING (
    (SELECT is_admin FROM profiles WHERE id = auth_uid_text()) = TRUE
);

-- Entries: Users can view their own, admin can view all
CREATE POLICY "Users can view own entries" ON entries FOR SELECT USING (auth_uid_text() = user_id);
CREATE POLICY "Admin can view all entries" ON entries FOR SELECT USING (
    (SELECT is_admin FROM profiles WHERE id = auth_uid_text()) = TRUE
);

-- Transactions: Users can view own, admin can view all
CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth_uid_text() = user_id);
CREATE POLICY "Admin can manage transactions" ON transactions FOR ALL USING (
    (SELECT is_admin FROM profiles WHERE id = auth_uid_text()) = TRUE
);

-- Notifications: Users can view own
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth_uid_text() = user_id);

-- 7. Functions & RPCs

-- Atomic Entry Creation
CREATE OR REPLACE FUNCTION enter_raffle(p_raffle_id UUID, p_user_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_cost INTEGER;
    v_user_balance BIGINT;
    v_status TEXT;
BEGIN
    -- 1. Get cost and raffle status
    SELECT entry_cost_tibs, status INTO v_cost, v_status FROM raffles WHERE id = p_raffle_id;
    
    IF v_status != 'open' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Raffle is no longer open');
    END IF;

    -- 2. Check user balance
    SELECT tibs_balance INTO v_user_balance FROM profiles WHERE id = p_user_id;
    
    IF v_user_balance < v_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient Tibs balance');
    END IF;

    -- 3. Deduct balance and update total spent
    UPDATE profiles 
    SET 
        tibs_balance = tibs_balance - v_cost,
        total_tibs_spent = total_tibs_spent + v_cost,
        is_host_eligible = (total_tibs_spent + v_cost >= 8000)
    WHERE id = p_user_id;

    -- 4. Create entry
    INSERT INTO entries (raffle_id, user_id) VALUES (p_raffle_id, p_user_id);

    RETURN jsonb_build_object('success', true, 'new_balance', v_user_balance - v_cost);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Transaction Approval
CREATE OR REPLACE FUNCTION approve_transaction(p_transaction_id UUID, p_admin_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_user_id TEXT;
    v_tibs INTEGER;
    v_status TEXT;
BEGIN
    -- Check if caller is admin
    IF NOT (SELECT is_admin FROM profiles WHERE id = p_admin_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    SELECT user_id, requested_tibs, status INTO v_user_id, v_tibs, v_status FROM transactions WHERE id = p_transaction_id;

    IF v_status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Transaction already processed');
    END IF;

    -- Update transaction
    UPDATE transactions 
    SET 
        status = 'approved', 
        processed_at = NOW(), 
        processed_by = p_admin_id 
    WHERE id = p_transaction_id;

    -- Credit user
    UPDATE profiles SET tibs_balance = tibs_balance + v_tibs WHERE id = v_user_id;

    -- Notify user
    INSERT INTO notifications (user_id, message) 
    VALUES (v_user_id, 'Your purchase of ' || v_tibs || ' Tibs has been approved!');

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
