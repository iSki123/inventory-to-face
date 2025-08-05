-- Create RPC function to search US cities
CREATE OR REPLACE FUNCTION public.search_us_cities(search_term text)
RETURNS TABLE(name text, state text) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.name,
    s.name as state
  FROM us_cities c
  JOIN us_states s ON c.state_id = s.id
  WHERE 
    c.name ILIKE '%' || search_term || '%' 
    OR s.name ILIKE '%' || search_term || '%'
  ORDER BY 
    CASE 
      WHEN c.name ILIKE search_term || '%' THEN 1
      WHEN c.name ILIKE '%' || search_term || '%' THEN 2
      ELSE 3
    END,
    c.name ASC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.search_us_cities(text) TO authenticated;

-- Create an index on city names for faster searching
CREATE INDEX IF NOT EXISTS idx_us_cities_name_search ON public.us_cities USING gin(name gin_trgm_ops);

-- Enable the pg_trgm extension for better text search if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;