-- Check current constraints on vehicles table and fix the facebook_post_status constraint

-- First, let's see what check constraints exist on the vehicles table
SELECT conname, pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint 
WHERE conrelid = 'public.vehicles'::regclass 
AND contype = 'c';

-- Check current enum values if it's an enum type
SELECT n.nspname AS enum_schema, 
       t.typname AS enum_name, 
       e.enumlabel AS enum_value
FROM pg_type t 
   JOIN pg_enum e ON t.oid = e.enumtypid 
   JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE t.typname LIKE '%facebook%'
ORDER BY e.enumsortorder;

-- Let's also check the current data types and constraints
\d+ public.vehicles;