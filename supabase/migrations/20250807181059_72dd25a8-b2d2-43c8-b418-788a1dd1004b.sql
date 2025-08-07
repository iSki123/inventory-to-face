-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a simple index for VIN lookups
CREATE INDEX IF NOT EXISTS idx_vehicles_vin 
ON vehicles(vin) 
WHERE vin IS NOT NULL;

-- Create a cron job to decode VINs every 10 minutes
SELECT cron.schedule(
  'vin-decoder-job',
  '*/10 * * * *', -- every 10 minutes
  $$
  SELECT
    net.http_post(
        url:='https://urdkaedsfnscgtyvcwlf.supabase.co/functions/v1/vin-decoder',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDA4NzgwNSwiZXhwIjoyMDY5NjYzODA1fQ.DMIGkSiYLBQXbWTZWm_bZ5lMj3CDJpqvR1UGEglMN1I"}'::jsonb,
        body:='{"action": "batch_decode", "batch_size": 10}'::jsonb
    ) as request_id;
  $$
);