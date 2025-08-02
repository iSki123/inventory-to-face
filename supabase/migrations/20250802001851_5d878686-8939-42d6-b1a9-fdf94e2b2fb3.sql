-- Create vehicles table for inventory management
CREATE TABLE public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic vehicle information
  year INTEGER NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT,
  vin TEXT UNIQUE,
  mileage INTEGER,
  exterior_color TEXT,
  interior_color TEXT,
  fuel_type TEXT DEFAULT 'gasoline',
  transmission TEXT DEFAULT 'automatic',
  engine TEXT,
  drivetrain TEXT,
  
  -- Pricing and condition
  price INTEGER NOT NULL, -- Price in cents
  original_price INTEGER, -- Original asking price
  condition TEXT DEFAULT 'used' CHECK (condition IN ('new', 'used', 'certified')),
  
  -- Marketplace information
  description TEXT,
  features TEXT[], -- Array of features
  images TEXT[], -- Array of image URLs
  facebook_post_id TEXT,
  facebook_post_status TEXT DEFAULT 'draft' CHECK (facebook_post_status IN ('draft', 'posted', 'sold', 'expired', 'error')),
  last_posted_at TIMESTAMP WITH TIME ZONE,
  
  -- Dealership information
  location TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  
  -- Status and metadata
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'pending', 'sold', 'draft')),
  is_featured BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  lead_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for vehicles
CREATE POLICY "Users can view vehicles from their dealership" 
ON public.vehicles 
FOR SELECT 
USING (
  user_id = auth.uid() OR 
  user_id IN (
    SELECT profiles.user_id 
    FROM public.profiles 
    WHERE profiles.dealership_name = (
      SELECT dealership_name 
      FROM public.profiles 
      WHERE user_id = auth.uid()
    ) AND profiles.dealership_name IS NOT NULL
  )
);

CREATE POLICY "Users can create their own vehicles" 
ON public.vehicles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update vehicles from their dealership" 
ON public.vehicles 
FOR UPDATE 
USING (
  user_id = auth.uid() OR 
  user_id IN (
    SELECT profiles.user_id 
    FROM public.profiles 
    WHERE profiles.dealership_name = (
      SELECT dealership_name 
      FROM public.profiles 
      WHERE user_id = auth.uid()
    ) AND profiles.dealership_name IS NOT NULL
  )
);

CREATE POLICY "Users can delete their own vehicles" 
ON public.vehicles 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_vehicles_updated_at
BEFORE UPDATE ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_vehicles_user_id ON public.vehicles(user_id);
CREATE INDEX idx_vehicles_status ON public.vehicles(status);
CREATE INDEX idx_vehicles_year_make_model ON public.vehicles(year, make, model);
CREATE INDEX idx_vehicles_price ON public.vehicles(price);
CREATE INDEX idx_vehicles_facebook_post_status ON public.vehicles(facebook_post_status);