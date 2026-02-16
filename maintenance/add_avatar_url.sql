-- Add avatar_url column to profiles table if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Update RLS policies (if any) are usually handled by existing broad policies, 
-- but ensuring column is selectable is key.
GRANT SELECT ON profiles TO anon, authenticated;
