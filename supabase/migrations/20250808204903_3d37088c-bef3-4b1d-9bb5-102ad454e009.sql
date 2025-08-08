-- Remove existing vehicles with invalid data (price = 0 or VIN shorter than 17 characters)
DELETE FROM vehicles 
WHERE price = 0 
   OR vin IS NULL 
   OR LENGTH(TRIM(vin)) < 17;