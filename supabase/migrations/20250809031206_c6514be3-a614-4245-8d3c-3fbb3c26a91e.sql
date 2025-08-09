-- Update vehicles that have NHTSA data but missing vin_decoded_at timestamp
-- This fixes vehicles imported before the vin_decoded_at field was properly set

UPDATE vehicles 
SET vin_decoded_at = created_at
WHERE vin_decoded_at IS NULL 
  AND (
    body_style_nhtsa IS NOT NULL 
    OR fuel_type_nhtsa IS NOT NULL 
    OR transmission_nhtsa IS NOT NULL 
    OR engine_nhtsa IS NOT NULL 
    OR drivetrain_nhtsa IS NOT NULL 
    OR vehicle_type_nhtsa IS NOT NULL
  );