-- Drop the old function and keep only the one we need
DROP FUNCTION IF EXISTS public.search_us_cities(TEXT, INTEGER);

-- Test the remaining function
SELECT * FROM public.search_us_cities('los'::text) LIMIT 3;