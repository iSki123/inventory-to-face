-- Create console logs table for debugging extension activity
CREATE TABLE public.console_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  log_level TEXT NOT NULL CHECK (log_level IN ('log', 'info', 'warn', 'error', 'debug')),
  message TEXT NOT NULL,
  data JSONB,
  url TEXT,
  source TEXT NOT NULL CHECK (source IN ('extension', 'content_script', 'background_script', 'webapp')),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.console_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own console logs" 
ON public.console_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own console logs" 
ON public.console_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all console logs" 
ON public.console_logs 
FOR SELECT 
USING (get_current_user_role() = ANY (ARRAY['owner'::text, 'admin'::text]));

-- Create index for better performance
CREATE INDEX idx_console_logs_user_timestamp ON public.console_logs (user_id, timestamp DESC);
CREATE INDEX idx_console_logs_session ON public.console_logs (session_id, timestamp DESC);
CREATE INDEX idx_console_logs_level ON public.console_logs (log_level, timestamp DESC);

-- Add console logging enabled setting to site_settings
INSERT INTO public.site_settings (setting_key, setting_value) 
VALUES ('console_logging_enabled', 'false'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;