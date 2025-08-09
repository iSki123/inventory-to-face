-- Clean up existing VIN and trim fields by removing leading and trailing whitespace
UPDATE vehicles 
SET 
  vin = TRIM(vin),
  trim = TRIM(trim)
WHERE 
  (vin IS NOT NULL AND vin != TRIM(vin)) 
  OR 
  (trim IS NOT NULL AND trim != TRIM(trim));