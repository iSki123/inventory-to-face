-- Add standardized color fields to vehicles table
ALTER TABLE public.vehicles 
ADD COLUMN exterior_color_standardized text,
ADD COLUMN interior_color_standardized text DEFAULT 'Black';