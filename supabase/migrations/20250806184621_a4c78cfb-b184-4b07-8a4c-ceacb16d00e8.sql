-- Add NHTSA VIN decoding columns to vehicles table
ALTER TABLE public.vehicles 
ADD COLUMN body_style_nhtsa text,
ADD COLUMN fuel_type_nhtsa text,
ADD COLUMN transmission_nhtsa text,
ADD COLUMN engine_nhtsa text,
ADD COLUMN vehicle_type_nhtsa text,
ADD COLUMN drivetrain_nhtsa text,
ADD COLUMN vin_decoded_at timestamp with time zone;