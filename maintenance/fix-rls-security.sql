-- FIX RLS SECURITY
-- This script ensures RLS is enabled on tables where it might have been disabled
-- specifically addressing the Security Advisor errors for 'refund_queue'

-- 1. Enable RLS on core tables (Safety Check)
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.raffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.kyc_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payout_requests ENABLE ROW LEVEL SECURITY;

-- 2. Specifically fix refund_queue (The reported error)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'refund_queue' AND schemaname = 'public') THEN
        ALTER TABLE public.refund_queue ENABLE ROW LEVEL SECURITY;
        
        -- Ensure the admin policy exists
        DROP POLICY IF EXISTS "Admins can manage refund queue" ON public.refund_queue;
        CREATE POLICY "Admins can manage refund queue" ON public.refund_queue
            USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth_uid_text() AND is_admin = true));
    END IF;
END $$;

-- 3. Verify RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'raffles', 'entries', 'transactions', 'notifications', 'kyc_requests', 'payout_requests', 'refund_queue');
