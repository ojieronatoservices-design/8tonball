-- Phase 4: Raffle Campaigns & Custom UI
BEGIN;

-- 1. Create Campaigns Table
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    host_user_id TEXT REFERENCES public.profiles(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Update campaign_codes to link to campaigns
ALTER TABLE public.campaign_codes ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE;

-- 3. Update raffles to link to campaigns and add custom color
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS banner_color TEXT;

-- 4. Setup RLS for campaigns
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts can manage their own campaigns" ON public.campaigns
    FOR ALL USING (auth_uid_text() = host_user_id);

CREATE POLICY "Admins can manage all campaigns" ON public.campaigns
    FOR ALL USING (
        (SELECT is_admin FROM public.profiles WHERE id = auth_uid_text()) = TRUE
    );

COMMIT;
