-- 1. Create KYC Requests Table
CREATE TABLE IF NOT EXISTS public.kyc_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    address TEXT,
    id_image_url TEXT NOT NULL,
    selfie_image_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Refund Queue Table
CREATE TABLE IF NOT EXISTS public.refund_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
    raffle_id UUID NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount_tibs INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- 3. Add escrow/delivery columns to raffles
ALTER TABLE public.raffles 
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'shipped', 'delivered', 'disputed')),
ADD COLUMN IF NOT EXISTS escrow_released BOOLEAN DEFAULT FALSE;

-- 4. Enable RLS
ALTER TABLE public.kyc_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_queue ENABLE ROW LEVEL SECURITY;

-- 5. KYC RLS Policies
-- Users can view their own requests
CREATE POLICY "Users can view own kyc" ON public.kyc_requests
    FOR SELECT USING (auth.uid()::text = user_id);

-- Users can create their own requests
CREATE POLICY "Users can create own kyc" ON public.kyc_requests
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Admins can view and update everything
CREATE POLICY "Admins can manage kyc" ON public.kyc_requests
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()::text AND is_admin = true));

-- 6. Refund Queue RLS
-- Only admins can see the queue
CREATE POLICY "Admins can manage refund queue" ON public.refund_queue
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()::text AND is_admin = true));
