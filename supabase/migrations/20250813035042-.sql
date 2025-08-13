-- Check and fix the deduct_credit_and_update_vehicle function
-- The issue is that it's deducting credits but not updating vehicle status properly

CREATE OR REPLACE FUNCTION public.deduct_credit_and_update_vehicle(p_vehicle_id uuid, p_user_id uuid, p_facebook_post_id text, p_update_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  current_credits INTEGER;
  updated_vehicle RECORD;
  result JSONB;
  actual_user_id UUID;
BEGIN
  -- Get the actual user ID from auth context if p_user_id is null
  IF p_user_id IS NULL THEN
    actual_user_id := auth.uid();
  ELSE
    actual_user_id := p_user_id;
  END IF;
  
  -- Log for debugging
  RAISE LOG 'deduct_credit_and_update_vehicle called with vehicle_id: %, user_id: %, facebook_post_id: %', 
    p_vehicle_id, actual_user_id, p_facebook_post_id;
  
  -- Start transaction (implicit in function)
  
  -- Get current credits with row lock to prevent race conditions
  SELECT credits INTO current_credits 
  FROM public.profiles 
  WHERE user_id = actual_user_id 
  FOR UPDATE;
  
  -- Check if user has sufficient credits
  IF current_credits IS NULL THEN
    RAISE EXCEPTION 'User profile not found for user_id: %', actual_user_id;
  END IF;
  
  IF current_credits < 1 THEN
    RAISE EXCEPTION 'insufficient credits';
  END IF;
  
  -- Deduct 1 credit
  UPDATE public.profiles 
  SET credits = credits - 1, updated_at = now()
  WHERE user_id = actual_user_id;
  
  RAISE LOG 'Credits deducted successfully for user: %', actual_user_id;
  
  -- Update vehicle with the provided data
  UPDATE public.vehicles 
  SET 
    facebook_post_status = COALESCE((p_update_data->>'facebook_post_status')::text, facebook_post_status),
    facebook_post_id = COALESCE(p_facebook_post_id, facebook_post_id),
    last_posted_at = COALESCE((p_update_data->>'last_posted_at')::timestamp with time zone, last_posted_at),
    updated_at = COALESCE((p_update_data->>'updated_at')::timestamp with time zone, now())
  WHERE id = p_vehicle_id AND user_id = actual_user_id
  RETURNING * INTO updated_vehicle;
  
  -- Check if vehicle was actually updated
  IF updated_vehicle IS NULL THEN
    RAISE EXCEPTION 'Vehicle not found or access denied. Vehicle ID: %, User ID: %', p_vehicle_id, actual_user_id;
  END IF;
  
  RAISE LOG 'Vehicle updated successfully: %, status: %', updated_vehicle.id, updated_vehicle.facebook_post_status;
  
  -- Get updated credits count
  SELECT credits INTO current_credits 
  FROM public.profiles 
  WHERE user_id = actual_user_id;
  
  -- Return both vehicle data and credits
  SELECT jsonb_build_object(
    'vehicle', to_jsonb(updated_vehicle),
    'credits', current_credits
  ) INTO result;
  
  RETURN result;
END;
$function$