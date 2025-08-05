-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.search_us_cities(search_term text)
RETURNS TABLE(name text, state text) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.city_name as name,
    s.state_name as state
  FROM public.us_cities c
  JOIN public.us_states s ON c.state_id = s.state_code
  WHERE 
    c.city_name ILIKE '%' || search_term || '%' 
    OR s.state_name ILIKE '%' || search_term || '%'
  ORDER BY 
    CASE 
      WHEN c.city_name ILIKE search_term || '%' THEN 1
      WHEN c.city_name ILIKE '%' || search_term || '%' THEN 2
      ELSE 3
    END,
    c.city_name ASC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update the other function as well
CREATE OR REPLACE FUNCTION public.search_us_cities(search_term TEXT, limit_count INTEGER DEFAULT 100)
RETURNS TABLE (
  city_name TEXT,
  state_name TEXT,
  full_name TEXT
) 
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT 
    c.city_name,
    s.state_name,
    c.city_name || ', ' || s.state_name as full_name
  FROM public.us_cities c
  JOIN public.us_states s ON c.state_id = s.state_code
  WHERE c.city_name ILIKE search_term || '%'
  ORDER BY c.city_name
  LIMIT limit_count;
$$;