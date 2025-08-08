-- Enable real-time functionality for vehicles table
ALTER TABLE public.vehicles REPLICA IDENTITY FULL;

-- Add vehicles table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicles;