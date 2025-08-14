-- Check and update facebook_post_status constraint to include 'processing'
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_facebook_post_status_check;

-- Add updated constraint that includes 'processing' status
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_facebook_post_status_check 
CHECK (facebook_post_status IN ('draft', 'processing', 'posted', 'error', 'failed'));