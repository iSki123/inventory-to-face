-- Create US States table
CREATE TABLE public.us_states (
  id SERIAL PRIMARY KEY,
  state_id VARCHAR(2) NOT NULL UNIQUE,
  state_name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create US Cities table
CREATE TABLE public.us_cities (
  id SERIAL PRIMARY KEY,
  city_name VARCHAR(100) NOT NULL,
  state_id VARCHAR(2) NOT NULL,
  county_name VARCHAR(50),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint
ALTER TABLE public.us_cities 
ADD CONSTRAINT fk_cities_state 
FOREIGN KEY (state_id) REFERENCES public.us_states(state_id);

-- Create indexes for fast searching
CREATE INDEX idx_cities_name ON public.us_cities(city_name);
CREATE INDEX idx_cities_state ON public.us_cities(state_id);
CREATE INDEX idx_cities_name_state ON public.us_cities(city_name, state_id);

-- Insert US States data
INSERT INTO public.us_states (state_id, state_name) VALUES
('AL', 'Alabama'), ('AK', 'Alaska'), ('AZ', 'Arizona'), ('AR', 'Arkansas'),
('CA', 'California'), ('CO', 'Colorado'), ('CT', 'Connecticut'), ('DE', 'Delaware'),
('FL', 'Florida'), ('GA', 'Georgia'), ('HI', 'Hawaii'), ('ID', 'Idaho'),
('IL', 'Illinois'), ('IN', 'Indiana'), ('IA', 'Iowa'), ('KS', 'Kansas'),
('KY', 'Kentucky'), ('LA', 'Louisiana'), ('ME', 'Maine'), ('MD', 'Maryland'),
('MA', 'Massachusetts'), ('MI', 'Michigan'), ('MN', 'Minnesota'), ('MS', 'Mississippi'),
('MO', 'Missouri'), ('MT', 'Montana'), ('NE', 'Nebraska'), ('NV', 'Nevada'),
('NH', 'New Hampshire'), ('NJ', 'New Jersey'), ('NM', 'New Mexico'), ('NY', 'New York'),
('NC', 'North Carolina'), ('ND', 'North Dakota'), ('OH', 'Ohio'), ('OK', 'Oklahoma'),
('OR', 'Oregon'), ('PA', 'Pennsylvania'), ('RI', 'Rhode Island'), ('SC', 'South Carolina'),
('SD', 'South Dakota'), ('TN', 'Tennessee'), ('TX', 'Texas'), ('UT', 'Utah'),
('VT', 'Vermont'), ('VA', 'Virginia'), ('WA', 'Washington'), ('WV', 'West Virginia'),
('WI', 'Wisconsin'), ('WY', 'Wyoming'), ('DC', 'District of Columbia');

-- Sample cities data (major cities for initial functionality)
INSERT INTO public.us_cities (city_name, state_id, county_name, latitude, longitude) VALUES
('New York', 'NY', 'New York', 40.7128, -74.0060),
('Los Angeles', 'CA', 'Los Angeles', 34.0522, -118.2437),
('Chicago', 'IL', 'Cook', 41.8781, -87.6298),
('Houston', 'TX', 'Harris', 29.7604, -95.3698),
('Phoenix', 'AZ', 'Maricopa', 33.4484, -112.0740),
('Philadelphia', 'PA', 'Philadelphia', 39.9526, -75.1652),
('San Antonio', 'TX', 'Bexar', 29.4241, -98.4936),
('San Diego', 'CA', 'San Diego', 32.7157, -117.1611),
('Dallas', 'TX', 'Dallas', 32.7767, -96.7970),
('San Jose', 'CA', 'Santa Clara', 37.3382, -121.8863),
('Austin', 'TX', 'Travis', 30.2672, -97.7431),
('Jacksonville', 'FL', 'Duval', 30.3322, -81.6557),
('Fort Worth', 'TX', 'Tarrant', 32.7555, -97.3308),
('Columbus', 'OH', 'Franklin', 39.9612, -82.9988),
('San Francisco', 'CA', 'San Francisco', 37.7749, -122.4194),
('Charlotte', 'NC', 'Mecklenburg', 35.2271, -80.8431),
('Indianapolis', 'IN', 'Marion', 39.7684, -86.1581),
('Seattle', 'WA', 'King', 47.6062, -122.3321),
('Denver', 'CO', 'Denver', 39.7392, -104.9903),
('Washington', 'DC', 'District of Columbia', 38.9072, -77.0369),
('Boston', 'MA', 'Suffolk', 42.3601, -71.0589),
('El Paso', 'TX', 'El Paso', 31.7619, -106.4850),
('Detroit', 'MI', 'Wayne', 42.3314, -83.0458),
('Nashville', 'TN', 'Davidson', 36.1627, -86.7816),
('Portland', 'OR', 'Multnomah', 45.5152, -122.6784),
('Memphis', 'TN', 'Shelby', 35.1495, -90.0490),
('Oklahoma City', 'OK', 'Oklahoma', 35.4676, -97.5164),
('Las Vegas', 'NV', 'Clark', 36.1699, -115.1398),
('Louisville', 'KY', 'Jefferson', 38.2027, -85.7585),
('Baltimore', 'MD', 'Baltimore City', 39.2904, -76.6122),
('Milwaukee', 'WI', 'Milwaukee', 43.0389, -87.9065),
('Albuquerque', 'NM', 'Bernalillo', 35.0844, -106.6504),
('Tucson', 'AZ', 'Pima', 32.2226, -110.9747),
('Fresno', 'CA', 'Fresno', 36.7378, -119.7871),
('Mesa', 'AZ', 'Maricopa', 33.4152, -111.8315),
('Sacramento', 'CA', 'Sacramento', 38.5816, -121.4944),
('Atlanta', 'GA', 'Fulton', 33.7490, -84.3880),
('Kansas City', 'MO', 'Jackson', 39.0997, -94.5786),
('Colorado Springs', 'CO', 'El Paso', 38.8339, -104.8214),
('Miami', 'FL', 'Miami-Dade', 25.7617, -80.1918),
('Raleigh', 'NC', 'Wake', 35.7796, -78.6382),
('Omaha', 'NE', 'Douglas', 41.2565, -95.9345),
('Long Beach', 'CA', 'Los Angeles', 33.7701, -118.1937),
('Virginia Beach', 'VA', 'Virginia Beach', 36.8529, -75.9780),
('Oakland', 'CA', 'Alameda', 37.8044, -122.2711),
('Minneapolis', 'MN', 'Hennepin', 44.9778, -93.2650),
('Tulsa', 'OK', 'Tulsa', 36.1540, -95.9928),
('Arlington', 'TX', 'Tarrant', 32.7357, -97.1081),
('Tampa', 'FL', 'Hillsborough', 27.9506, -82.4572),
('New Orleans', 'LA', 'Orleans', 29.9511, -90.0715),
('Wichita', 'KS', 'Sedgwick', 37.6872, -97.3301);

-- Create function to search cities
CREATE OR REPLACE FUNCTION search_us_cities(search_term TEXT, limit_count INTEGER DEFAULT 100)
RETURNS TABLE (
  city_name TEXT,
  state_name TEXT,
  full_name TEXT
) 
LANGUAGE sql
AS $$
  SELECT 
    c.city_name,
    s.state_name,
    c.city_name || ', ' || s.state_name as full_name
  FROM us_cities c
  JOIN us_states s ON c.state_id = s.state_id
  WHERE c.city_name ILIKE search_term || '%'
  ORDER BY c.city_name
  LIMIT limit_count;
$$;

-- Enable RLS on tables (but make them publicly readable for city search)
ALTER TABLE public.us_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.us_cities ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public read access
CREATE POLICY "Allow public read access to states" ON public.us_states
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to cities" ON public.us_cities
  FOR SELECT USING (true);