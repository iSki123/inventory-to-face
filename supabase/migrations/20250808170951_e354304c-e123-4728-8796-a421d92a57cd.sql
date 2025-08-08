-- Set up automated VIN decoding cron job
-- This will run every 30 minutes during business hours (9 AM - 6 PM EST)
-- and every 10 minutes during off hours

-- First enable the required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the VIN decoding cron job
SELECT cron.schedule(
  'vin-decoder-business-hours',
  '*/30 9-18 * * 1-5', -- Every 30 minutes, 9 AM to 6 PM, Monday to Friday
  $$
  SELECT
    net.http_post(
        url:='https://urdkaedsfnscgtyvcwlf.supabase.co/functions/v1/vin-decoder',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc4MDUsImV4cCI6MjA2OTY2MzgwNX0.Ho4_1O_3QVzQG7102sjrsv60dOyH9IfsERnB0FVmYrQ"}'::jsonb,
        body:='{"action": "batch_decode", "batch_size": 5}'::jsonb
    ) as request_id;
  $$
);

-- Create the off-hours VIN decoding cron job (evenings, nights, weekends)
SELECT cron.schedule(
  'vin-decoder-off-hours',
  '*/10 * * * *', -- Every 10 minutes
  $$
  SELECT
    CASE 
      WHEN EXTRACT(hour FROM NOW() AT TIME ZONE 'America/New_York') BETWEEN 9 AND 18 
           AND EXTRACT(dow FROM NOW()) BETWEEN 1 AND 5 
      THEN NULL -- Skip during business hours on weekdays
      ELSE
        net.http_post(
            url:='https://urdkaedsfnscgtyvcwlf.supabase.co/functions/v1/vin-decoder',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZGthZWRzZm5zY2d0eXZjd2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc4MDUsImV4cCI6MjA2OTY2MzgwNX0.Ho4_1O_3QVzQG7102sjrsv60dOyH9IfsERnB0FVmYrQ"}'::jsonb,
            body:='{"action": "batch_decode", "batch_size": 10}'::jsonb
        )
    END as request_id;
  $$
);