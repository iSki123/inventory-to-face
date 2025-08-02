-- Create a table for scraped vehicle sources
CREATE TABLE public.vehicle_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dealership_name TEXT NOT NULL,
  website_url TEXT NOT NULL,
  octoparse_task_id TEXT,
  last_scraped_at TIMESTAMP WITH TIME ZONE,
  scraping_enabled BOOLEAN NOT NULL DEFAULT true,
  scraping_frequency INTEGER NOT NULL DEFAULT 24, -- hours
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, website_url)
);

-- Enable RLS
ALTER TABLE public.vehicle_sources ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own vehicle sources" 
ON public.vehicle_sources 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vehicle sources" 
ON public.vehicle_sources 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vehicle sources" 
ON public.vehicle_sources 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vehicle sources" 
ON public.vehicle_sources 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create table for Facebook posting jobs
CREATE TABLE public.facebook_posting_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retrying')),
  facebook_post_id TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.facebook_posting_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own posting jobs" 
ON public.facebook_posting_jobs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own posting jobs" 
ON public.facebook_posting_jobs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posting jobs" 
ON public.facebook_posting_jobs 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_vehicle_sources_updated_at
BEFORE UPDATE ON public.vehicle_sources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_facebook_posting_jobs_updated_at
BEFORE UPDATE ON public.facebook_posting_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for better performance
CREATE INDEX idx_vehicle_sources_user_id ON public.vehicle_sources(user_id);
CREATE INDEX idx_facebook_posting_jobs_user_id ON public.facebook_posting_jobs(user_id);
CREATE INDEX idx_facebook_posting_jobs_status ON public.facebook_posting_jobs(status);
CREATE INDEX idx_facebook_posting_jobs_scheduled_at ON public.facebook_posting_jobs(scheduled_at);