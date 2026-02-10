-- Add missing phone_number column to kyc_requests table
ALTER TABLE public.kyc_requests ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Refresh PostgREST schema cache (optional, usually happens on DDL changes)
-- NOTIFY pgrst, 'reload schema';
