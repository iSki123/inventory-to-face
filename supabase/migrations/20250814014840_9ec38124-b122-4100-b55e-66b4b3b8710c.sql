-- Check constraints and fix the facebook_post_status issue

-- First, let's see what check constraints exist on the vehicles table
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN 
        SELECT conname, pg_get_constraintdef(oid) as constraint_def
        FROM pg_constraint 
        WHERE conrelid = 'public.vehicles'::regclass 
        AND contype = 'c'
    LOOP
        RAISE NOTICE 'Constraint: % - Definition: %', constraint_record.conname, constraint_record.constraint_def;
    END LOOP;
END $$;

-- Check if there's a check constraint on facebook_post_status and what values it allows
-- Let's look at the specific constraint that's failing
SELECT conname, pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint 
WHERE conrelid = 'public.vehicles'::regclass 
AND contype = 'c'
AND pg_get_constraintdef(oid) LIKE '%facebook_post_status%';

-- If there's a restrictive constraint, we need to update it to allow 'processing' status
-- Drop the old constraint if it exists
ALTER TABLE public.vehicles 
DROP CONSTRAINT IF EXISTS vehicles_facebook_post_status_check;

-- Add a new constraint that allows the 'processing' status
ALTER TABLE public.vehicles 
ADD CONSTRAINT vehicles_facebook_post_status_check 
CHECK (facebook_post_status IN ('draft', 'processing', 'posted', 'error', 'failed'));