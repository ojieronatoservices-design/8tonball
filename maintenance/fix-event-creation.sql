-- 1. Add missing columns to raffles table
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS goal_tibs INTEGER DEFAULT 0;
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS display_id TEXT;

-- 2. Update RLS Policies for Raffles
-- Ensure host-eligible users can create events
DROP POLICY IF EXISTS "Eligible hosts can insert raffles" ON raffles;
CREATE POLICY "Eligible hosts can insert raffles" ON raffles 
FOR INSERT WITH CHECK (
    auth_uid_text() = host_user_id AND 
    ((SELECT is_host_eligible FROM profiles WHERE id = auth_uid_text()) = TRUE OR (SELECT is_admin FROM profiles WHERE id = auth_uid_text()) = TRUE)
);

-- Ensure hosts can update their own open raffles
DROP POLICY IF EXISTS "Hosts can update own open raffles" ON raffles;
CREATE POLICY "Hosts can update own open raffles" ON raffles 
FOR UPDATE USING (
    auth_uid_text() = host_user_id AND 
    status = 'open' AND 
    ((SELECT is_host_eligible FROM profiles WHERE id = auth_uid_text()) = TRUE OR (SELECT is_admin FROM profiles WHERE id = auth_uid_text()) = TRUE)
);

-- 3. Storage Bucket Policies (Media)
-- Note: These policies are for the 'media' bucket. 
-- They allow public viewing and authenticated uploads.

-- Allow public access to media
-- (This might already be set if the bucket is public, but being explicit helps)
-- DROP POLICY IF EXISTS "Public Access" ON storage.objects;
-- CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'media');

-- Allow authenticated users to upload to 'raffles/' prefix
DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = 'raffles');

-- Allow owners to delete their own uploads
DROP POLICY IF EXISTS "Users can delete own media" ON storage.objects;
CREATE POLICY "Users can delete own media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'media' AND auth.uid()::text = owner::text);
