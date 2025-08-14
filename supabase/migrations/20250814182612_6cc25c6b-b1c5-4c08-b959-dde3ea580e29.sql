-- Create storage bucket for AI-generated vehicle images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('ai-vehicle-images', 'ai-vehicle-images', true);

-- Create RLS policies for the bucket
CREATE POLICY "Anyone can view AI vehicle images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'ai-vehicle-images');

CREATE POLICY "Service role can insert AI vehicle images" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'ai-vehicle-images');