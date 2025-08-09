-- Add custom AI description prompt field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN custom_ai_description_prompt text;