-- Fix security definer function by adding search_path
CREATE OR REPLACE FUNCTION public.deduct_credit_and_update_vehicle(
  p_vehicle_id UUID,
  p_user_id UUID,
  p_facebook_post_id TEXT,
  p_update_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_credits INTEGER;
  updated_vehicle RECORD;
  result JSONB;
BEGIN
  -- Start transaction (implicit in function)
  
  -- Get current credits with row lock to prevent race conditions
  SELECT credits INTO current_credits 
  FROM public.profiles 
  WHERE user_id = p_user_id 
  FOR UPDATE;
  
  -- Check if user has sufficient credits
  IF current_credits IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
  
  IF current_credits < 1 THEN
    RAISE EXCEPTION 'insufficient credits';
  END IF;
  
  -- Deduct 1 credit
  UPDATE public.profiles 
  SET credits = credits - 1, updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Update vehicle with the provided data
  UPDATE public.vehicles 
  SET 
    facebook_post_status = (p_update_data->>'facebook_post_status')::text,
    facebook_post_id = p_facebook_post_id,
    last_posted_at = (p_update_data->>'last_posted_at')::timestamp with time zone,
    updated_at = (p_update_data->>'updated_at')::timestamp with time zone
  WHERE id = p_vehicle_id AND user_id = p_user_id
  RETURNING * INTO updated_vehicle;
  
  -- Check if vehicle was actually updated
  IF updated_vehicle IS NULL THEN
    RAISE EXCEPTION 'Vehicle not found or access denied';
  END IF;
  
  -- Get updated credits count
  SELECT credits INTO current_credits 
  FROM public.profiles 
  WHERE user_id = p_user_id;
  
  -- Return both vehicle data and credits
  SELECT jsonb_build_object(
    'vehicle', to_jsonb(updated_vehicle),
    'credits', current_credits
  ) INTO result;
  
  RETURN result;
END;
$$;