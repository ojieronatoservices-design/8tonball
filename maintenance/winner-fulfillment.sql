-- Winner Fulfillment Status Migration
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS fulfillment_status TEXT DEFAULT 'unclaimed' 
CHECK (fulfillment_status IN ('unclaimed', 'shipped', 'claimed'));

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_raffles_fulfillment_status ON public.raffles(fulfillment_status);
