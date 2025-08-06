-- Add standardized color fields to vehicles table for Facebook Marketplace compatibility
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS exterior_color_standardized TEXT,
ADD COLUMN IF NOT EXISTS interior_color_standardized TEXT DEFAULT 'Black';

-- Create an index for better performance on color searches
CREATE INDEX IF NOT EXISTS idx_vehicles_exterior_color_standardized ON public.vehicles(exterior_color_standardized);
CREATE INDEX IF NOT EXISTS idx_vehicles_interior_color_standardized ON public.vehicles(interior_color_standardized);

-- Update existing records to have standardized colors
-- This will set all existing interior colors to 'Black' and exterior colors to 'Unknown' for now
UPDATE public.vehicles 
SET 
  interior_color_standardized = 'Black',
  exterior_color_standardized = CASE 
    WHEN exterior_color IS NULL OR exterior_color = '' THEN 'Unknown'
    ELSE 'Unknown'  -- Will be properly standardized on next import
  END
WHERE exterior_color_standardized IS NULL OR interior_color_standardized IS NULL;