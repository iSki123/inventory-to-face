-- Fix function with correct column names
CREATE OR REPLACE FUNCTION public.search_us_cities(search_term text)
RETURNS TABLE(name text, state text) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.city_name as name,
    s.state_name as state
  FROM public.us_cities c
  JOIN public.us_states s ON c.state_id = s.state_id
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