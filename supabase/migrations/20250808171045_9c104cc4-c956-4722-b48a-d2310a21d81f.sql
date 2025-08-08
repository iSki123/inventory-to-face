-- Remove the VIN decoding cron jobs
SELECT cron.unschedule('vin-decoder-business-hours');
SELECT cron.unschedule('vin-decoder-off-hours');