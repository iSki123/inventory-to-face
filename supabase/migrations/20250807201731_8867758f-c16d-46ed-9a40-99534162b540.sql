-- Add AI image generation tracking fields to vehicles table
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS ai_images_generated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_image_generation_requested_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS ai_image_generation_completed_at timestamp with time zone;