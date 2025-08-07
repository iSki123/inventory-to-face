-- Update the cron job to run less frequently during business hours
-- Remove the old cron job first
SELECT cron.unschedule('vin-decoder-job');

-- Create a new optimized cron job that runs:
-- - Every 30 minutes during EST business hours (6AM-6PM EST, Mon-Fri)  
-- - Every 10 minutes during nights and weekends
-- Since cron runs in UTC, EST business hours (6AM-6PM) = UTC (11AM-11PM)
SELECT cron.schedule(
  'vin-decoder-business-hours',
  '*/30 11-23 * * 1-5', -- Every 30 minutes, 11AM-11PM UTC (6AM-6PM EST), Mon-Fri
  $$
  SELECT
    net.http_post(
        url:='https://urdkaedsfnscgtyvcwlf.supabase.co/functions/v1/vin-decoder',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDA4NzgwNSwiZXhwIjoyMDY5NjYzODA1fQ.DMIGkSiYLBQXbWTZWm_bZ5lMj3CDJpqvR1UGEglMN1I"}'::jsonb,
        body:='{"action": "batch_decode", "batch_size": 5}'::jsonb
    ) as request_id;
  $$
);

-- Create a second cron job for nights and weekends (more frequent)
SELECT cron.schedule(
  'vin-decoder-off-hours',
  '*/10 * * * *', -- Every 10 minutes
  $$
  -- Only run during non-business hours
  SELECT CASE
    WHEN EXTRACT(DOW FROM now()) IN (0, 6) OR -- Weekend (Sunday=0, Saturday=6)
         EXTRACT(HOUR FROM now()) NOT BETWEEN 11 AND 23 -- Outside business hours
    THEN
      net.http_post(
          url:='https://urdkaedsfnscgtyvcwlf.supabase.co/functions/v1/vin-decoder',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDA4NzgwNSwiZXhwIjoyMDY5NjYzODA1fQ.DMIGkSiYLBQXbWTZWm_bZ5lMj3CDJpqvR1UGEglMN1I"}'::jsonb,
          body:='{"action": "batch_decode", "batch_size": 10}'::jsonb
      )
    ELSE NULL
  END as request_id;
  $$
);