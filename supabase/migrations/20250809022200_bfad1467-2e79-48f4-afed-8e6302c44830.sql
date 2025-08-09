-- Clean up existing VIN and trim fields by removing ALL leading and trailing whitespace
UPDATE vehicles 
SET 
  vin = TRIM(BOTH ' ' FROM vin),
  trim = TRIM(BOTH ' ' FROM trim)
WHERE 
  (vin IS NOT NULL AND vin != TRIM(BOTH ' ' FROM vin)) 
  OR 
  (trim IS NOT NULL AND trim != TRIM(BOTH ' ' FROM trim));

-- Also clean up any other potential whitespace characters like tabs and newlines
UPDATE vehicles 
SET 
  vin = TRIM(BOTH E'\t\n\r ' FROM vin),
  trim = TRIM(BOTH E'\t\n\r ' FROM trim)
WHERE 
  (vin IS NOT NULL AND vin != TRIM(BOTH E'\t\n\r ' FROM vin)) 
  OR 
  (trim IS NOT NULL AND trim != TRIM(BOTH E'\t\n\r ' FROM trim));