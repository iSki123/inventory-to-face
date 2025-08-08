-- Create settings table for site-wide configurations
CREATE TABLE IF NOT EXISTS public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for site settings (only admins can manage)
CREATE POLICY "Admins can view site settings" 
ON public.site_settings 
FOR SELECT 
USING (get_current_user_role() = ANY (ARRAY['owner'::text, 'admin'::text]));

CREATE POLICY "Admins can manage site settings" 
ON public.site_settings 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['owner'::text, 'admin'::text]));

-- Add trigger for updated_at
CREATE TRIGGER update_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default setting for AI image generation (enabled by default)
INSERT INTO public.site_settings (setting_key, setting_value)
VALUES ('ai_image_generation_enabled', '{"enabled": true}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;